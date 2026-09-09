/**
 * Borra TODAS las órdenes. Es para usar una sola vez, antes de empezar a vender
 * de verdad, y dejar el contador del panel en cero.
 *
 * Hace falta porque las compras de prueba dejan a sus fotos atadas a una orden,
 * y una foto comprada no se puede borrar —el link de descarga tiene que seguir
 * andando—, así que tampoco se puede borrar el partido de prueba.
 *
 * No lo corras si ya hay ventas reales: se lleva la orden, sus renglones y el
 * link de descarga del comprador. No se deshace.
 *
 *   # ver qué hay, sin borrar nada
 *   npx tsx --conditions=react-server --env-file=.env scripts/resetear-ventas-de-prueba.ts
 *
 *   # hacerlo
 *   npx tsx --conditions=react-server --env-file=.env scripts/resetear-ventas-de-prueba.ts --aplicar
 */
import { db } from "../src/lib/db";

const aplicar = process.argv.includes("--aplicar");

async function main() {
  const ordenes = await db.order.findMany({
    orderBy: { createdAt: "asc" },
    select: { status: true, totalArs: true, email: true, createdAt: true },
  });

  if (ordenes.length === 0) {
    console.log("No hay ninguna orden. No hay nada que hacer.");
    return;
  }

  const pagadas = ordenes.filter((o) => o.status === "PAID");
  console.log(`Órdenes: ${ordenes.length} · pagadas: ${pagadas.length}`);
  console.log(`Suma de las pagadas: ${pagadas.reduce((s, o) => s + o.totalArs, 0)}`);
  console.log(`Mails: ${[...new Set(ordenes.map((o) => o.email))].join(", ")}`);
  console.log(
    `Desde ${ordenes[0].createdAt.toISOString().slice(0, 10)} hasta ${ordenes[ordenes.length - 1].createdAt.toISOString().slice(0, 10)}`,
  );

  if (!aplicar) {
    console.log("\nEnsayo: no se borró nada. Agregá --aplicar para hacerlo en serio.");
    return;
  }

  const { count } = await db.order.deleteMany({});
  const atadas = await db.photo.count({ where: { orderItems: { some: {} } } });

  console.log(`\nBorradas: ${count} órdenes.`);
  console.log(`Fotos que siguen atadas a una compra: ${atadas}`);
  console.log("El panel debería marcar 0 ventas.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
