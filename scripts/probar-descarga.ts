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

  // Los dos chequeos que siguen tienen que andar igual con R2 que con el disco
  // local, y cada uno firma distinto: R2 usa X-Amz-Signature y el disco usa sig.
  const url: string = pagada.body.url ?? "";

  const firmado = await pedirDescarga(orden.token, comprada.id);
  const urlValida: string = firmado.body.url ?? url;
  const res = await fetch(urlValida);
  resultados.push(["el link recien emitido sirve", res.status === 200, `${res.status}`]);

  const manipulada = new URL(urlValida);
  const campoFirma = ["X-Amz-Signature", "sig"].find((c) =>
    manipulada.searchParams.has(c),
  );
  if (!campoFirma) {
    resultados.push(["encontro la firma en el link", false, urlValida.slice(0, 80)]);
  } else {
    // Cambiamos un solo caracter de la firma: tiene que alcanzar para invalidarla.
    const original = manipulada.searchParams.get(campoFirma)!;
    manipulada.searchParams.set(
      campoFirma,
      (original[0] === "a" ? "b" : "a") + original.slice(1),
    );
    const resManipulado = await fetch(manipulada.toString());
    const cuerpo = await resManipulado.arrayBuffer();
    resultados.push([
      `firma manipulada no sirve (${campoFirma})`,
      !resManipulado.ok || cuerpo.byteLength === 0,
      `${resManipulado.status}`,
    ]);
  }

  // Para el vencimiento pedimos un link que dure un segundo y esperamos.
  const { signedDownloadUrl } = await import("../src/lib/storage");
  const fotoComprada = await db.photo.findUnique({
    where: { id: comprada.id },
    select: { originalKey: true },
  });
  const urlCorta = await signedDownloadUrl(fotoComprada!.originalKey, "prueba.jpg", 1);
  await new Promise((r) => setTimeout(r, 2500));
  const resVencido = await fetch(urlCorta);
  const cuerpoVencido = await resVencido.arrayBuffer();
  resultados.push([
    "link vencido no sirve",
    !resVencido.ok || cuerpoVencido.byteLength === 0,
    `${resVencido.status}`,
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
