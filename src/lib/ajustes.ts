import "server-only";

import { db } from "./db";

/**
 * Perillas del sitio que Santi puede cambiar desde el panel. Viven en la tabla
 * `Ajuste`, una fila por perilla, y se leen en cada foto que se procesa: por eso
 * el cache.
 */

/// Cuánto se ve cada marca sobre la foto, de 0 a 1.
export const OPACIDAD_MOSAICO = "marca.opacidad.mosaico";
export const OPACIDAD_CENTRO = "marca.opacidad.centro";

/// Los valores con los que venía el sitio antes de que esto fuera regulable.
export const OPACIDAD_POR_DEFECTO: Record<string, number> = {
  [OPACIDAD_MOSAICO]: 0.22,
  [OPACIDAD_CENTRO]: 0.26,
};

/// Menos de esto es una marca que no protege; más, una que tapa la foto y no
/// deja decidir si comprarla.
export const OPACIDAD_MINIMA = 0.05;
export const OPACIDAD_MAXIMA = 0.9;

const TTL_MS = 30_000;
let cache: { valores: Map<string, string>; vence: number } | null = null;

export function invalidarAjustes() {
  cache = null;
}

async function todos(): Promise<Map<string, string>> {
  if (cache && cache.vence > Date.now()) return cache.valores;

  let valores = new Map<string, string>();
  try {
    const filas = await db.ajuste.findMany();
    valores = new Map(filas.map((f) => [f.clave, f.valor]));
  } catch {
    // Si la tabla todavía no existe (migración sin correr), seguimos con los
    // valores por defecto en vez de tumbar la subida de fotos.
  }

  cache = { valores, vence: Date.now() + TTL_MS };
  return valores;
}

export async function leerOpacidad(clave: string): Promise<number> {
  const crudo = (await todos()).get(clave);
  const n = crudo === undefined ? NaN : Number(crudo);
  if (!Number.isFinite(n)) return OPACIDAD_POR_DEFECTO[clave];
  return acotarOpacidad(n);
}

export function acotarOpacidad(n: number) {
  return Math.min(OPACIDAD_MAXIMA, Math.max(OPACIDAD_MINIMA, n));
}

export async function guardarAjuste(clave: string, valor: string) {
  await db.ajuste.upsert({
    where: { clave },
    create: { clave, valor },
    update: { valor },
  });
  invalidarAjustes();
}

/// Lo que necesita el procesamiento de una foto, de una sola consulta.
export async function leerOpacidades() {
  return {
    mosaico: await leerOpacidad(OPACIDAD_MOSAICO),
    centro: await leerOpacidad(OPACIDAD_CENTRO),
  };
}
