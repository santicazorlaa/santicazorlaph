/**
 * Cambia la dirección (el slug) de un partido.
 *
 * Ojo: la dirección vieja deja de funcionar en el momento. Si ya circula por
 * WhatsApp, cambiarla rompe el link de todos los que lo tengan. Se hace cuando
 * el partido todavía no se compartió, o asumiendo eso a sabiendas.
 *
 *   # ver las direcciones actuales
 *   npx tsx --conditions=react-server --env-file=.env scripts/cambiar-direccion.ts
 *
 *   # cambiar una
 *   npx tsx --conditions=react-server --env-file=.env scripts/cambiar-direccion.ts bayern-vs-drink-7 bayern-vs-drink --aplicar
 */
import { db } from "../src/lib/db";
import { siteUrl } from "../src/lib/env";
import { slugify } from "../src/lib/format";

const args = process.argv.slice(2).filter((a) => a !== "--aplicar");
const aplicar = process.argv.includes("--aplicar");
const [actual, pedida] = args;

async function main() {
  if (!actual || !pedida) {
    const eventos = await db.event.findMany({
      select: { title: true, slug: true, published: true },
      orderBy: { date: "desc" },
    });
    console.log("Direcciones actuales:\n");
    for (const e of eventos) {
      console.log(`  ${e.slug}   ${e.title}${e.published ? "" : "  (borrador)"}`);
    }
    console.log("\nPara cambiar una: ... <direccion-actual> <direccion-nueva> --aplicar");
    return;
  }

  const nueva = slugify(pedida);
  if (nueva !== pedida) {
    console.log(`La dirección se normaliza a "${nueva}".`);
  }
  if (!nueva) {
    console.log("Esa dirección no queda en nada usable.");
    return;
  }

  const evento = await db.event.findUnique({
    where: { slug: actual },
    select: { id: true, title: true },
  });
  if (!evento) {
    console.log(`No hay ningún partido en "${actual}".`);
    return;
  }

  const ocupada = await db.event.findUnique({
    where: { slug: nueva },
    select: { id: true, title: true },
  });
  if (ocupada && ocupada.id !== evento.id) {
    console.log(`"${nueva}" ya la usa el partido "${ocupada.title}". Elegí otra.`);
    return;
  }

  console.log(`"${evento.title}"`);
  console.log(`  antes:  ${siteUrl}/e/${actual}`);
  console.log(`  ahora:  ${siteUrl}/e/${nueva}`);

  if (!aplicar) {
    console.log("\nEnsayo: no se cambió nada. Agregá --aplicar.");
    return;
  }

  await db.event.update({ where: { id: evento.id }, data: { slug: nueva } });
  console.log("\nListo. La dirección vieja ya no responde.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
