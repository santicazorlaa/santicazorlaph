/**
 * Busca pagos cobrados que hayan quedado sin acreditar.
 *
 * Una orden pendiente puede ser un checkout abandonado (normal: alguien se
 * arrepintió) o un pago que entró y no llegó el aviso (grave: el comprador pagó
 * y no tiene sus fotos). Esto los distingue preguntándole a MercadoPago.
 *
 * Consulta con las credenciales de prueba y con las reales, porque las órdenes
 * anteriores al cambio pertenecen a la cuenta de prueba.
 *
 *   npx tsx --conditions=react-server --env-file=.env scripts/revisar-pendientes.ts [--acreditar]
 */
import { db } from "../src/lib/db";
import { confirmPayment } from "../src/lib/orders";

const TOKENS = [
  ["prueba", process.env.MP_ACCESS_TOKEN ?? ""],
  ["real", process.env.MP_ACCESS_TOKEN_PROD ?? ""],
].filter(([, t]) => t) as [string, string][];

async function buscarPago(orderId: string) {
  for (const [cual, token] of TOKENS) {
    const r = await fetch(
      `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(orderId)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!r.ok) continue;
    const pagos = ((await r.json()).results ?? []) as { id: number; status: string }[];
    const aprobado = pagos.find((p) => p.status === "approved");
    if (aprobado) return { cuenta: cual, pago: aprobado };
    if (pagos.length > 0) return { cuenta: cual, pago: pagos[0] };
  }
  return null;
}

async function main() {
  const acreditar = process.argv.includes("--acreditar");

  const pendientes = await db.order.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { items: true } } },
  });

  console.log(`${pendientes.length} orden(es) pendiente(s)\n`);

  let cobradasSinEntregar = 0;

  for (const o of pendientes) {
    const min = Math.round((Date.now() - o.createdAt.getTime()) / 60000);
    const hallazgo = await buscarPago(o.id);

    if (!hallazgo) {
      console.log(`  abandonada   ${o.email.padEnd(26)} $${String(o.totalArs).padEnd(6)} hace ${min} min`);
      continue;
    }

    if (hallazgo.pago.status === "approved") {
      cobradasSinEntregar++;
      console.log(
        `  COBRADA      ${o.email.padEnd(26)} $${String(o.totalArs).padEnd(6)} pago ${hallazgo.pago.id} (cuenta ${hallazgo.cuenta})`,
      );
      if (acreditar) {
        const r = await confirmPayment(String(hallazgo.pago.id));
        console.log(`               -> acreditada: ${JSON.stringify(r)}`);
      }
    } else {
      console.log(
        `  ${hallazgo.pago.status.padEnd(12)} ${o.email.padEnd(26)} $${String(o.totalArs).padEnd(6)} hace ${min} min`,
      );
    }
  }

  console.log(
    cobradasSinEntregar === 0
      ? "\nOK  ningun pago cobrado quedo sin entregar"
      : `\nATENCION: ${cobradasSinEntregar} pago(s) cobrado(s) sin entregar. Correr con --acreditar para resolverlo.`,
  );
  if (cobradasSinEntregar > 0 && !acreditar) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
