/**
 * Completa el nombre del comprador en las ventas que ya están pagadas pero se
 * hicieron antes de que el sitio empezara a guardarlo (commit d78c4ca). Ese
 * dato sólo se extrae en el momento en que una orden pasa de pendiente a
 * pagada, nunca en retrospectiva, así que las ventas viejas se quedaron sin
 * nombre para siempre a menos que se corra esto una vez.
 *
 * Sólo mira órdenes pagadas con MercadoPago: las de transferencia bancaria no
 * tienen ningún pago del que sacar el nombre.
 *
 *   # ver qué completaría, sin escribir nada
 *   npx tsx --conditions=react-server --env-file=.env scripts/completar-nombres-compradores.ts
 *
 *   # completarlo de verdad
 *   npx tsx --conditions=react-server --env-file=.env scripts/completar-nombres-compradores.ts --aplicar
 */
import { db } from "../src/lib/db";
import { getPayment } from "../src/lib/mercadopago";
import { extraerNombreComprador, MetodoPago, OrderStatus } from "../src/lib/orders";

const aplicar = process.argv.includes("--aplicar");

async function main() {
  const ordenes = await db.order.findMany({
    where: {
      status: OrderStatus.PAID,
      metodoPago: MetodoPago.MERCADOPAGO,
      buyerName: null,
      mpPaymentId: { not: null },
    },
    orderBy: { paidAt: "asc" },
  });

  if (ordenes.length === 0) {
    console.log("No hay ninguna venta de MercadoPago pagada sin nombre de comprador.");
    return;
  }

  console.log(`${ordenes.length} venta(s) sin nombre de comprador.\n`);

  let completadas = 0;
  let sinNombre = 0;

  for (const orden of ordenes) {
    try {
      const payment = await getPayment(orden.mpPaymentId!);
      const buyerName = extraerNombreComprador(payment);

      if (!buyerName) {
        sinNombre++;
        console.log(`sin nombre en MercadoPago  ${orden.id}  ${orden.email}  $${orden.totalArs}`);
        continue;
      }

      console.log(
        `${aplicar ? "completando" : "completaría"}  ${orden.id}  ${orden.email}  → "${buyerName}"`,
      );

      if (aplicar) {
        await db.order.update({ where: { id: orden.id }, data: { buyerName } });
      }
      completadas++;
    } catch (e) {
      console.log(`error consultando el pago ${orden.mpPaymentId} de la orden ${orden.id}: ${e}`);
    }
  }

  console.log(
    `\n${completadas} de ${ordenes.length} completadas${sinNombre ? `, ${sinNombre} sin nombre en MercadoPago` : ""}.`,
  );
  if (!aplicar && completadas > 0) {
    console.log("Esto fue un ensayo: no se escribió nada. Volvé a correr con --aplicar.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
