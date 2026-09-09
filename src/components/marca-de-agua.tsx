"use client";

import { useState } from "react";

import { DESCRIPCION_SLOT, NOMBRE_SLOT, SLOTS, type Slot } from "@/lib/marca-slots";

type Estado = { slot: Slot; propia: boolean; filename: string | null };

export function MarcaDeAgua({
  estados,
  aviso,
}: {
  estados: Estado[];
  aviso: string | null;
}) {
  // El parámetro fuerza a recargar la imagen cuando se cambia la marca; sin él
  // el navegador muestra la anterior.
  const [version, setVersion] = useState(() => Date.now());
  const [mostrandoPreview, setMostrandoPreview] = useState(false);

  return (
    <section className="border border-line rounded-lg p-5 mb-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-1">
        <h2 className="etiqueta text-muted">Marca de agua</h2>
        <button
          type="button"
          onClick={() => {
            setVersion(Date.now());
            setMostrandoPreview((v) => !v);
          }}
          className="etiqueta text-muted hover:text-ink transition-colors"
        >
          {mostrandoPreview ? "Ocultar" : "Ver cómo queda"}
        </button>
      </div>

      <p className="text-sm text-muted mb-5 max-w-prose">
        Por defecto se usa tu logo, que ya viene cargado en el proyecto. Si querés
        otra, subí un PNG con fondo transparente o un SVG. Se aplica a las fotos que
        subas de ahí en adelante.
      </p>

      {aviso && (
        <p
          className={`text-sm mb-5 ${
            aviso.startsWith("Listo") || aviso.startsWith("Volvimos")
              ? "text-good"
              : "text-danger"
          }`}
        >
          {aviso}
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        {SLOTS.map((slot) => {
          const estado = estados.find((e) => e.slot === slot);
          const propia = estado?.propia ?? false;

          return (
            <div key={slot} className="border border-line rounded-md p-4 flex flex-col gap-3">
              <div>
                <h3 className="font-medium">{NOMBRE_SLOT[slot]}</h3>
                <p className="text-xs text-muted mt-1">{DESCRIPCION_SLOT[slot]}</p>
              </div>

              <div className="bg-surface-2 rounded h-24 grid place-items-center p-3">
                {propia ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={`/api/admin/marca/${slot}?v=${version}`}
                    alt={`Marca propia para ${NOMBRE_SLOT[slot]}`}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-muted">Usando tu logo del proyecto</span>
                )}
              </div>

              {propia && estado?.filename && (
                <p className="text-xs text-muted truncate" title={estado.filename}>
                  {estado.filename}
                </p>
              )}

              <form
                method="POST"
                action="/api/admin/marca"
                encType="multipart/form-data"
                className="flex flex-col gap-2 mt-auto"
              >
                <input type="hidden" name="slot" value={slot} />
                <label className="sr-only" htmlFor={`file-${slot}`}>
                  Archivo para {NOMBRE_SLOT[slot]}
                </label>
                <input
                  id={`file-${slot}`}
                  type="file"
                  name="file"
                  accept="image/png,image/svg+xml"
                  required
                  className="block w-full text-xs text-muted file:mr-3 file:rounded file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-ink file:text-xs file:uppercase file:tracking-wider"
                />
                <button
                  type="submit"
                  className="etiqueta bg-accent text-accent-ink rounded py-2.5 hover:opacity-90 transition-opacity"
                >
                  Subir
                </button>
              </form>

              {propia && (
                <form method="POST" action="/api/admin/marca">
                  <input type="hidden" name="slot" value={slot} />
                  <input type="hidden" name="accion" value="borrar" />
                  <button
                    type="submit"
                    className="etiqueta text-muted hover:text-danger transition-colors"
                  >
                    Volver a mi logo
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </div>

      {mostrandoPreview && (
        <div className="mt-6 pt-5 border-t border-line">
          <p className="text-xs text-muted mb-3">
            Así queda sobre la última foto que subiste, con el mismo procesamiento que ve
            el comprador.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/admin/marca/previsualizar?v=${version}`}
            alt="Previsualización de la marca de agua sobre una foto"
            className="w-full rounded-md border border-line"
          />
        </div>
      )}
    </section>
  );
}
