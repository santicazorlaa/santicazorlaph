"use client";

import { useState } from "react";

import { precio } from "@/lib/format";
import {
  calcular,
  MAXIMO_ESCALONES,
  normalizar,
  PORCENTAJE_MAXIMO,
  type Escalon,
} from "@/lib/descuentos";

type Fila = { desde: string; porcentaje: string };

const aFilas = (escalones: Escalon[]): Fila[] => {
  const filas = escalones.map((e) => ({
    desde: String(e.desde),
    porcentaje: String(e.porcentaje),
  }));
  while (filas.length < MAXIMO_ESCALONES) filas.push({ desde: "", porcentaje: "" });
  return filas;
};

/**
 * Los escalones del descuento por cantidad.
 *
 * Muestra al lado el precio que queda para cada pack. Eso es lo que hace falta
 * en la práctica: uno no piensa "14%", piensa "que el pack de 3 salga nueve
 * mil", y el porcentaje es el medio para llegar ahí.
 */
export function DescuentosPanel({
  escalones,
  precioReferencia,
  aviso,
}: {
  escalones: Escalon[];
  /// Precio por foto de un partido real, para que el ejemplo no sea inventado.
  precioReferencia: number;
  aviso: string | null;
}) {
  const [filas, setFilas] = useState<Fila[]>(() => aFilas(escalones));

  const cambiar = (i: number, campo: keyof Fila, valor: string) => {
    setFilas((prev) => prev.map((f, j) => (i === j ? { ...f, [campo]: valor } : f)));
  };

  // Lo que se está viendo, pasado por el mismo filtro que usa el servidor al
  // guardar: así la vista previa no promete algo que después no queda.
  const enVista = normalizar(
    filas.map((f) => ({ desde: Number(f.desde), porcentaje: Number(f.porcentaje) })),
  );

  const sinGuardar =
    JSON.stringify(enVista) !== JSON.stringify(normalizar(escalones));

  return (
    <section className="border border-line rounded-lg p-5 mb-10">
      <h2 className="etiqueta text-muted mb-1">Descuento por cantidad</h2>
      <p className="text-sm text-muted mb-5 max-w-prose">
        Cuántas fotos hay que llevar para cada descuento. A la derecha ves cuánto saldría
        ese pack con el precio de <span className="cifra">{precio(precioReferencia)}</span>{" "}
        por foto. Dejá una fila vacía para no usarla.
      </p>

      {aviso && <p className="text-sm text-good mb-5">{aviso}</p>}

      <form method="POST" action="/api/admin/descuentos">
        <div className="grid gap-3 sm:grid-cols-2">
          {filas.map((fila, i) => {
            const desde = Number(fila.desde);
            const porcentaje = Number(fila.porcentaje);
            const valida =
              Number.isFinite(desde) && desde >= 2 && Number.isFinite(porcentaje) && porcentaje > 0;
            const cuenta = valida
              ? calcular(precioReferencia * desde, desde, [
                  { desde, porcentaje: Math.min(PORCENTAJE_MAXIMO, porcentaje) },
                ])
              : null;

            return (
              <div
                key={i}
                className="flex items-end gap-2 border border-line rounded-md p-3"
              >
                <div className="w-20">
                  <label
                    htmlFor={`desde-${i}`}
                    className="etiqueta text-[0.6rem] text-muted block mb-1"
                  >
                    Desde
                  </label>
                  <input
                    id={`desde-${i}`}
                    name={`desde${i}`}
                    type="number"
                    inputMode="numeric"
                    min={2}
                    step={1}
                    value={fila.desde}
                    onChange={(e) => cambiar(i, "desde", e.target.value)}
                    placeholder="—"
                    className="w-full bg-surface border border-line rounded px-2 py-1.5 cifra text-sm focus:border-accent outline-none"
                  />
                </div>
                <div className="w-20">
                  <label
                    htmlFor={`pct-${i}`}
                    className="etiqueta text-[0.6rem] text-muted block mb-1"
                  >
                    Descuento
                  </label>
                  <input
                    id={`pct-${i}`}
                    name={`pct${i}`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={PORCENTAJE_MAXIMO}
                    step={1}
                    value={fila.porcentaje}
                    onChange={(e) => cambiar(i, "porcentaje", e.target.value)}
                    placeholder="—"
                    className="w-full bg-surface border border-line rounded px-2 py-1.5 cifra text-sm focus:border-accent outline-none"
                  />
                </div>
                <p className="text-xs text-muted flex-1 min-w-0 pb-1.5 leading-snug">
                  {cuenta ? (
                    <>
                      <span className="cifra text-ink">{precio(cuenta.total)}</span>
                      <br />
                      el pack de {desde}
                    </>
                  ) : (
                    "sin usar"
                  )}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={!sinGuardar}
            className="etiqueta bg-accent-solid text-accent-ink rounded px-6 py-2.5 hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            Guardar descuentos
          </button>
          {sinGuardar && (
            <span className="text-xs text-muted">
              Sin guardar. Cambia lo que paga el comprador apenas lo guardes.
            </span>
          )}
        </div>
      </form>
    </section>
  );
}
