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

  // El `favicon.ico` clásico, en la raíz del sitio. Google lo busca ahí aunque
  // la página declare otro ícono, y sin él mostraba un globito gris al lado del
  // resultado. Lleva 16, 32 y 48 px: 48 es el mínimo que Google acepta.
  const lados = [16, 32, 48];
  const pngs = await Promise.all(lados.map((l) => sharp(icono).resize(l, l).png().toBuffer()));
  const destinoIco = path.join("src", "app", "favicon.ico");
  await writeFile(destinoIco, armarIco(lados, pngs));
  console.log(`favicon -> ${destinoIco} (${lados.join(", ")} px)`);

  // El que usa el iPhone al guardar el sitio en la pantalla de inicio.
  const destinoApple = path.join("src", "app", "apple-icon.png");
  await writeFile(destinoApple, await sharp(icono).resize(180, 180).png().toBuffer());
  console.log(`icono de Apple -> ${destinoApple} (180x180)`);

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

/// Un .ico es un índice seguido de las imágenes. Desde hace años puede llevar
/// PNG adentro tal cual, así que no hace falta ninguna librería para armarlo.
function armarIco(lados: number[], pngs: Buffer[]) {
  const cabecera = Buffer.alloc(6 + 16 * pngs.length);
  cabecera.writeUInt16LE(0, 0);
  cabecera.writeUInt16LE(1, 2);
  cabecera.writeUInt16LE(pngs.length, 4);
  let desplazamiento = cabecera.length;
  pngs.forEach((png, i) => {
    const o = 6 + 16 * i;
    cabecera.writeUInt8(lados[i], o);
    cabecera.writeUInt8(lados[i], o + 1);
    cabecera.writeUInt16LE(1, o + 4);
    cabecera.writeUInt16LE(32, o + 6);
    cabecera.writeUInt32LE(png.length, o + 8);
    cabecera.writeUInt32LE(desplazamiento, o + 12);
    desplazamiento += png.length;
  });
  return Buffer.concat([cabecera, ...pngs]);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
