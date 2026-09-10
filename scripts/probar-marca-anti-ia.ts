/**
 * Genera fotos de prueba (horizontal y vertical) para verificar la directiva Anti-IA
 * tanto visualmente como subiéndola a ChatGPT o Gemini.
 *
 *   npx tsx scripts/probar-marca-anti-ia.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const outDir = path.join(root, ".data", "prueba");

/** Fondo sintético desafiante: césped deportivo, jugadores, líneas blancas y cielo. */
async function generarFotoBase(ancho: number, alto: number) {
  const lineaPastoY = Math.round(alto * 0.38);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}">
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
    <!-- Fondo cielo y campo -->
    <rect width="${ancho}" height="${lineaPastoY}" fill="url(#cielo)"/>
    <rect y="${lineaPastoY}" width="${ancho}" height="${alto - lineaPastoY}" fill="url(#pasto)"/>
    
    <!-- Líneas de campo de fútbol -->
    <rect x="0" y="${lineaPastoY + 50}" width="${ancho}" height="16" fill="#ffffff" opacity="0.8"/>
    <circle cx="${Math.round(ancho / 2)}" cy="${Math.round(alto * 0.75)}" r="${Math.round(ancho * 0.22)}" fill="none" stroke="#ffffff" stroke-width="14" opacity="0.6"/>
    
    <!-- Siluetas de jugadores de fútbol con camisetas oscura y blanca -->
    <rect x="${Math.round(ancho * 0.38)}" y="${Math.round(alto * 0.42)}" width="${Math.round(ancho * 0.12)}" height="${Math.round(alto * 0.32)}" rx="25" fill="#111820"/>
    <circle cx="${Math.round(ancho * 0.44)}" cy="${Math.round(alto * 0.38)}" r="${Math.round(ancho * 0.045)}" fill="#2b3440"/>
    
    <rect x="${Math.round(ancho * 0.52)}" y="${Math.round(alto * 0.44)}" width="${Math.round(ancho * 0.11)}" height="${Math.round(alto * 0.30)}" rx="25" fill="#f8fafc"/>
    <circle cx="${Math.round(ancho * 0.575)}" cy="${Math.round(alto * 0.40)}" r="${Math.round(ancho * 0.045)}" fill="#e2e8f0"/>
  </svg>`;

  return sharp(Buffer.from(svg)).jpeg({ quality: 95 }).toBuffer();
}

async function main() {
  await mkdir(outDir, { recursive: true });

  console.log("Generando imágenes de prueba sintéticas...");
  const horizontalOriginal = await generarFotoBase(3000, 2000); // 3:2 landscape
  const verticalOriginal = await generarFotoBase(2000, 3000);   // 2:3 portrait

  await writeFile(path.join(outDir, "original-horizontal.jpg"), horizontalOriginal);
  await writeFile(path.join(outDir, "original-vertical.jpg"), verticalOriginal);

  const { renderPreview } = await import("../src/lib/watermark");

  console.log("Renderizando previsualizaciones sintéticas...");
  const previewHorizontal = await renderPreview(horizontalOriginal);
  const previewVertical = await renderPreview(verticalOriginal);

  const outH = path.join(outDir, "preview-anti-ia-horizontal.jpg");
  const outV = path.join(outDir, "preview-anti-ia-vertical.jpg");

  await writeFile(outH, previewHorizontal);
  await writeFile(outV, previewVertical);

  // Procesar también foto real deportiva existente en assets
  const fotoRealBuffer = await sharp(path.join(root, "assets", "dsc7362fondo.jpg")).toBuffer();
  console.log("Renderizando foto real deportiva...");
  const realHorizontal = await renderPreview(fotoRealBuffer);
  
  // Para vertical real, recortamos a proporción 2:3 vertical
  const { width: rw = 1920, height: rh = 1282 } = await sharp(fotoRealBuffer).metadata();
  const cropW = Math.round(rh * (2 / 3));
  const fotoRealVerticalBuffer = await sharp(fotoRealBuffer)
    .extract({ left: Math.round((rw - cropW) / 2), top: 0, width: cropW, height: rh })
    .toBuffer();
  const realVertical = await renderPreview(fotoRealVerticalBuffer);

  const outRealH = path.join(outDir, "real-anti-ia-horizontal.jpg");
  const outRealV = path.join(outDir, "real-anti-ia-vertical.jpg");

  await writeFile(outRealH, realHorizontal);
  await writeFile(outRealV, realVertical);

  const { processPhoto } = await import("../src/lib/watermark");
  const processed = await processPhoto(fotoRealBuffer);
  const outRealThumb = path.join(outDir, "real-thumb.jpg");
  await writeFile(outRealThumb, processed.thumb);

  console.log("✅ Generadas con éxito:");
  console.log(`- Sintética Horizontal: ${outH}`);
  console.log(`- Sintética Vertical:   ${outV}`);
  console.log(`- Real Horizontal:      ${outRealH}`);
  console.log(`- Real Vertical:        ${outRealV}`);
  console.log(`- Real Miniatura:       ${outRealThumb} (${processed.thumb.byteLength} bytes)`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
