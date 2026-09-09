/**
 * Busca en MercadoPago los pagos de una orden y corre la misma confirmación que
 * dispara el webhook. Sirve para probar en local, donde MercadoPago no puede
 * avisarnos porque localhost no es alcanzable desde internet.
 *
 *   npx tsx --conditions=react-server --env-file=.env scripts/confirmar-pago.ts <token>
 */
import { db } from "../src/lib/db";
import { confirmPayment } from "../src/lib/orders";
import { OrderStatus } from "../src/lib/orders";

const BASE = "http://localhost:3000";

async function buscarPagos(orderId: string) {
  const res = await fetch(
    `https://api.mercadopago.com/v1/payments/search?external_reference=${orderId}`,
    { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` } },
  );
  const data = await res.json();
  return (data.results ?? []) as { id: number; status: string; transaction_amount: number }[];
}

async function main() {
  // Sin argumento toma la última orden creada, que es lo habitual al probar.
  const orden = process.argv[2]
    ? await db.order.findUnique({
        where: { token: process.argv[2] },
        include: { items: { select: { photoId: true } } },
      })
    : await db.order.findFirst({
        orderBy: { createdAt: "desc" },
        include: { items: { select: { photoId: true } } },
      });

  if (!orden) throw new Error("No hay ninguna orden para confirmar");
  const token = orden.token;

  console.log(`orden ${orden.id} · estado actual: ${orden.status} · $${orden.totalArs}`);

  const pagos = await buscarPagos(orden.id);
  if (pagos.length === 0) {
    console.log("\nTodavía no hay ningún pago para esta orden.");
    console.log("Completá el pago en el link de checkout y volvé a correr esto.");
    return;
  }

  for (const p of pagos) {
    console.log(`pago ${p.id} · ${p.status} · $${p.transaction_amount}`);
  }

  const aprobado = pagos.find((p) => p.status === "approved") ?? pagos[0];
  console.log(`\nconfirmando el pago ${aprobado.id}…`);

  const resultado = await confirmPayment(String(aprobado.id));
  console.log(resultado);

  const despues = await db.order.findUnique({ where: { token } });
  const resultados: [string, boolean, string?][] = [
    [
      "la orden quedó PAGADA",
      despues?.status === OrderStatus.PAID,
      despues?.status ?? "null",
    ],
    ["guardó el id del pago de MercadoPago", Boolean(despues?.mpPaymentId), despues?.mpPaymentId ?? ""],
    ["guardó la fecha de pago", despues?.paidAt !== null],
  ];

  // Y lo que importa de verdad: que ahora sí se pueda descargar.
  const res = await fetch(
    `${BASE}/api/compra/${token}/descarga?foto=${orden.items[0].photoId}`,
  );
  const data = await res.json();
  resultados.push([
    "ahora se puede descargar el original",
    res.ok && typeof data.url === "string",
    `HTTP ${res.status}`,
  ]);

  if (res.ok) {
    const archivo = await fetch(data.url);
    resultados.push([
      "el original baja completo",
      archivo.ok && Number(archivo.headers.get("content-length") ?? 0) > 0,
      `${Math.round(Number(archivo.headers.get("content-length") ?? 0) / 1024)} KB`,
    ]);
  }

  // Correr la confirmación dos veces no tiene que romper nada: MercadoPago
  // reintenta los avisos y puede mandar el mismo pago varias veces.
  const repetido = await confirmPayment(String(aprobado.id));
  resultados.push([
    "confirmar dos veces no rompe",
    repetido.ok === true,
    JSON.stringify(repetido),
  ]);

  console.log("");
  let fallos = 0;
  for (const [nombre, ok, detalle] of resultados) {
    if (!ok) fallos++;
    console.log(`${ok ? "OK  " : "FALLA"}  ${nombre}${detalle ? `  (${detalle})` : ""}`);
  }
  if (fallos > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
