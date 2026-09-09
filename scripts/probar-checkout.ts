/**
 * Crea una orden real contra la API de MercadoPago y verifica que la
 * preferencia quede bien armada: el total lo calcula el servidor, los items son
 * las fotos elegidas, y la orden nace PENDIENTE.
 *
 *   npx tsx --conditions=react-server --env-file=.env scripts/probar-checkout.ts
 */
import { db } from "../src/lib/db";
import { OrderStatus } from "../src/lib/orders";

const BASE = "http://localhost:3000";

const resultados: [string, boolean, string?][] = [];
function check(nombre: string, ok: boolean, detalle?: string) {
  resultados.push([nombre, ok, detalle]);
}

async function main() {
  const fotos = await db.photo.findMany({
    take: 3,
    select: { id: true, code: true, event: { select: { priceArs: true, title: true } } },
  });
  if (fotos.length < 3) throw new Error("Hacen falta al menos 3 fotos cargadas");

  const esperado = fotos.reduce((s, f) => s + f.event.priceArs, 0);

  const res = await fetch(`${BASE}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "comprador@ejemplo.com",
      photoIds: fotos.map((f) => f.id),
    }),
  });
  const data = await res.json();

  check("el checkout responde bien", res.ok, `HTTP ${res.status} ${data.error ?? ""}`);
  if (!res.ok) return imprimir();

  check(
    "MercadoPago devolvió un link de pago",
    typeof data.checkoutUrl === "string" && data.checkoutUrl.includes("mercadopago"),
    data.checkoutUrl?.slice(0, 60),
  );

  const orden = await db.order.findUnique({
    where: { token: data.token },
    include: { items: true },
  });

  check("la orden quedó guardada", orden !== null);
  check("nace PENDIENTE", orden?.status === OrderStatus.PENDING, orden?.status);
  check("tiene las 3 fotos", orden?.items.length === 3, `${orden?.items.length}`);
  check(
    "el total lo calculó el servidor",
    orden?.totalArs === esperado,
    `${orden?.totalArs} vs ${esperado} esperado`,
  );
  check("quedó atada a la preferencia de MP", Boolean(orden?.mpPreferenceId));

  // Lo que sostiene el negocio: mandar un precio desde el navegador no cambia nada.
  const conPrecioFalso = await fetch(`${BASE}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "vivo@ejemplo.com",
      photoIds: [fotos[0].id],
      priceArs: 1,
      totalArs: 1,
    }),
  });
  const dataFalso = await conPrecioFalso.json();
  const ordenFalsa = await db.order.findUnique({ where: { token: dataFalso.token } });
  check(
    "mandar un precio falso no lo cambia",
    ordenFalsa?.totalArs === fotos[0].event.priceArs,
    `${ordenFalsa?.totalArs} (precio real ${fotos[0].event.priceArs})`,
  );

  // Y no se puede comprar una foto que no existe.
  const inventada = await fetch(`${BASE}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "x@ejemplo.com", photoIds: ["no-existe"] }),
  });
  check("rechaza fotos inexistentes", inventada.status === 400, `HTTP ${inventada.status}`);

  console.log(`\nLink para pagar a mano:\n${data.checkoutUrl}\n`);
  console.log(`Orden: ${BASE}/compra/${data.token}\n`);

  imprimir();
}

function imprimir() {
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
