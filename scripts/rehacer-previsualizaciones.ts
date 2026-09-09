/**
 * Vuelve a generar la miniatura y la vista ampliada de fotos que ya están
 * subidas, partiendo del original que sigue guardado en el bucket privado.
 *
 * Hace falta cada vez que se cambia algo del procesamiento —la intensidad de la
 * marca de agua, el tamaño o la calidad de la previsualización—, porque esos
 * cambios sólo se aplican solos a las fotos que se suben después. Las que ya
 * estaban se quedan como estaban hasta que se corre esto.
 *
 * No toca el original. Sí escribe los dos archivos públicos en una dirección
 * nueva y actualiza la base para que apunte ahí, borrando después los viejos.
 *
 * Eso no es un capricho: las fotos se publican con `Cache-Control` de un año y
 * marcadas `immutable`, que es lo correcto para algo que nunca cambia. Pisar el
 * mismo archivo deja al CDN de Cloudflare —y a cualquier navegador que ya la
 * haya visto— sirviendo la versión vieja durante meses. Con una dirección nueva
 * el cambio se ve al instante y sin purgar ningún caché.
 *
 *   # ver qué haría, sin escribir nada
 *   npx tsx --conditions=react-server --env-file=.env scripts/rehacer-previsualizaciones.ts
 *
 *   # hacerlo de verdad, para todo el sitio
 *   npx tsx --conditions=react-server --env-file=.env scripts/rehacer-previsualizaciones.ts --aplicar
 *
 *   # hacerlo sólo para un partido
 *   npx tsx --conditions=react-server --env-file=.env scripts/rehacer-previsualizaciones.ts --aplicar --partido=bayern-vs-drink-7
 */
import { db } from "../src/lib/db";
import { deleteObject, getObject, putObject } from "../src/lib/storage";
import { formatBytes, processPhoto } from "../src/lib/watermark";

/// Del original `originales/<evento>/<objeto>.jpg` saca las dos partes que
/// hacen falta para armar las direcciones nuevas.
function partes(originalKey: string) {
  const m = /^originales\/([^/]+)\/([^/]+)\.jpg$/.exec(originalKey);
  return m ? { evento: m[1], objeto: m[2] } : null;
}

/// Un sello corto para que la dirección nueva no choque con la vieja.
const SELLO = Date.now().toString(36);

const args = process.argv.slice(2);
const aplicar = args.includes("--aplicar");
const partido = args.find((a) => a.startsWith("--partido="))?.split("=")[1];

async function main() {
  const fotos = await db.photo.findMany({
    where: partido ? { event: { slug: partido } } : undefined,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      code: true,
      originalKey: true,
      previewKey: true,
      thumbKey: true,
      event: { select: { title: true, slug: true } },
    },
  });

  if (fotos.length === 0) {
    console.log(
      partido
        ? `No hay fotos en el partido "${partido}". ¿Está bien escrito el slug?`
        : "No hay fotos cargadas.",
    );
    return;
  }

  console.log(
    `${fotos.length} foto(s) a rehacer${partido ? ` del partido "${partido}"` : ""}.`,
  );
  if (!aplicar) {
    console.log("Ensayo: no se escribe nada. Agregá --aplicar para hacerlo en serio.\n");
  }
  console.log("");

  let hechas = 0;
  let falladas = 0;
  let antes = 0;
  let despues = 0;

  for (const [i, foto] of fotos.entries()) {
    const etiqueta = `[${i + 1}/${fotos.length}] #${foto.code} (${foto.event.title})`;

    try {
      const original = await getObject("private", foto.originalKey);

      // Cuánto pesaba lo que había, para poder comparar al final.
      const previos = await Promise.all([
        getObject("public", foto.previewKey).catch(() => null),
        getObject("public", foto.thumbKey).catch(() => null),
      ]);
      antes += previos.reduce((t, b) => t + (b?.byteLength ?? 0), 0);

      const nueva = await processPhoto(original);
      despues += nueva.preview.byteLength + nueva.thumb.byteLength;

      const p = partes(foto.originalKey);
      if (!p) throw new Error(`No entiendo la dirección del original: ${foto.originalKey}`);
      const previewKey = `preview/${p.evento}/${p.objeto}.${SELLO}.jpg`;
      const thumbKey = `thumb/${p.evento}/${p.objeto}.${SELLO}.jpg`;

      if (aplicar) {
        await Promise.all([
          putObject("public", previewKey, nueva.preview, "image/jpeg"),
          putObject("public", thumbKey, nueva.thumb, "image/jpeg"),
        ]);

        // Recién con los archivos nuevos arriba se mueve la base. Si algo falla
        // antes de esto, la foto sigue mostrando la versión vieja y no se rompe.
        await db.photo.update({
          where: { id: foto.id },
          data: { previewKey, thumbKey },
        });

        // Y recién con la base apuntando al archivo nuevo se borra el viejo.
        for (const vieja of [foto.previewKey, foto.thumbKey]) {
          if (vieja !== previewKey && vieja !== thumbKey) {
            await deleteObject("public", vieja).catch(() => {});
          }
        }
      }

      hechas++;
      console.log(
        `${etiqueta}: ${formatBytes(nueva.preview.byteLength + nueva.thumb.byteLength)}`,
      );
    } catch (error) {
      falladas++;
      const motivo = error instanceof Error ? error.message : String(error);
      console.log(`${etiqueta}: FALLÓ — ${motivo}`);
    }
  }

  console.log("");
  console.log(`Rehechas: ${hechas}${falladas ? ` · Fallaron: ${falladas}` : ""}`);
  if (antes > 0) {
    const ahorro = Math.round((1 - despues / antes) * 100);
    console.log(`Peso publicado: ${formatBytes(antes)} → ${formatBytes(despues)} (${ahorro}% menos)`);
  }
  if (!aplicar) {
    console.log("\nFue un ensayo. Nada de esto se escribió todavía.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
