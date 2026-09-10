"use client";

import { useState } from "react";

import { BotonEnvio } from "./boton-envio";
import { calcular, type Escalon } from "@/lib/descuentos";
import { precio } from "@/lib/format";

/**
 * El precio por foto de un partido, con los packs calculados al lado.
 *
 * Los packs se recalculan mientras se escribe. Sin eso hay que poner un número,
 * guardar, ir a mirar el carrito y volver: tres pasos para responder "¿a cuánto
 * me queda el pack de cinco?", que es la pregunta que uno se hace justo cuando
 * está decidiendo el precio.
 */
export function PrecioPartido({
  eventId,
  precioActual,
  escalones,
  action,
}: {
  eventId: string;
  precioActual: number;
  escalones: Escalon[];
  action: (formData: FormData) => void;
}) {
  const [valor, setValor] = useState(String(precioActual));

  const n = Number(valor);
  const valido = Number.isFinite(n) && n >= 1;
  const sinGuardar = valido && Math.round(n) !== precioActual;

  return (
    <div>
      <h2 className="etiqueta text-muted mb-1">Precio por foto</h2>
      <p className="text-sm text-muted mb-4 max-w-prose">
        Se puede cambiar cuando quieras. Las compras ya hechas no se tocan: cada una
        guardó el precio que la foto tenía ese día.
      </p>

      <form action={action} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="eventId" value={eventId} />
        <div>
          <label htmlFor="priceArs" className="etiqueta text-muted block mb-1.5">
            Pesos
          </label>
          <input
            id="priceArs"
            name="priceArs"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="w-40 bg-surface border border-line rounded-md px-3 py-2.5 cifra focus:border-accent outline-none"
          />
        </div>
        <BotonEnvio
          enviando="Guardando"
          disabled={!sinGuardar}
          className="bg-accent-solid text-accent-ink rounded-md px-6 py-2.5 hover:opacity-90 inline-flex items-center"
        >
          Guardar
        </BotonEnvio>
      </form>

      {valido && escalones.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <p className="etiqueta text-[0.6rem] text-muted mb-3">
            Cómo quedan los packs {sinGuardar && <span className="text-accent">(sin guardar)</span>}
          </p>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-5 gap-y-3">
            <div>
              <dt className="text-xs text-muted">1 foto</dt>
              <dd className="cifra text-sm mt-0.5">{precio(Math.round(n))}</dd>
            </div>
            {escalones.map((e) => {
              const cuenta = calcular(Math.round(n) * e.desde, e.desde, escalones);
              return (
                <div key={e.desde}>
                  <dt className="text-xs text-muted">
                    {e.desde} fotos <span className="text-accent">−{e.porcentaje}%</span>
                  </dt>
                  <dd className="cifra text-sm mt-0.5">{precio(cuenta.total)}</dd>
                </div>
              );
            })}
          </dl>
        </div>
      )}
    </div>
  );
}
