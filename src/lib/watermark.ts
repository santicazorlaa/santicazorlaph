import { readFile } from "node:fs/promises";
import path from "node:path";

import exifr from "exifr";
import sharp from "sharp";
import type { OverlayOptions, Sharp } from "sharp";

import { siteName } from "./env";

/// Ancho de la grilla del evento. Suficiente para que se vea bien en retina
/// sin que un partido de 1.500 fotos funda los datos del celular.
const THUMB_WIDTH = 500;
/// Ancho de la vista ampliada. Se ve el detalle de la jugada, pero no alcanza
/// para imprimir ni para pasar por una foto comprada.
const PREVIEW_WIDTH = 1100;

/// Siempre las versiones en negativo: la marca se aplica en blanco sobre la
/// foto. De cada una se usa el primer archivo que exista.
const MARCAS = {
  isotipo: ["watermark.svg", "isotipo-negativo.svg", "watermark.png"],
  logotipo: ["logotipo-negativo.svg"],
} as const;

type Marca = keyof typeof MARCAS;
type Logo = { data: Buffer; vector: boolean; naturalWidth: number };

const logoCache = new Map<Marca, Logo | null>();

async function loadLogo(marca: Marca): Promise<Logo | null> {
  const cacheado = logoCache.get(marca);
  if (cacheado !== undefined) return cacheado;

  for (const nombre of MARCAS[marca]) {
    try {
      const data = await readFile(path.join(process.cwd(), "assets", nombre));
      const { width } = await sharp(data).metadata();
      const logo = { data, vector: nombre.endsWith(".svg"), naturalWidth: width || 1000 };
      logoCache.set(marca, logo);
      return logo;
    } catch {
      // No está ese archivo: probamos el siguiente.
    }
  }

  logoCache.set(marca, null);
  return null;
}

/// El logo al ancho pedido. Un SVG se rasteriza al doble y se baja, que sale
/// más limpio que pedirle a la librería el tamaño exacto.
function renderLogo(logo: Logo, width: number) {
  if (!logo.vector) return sharp(logo.data).resize({ width });

  const density = Math.min(
    2400,
    Math.max(72, Math.round((72 * width * 2) / logo.naturalWidth)),
  );
  return sharp(logo.data, { density }).resize({ width });
}

/// Baja la opacidad de un PNG multiplicando su canal alfa.
function fade(image: Sharp, opacity: number) {
  return image.ensureAlpha().composite([
    {
      input: Buffer.from([255, 255, 255, Math.round(255 * opacity)]),
      raw: { width: 1, height: 1, channels: 4 },
      tile: true,
      blend: "dest-in",
    },
  ]);
}

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

