import "server-only";

import { db } from "./db";

/**
 * Los textos del sitio que Santi escribe desde el panel, sin tocar código.
 *
 * Viven en la misma tabla `Ajuste` que las perillas de la marca de agua: una
 * fila por texto. Sumar una sección nueva es sumar una clave acá, no migrar la
 * base.
 *
 * Regla que ordena todo esto: **lo que está vacío no se muestra**. Ninguna
 * sección sale al aire con un texto de relleno inventado, así el sitio nunca
 * promete algo que Santi no dijo. Las únicas que traen texto por defecto son
 * las que describen cómo funciona el sitio de verdad.
 */

export const CLAVES = [
  "hero.titular",
  "hero.bajada",
  "hero.fotoKey",
  "hero.fotoKeyCelular",
  "hero.origenKey",
  "hero.encuadreEscritorio",
  "hero.encuadreCelular",
  "sobre.titulo",
  "sobre.texto",
  "sobre.fotoKey",
  "sobre.origenKey",
  "servicios.titulo",
  "servicios.texto",
  "servicios.items",
  "pasos.items",
  "contacto.whatsapp",
  "contacto.mensaje",
  "contacto.titulo",
  "contacto.bajada",
  "contacto.instagram",
  "contacto.linkedin",
  "contacto.email",
  "legal.terminos",
  "legal.privacidad",
] as const;

export type Clave = (typeof CLAVES)[number];

/// Lo que trae el sitio si nunca se tocó el panel. Sólo tienen texto las
/// secciones que describen algo verificable: cómo se compra acá adentro.
const DEFECTOS: Record<Clave, string> = {
  "hero.titular": "Encontrá las fotos de tu partido",
  "hero.bajada":
    "Entrá al partido que jugaste, elegí las fotos que te gusten y llevátelas en alta resolución, sin marca de agua. Se descargan al instante, apenas se acredita el pago.",
  "hero.fotoKey": "",
  // La misma tapa recortada alta, para el celular. Son dos archivos porque son
  // dos recortes distintos de la misma foto, no dos tamaños de lo mismo.
  "hero.fotoKeyCelular": "",
  // Guarda dónde quedó el archivo tal como se subió, en el bucket privado. Es
  // lo que permite volver a generar la imagen con otra medida —como pasó al
  // descubrir que la tapa se veía borrosa— sin pedirle a Santi que la suba de
  // nuevo, y es también de donde salen los dos recortes cada vez que los
  // cambia.
  "hero.origenKey": "",
  // Qué pedazo de la foto se ve en cada pantalla, en fracciones ("x,y,w,h").
  // Vacío significa "el centro", que es lo que hacía el navegador solo.
  "hero.encuadreEscritorio": "",
  "hero.encuadreCelular": "",
  "sobre.titulo": "",
  "sobre.texto": "",
  "sobre.fotoKey": "",
  "sobre.origenKey": "",
  "servicios.titulo": "",
  "servicios.texto": "",
  "servicios.items": "",
  "pasos.items": [
    "Elegí tu partido|Buscá la fecha y el club en la lista de partidos publicados.",
    "Mirá las fotos y armá tu carrito|Están todas ahí, con marca de agua. Cuantas más lleves, menos pagás por cada una.",
    "Pagá y descargá|Se paga con MercadoPago: tarjeta, transferencia o efectivo. La descarga en alta resolución y sin marca aparece apenas se acredita.",
  ].join("\n"),
  "contacto.whatsapp": "",
  "contacto.mensaje": "Hola Santi, te escribo desde la web.",
  "contacto.titulo": "¿Tenés un evento en puerta?",
  "contacto.bajada": "Escribime y lo charlamos. Contame qué es, cuándo y dónde.",
  "contacto.instagram": "",
  "contacto.linkedin": "",
  "contacto.email": "",
  "legal.terminos": "",
  "legal.privacidad": "",
};

export type Contenido = Record<Clave, string>;

const TTL_MS = 30_000;
let cache: { valores: Contenido; vence: number } | null = null;

export function invalidarContenido() {
  cache = null;
}

export async function leerContenido(): Promise<Contenido> {
  if (cache && cache.vence > Date.now()) return cache.valores;

  const valores = { ...DEFECTOS };
  try {
    const filas = await db.ajuste.findMany({ where: { clave: { in: [...CLAVES] } } });
    for (const fila of filas) {
      // Guardar un texto vacío es la forma de apagar una sección, así que un
      // valor vacío pisa el defecto en vez de caer de nuevo en él.
      valores[fila.clave as Clave] = fila.valor;
    }
  } catch {
    // Si la tabla todavía no existe, el sitio sale con los defectos en vez de
    // no cargar.
  }

  cache = { valores, vence: Date.now() + TTL_MS };
  return valores;
}

export async function guardarContenido(cambios: Partial<Record<Clave, string>>) {
  for (const [clave, valor] of Object.entries(cambios)) {
    await db.ajuste.upsert({
      where: { clave },
      create: { clave, valor: valor ?? "" },
      update: { valor: valor ?? "" },
    });
  }
  invalidarContenido();
}

/**
 * Los pasos de "cómo funciona", guardados como "título|explicación", uno por
 * línea. Es el formato más simple que se puede escribir en un textarea sin
 * equivocarse, y si alguien se come el separador queda el título solo en vez
 * de romperse.
 */
export function leerPasos(texto: string) {
  return texto
    .split("\n")
    .map((linea) => linea.trim())
    .filter(Boolean)
    .map((linea) => {
      const corte = linea.indexOf("|");
      if (corte === -1) return { titulo: linea, detalle: "" };
      return {
        titulo: linea.slice(0, corte).trim(),
        detalle: linea.slice(corte + 1).trim(),
      };
    });
}

/// Los ítems de la sección de servicios: una línea, un ítem.
export function leerLineas(texto: string) {
  return texto
    .split("\n")
    .map((linea) => linea.trim().replace(/^[-•*]\s*/, ""))
    .filter(Boolean);
}

/**
 * El link de WhatsApp. El número se guarda como lo escriba Santi —con espacios,
 * guiones o el +— y acá se limpia, porque wa.me sólo acepta dígitos.
 */
export function linkWhatsapp(numero: string, mensaje: string) {
  const digitos = numero.replace(/\D/g, "");
  if (digitos.length < 8) return null;
  const texto = mensaje.trim();
  return `https://wa.me/${digitos}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;
}

/// Acepta el usuario suelto ("santicazorlaph"), con arroba o el link entero.
export function linkInstagram(valor: string) {
  const v = valor.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  return `https://instagram.com/${v.replace(/^@/, "")}`;
}

export function linkLinkedin(valor: string) {
  const v = valor.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  return `https://www.linkedin.com/in/${v.replace(/^@/, "")}`;
}
