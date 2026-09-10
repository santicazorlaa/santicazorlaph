import { readFile } from "node:fs/promises";
import path from "node:path";

import exifr from "exifr";
import sharp from "sharp";
import type { OverlayOptions, Sharp } from "sharp";

import { leerAjustesDeFoto, type AjustesDeFoto } from "./ajustes";
import { leerMarca } from "./marca";
import type { Slot } from "./marca-slots";

import { siteName } from "./env";

/// Ancho de la grilla del evento. Suficiente para que se vea bien en retina
/// sin que un partido de 1.500 fotos funda los datos del celular.
const THUMB_WIDTH = 500;
/// Lado más largo de la vista ampliada. No es el ancho, y esa diferencia
/// importa: el lightbox muestra la foto entera dentro de la pantalla, así que
/// una foto vertical se ve *más chica* que una horizontal. Midiendo por el
/// ancho, la vertical se llevaba 820x1230 —más del doble de píxeles— y quedaba
/// notoriamente mejor que la horizontal aun ocupando menos lugar. Midiendo por
/// el lado más largo, las dos reciben la misma cantidad de información.
///
/// Estuvo en 1100 hasta septiembre de 2026. Se bajó porque hoy cualquiera le
/// pasa un reescalador con IA a una imagen que baje del sitio: cuanto menos
/// información real tenga el archivo, menos tiene con qué trabajar.
const PREVIEW_LADO_MAYOR = 820;

/// La miniatura, en cambio, sí se mide por el ancho: en la grilla todas las
/// fotos ocupan una columna del mismo ancho, así que igualar el ancho es lo que
/// las deja parejas de nitidez. Es la misma idea que arriba —que ninguna reciba
/// más que otra para cómo se muestra—, aplicada a otra forma de mostrar.
const CALIDAD_THUMB = 72;

/// La tapa del sitio: se ve de lado a lado de la pantalla, así que necesita más
/// ancho que una portada. Va con una compresión más dura para compensar: abajo
/// de un degradado oscuro no se nota, y suelta la foto no sirve de mucho.
const TAPA_ANCHO = 1000;
const CALIDAD_TAPA = 58;

/// Archivos que vienen con el proyecto, en negativo porque la marca se aplica
/// en blanco sobre la foto. De cada slot se usa el primero que exista.
const MARCAS_POR_DEFECTO: Record<Slot, readonly string[]> = {
  mosaico: ["watermark.svg", "isotipo-negativo.svg", "watermark.png"],
  centro: ["logotipo-negativo.svg"],
};

type Logo = { data: Buffer; vector: boolean; naturalWidth: number };

const bundledCache = new Map<Slot, Logo | null>();

async function loadBundled(slot: Slot): Promise<Logo | null> {
  const cacheado = bundledCache.get(slot);
  if (cacheado !== undefined) return cacheado;

  for (const nombre of MARCAS_POR_DEFECTO[slot]) {
    try {
      const data = await readFile(path.join(process.cwd(), "assets", nombre));
      const { width } = await sharp(data).metadata();
      const logo = { data, vector: nombre.endsWith(".svg"), naturalWidth: width || 1000 };
      bundledCache.set(slot, logo);
      return logo;
    } catch {
      // No está ese archivo: probamos el siguiente.
    }
  }

  bundledCache.set(slot, null);
  return null;
}

