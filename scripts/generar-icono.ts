/**
 * Genera el icono de la pestaña a partir del isotipo. Va sobre el fondo oscuro
 * de la marca porque el isotipo es blanco: sobre una pestaña clara, solo, no se
 * veria.
 *
 * Correr de nuevo si cambia el logo:
 *   npx tsx scripts/generar-icono.ts
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const LADO = 512;

async function main() {
  const svg = await readFile(path.join("assets", "isotipo-negativo.svg"));
  const { width = 967 } = await sharp(svg).metadata();

  const anchoMarca = Math.round(LADO * 0.68);
  const density = Math.min(2400, Math.round((72 * anchoMarca * 2) / width));

  const marca = await sharp(svg, { density })
    .resize({ width: anchoMarca })
    .png()
    .toBuffer();

  const icono = await sharp({
    create: { width: LADO, height: LADO, channels: 4, background: "#141619" },
  })
    .composite([{ input: marca, gravity: "center" }])
    .png()
    .toBuffer();

  const destino = path.join("src", "app", "icon.png");
  await writeFile(destino, icono);
  console.log(`icono generado -> ${destino} (${LADO}x${LADO})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
