"use client";

import { useState } from "react";

import { BotonEnvio } from "./boton-envio";

export type FotoComprada = {
  id: string;
  code: string;
  thumbUrl: string;
  partido: string;
  precio: string;
};

/**
 * Una venta en el panel, que se abre para ver qué fotos compró.
 *
 * Saber cuáles son importa más de lo que parece: cuando alguien escribe porque
 * no le llegó algo, la pregunta siempre es "¿qué compró?", y hasta ahora la
 * respuesta estaba sólo en la base.
 *
 * Se abre y se cierra con una animación corta: la fila ya está en pantalla y lo
 * que cambia es su tamaño, así que el movimiento es lo que explica de dónde
 * salió el detalle. Con el sistema en "menos movimiento" no se anima nada.
 */
export function Venta({
  email,
  instagram,
  fecha,
  cantidad,
  total,
  pagada,
  fotos,
  formId,
}: {
  email: string;
  instagram: string | null;
  fecha: string;
  cantidad: string;
  total: string;
  pagada: boolean;
  fotos: FotoComprada[];
  formId: string | null;
}) {
  const [abierta, setAbierta] = useState(false);

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <button
          type="button"
          onClick={() => setAbierta((v) => !v)}
          aria-expanded={abierta}
          className="etiqueta text-[0.65rem] text-muted con-mouse:hover:text-fg transition-colors w-4 shrink-0"
          aria-label={abierta ? "Ocultar las fotos" : "Ver las fotos"}
        >
          <span
            className={`inline-block transition-transform duration-200 ease-out ${
              abierta ? "rotate-90" : ""
            }`}
          >
            ›
          </span>
        </button>

        {formId ? (
          <input
            type="email"
            name="email"
            form={formId}
            defaultValue={email}
            className="text-sm flex-1 min-w-40 bg-transparent border border-transparent hover:border-line focus:border-accent rounded px-1.5 py-0.5 -mx-1.5 outline-none transition-colors"
          />
        ) : (
          <span className="text-sm flex-1 min-w-40 truncate px-1.5">{email}</span>
        )}

        <span className="text-sm text-muted tabular-nums">{fecha}</span>
        <span className="text-sm text-muted tabular-nums w-20 text-right">{cantidad}</span>
        <span className="text-sm tabular-nums w-24 text-right">{total}</span>
        <span
          className={`etiqueta text-[0.65rem] w-20 text-right ${pagada ? "text-good" : "text-muted"}`}
        >
          {pagada ? "Pagada" : "Pendiente"}
        </span>
        <span className="w-28 text-right">
          {formId && (
            <BotonEnvio
              enviando="Enviando…"
              className="text-[0.65rem] text-muted con-mouse:hover:text-accent"
            >
              Reenviar mail
            </BotonEnvio>
          )}
        </span>
      </div>

      {instagram && (
        <a
          href={`https://instagram.com/${instagram}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-accent con-mouse:hover:underline ml-9 inline-block mt-1"
        >
          @{instagram}
        </a>
      )}

      {/* El truco de las dos filas de grilla (0fr → 1fr) es lo que permite
          animar el despliegue sin saber de antemano cuánto mide el contenido. */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-250 ease-out motion-reduce:transition-none ${
          abierta ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <ul className="flex flex-wrap gap-3 pt-3 pb-1 pl-9">
            {fotos.map((foto) => (
              <li key={foto.id} className="w-24">
                <div className="aspect-[3/2] bg-surface rounded overflow-hidden border border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={foto.thumbUrl}
                    alt={`Foto ${foto.code}`}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="etiqueta text-[0.55rem] text-muted mt-1 truncate">
                  #{foto.code} · {foto.precio}
                </p>
                <p className="text-[0.6rem] text-muted truncate">{foto.partido}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </li>
  );
}
