"use client";

import { useState } from "react";

import { BotonEnvio } from "./boton-envio";

/**
 * Prende o apaga el precio por foto en la tarjeta de cada partido, en el
 * inicio. Apagado, ese precio se ve recién al entrar al partido.
 */
export function PrecioInicioPanel({
  mostrar,
  aviso,
}: {
  mostrar: boolean;
  aviso: string | null;
}) {
  const [valor, setValor] = useState(mostrar);
  const sinGuardar = valor !== mostrar;

  return (
    <section className="border border-line rounded-lg p-5 mb-10">
      <h2 className="etiqueta text-muted mb-1">Precio en el inicio</h2>
      <p className="text-sm text-muted mb-4 max-w-prose">
        Si lo apagás, la tarjeta de cada partido en el inicio no muestra cuánto sale cada
        foto. El precio se ve igual apenas se entra al partido.
      </p>

      {aviso && <p className="text-sm text-good mb-4">{aviso}</p>}

      <form method="POST" action="/api/admin/precio-inicio">
        <label className="flex items-center gap-3 text-sm w-fit cursor-pointer">
          <input
            type="checkbox"
            name="mostrar"
            value="1"
            checked={valor}
            onChange={(e) => setValor(e.target.checked)}
            className="w-4 h-4 accent-[var(--color-accent-solid)]"
          />
          Mostrar el precio por foto en el inicio
        </label>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <BotonEnvio
            enviando="Guardando"
            disabled={!sinGuardar}
            className="bg-accent-solid text-accent-ink rounded px-6 py-2.5 hover:opacity-90 inline-flex items-center"
          >
            Guardar
          </BotonEnvio>
          {sinGuardar && <span className="text-xs text-muted">Sin guardar.</span>}
        </div>
      </form>
    </section>
  );
}