/// El logo al ancho pedido, en blanco y con una sombra oscura difusa detrás.
/// La sombra es lo que hace que la marca se lea tanto sobre un cielo quemado
/// como sobre la sombra de la tribuna.
async function buildMark(marca: Marca, markWidth: number, opacity: number) {
  const logo = await loadLogo(marca);

  let solid: Buffer;
  if (logo) {
    solid = await renderLogo(logo, markWidth).png().toBuffer();
  } else {
    // Sin logo cargado todavía: marca de texto, sólo para desarrollo.
    const fontSize = Math.round(markWidth / 7);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${markWidth}" height="${Math.round(fontSize * 1.6)}">
      <text x="0" y="${fontSize}" font-family="Arial, Helvetica, sans-serif"
            font-size="${fontSize}" font-weight="bold" letter-spacing="2"
            fill="#ffffff">${siteName}</text>
    </svg>`;
    solid = await sharp(Buffer.from(svg)).png().toBuffer();
  }

  const pad = Math.max(2, Math.round(markWidth * 0.02));
  const padded = await sharp(solid)
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: TRANSPARENT })
    .png()
    .toBuffer();

  const shadow = await sharp(padded)
    .linear(0, 0) // conserva el alfa y lleva el color a negro
    .blur(Math.max(1, markWidth * 0.012))
    .png()
    .toBuffer();

  const withShadow = await sharp(shadow)
    .composite([{ input: padded, blend: "over" }])
    .png()
    .toBuffer();

  return fade(sharp(withShadow), opacity).png().toBuffer();
}

/// Construye el mosaico que se repite sobre la foto: el logo en diagonal,
/// separado por aire transparente para que la imagen siga leyéndose.
async function buildTile(
  imageWidth: number,
  imageHeight: number,
  opacity: number,
  scale: number,
  gapRatio: number,
) {
  const markWidth = Math.round(imageWidth * scale);
  const mark = await buildMark("isotipo", markWidth, opacity);

  const rotated = await sharp(mark)
    .rotate(-30, { background: TRANSPARENT })
    .toBuffer();

  // El aire entre repeticiones sale de extend. Ojo: sharp aplica resize antes
  // que extend sin importar el orden de las llamadas, así que acá no se puede
  // encadenar un resize para ajustar el tamaño final.
  const gap = Math.round(markWidth * gapRatio);
  const tile = await sharp(rotated)
    .extend({ top: gap, bottom: gap, left: gap, right: gap, background: TRANSPARENT })
    .png()
    .toBuffer();

  const { width = 0, height = 0 } = await sharp(tile).metadata();
  if (width <= imageWidth && height <= imageHeight) return tile;

  // Fotos muy chicas o muy apaisadas: el mosaico no puede superar a la imagen.
  return sharp(tile)
    .resize({ width: imageWidth, height: imageHeight, fit: "inside" })
    .png()
    .toBuffer();
}

type WatermarkStyle = {
  /// Intensidad del mosaico.
  tileOpacity: number;
  /// Ancho del isotipo, como fracción del ancho de la foto.
  tileScale: number;
  /// Aire entre repeticiones, como fracción del ancho del isotipo.
  tileGap: number;
  /// Marca grande al centro. Va el logotipo con el nombre: el mosaico ya
  /// repite el isotipo, así que acá lo que suma es que se lea de quién es.
  center?: { opacity: number; scale: number };
};

async function render(original: Buffer, targetWidth: number, style: WatermarkStyle) {
  const base = sharp(original, { failOn: "none" })
    .rotate() // respeta la orientación EXIF antes de descartar la metadata
    .resize({ width: targetWidth, withoutEnlargement: true });

  const { width, height } = await base
    .clone()
    .toBuffer({ resolveWithObject: true })
    .then((r) => r.info);

  const layers: OverlayOptions[] = [
    {
      input: await buildTile(
        width,
        height,
        style.tileOpacity,
        style.tileScale,
        style.tileGap,
      ),
      tile: true,
      blend: "over",
    },
  ];

  if (style.center) {
    const centerWidth = Math.min(
      Math.round(width * style.center.scale),
      Math.round(width * 0.9),
    );
    layers.push({
      input: await buildMark("logotipo", centerWidth, style.center.opacity),
      gravity: "center",
      blend: "over",
    });
  }

  return base
    .composite(layers)
    .jpeg({ quality: 82, progressive: true, mozjpeg: true })
    .toBuffer();
}

export type ProcessedPhoto = {
  thumb: Buffer;
  preview: Buffer;
  width: number;
  height: number;
  sizeBytes: number;
  camera: string | null;
  lens: string | null;
  takenAt: Date | null;
};

export async function processPhoto(original: Buffer): Promise<ProcessedPhoto> {
  const meta = await sharp(original, { failOn: "none" }).metadata();

  // Con orientación 5-8 la foto está rotada 90°, así que el alto y el ancho
  // reales vienen dados vuelta respecto de lo que reporta el archivo.
  const rotated = (meta.orientation ?? 1) >= 5;
  const width = (rotated ? meta.height : meta.width) ?? 0;
  const height = (rotated ? meta.width : meta.height) ?? 0;

  const [thumb, preview, exif] = await Promise.all([
    render(original, THUMB_WIDTH, {
      tileOpacity: 0.26,
      tileScale: 0.36,
      tileGap: 0.14,
    }),
    render(original, PREVIEW_WIDTH, {
      tileOpacity: 0.18,
      tileScale: 0.2,
      tileGap: 0.16,
      center: { opacity: 0.26, scale: 0.52 },
    }),
    // Cada marca guarda el lente en un tag distinto, así que los pedimos todos
    // y nos quedamos con el primero que venga.
    exifr
      .parse(original, [
        "Make",
        "Model",
        "LensModel",
        "Lens",
        "LensID",
        "DateTimeOriginal",
        "CreateDate",
      ])
      .catch(() => null),
  ]);

  const texto = (v: unknown) => {
    const s = typeof v === "string" ? v.trim() : "";
    return s.length > 0 ? s : null;
  };

  const fecha = exif?.DateTimeOriginal ?? exif?.CreateDate;

  return {
    thumb,
    preview,
    width,
    height,
    sizeBytes: original.byteLength,
    camera: texto(exif?.Model),
    lens: texto(exif?.LensModel) ?? texto(exif?.Lens) ?? texto(exif?.LensID),
    takenAt: fecha ? new Date(fecha) : null,
  };
}

export function megapixels(width: number, height: number) {
  return Math.round((width * height) / 100_000) / 10;
}

export function formatBytes(bytes: number) {
  if (bytes >= 1_048_576) return `${Math.round(bytes / 1_048_576)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}
