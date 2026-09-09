/**
 * Vuelve a generar la miniatura y la vista ampliada de fotos que ya están
 * subidas, partiendo del original que sigue guardado en el bucket privado.
 *
 * Hace falta cada vez que se cambia algo del procesamiento —la intensidad de la
 * marca de agua, el tamaño o la calidad de la previsualización—, porque esos
 * cambios sólo se aplican solos a las fotos que se suben después. Las que ya
 * estaban se quedan como estaban hasta que se corre esto.
 *
 * No toca el original ni la base: reescribe los dos archivos públicos sobre la
 * misma clave, así los links que ya circulan siguen andando.
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
import { getObject, putObject } from "../src/lib/storage";
import { formatBytes, processPhoto } from "../src/lib/watermark";

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

      if (aplicar) {
        await Promise.all([
          putObject("public", foto.previewKey, nueva.preview, "image/jpeg"),
          putObject("public", foto.thumbKey, nueva.thumb, "image/jpeg"),
        ]);
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
