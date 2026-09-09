/**
 * Revisión de salud de todo el sistema en producción: sitio, base, fotos,
 * pagos, avisos de MercadoPago y envío de mails.
 *
 *   npx tsx --conditions=react-server --env-file=.env scripts/revision-general.ts
 */
import { createHmac } from "node:crypto";

import { db } from "../src/lib/db";

const SITIO = "https://www.santicazorlaph.com";
const MP = process.env.MP_ACCESS_TOKEN ?? "";
const RESEND = process.env.RESEND_API_KEY ?? "";
const SECRETO_WEBHOOK = process.env.MP_WEBHOOK_SECRET ?? "";

const filas: [string, boolean, string?][] = [];
function check(nombre: string, ok: boolean, detalle?: string) {
  filas.push([nombre, ok, detalle]);
}

async function main() {
  // --- el sitio responde ---
  const home = await fetch(SITIO);
  check("el sitio responde", home.ok, `HTTP ${home.status}`);

  const apex = await fetch("https://santicazorlaph.com", { redirect: "manual" });
  check(
    "el dominio sin www lleva al sitio",
    apex.status === 308 || apex.ok,
    `HTTP ${apex.status}`,
  );

  // --- las fotos se sirven desde el CDN ---
  const foto = await db.photo.findFirst({
    where: { event: { published: true } },
    select: { thumbKey: true, originalKey: true },
  });
  if (foto) {
    const cdn = await fetch(`https://fotos.santicazorlaph.com/${foto.thumbKey}`);
    check("las fotos cargan desde el CDN", cdn.ok, `HTTP ${cdn.status}`);

    // El original NO tiene que ser alcanzable por el CDN publico.
    const fuga = await fetch(`https://fotos.santicazorlaph.com/${foto.originalKey}`);
    check("los originales NO estan en el CDN publico", !fuga.ok, `HTTP ${fuga.status}`);
  }

  // --- avisos de MercadoPago ---
  const sinFirma = await fetch(`${SITIO}/api/webhooks/mercadopago`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "payment", data: { id: "1" } }),
    redirect: "manual",
  });
  check("el aviso sin firma se rechaza", sinFirma.status === 401, `HTTP ${sinFirma.status}`);
  check("la direccion de aviso no redirige", sinFirma.status !== 308);

  if (SECRETO_WEBHOOK) {
    const id = "1";
    const req = "salud-" + Date.now();
    const ts = Math.floor(Date.now() / 1000);
    const v1 = createHmac("sha256", SECRETO_WEBHOOK)
      .update(`id:${id};request-id:${req};ts:${ts};`)
      .digest("hex");
    const firmado = await fetch(`${SITIO}/api/webhooks/mercadopago`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-signature": `ts=${ts},v1=${v1}`,
        "x-request-id": req,
      },
      body: JSON.stringify({ type: "payment", data: { id } }),
    });
    check("el aviso firmado se acepta", firmado.status !== 401, `HTTP ${firmado.status}`);
  }

  // --- panel protegido ---
  const panel = await fetch(`${SITIO}/admin`, { redirect: "manual" });
  check("el panel pide contraseña", panel.status === 307, `HTTP ${panel.status}`);

  const subida = await fetch(`${SITIO}/api/admin/subir/autorizar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId: "x", contentType: "image/jpeg", size: 1 }),
  });
  check("no se puede subir sin sesion", subida.status === 401, `HTTP ${subida.status}`);

  // --- ordenes ---
  const ordenes = await db.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { _count: { select: { items: true } } },
  });
  console.log("=== ULTIMAS ORDENES ===");
  for (const o of ordenes) {
    const cuando = (o.paidAt ?? o.createdAt).toISOString().slice(0, 16).replace("T", " ");
    console.log(
      `  ${o.status.padEnd(8)} $${String(o.totalArs).padEnd(6)} ${o._count.items} foto(s)  ${cuando}  ${o.email}`,
    );
  }

  const pendientesViejas = ordenes.filter(
    (o) => o.status === "PENDING" && Date.now() - o.createdAt.getTime() > 30 * 60 * 1000,
  );
  check(
    "no hay pagos cobrados sin acreditar",
    pendientesViejas.length === 0,
    `${pendientesViejas.length} pendientes de mas de 30 min`,
  );

  // --- descarga de una compra pagada ---
  const pagada = await db.order.findFirst({
    where: { status: "PAID" },
    orderBy: { paidAt: "desc" },
    include: { items: { select: { photoId: true } } },
  });
  if (pagada) {
    const r = await fetch(
      `${SITIO}/api/compra/${pagada.token}/descarga?foto=${pagada.items[0].photoId}`,
    );
    const data = await r.json();
    check("una compra pagada puede descargar", r.ok && Boolean(data.url), `HTTP ${r.status}`);
    if (r.ok) {
      const archivo = await fetch(data.url);
      const kb = Math.round(Number(archivo.headers.get("content-length") ?? 0) / 1024);
      check("el original baja completo", archivo.ok && kb > 0, `${kb} KB`);
    }
  }

  const falsa = await fetch(`${SITIO}/api/compra/inventado/descarga?foto=x`);
  check("un token inventado no descarga", falsa.status === 403, `HTTP ${falsa.status}`);

  // --- mails ---
  if (RESEND) {
    const dom = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${RESEND}` },
    });
    const d = await dom.json();
    const verificado = (d.data ?? []).find(
      (x: { name: string; status: string }) => x.name === "santicazorlaph.com",
    );
    check(
      "el dominio de mail esta verificado",
      verificado?.status === "verified",
      verificado?.status ?? "no encontrado",
    );
  }

  // --- MercadoPago: que credenciales estan activas ---
  const yo = await fetch("https://api.mercadopago.com/users/me", {
    headers: { Authorization: `Bearer ${MP}` },
  }).then((r) => r.json());
  const esPrueba = (yo.tags ?? []).includes("test_user");
  console.log(`\n=== MERCADOPAGO ===`);
  console.log(`  cuenta: ${yo.nickname}  ${esPrueba ? "(DE PRUEBA)" : "(REAL)"}`);

  console.log("\n=== REVISION ===");
  let fallos = 0;
  for (const [n, ok, det] of filas) {
    if (!ok) fallos++;
    console.log(`${ok ? "OK  " : "FALLA"}  ${n}${det ? `  (${det})` : ""}`);
  }
  console.log(`\n${fallos === 0 ? "todo en orden" : `${fallos} para revisar`}`);
  if (fallos > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
