/**
 * Descuento por cantidad.
 *
 * Sin `server-only` a propósito: el carrito lo usa en el navegador para mostrar
 * cuánto se ahorra, y el servidor lo usa para cobrar. Tiene que ser la misma
 * cuenta en los dos lados, y por eso vive en un solo archivo sin nada alrededor.
 *
 * De todos modos, lo que se cobra lo decide siempre el servidor: acá el
 * navegador sólo muestra.
 */

export type Escalon = { desde: number; porcentaje: number };

/// Los escalones, de menor a mayor. Cambiarlos acá cambia lo que se muestra y
/// lo que se cobra a la vez.
export const ESCALONES: Escalon[] = [
  { desde: 3, porcentaje: 5 },
  { desde: 6, porcentaje: 8 },
  { desde: 10, porcentaje: 10 },
];

/// Qué descuento le toca a esta cantidad de fotos.
export function porcentajePara(cantidad: number): number {
  let porcentaje = 0;
  for (const e of ESCALONES) {
    if (cantidad >= e.desde) porcentaje = e.porcentaje;
  }
  return porcentaje;
}

/// El próximo escalón que todavía no alcanzó, para poder invitarlo a llegar.
/// Devuelve null si ya está en el mejor.
export function proximoEscalon(cantidad: number): Escalon | null {
  return ESCALONES.find((e) => cantidad < e.desde) ?? null;
}

export type Cuenta = {
  /// Lo que suman las fotos sin descuento.
  subtotal: number;
  porcentaje: number;
  /// Cuánto se ahorra, en pesos.
  ahorro: number;
  /// Lo que se paga.
  total: number;
};

export function calcular(subtotal: number, cantidad: number): Cuenta {
  const porcentaje = porcentajePara(cantidad);
  // Se redondea el total y el ahorro sale de la resta, así las dos cifras que
  // ve el comprador cierran entre sí y con lo que se le cobra.
  const total = Math.round(subtotal * (1 - porcentaje / 100));
  return { subtotal, porcentaje, ahorro: subtotal - total, total };
}

/**
 * Reparte el descuento entre las fotos, en pesos enteros, de modo que la suma
 * dé exactamente el total.
 *
 * Hace falta porque a MercadoPago se le manda una línea por foto: si cada línea
 * llevara el precio de lista, el comprador terminaría pagando sin descuento.
 * El redondeo de cada línea deja unos pesos de diferencia, y esa diferencia se
 * acomoda en la última para que el total cierre al peso.
 */
export function repartir(precios: number[], total: number): number[] {
  const bruto = precios.reduce((a, b) => a + b, 0);
  if (precios.length === 0) return [];
  if (bruto === 0 || total === bruto) return [...precios];

  const repartido = precios.map((p) => Math.round((p * total) / bruto));
  const diferencia = total - repartido.reduce((a, b) => a + b, 0);
  repartido[repartido.length - 1] += diferencia;
  return repartido;
}

/// Cómo se le cuenta al comprador, en una línea.
export function textoDeEscalones() {
  return ESCALONES.map((e) => `${e.desde} o más, ${e.porcentaje}%`).join(" · ");
}
