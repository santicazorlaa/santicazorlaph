/**
 * Diagnostica por qué una orden pagada no se acreditó sola.
 *
 *   npx tsx --conditions=react-server --env-file=.env scripts/diagnosticar-webhook.ts
 */
import { db } from "../src/lib/db";

const TOKEN = process.env.MP_ACCESS_TOKEN ?? "";

async function main() {
  const orden = await db.order.findFirst({
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });
  if (!orden) throw new Error("No hay ordenes");

  console.log("=== ORDEN ===");
  console.log(`  id:        ${orden.id}`);
  console.log(`  estado:    ${orden.status}`);
  console.log(`  total:     $${orden.totalArs}`);
  console.log(`  email:     ${orden.email}`);
  console.log(`  pref MP:   ${orden.mpPreferenceId}`);
  console.log(`  creada:    ${orden.createdAt.toISOString()}`);

  // ¿MercadoPago tiene el pago?
  const busq = await fetch(
    `https://api.mercadopago.com/v1/payments/search?external_reference=${orden.id}`,
    { headers: { Authorization: `Bearer ${TOKEN}` } },
  );
  const pagos = (await busq.json()).results ?? [];
  console.log("\n=== PAGOS EN MERCADOPAGO ===");
  if (pagos.length === 0) console.log("  ninguno");
  for (const p of pagos) {
    console.log(`  ${p.id} · ${p.status} · $${p.transaction_amount}`);
  }

  // ¿A dónde le dijimos a MercadoPago que avise?
  if (orden.mpPreferenceId) {
    const pref = await fetch(
      `https://api.mercadopago.com/checkout/preferences/${orden.mpPreferenceId}`,
      { headers: { Authorization: `Bearer ${TOKEN}` } },
    );
    const p = await pref.json();
    console.log("\n=== A DONDE AVISA MERCADOPAGO ===");
    console.log(`  notification_url: ${p.notification_url ?? "(ninguna)"}`);
    console.log(`  back success:     ${p.back_urls?.success ?? "(ninguna)"}`);

    // Lo importante: ¿esa direccion responde a un POST, o redirige?
    if (p.notification_url) {
      const r = await fetch(p.notification_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "payment", data: { id: "1" } }),
        redirect: "manual",
      });
      console.log(`\n  POST a esa direccion -> HTTP ${r.status}`);
      if (r.status >= 300 && r.status < 400) {
        console.log(`  REDIRIGE a: ${r.headers.get("location")}`);
        console.log(
          "  => MercadoPago no sigue redirecciones en los avisos: el aviso se pierde",
        );
      } else if (r.status === 401) {
        console.log("  => llega bien (401 es correcto: el aviso de prueba no va firmado)");
      }
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
