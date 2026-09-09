/**
 * Verifica la carga manual de marca de agua: que valide lo que tiene que
 * validar, que la marca subida efectivamente se aplique a las fotos nuevas, y
 * que al quitarla se vuelva al logo del proyecto.
 *
 *   npx tsx --conditions=react-server --env-file=.env scripts/probar-marca.ts
 */
import sharp from "sharp";

import { db } from "../src/lib/db";

const BASE = "http://localhost:3000";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "";

const resultados: [string, boolean, string][] = [];
function check(nombre: string, ok: boolean, detalle = "") {
  resultados.push([nombre, ok, detalle]);
}

async function login() {
  const res = await fetch(`${BASE}/api/admin/login`, {
    method: "POST",
    body: new URLSearchParams({ password: PASSWORD }),
    redirect: "manual",
  });
  const cookie = res.headers.get("set-cookie");
  if (!cookie) throw new Error("No entró al panel");
  return cookie.split(";")[0];
}

async function subir(cookie: string, slot: string, nombre: string, data: Buffer, tipo: string) {
  const form = new FormData();
  form.append("slot", slot);
  form.append("file", new Blob([new Uint8Array(data)], { type: tipo }), nombre);
  const res = await fetch(`${BASE}/api/admin/marca`, {
    method: "POST",
    headers: { cookie },
    body: form,
    redirect: "manual",
  });
  return new URL(res.headers.get("location") ?? BASE).searchParams;
}

/// Un PNG transparente bien distinto del logo, para reconocerlo en el resultado.
function marcaDePrueba() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="200">
    <rect x="0" y="0" width="800" height="60" fill="#ffffff"/>
    <rect x="0" y="140" width="800" height="60" fill="#ffffff"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function main() {
  const cookie = await login();

  // --- sin sesión no se puede tocar nada ---
  const sinSesion = await fetch(`${BASE}/api/admin/marca/mosaico`);
  check("sin sesión no se ve la marca", sinSesion.status === 401, `${sinSesion.status}`);

  const previewSinSesion = await fetch(`${BASE}/api/admin/marca/previsualizar`);
  check(
    "sin sesión no se previsualiza",
    previewSinSesion.status === 401,
    `${previewSinSesion.status}`,
  );

  // --- validaciones ---
  const jpeg = await sharp({
    create: { width: 100, height: 100, channels: 3, background: "#888" },
  })
    .jpeg()
    .toBuffer();
  const rechazaJpeg = await subir(cookie, "mosaico", "marca.jpg", jpeg, "image/jpeg");
  check(
    "rechaza un JPEG",
    rechazaJpeg.get("marca") === "error",
    rechazaJpeg.get("detalle") ?? "",
  );

  const pngOpaco = await sharp({
    create: { width: 100, height: 100, channels: 3, background: "#888" },
  })
    .png()
    .toBuffer();
  const rechazaOpaco = await subir(cookie, "mosaico", "opaco.png", pngOpaco, "image/png");
  check(
    "rechaza un PNG sin transparencia",
    rechazaOpaco.get("marca") === "error",
    rechazaOpaco.get("detalle") ?? "",
  );

  const slotMalo = await subir(cookie, "inventado", "x.png", await marcaDePrueba(), "image/png");
  check("rechaza un slot inexistente", slotMalo.get("marca") === "slot-invalido");

  // --- carga válida ---
  const png = await marcaDePrueba();
  const okSubida = await subir(cookie, "mosaico", "mi-marca.png", png, "image/png");
  check("acepta un PNG transparente", okSubida.get("marca") === "guardada");

  const fila = await db.watermark.findUnique({ where: { slot: "mosaico" } });
  check("queda registrada en la base", fila?.filename === "mi-marca.png", fila?.filename ?? "null");

  const verla = await fetch(`${BASE}/api/admin/marca/mosaico`, { headers: { cookie } });
  check("se puede ver desde el panel", verla.status === 200, verla.headers.get("content-type") ?? "");

  // --- se aplica de verdad a una foto nueva ---
  const evento = await db.event.findFirst({ select: { id: true } });
  if (!evento) throw new Error("No hay ningún partido cargado");

  const foto = await sharp({
    create: { width: 1600, height: 1000, channels: 3, background: "#1e5c1a" },
  })
    .jpeg()
    .toBuffer();

  const permiso = await fetch(`${BASE}/api/admin/subir/autorizar`, {
    method: "POST",
    headers: { cookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      eventId: evento.id,
      contentType: "image/jpeg",
      size: foto.byteLength,
    }),
  });
  const datosPermiso = await permiso.json();
  await fetch(datosPermiso.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/jpeg" },
    body: new Uint8Array(foto),
  });
  const subida = await fetch(`${BASE}/api/admin/subir/procesar`, {
    method: "POST",
    headers: { cookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      eventId: evento.id,
      objeto: datosPermiso.objeto,
      filename: "prueba.jpg",
    }),
  });
  const { photo } = await subida.json();

  const guardada = await db.photo.findUnique({ where: { id: photo.id } });
  const { getObject } = await import("../src/lib/storage");
  const preview = await getObject("public", guardada!.previewKey);

  // La marca de prueba son dos franjas blancas horizontales. Sobre un verde
  // plano, el preview tiene que quedar bastante mas claro que el original.
  const brilloOriginal = (await sharp(foto).stats()).channels[1].mean;
  const brilloPreview = (await sharp(preview).stats()).channels[1].mean;
  check(
    "la marca subida se aplica a las fotos nuevas",
    brilloPreview > brilloOriginal + 3,
    `verde ${brilloOriginal.toFixed(1)} -> ${brilloPreview.toFixed(1)}`,
  );

  // --- quitarla vuelve al logo del proyecto ---
  const borrado = new FormData();
  borrado.append("slot", "mosaico");
  borrado.append("accion", "borrar");
  const resBorrado = await fetch(`${BASE}/api/admin/marca`, {
    method: "POST",
    headers: { cookie },
    body: borrado,
    redirect: "manual",
  });
  const paramsBorrado = new URL(resBorrado.headers.get("location") ?? BASE).searchParams;
  check("se puede volver al logo del proyecto", paramsBorrado.get("marca") === "restaurada");
  check(
    "se borra de la base",
    (await db.watermark.findUnique({ where: { slot: "mosaico" } })) === null,
  );

  await db.photo.delete({ where: { id: photo.id } });

  let fallos = 0;
  for (const [nombre, ok, detalle] of resultados) {
    if (!ok) fallos++;
    console.log(`${ok ? "OK  " : "FALLA"}  ${nombre}${detalle ? `  (${detalle})` : ""}`);
  }
  if (fallos > 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
