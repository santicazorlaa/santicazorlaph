/**
 * Las cuentas de "cuánta plata me queda de verdad", sin `server-only`: son
 * aritmética pura sobre fechas y montos, y así se leen solas.
 *
 * MercadoPago descuenta de cada cobro un porcentaje (su cargo más la retención
 * de Ingresos Brutos de Tucumán). Lo que se cuenta acá es el **neto**, lo que
 * cae de verdad en la cuenta. Las ventas por transferencia no pasan por
 * MercadoPago, así que no llevan ese descuento.
 */

export const COMISION_POR_DEFECTO = 12.61;

export type Vista = "dia" | "semana" | "mes";

export type VentaCobrada = {
  pagadaEn: Date;
  totalArs: number;
  /** true si el cobro pasó por MercadoPago y por lo tanto sufre el descuento. */
  conComision: boolean;
};

export type FilaIngreso = {
  clave: string;
  etiqueta: string;
  ventas: number;
  bruto: number;
  descuento: number;
  neto: number;
};

/// Argentina no tiene horario de verano: es UTC-3 todo el año.
const DESFASE_MS = -3 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;

const CANTIDAD: Record<Vista, number> = { dia: 30, semana: 12, mes: 12 };

/** Lo que queda de un cobro después del descuento, en pesos enteros. */
export function netoDe(total: number, porcentaje: number) {
  return Math.round(total * (1 - porcentaje / 100));
}

// Se trabaja con una fecha "corrida" al horario argentino y se lee siempre con
// los métodos UTC: así el día de una venta no depende de dónde corra el código.
function corrida(fecha: Date) {
  return new Date(fecha.getTime() + DESFASE_MS);
}

function inicioDe(vista: Vista, c: Date): Date {
  const d = new Date(Date.UTC(c.getUTCFullYear(), c.getUTCMonth(), c.getUTCDate()));
  if (vista === "semana") {
    const desdeLunes = (d.getUTCDay() + 6) % 7;
    d.setTime(d.getTime() - desdeLunes * DIA_MS);
  } else if (vista === "mes") {
    d.setUTCDate(1);
  }
  return d;
}

function anterior(vista: Vista, inicio: Date): Date {
  if (vista === "dia") return new Date(inicio.getTime() - DIA_MS);
  if (vista === "semana") return new Date(inicio.getTime() - 7 * DIA_MS);
  return new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() - 1, 1));
}

function claveDe(inicio: Date) {
  return inicio.toISOString().slice(0, 10);
}

const formato = {
  dia: new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }),
  semana: new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: "UTC" }),
  mes: new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" }),
};

function etiquetaDe(vista: Vista, inicio: Date) {
  const t = formato[vista].format(inicio).replace(/\./g, "");
  return vista === "semana" ? `Semana del ${t}` : t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * Agrupa las ventas por día, semana o mes y devuelve los períodos más recientes
 * primero, **incluidos los que no tuvieron ventas**: un día en cero también es
 * un dato, y sin la fila parecería que el listado se saltea fechas.
 */
export function agrupar(
  ventas: VentaCobrada[],
  vista: Vista,
  porcentaje: number,
  ahora: Date = new Date(),
): FilaIngreso[] {
  const filas = new Map<string, FilaIngreso>();
  const orden: string[] = [];

  let inicio = inicioDe(vista, corrida(ahora));
  for (let i = 0; i < CANTIDAD[vista]; i++) {
    const clave = claveDe(inicio);
    orden.push(clave);
    filas.set(clave, { clave, etiqueta: etiquetaDe(vista, inicio), ventas: 0, bruto: 0, descuento: 0, neto: 0 });
    inicio = anterior(vista, inicio);
  }

  for (const v of ventas) {
    const fila = filas.get(claveDe(inicioDe(vista, corrida(v.pagadaEn))));
    if (!fila) continue; // fuera de la ventana que se muestra
    const neto = v.conComision ? netoDe(v.totalArs, porcentaje) : v.totalArs;
    fila.ventas += 1;
    fila.bruto += v.totalArs;
    fila.neto += neto;
    fila.descuento += v.totalArs - neto;
  }

  return orden.map((c) => filas.get(c)!);
}

/// Cuánto hay que traer de la base para cubrir la vista más larga (12 meses).
export function desdeMasAntiguo(ahora: Date = new Date()): Date {
  const c = corrida(ahora);
  return new Date(Date.UTC(c.getUTCFullYear(), c.getUTCMonth() - 12, 1) - DESFASE_MS);
}
