/**
 * Genera, a partir del logo, las dos imagenes que no pueden ser SVG:
 *
 *  - el icono de la pestaña, sobre el fondo oscuro de la marca porque el
 *    isotipo es blanco y solo, en una pestaña clara, no se veria;
 *  - el logo del mail, en PNG porque los clientes de correo no muestran SVG.
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

  // El logo del mail va sobre la banda oscura del encabezado, asi que se genera
  // en negativo con fondo transparente y al doble para pantallas retina.
  const imagotipo = await readFile(path.join("assets", "imagotipo-hor-negativo.svg"));
  const { width: anchoNatural = 2398 } = await sharp(imagotipo).metadata();
  const ANCHO_MAIL = 440;
  const logoMail = await sharp(imagotipo, {
    density: Math.min(2400, Math.round((72 * ANCHO_MAIL * 2) / anchoNatural)),
  })
    .resize({ width: ANCHO_MAIL })
    .png()
    .toBuffer();

  const destinoMail = path.join("public", "logo-email.png");
  await writeFile(destinoMail, logoMail);
  console.log(`logo del mail -> ${destinoMail} (${ANCHO_MAIL}px de ancho)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
