import "server-only";

import { db } from "./db";

/**
 * Perillas del sitio que Santi puede cambiar desde el panel. Viven en la tabla
 * `Ajuste`, una fila por perilla, y se leen cada vez que se procesa una foto:
 * por eso el cache.
 */

/// Cuánto se ve cada marca sobre la foto, de 0 a 1.
export const OPACIDAD_MOSAICO = "marca.opacidad.mosaico";
export const OPACIDAD_CENTRO = "marca.opacidad.centro";
/// Calidad JPEG de la vista ampliada, de 0 a 100.
export const CALIDAD_PREVIEW = "foto.calidad.preview";

type Rango = { min: number; max: number; defecto: number };

/// Los límites de cada perilla, y con qué valor venía el sitio.
export const RANGOS: Record<string, Rango> = {
  // Menos de esto es una marca que no protege; más, una que tapa la foto y no
  // deja decidir si comprarla.
  [OPACIDAD_MOSAICO]: { min: 0.05, max: 0.9, defecto: 0.22 },
  [OPACIDAD_CENTRO]: { min: 0.05, max: 0.9, defecto: 0.26 },
  // Por debajo de 20 la foto se vuelve un mosaico de cuadrados y no se entiende
  // qué se está comprando. Por arriba de 90 el archivo pesa de más sin verse
  // mejor.
  [CALIDAD_PREVIEW]: { min: 20, max: 90, defecto: 62 },
};

export function acotar(clave: string, n: number) {
  const r = RANGOS[clave];
  if (!r) return n;
  return Math.min(r.max, Math.max(r.min, n));
}

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

export async function leerNumero(clave: string): Promise<number> {
  const crudo = (await todos()).get(clave);
  const n = crudo === undefined ? NaN : Number(crudo);
  if (!Number.isFinite(n)) return RANGOS[clave].defecto;
  return acotar(clave, n);
}

export async function guardarAjuste(clave: string, valor: string) {
  await db.ajuste.upsert({
    where: { clave },
    create: { clave, valor },
    update: { valor },
  });
  invalidarAjustes();
}

/// Todo lo que necesita el procesamiento de una foto, de una sola lectura.
export type AjustesDeFoto = { mosaico: number; centro: number; calidad: number };

export async function leerAjustesDeFoto(): Promise<AjustesDeFoto> {
  await todos(); // una sola consulta; las tres lecturas de abajo salen del cache
  return {
    mosaico: await leerNumero(OPACIDAD_MOSAICO),
    centro: await leerNumero(OPACIDAD_CENTRO),
    calidad: await leerNumero(CALIDAD_PREVIEW),
  };
}
