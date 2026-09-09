import "server-only";

import sharp from "sharp";

import { db } from "./db";
import type { Slot } from "./marca-slots";
import { deleteObject, getObject, putObject } from "./storage";

const MAX_BYTES = 5 * 1024 * 1024;

export type MarcaGuardada = {
  slot: Slot;
  data: Buffer;
  mime: string;
  filename: string;
  updatedAt: Date;
};

/**
 * Las marcas se releen cada 30 segundos. Se cambian muy de vez en cuando, y sin
 * esto habría que ir al bucket por cada foto que se procesa.
 */
const TTL_MS = 30_000;
type Entrada = { valor: MarcaGuardada | null; vence: number };
const cache = new Map<Slot, Entrada>();

export function invalidarCache(slot?: Slot) {
  if (slot) cache.delete(slot);
  else cache.clear();
}

export async function leerMarca(slot: Slot): Promise<MarcaGuardada | null> {
  const cacheado = cache.get(slot);
  if (cacheado && cacheado.vence > Date.now()) return cacheado.valor;

  const fila = await db.watermark.findUnique({ where: { slot } });

  let valor: MarcaGuardada | null = null;
  if (fila) {
    try {
      valor = {
        slot,
        data: await getObject("private", fila.storageKey),
        mime: fila.mime,
        filename: fila.filename,
        updatedAt: fila.updatedAt,
      };
    } catch {
      // La fila quedó apuntando a un archivo que ya no está: usamos el de assets/.
      valor = null;
    }
  }

  cache.set(slot, { valor, vence: Date.now() + TTL_MS });
  return valor;
}

export class MarcaError extends Error {}

/**
 * Guarda una marca subida a mano. Acepta PNG y SVG: el PNG tiene que traer
 * transparencia, porque si no se aplica un rectángulo opaco sobre la foto.
 */
export async function guardarMarca(slot: Slot, file: File) {
  if (file.size > MAX_BYTES) {
    throw new MarcaError("El archivo no puede pesar más de 5 MB");
  }

  const data = Buffer.from(await file.arrayBuffer());
  const esSvg =
    file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg");

  let mime: string;
  if (esSvg) {
    mime = "image/svg+xml";
  } else {
    let meta;
    try {
      meta = await sharp(data).metadata();
    } catch {
      throw new MarcaError("No pudimos leer el archivo. Tiene que ser PNG o SVG.");
    }
    if (meta.format !== "png") {
      throw new MarcaError("Subí un PNG con fondo transparente, o un SVG.");
    }
    if (!meta.hasAlpha) {
      throw new MarcaError(
        "Ese PNG no tiene transparencia: se vería como un recuadro opaco sobre la foto.",
      );
    }
    mime = "image/png";
  }

  const storageKey = `marca/${slot}.${esSvg ? "svg" : "png"}`;
  await putObject("private", storageKey, data, mime);

  await db.watermark.upsert({
    where: { slot },
    create: { slot, storageKey, mime, filename: file.name },
    update: { storageKey, mime, filename: file.name },
  });

  invalidarCache(slot);
}

export async function borrarMarca(slot: Slot) {
  const fila = await db.watermark.findUnique({ where: { slot } });
  if (!fila) return;

  await db.watermark.delete({ where: { slot } });
  await deleteObject("private", fila.storageKey).catch(() => {});
  invalidarCache(slot);
}
