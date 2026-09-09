/**
 * Descuento por cantidad.
 *
 * Sin `server-only` a propósito: el carrito lo usa en el navegador para mostrar
 * cuánto se ahorra, y el servidor lo usa para cobrar. Tiene que ser la misma
 * cuenta en los dos lados, y por eso vive en un solo archivo sin nada alrededor.
 *
 * Los escalones se configuran desde el panel, así que ninguna función de acá
 * los da por sentado: siempre se le pasan. De todos modos, lo que se cobra lo
 * decide el servidor; acá el navegador sólo muestra.
 */

export type Escalon = { desde: number; porcentaje: number };

/// Con los que arranca el sitio si nadie tocó nada en el panel.
export const ESCALONES_POR_DEFECTO: Escalon[] = [
  { desde: 3, porcentaje: 14 },
  { desde: 5, porcentaje: 20 },
  { desde: 10, porcentaje: 31 },
  { desde: 15, porcentaje: 37 },
];

export const MAXIMO_ESCALONES = 5;

/// Cuánto puede llegar a descontarse. El tope no es un capricho: un error de
/// tipeo en el panel no puede terminar regalando las fotos.
export const PORCENTAJE_MAXIMO = 70;

/**
 * Deja una lista de escalones en condiciones: sin filas vacías, sin repetidos,
 * ordenada y acotada. Se usa tanto al leer de la base como al guardar, así que
 * lo que quede guardado y lo que se use para cobrar pasan por el mismo filtro.
 */
export function normalizar(escalones: Escalon[]): Escalon[] {
  const vistos = new Set<number>();
  return escalones
    .map((e) => ({
      desde: Math.round(e.desde),
      porcentaje: Math.round(e.porcentaje),
    }))
    .filter((e) => Number.isFinite(e.desde) && Number.isFinite(e.porcentaje))
    .filter((e) => e.desde >= 2 && e.porcentaje > 0)
    .map((e) => ({ ...e, porcentaje: Math.min(PORCENTAJE_MAXIMO, e.porcentaje) }))
    .sort((a, b) => a.desde - b.desde)
    .filter((e) => {
      if (vistos.has(e.desde)) return false;
      vistos.add(e.desde);
      return true;
    })
    .slice(0, MAXIMO_ESCALONES);
}

/// Formato guardado: "3:14,5:20,10:31,15:37". Se eligió algo legible de un
/// vistazo para que se pueda entender mirando la fila de la base.
export function escribir(escalones: Escalon[]): string {
  return normalizar(escalones)
    .map((e) => `${e.desde}:${e.porcentaje}`)
    .join(",");
}

export function leer(texto: string | null | undefined): Escalon[] {
  if (!texto) return ESCALONES_POR_DEFECTO;
  const escalones = texto
    .split(",")
    .map((par) => par.split(":"))
    .filter((p) => p.length === 2)
    .map(([desde, porcentaje]) => ({
      desde: Number(desde),
      porcentaje: Number(porcentaje),
    }))
    .filter((e) => Number.isFinite(e.desde) && Number.isFinite(e.porcentaje));

  const limpios = normalizar(escalones);
  // Una fila corrupta o vacía no puede dejar al sitio sin descuentos.
  return limpios.length > 0 ? limpios : ESCALONES_POR_DEFECTO;
}

/// Qué descuento le toca a esta cantidad de fotos.
export function porcentajePara(cantidad: number, escalones: Escalon[]): number {
  let porcentaje = 0;
  for (const e of escalones) {
    if (cantidad >= e.desde) porcentaje = e.porcentaje;
  }
  return porcentaje;
}

/// El próximo escalón que todavía no alcanzó, para poder invitarlo a llegar.
/// Devuelve null si ya está en el mejor.
export function proximoEscalon(cantidad: number, escalones: Escalon[]): Escalon | null {
  return escalones.find((e) => cantidad < e.desde) ?? null;
}

export type Cuenta = {
  /// Lo que suman las fotos sin descuento.
  subtotal: number;
  porcentaje: number;
  /// Cuánto se ahorra, en pesos.
  ahorro: number;
  /// Lo que se paga.
  total: number;
  /// A cuánto le queda cada foto. Es la cifra que mejor se compara contra el
  /// precio de lista, y la que hace ver el descuento sin tener que dividir.
  unitario: number;
};

export function calcular(
  subtotal: number,
  cantidad: number,
  escalones: Escalon[],
): Cuenta {
  const porcentaje = porcentajePara(cantidad, escalones);
  // Se redondea el total y el ahorro sale de la resta, así las dos cifras que
  // ve el comprador cierran entre sí y con lo que se le cobra.
  const total = Math.round(subtotal * (1 - porcentaje / 100));
  return {
    subtotal,
    porcentaje,
    ahorro: subtotal - total,
    total,
    unitario: cantidad > 0 ? Math.round(total / cantidad) : 0,
  };
}

export type Empuje = {
  escalon: Escalon;
  /// Cuántas fotos más hay que sumar para llegar.
  faltan: number;
  /// De 0 a 100, para dibujar cuán cerca está.
  progreso: number;
  /// A cuánto quedaría cada foto si llegara.
  unitarioDestino: number;
};

/**
 * Qué le falta para el próximo escalón, listo para mostrar.
 *
 * `precioDeLista` es lo que sale una foto suelta. En un carrito con fotos de
 * dos partidos a distinto precio es un promedio, que para invitar alcanza: la
 * cuenta exacta la hace igual el servidor al cobrar.
 */
export function empujeHacia(
  cantidad: number,
  escalones: Escalon[],
  precioDeLista: number,
): Empuje | null {
  const escalon = proximoEscalon(cantidad, escalones);
  if (!escalon) return null;
  return {
    escalon,
    faltan: escalon.desde - cantidad,
    progreso: Math.min(100, Math.round((cantidad / escalon.desde) * 100)),
    unitarioDestino: Math.round(precioDeLista * (1 - escalon.porcentaje / 100)),
  };
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
export function textoDeEscalones(escalones: Escalon[]) {
  return escalones.map((e) => `${e.desde} o más, ${e.porcentaje}%`).join(" · ");
}