/// Si hay una marca subida desde el panel, gana sobre la del proyecto.
async function loadLogo(slot: Slot): Promise<Logo | null> {
  const propia = await leerMarca(slot);
  if (propia) {
    const { width } = await sharp(propia.data).metadata();
    return {
      data: propia.data,
      vector: propia.mime === "image/svg+xml",
      naturalWidth: width || 1000,
    };
  }
  return loadBundled(slot);
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
async function buildMark(slot: Slot, markWidth: number, opacity: number) {
  const logo = await loadLogo(slot);

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
  const mark = await buildMark("mosaico", markWidth, opacity);

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
  /// Calidad JPEG del archivo que se publica.
  quality: number;
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

/// Cómo se decide el tamaño de lo que se publica.
type Medida =
  /// Todas terminan con el mismo ancho (la grilla).
  | { tipo: "ancho"; px: number }
  /// Todas terminan con el mismo lado largo (la vista ampliada).
  | { tipo: "ladoMayor"; px: number };

async function render(original: Buffer, medida: Medida, style: WatermarkStyle) {
  const base = sharp(original, { failOn: "none" })
    .rotate() // respeta la orientación EXIF antes de descartar la metadata
    .resize(
      medida.tipo === "ancho"
        ? { width: medida.px, withoutEnlargement: true }
        : {
            width: medida.px,
            height: medida.px,
            fit: "inside",
            withoutEnlargement: true,
          },
    );

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
      input: await buildMark("centro", centerWidth, style.center.opacity),
      gravity: "center",
      blend: "over",
    });
  }

  return base
    .composite(layers)
    .jpeg({ quality: style.quality, progressive: true, mozjpeg: true })
    .toBuffer();
}

/// El tamaño y la separación del mosaico están calibrados y no se tocan desde
/// el panel; lo que Santi elige es cuánto se ve la marca y cuánta calidad
/// conserva la vista ampliada.
function estiloThumb(a: AjustesDeFoto): WatermarkStyle {
  return {
    quality: CALIDAD_THUMB,
    tileOpacity: a.mosaico,
    tileScale: 0.36,
    tileGap: 0.14,
  };
}

function estiloPreview(a: AjustesDeFoto): WatermarkStyle {
  return {
    quality: a.calidad,
    tileOpacity: a.mosaico,
    tileScale: 0.2,
    tileGap: 0.16,
    center: { opacity: a.centro, scale: 0.52 },
  };
}

/// Aplica la marca de agua tal cual queda en la vista ampliada. Lo usa el panel
/// para mostrar cómo se ve antes de procesar un partido entero.
///
/// Acepta opacidades sueltas para que el panel pueda mostrar el resultado de
/// mover el control antes de guardarlo.
export async function renderPreview(original: Buffer, ajustes?: AjustesDeFoto) {
  const a = ajustes ?? (await leerAjustesDeFoto());
  return render(original, { tipo: "ladoMayor", px: PREVIEW_LADO_MAYOR }, estiloPreview(a));
}

/**
 * La portada del partido: la única imagen que sale sin marca de agua, a
 * propósito, porque es la que invita a entrar y con la marca encima no invita.
 *
 * Sale al mismo tamaño y con la misma compresión que una miniatura. Eso es lo
 * que hace aceptable el riesgo: es una sola foto por partido, chica, de la que
 * no se puede sacar gran cosa. Agrandarla o mejorarle la calidad sí sería
 * regalar una foto.
 */
export function renderPortada(original: Buffer) {
  return sharp(original, { failOn: "none" })
    .rotate() // respeta la orientación EXIF antes de descartar la metadata
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: CALIDAD_THUMB, progressive: true, mozjpeg: true })
    .toBuffer();
}

/**
 * La foto grande del encabezado de la portada, que se ve a lo ancho de toda la
 * pantalla y siempre debajo de un degradado oscuro y del título.
 *
 * Es más grande que una portada porque a 500 px se vería borrosa de lado a lado
 * y quedaría peor que no tenerla. La compensación está en la compresión —más
 * dura que la de una preview— y en que es una sola foto de todo el sitio,
 * elegida por Santi, y no una por partido.
 */
export function renderTapa(original: Buffer) {
  return sharp(original, { failOn: "none" })
    .rotate()
    .resize({ width: TAPA_ANCHO, withoutEnlargement: true })
    .jpeg({ quality: CALIDAD_TAPA, progressive: true, mozjpeg: true })
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

  const ajustes = await leerAjustesDeFoto();

  const [thumb, preview, exif] = await Promise.all([
    render(original, { tipo: "ancho", px: THUMB_WIDTH }, estiloThumb(ajustes)),
    render(
      original,
      { tipo: "ladoMayor", px: PREVIEW_LADO_MAYOR },
      estiloPreview(ajustes),
    ),
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
