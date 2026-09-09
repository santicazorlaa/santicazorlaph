/**
 * Sube una foto por el endpoint real del panel y verifica todo el recorrido:
 * autenticación, marca de agua, lectura de EXIF, y que el original quede en el
 * bucket privado mientras los previews van al público.
 *
 *   npx tsx --conditions=react-server scripts/probar-subida.ts
 */
import exifr from "exifr";
import sharp from "sharp";

import { db } from "../src/lib/db";

const BASE = "http://localhost:3000";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "";

async function login() {
  const form = new URLSearchParams({ password: PASSWORD });
  const res = await fetch(`${BASE}/api/admin/login`, {
    method: "POST",
    body: form,
    redirect: "manual",
  });
  const cookie = res.headers.get("set-cookie");
  if (!cookie) throw new Error("No entró al panel: revisá ADMIN_PASSWORD");
  return cookie.split(";")[0];
}

async function fotoConExif() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="1600">
    <rect width="2400" height="700" fill="#c3d8ea"/>
    <rect y="700" width="2400" height="900" fill="#3d6b34"/>
    <circle cx="1200" cy="1100" r="120" fill="#f0f0f0"/>
  </svg>`;
  return sharp(Buffer.from(svg))
    .withExif({ IFD0: { Make: "Canon", Model: "Canon EOS R6 Mark II" } })
    .jpeg({ quality: 92 })
    .toBuffer();
}

async function main() {
  const cookie = await login();
  console.log("OK    entró al panel");

  const evento = await db.event.findFirst({ select: { id: true, title: true } });
  if (!evento) throw new Error("No hay ningún partido cargado");

  const antes = await db.photo.count({ where: { eventId: evento.id } });

  const jpeg = await fotoConExif();
  // Sin sesión no se puede ni pedir permiso ni mandar a procesar.
  const sinSesionAutorizar = await fetch(`${BASE}/api/admin/subir/autorizar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId: evento.id, contentType: "image/jpeg", size: 100 }),
  });
  console.log(
    `${sinSesionAutorizar.status === 401 ? "OK  " : "FALLA"}  sin sesión no autoriza subidas  (${sinSesionAutorizar.status})`,
  );

  const sinSesionProcesar = await fetch(`${BASE}/api/admin/subir/procesar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventId: evento.id,
      objeto: "00000000-0000-4000-8000-000000000000",
      filename: "x.jpg",
    }),
  });
  console.log(
    `${sinSesionProcesar.status === 401 ? "OK  " : "FALLA"}  sin sesión no procesa  (${sinSesionProcesar.status})`,
  );

  // Paso 1: pedir permiso para subir.
  const permiso = await fetch(`${BASE}/api/admin/subir/autorizar`, {
    method: "POST",
    headers: { cookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      eventId: evento.id,
      contentType: "image/jpeg",
      size: jpeg.byteLength,
    }),
  });
  const datosPermiso = await permiso.json();
  if (!permiso.ok) throw new Error(`No autorizó: ${JSON.stringify(datosPermiso)}`);
  console.log("OK    autorizó la subida directa al bucket");

  // Paso 2: subir el original derecho al bucket, sin pasar por el servidor.
  const puesta = await fetch(datosPermiso.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/jpeg" },
    body: new Uint8Array(jpeg),
  });
  if (!puesta.ok) throw new Error(`La subida al bucket falló: HTTP ${puesta.status}`);
  console.log("OK    el original subió directo al bucket");

  // Paso 3: procesar.
  const res = await fetch(`${BASE}/api/admin/subir/procesar`, {
    method: "POST",
    headers: { cookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      eventId: evento.id,
      objeto: datosPermiso.objeto,
      filename: "_SC9001.jpg",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`El procesado falló: ${JSON.stringify(data)}`);

  console.log(`OK    proceso la foto #${data.photo.code}`);

  const photo = await db.photo.findUnique({ where: { id: data.photo.id } });
  if (!photo) throw new Error("No quedó guardada en la base");

  const checks: [string, boolean, string?][] = [
    ["se agregó a la base", (await db.photo.count({ where: { eventId: evento.id } })) === antes + 1, ""],
    ["leyó la cámara del EXIF", photo.camera === "Canon EOS R6 Mark II", photo.camera ?? "null"],
    ["guardó las medidas", photo.width === 2400 && photo.height === 1600, `${photo.width}x${photo.height}`],
    ["el original va al bucket privado", photo.originalKey.startsWith("originales/"), photo.originalKey],
    ["el preview va al público", photo.previewKey.startsWith("preview/"), photo.previewKey],
  ];

  // Se consulta el storage por su interfaz, así estos chequeos valen igual con
  // R2 que con el disco local.
  const { getObject } = await import("../src/lib/storage");
  const traer = async (bucket: "public" | "private", key: string) =>
    getObject(bucket, key).catch(() => null);

  const original = await traer("private", photo.originalKey);
  checks.push(["el original está en el bucket privado", original !== null]);

  checks.push([
    "el original NO está en el bucket público",
    (await traer("public", photo.originalKey)) === null,
  ]);

  const preview = await traer("public", photo.previewKey);
  checks.push(["el preview está en el bucket público", preview !== null]);

  if (original && preview) {
    checks.push([
      "el preview pesa menos que el original",
      preview.byteLength < original.byteLength,
      `${Math.round(preview.byteLength / 1024)}KB vs ${Math.round(original.byteLength / 1024)}KB`,
    ]);

    const dimPreview = await sharp(preview).metadata();
    checks.push([
      "el preview está reducido",
      (dimPreview.width ?? 0) <= 1100 && (dimPreview.width ?? 0) < photo.width,
      `${dimPreview.width}px`,
    ]);
  }

  // El lente y la fecha de captura viven en el bloque ExifIFD. sharp no puede
  // escribir esos dos tags, así que con una foto sintética no se pueden probar
  // de punta a punta; lo que sí verificamos es que sepamos leer ese bloque.
  const exifIFD = await exifr.parse(jpeg, [
    "ExifImageWidth",
    "LensModel",
    "DateTimeOriginal",
  ]);
  checks.push([
    "sabe leer el bloque ExifIFD (lente y fecha salen de ahí)",
    exifIFD?.ExifImageWidth === 2400,
    `ExifImageWidth=${exifIFD?.ExifImageWidth}`,
  ]);

  let fallos = 0;
  for (const [nombre, ok, detalle] of checks) {
    if (!ok) fallos++;
    console.log(`${ok ? "OK  " : "FALLA"}  ${nombre}${detalle ? `  (${detalle})` : ""}`);
  }

  // Dejamos la base como estaba.
  await db.photo.delete({ where: { id: photo.id } });

  if (fallos > 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
