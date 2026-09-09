/**
 * Verifica la regla que sostiene el negocio: sólo una orden PAGADA habilita la
 * descarga del original, y sólo de las fotos que están en esa orden.
 *
 *   npx tsx --conditions=react-server scripts/probar-descarga.ts
 */
import { db } from "../src/lib/db";
import { OrderStatus } from "../src/lib/orders";

const BASE = "http://localhost:3000";

async function pedirDescarga(token: string, photoId: string) {
  const res = await fetch(`${BASE}/api/compra/${token}/descarga?foto=${photoId}`);
  return { status: res.status, body: await res.json() };
}

async function main() {
  const fotos = await db.photo.findMany({ take: 2, select: { id: true, code: true } });
  if (fotos.length < 2) throw new Error("Hacen falta al menos 2 fotos cargadas");

  const [comprada, ajena] = fotos;

  const orden = await db.order.create({
    data: {
      token: `prueba-${Date.now()}`,
      email: "prueba@ejemplo.com",
      totalArs: 2500,
      status: OrderStatus.PENDING,
      items: { create: [{ photoId: comprada.id, priceArs: 2500 }] },
    },
  });

  const resultados: [string, boolean, string][] = [];

  const pendiente = await pedirDescarga(orden.token, comprada.id);
  resultados.push([
    "orden PENDIENTE no descarga",
    pendiente.status === 403,
    `${pendiente.status}`,
  ]);

  await db.order.update({
    where: { id: orden.id },
    data: { status: OrderStatus.PAID, paidAt: new Date() },
  });

  const pagada = await pedirDescarga(orden.token, comprada.id);
  resultados.push([
    "orden PAGADA sí descarga",
    pagada.status === 200 && typeof pagada.body.url === "string",
    `${pagada.status}`,
  ]);

  const otraFoto = await pedirDescarga(orden.token, ajena.id);
  resultados.push([
    "foto fuera de la orden no descarga",
    otraFoto.status === 403,
    `${otraFoto.status}`,
  ]);

  // El link firmado tiene que caducar.
  const url: string = pagada.body.url ?? "";
  const vencido = url.replace(/expires=\d+/, `expires=${Date.now() - 1000}`);
  const resVencido = await fetch(vencido);
  resultados.push([
    "link vencido no sirve",
    resVencido.status === 403,
    `${resVencido.status}`,
  ]);

  // Y no tiene que aceptar una firma cambiada a mano.
  const manipulado = url.replace(/key=[^&]+/, "key=originales%2Fcualquier%2Fcosa.jpg");
  const resManipulado = await fetch(manipulado);
  resultados.push([
    "firma manipulada no sirve",
    resManipulado.status === 403,
    `${resManipulado.status}`,
  ]);

  await db.order.delete({ where: { id: orden.id } });

  let fallos = 0;
  for (const [nombre, ok, detalle] of resultados) {
    if (!ok) fallos++;
    console.log(`${ok ? "OK  " : "FALLA"}  ${nombre}  (${detalle})`);
  }
  if (fallos > 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
