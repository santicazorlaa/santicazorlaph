"use client";

import { useState } from "react";

import { DESCRIPCION_SLOT, NOMBRE_SLOT, SLOTS, type Slot } from "@/lib/marca-slots";

type Estado = { slot: Slot; propia: boolean; filename: string | null };
type Opacidades = { mosaico: number; centro: number };

const porcentaje = (n: number) => Math.round(n * 100);

export function MarcaDeAgua({
  estados,
  aviso,
  opacidades,
}: {
  estados: Estado[];
  aviso: string | null;
  opacidades: Opacidades;
}) {
  // El parámetro fuerza a recargar la imagen cuando se cambia la marca; sin él
  // el navegador muestra la anterior.
  const [version, setVersion] = useState(() => Date.now());
  const [mostrandoPreview, setMostrandoPreview] = useState(false);

  // Los controles se mueven en el navegador y recién se guardan al enviar, así
  // se puede probar cómo queda sin dejarlo aplicado.
  const [mosaico, setMosaico] = useState(() => porcentaje(opacidades.mosaico));
  const [centro, setCentro] = useState(() => porcentaje(opacidades.centro));
  const sinGuardar =
    mosaico !== porcentaje(opacidades.mosaico) || centro !== porcentaje(opacidades.centro);

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
                  className="etiqueta bg-accent-solid text-accent-ink rounded py-2.5 hover:opacity-90 transition-opacity"
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

      <form
        method="POST"
        action="/api/admin/marca"
        className="mt-6 pt-5 border-t border-line"
      >
        <input type="hidden" name="accion" value="opacidad" />

        <h3 className="etiqueta text-muted mb-1">Cuánto se ve la marca</h3>
        <p className="text-sm text-muted mb-5 max-w-prose">
          Más fuerte protege mejor la foto; más suave deja apreciarla y ayuda a que la
          compren. Movelo y mirá abajo cómo queda antes de guardar.
        </p>

        <div className="grid gap-5 sm:grid-cols-2">
          {(
            [
              ["mosaico", "Mosaico", mosaico, setMosaico],
              ["centro", "Marca del centro", centro, setCentro],
            ] as const
          ).map(([campo, titulo, valor, setValor]) => (
            <div key={campo}>
              <label
                htmlFor={`op-${campo}`}
                className="flex items-baseline justify-between gap-3 mb-2"
              >
                <span className="text-sm">{titulo}</span>
                <span className="cifra text-sm text-accent">{valor}%</span>
              </label>
              <input
                id={`op-${campo}`}
                name={campo}
                type="range"
                min={5}
                max={90}
                step={1}
                value={valor}
                onChange={(e) => setValor(Number(e.target.value))}
                className="w-full accent-[var(--color-accent)]"
              />
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={!sinGuardar}
            className="etiqueta bg-accent-solid text-accent-ink rounded px-6 py-2.5 hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            Guardar intensidad
          </button>
          {sinGuardar && (
            <span className="text-xs text-muted">
              Sin guardar. Sólo cambia las fotos que subas después.
            </span>
          )}
        </div>
      </form>

      {mostrandoPreview && (
        <div className="mt-6 pt-5 border-t border-line">
          <p className="text-xs text-muted mb-3">
            Así queda sobre la última foto que subiste, con el mismo procesamiento que ve
            el comprador. Si moviste los controles, se ve con esos valores aunque todavía
            no los hayas guardado.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/admin/marca/previsualizar?v=${version}&mosaico=${mosaico}&centro=${centro}`}
            alt="Previsualización de la marca de agua sobre una foto"
            className="w-full rounded-md border border-line"
          />
        </div>
      )}
    </section>
  );
}
