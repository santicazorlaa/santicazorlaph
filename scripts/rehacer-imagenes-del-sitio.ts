/**
 * Vuelve a generar las imágenes limpias del sitio —la tapa del encabezado, el
 * retrato de "quién soy" y las fotos del portfolio— partiendo del archivo
 * original, que sigue guardado en el bucket privado.
 *
 * Hace falta cada vez que cambia la medida o la calidad con la que se publican,
 * porque ese cambio sólo se aplica solo a lo que se suba después. Fue el caso
 * en septiembre de 2026: la tapa salía a 1000 px de ancho y en cualquier
 * monitor de escritorio se estiraba a más del doble, así que se veía borrosa.
 *
 * Igual que con las previsualizaciones, cada imagen se escribe en una dirección
 * nueva y recién después se borra la vieja. Lo público se publica con caché de
 * un año y marcado `immutable`: pisar el mismo archivo dejaría al CDN sirviendo
 * la versión vieja durante meses.
 *
 *   # ver qué haría, sin escribir nada
 *   npx tsx --conditions=react-server --env-file=.env scripts/rehacer-imagenes-del-sitio.ts
 *
 *   # hacerlo de verdad
 *   npx tsx --conditions=react-server --env-file=.env scripts/rehacer-imagenes-del-sitio.ts --aplicar
 */
import { db } from "../src/lib/db";
import { guardarContenido, leerContenido } from "../src/lib/contenido";
import { deleteObject, getObject, putObject } from "../src/lib/storage";
import { leerEncuadre, TAPA_CELULAR, TAPA_ESCRITORIO } from "../src/lib/encuadre";
import { procesarPortfolio, renderRetrato, renderTapa } from "../src/lib/watermark";

const aplicar = process.argv.includes("--aplicar");
const SELLO = Date.now().toString(36);

async function rehacer(
  etiqueta: string,
  origenKey: string,
  destino: string,
  render: (b: Buffer) => Promise<Buffer>,
) {
  const original = await getObject("private", origenKey);
  const nueva = await render(original);
  if (aplicar) await putObject("public", destino, nueva, "image/jpeg");
  console.log(`${etiqueta}: ${destino} (${Math.round(nueva.length / 1024)} KB)`);
}

async function main() {
  const contenido = await leerContenido();

  // La tapa y el retrato. Sólo se pueden rehacer si quedó guardado de dónde
  // salieron: las que se subieron antes de que el panel guardara el origen hay
  // que volver a elegirlas a mano, una sola vez.
  //
  // La tapa son dos, con el recorte que Santi acomodó para cada pantalla.
  for (const [nombre, claveFoto, claveOrigen, render] of [
    [
      "Tapa (computadora)",
      "hero.fotoKey",
      "hero.origenKey",
      (b: Buffer) =>
        renderTapa(b, TAPA_ESCRITORIO, leerEncuadre(contenido["hero.encuadreEscritorio"])),
    ],
    [
      "Tapa (celular)",
      "hero.fotoKeyCelular",
      "hero.origenKey",
      (b: Buffer) => renderTapa(b, TAPA_CELULAR, leerEncuadre(contenido["hero.encuadreCelular"])),
    ],
    ["Retrato", "sobre.fotoKey", "sobre.origenKey", renderRetrato],
  ] as const) {
    const origen = contenido[claveOrigen];
    const actual = contenido[claveFoto];
    // Se mira el origen, no la imagen publicada: el recorte de celular puede
    // no existir todavía —es más nuevo que la tapa— y esta es justamente la
    // corrida que lo crea.
    if (!origen && !actual) {
      console.log(`${nombre}: no hay ninguna elegida.`);
      continue;
    }
    if (!origen) {
      console.log(
        `${nombre}: no se puede rehacer, no quedó guardado el archivo de origen. ` +
          `Volvé a elegirla desde el panel y queda lista para siempre.`,
      );
      continue;
    }

    const destino = `sitio/${claveFoto.replace(".", "-")}.${SELLO}.jpg`;
    await rehacer(nombre, origen, destino, render);
    if (aplicar) {
      await guardarContenido({ [claveFoto]: destino });
      if (actual && actual !== destino && actual.startsWith("sitio/")) {
        await deleteObject("public", actual).catch(() => {});
      }
    }
  }

  const portfolio = await db.portfolioPhoto.findMany({
    select: { id: true, originalKey: true, key: true, thumbKey: true },
  });
  console.log(`
Portfolio: ${portfolio.length} fotos`);

  for (const foto of portfolio) {
    const etiqueta = `  #${foto.id.slice(-6)}`;
    try {
      const original = await getObject("private", foto.originalKey);
      const hecha = await procesarPortfolio(original);

      const key = `portfolio/${foto.id}.${SELLO}.jpg`;
      const thumbKey = `portfolio/${foto.id}.${SELLO}-chica.jpg`;
      console.log(`${etiqueta}: ${Math.round(hecha.grande.length / 1024)} KB + ${Math.round(hecha.thumb.length / 1024)} KB`);

      if (aplicar) {
        await putObject("public", key, hecha.grande, "image/jpeg");
        await putObject("public", thumbKey, hecha.thumb, "image/jpeg");
        await db.portfolioPhoto.update({
          where: { id: foto.id },
          data: { key, thumbKey, width: hecha.width, height: hecha.height },
        });
        for (const vieja of [foto.key, foto.thumbKey]) {
          if (vieja && vieja !== key && vieja !== thumbKey) {
            await deleteObject("public", vieja).catch(() => {});
          }
        }
      }
    } catch (error) {
      console.log(`${etiqueta}: FALLÓ — ${error instanceof Error ? error.message : error}`);
    }
  }

  if (!aplicar) console.log("\nFue un ensayo. Nada de esto se escribió todavía.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
