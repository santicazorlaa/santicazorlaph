/**
 * Genera un logo provisorio y una foto sintética, y corre el procesamiento real
 * para ver cómo queda la marca de agua. Se borra cuando tengamos el logo real.
 *
 *   npx tsx scripts/probar-watermark.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const root = process.cwd();
const out = path.join(root, ".data", "prueba");

async function logoProvisorio() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="300">
    <text x="450" y="150" text-anchor="middle" font-family="Arial Black, Arial, sans-serif"
          font-size="190" font-weight="900" fill="#ffffff">SC</text>
    <text x="450" y="230" text-anchor="middle" font-family="Arial, sans-serif"
          font-size="46" letter-spacing="9" fill="#ffffff">SANTI CAZORLA</text>
  </svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  await mkdir(path.join(root, "assets"), { recursive: true });
  await writeFile(path.join(root, "assets", "watermark.png"), png);
  return png;
}

/** Una cancha sintética con zonas claras y oscuras, para ver si el watermark
 *  se lee sobre las dos. */
async function fotoDePrueba() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="3000" height="2000">
    <defs>
      <linearGradient id="cielo" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#dfeaf5"/>
        <stop offset="100%" stop-color="#a8c6e0"/>
      </linearGradient>
      <linearGradient id="pasto" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#4a7c3f"/>
        <stop offset="100%" stop-color="#20401c"/>
      </linearGradient>
    </defs>
    <rect width="3000" height="820" fill="url(#cielo)"/>
    <rect y="820" width="3000" height="1180" fill="url(#pasto)"/>
    <rect x="120" y="900" width="2760" height="14" fill="#ffffff" opacity="0.75"/>
    <circle cx="1500" cy="1500" r="330" fill="none" stroke="#ffffff" stroke-width="12" opacity="0.55"/>
    <rect x="1180" y="1020" width="230" height="560" rx="30" fill="#111820"/>
    <circle cx="1295" cy="960" r="88" fill="#2b3440"/>
    <rect x="1700" y="1060" width="215" height="520" rx="28" fill="#f2f4f7"/>
    <circle cx="1807" cy="1000" r="84" fill="#e8ebef"/>
    <circle cx="1560" cy="1660" r="62" fill="#fdfdfd"/>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 95 }).toBuffer();
}

async function main() {
  await mkdir(out, { recursive: true });

  await logoProvisorio();
  console.log("logo provisorio -> assets/watermark.png");

  const original = await fotoDePrueba();
  await writeFile(path.join(out, "original.jpg"), original);

  const { processPhoto, megapixels, formatBytes } = await import("../src/lib/watermark");

  const t0 = Date.now();
  const r = await processPhoto(original);
  const ms = Date.now() - t0;

  await writeFile(path.join(out, "thumb.jpg"), r.thumb);
  await writeFile(path.join(out, "preview.jpg"), r.preview);

  console.log({
    procesadoEnMs: ms,
    original: `${r.width}x${r.height} · ${megapixels(r.width, r.height)}MP · ${formatBytes(r.sizeBytes)}`,
    thumb: `${formatBytes(r.thumb.byteLength)}`,
    preview: `${formatBytes(r.preview.byteLength)}`,
    camara: r.camera,
    lente: r.lens,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
