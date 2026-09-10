"use client";

import { useEffect, useState } from "react";

import { BotonEnvioNativo } from "./boton-envio-nativo";
import { DESCRIPCION_SLOT, NOMBRE_SLOT, SLOTS, type Slot } from "@/lib/marca-slots";

type Estado = { slot: Slot; propia: boolean; filename: string | null };
type Ajustes = { mosaico: number; centro: number; calidad: number };

const porcentaje = (n: number) => Math.round(n * 100);

/// Lo que se le manda al servidor para previsualizar. La calidad ya viaja en la
/// escala en que se guarda; las opacidades, en porcentaje.
const aParametros = (a: Ajustes) =>
  `mosaico=${a.mosaico}&centro=${a.centro}&calidad=${a.calidad}`;

export function MarcaDeAgua({
  estados,
  aviso,
  ajustes,
}: {
  estados: Estado[];
  aviso: string | null;
  ajustes: Ajustes;
}) {
  // El parámetro fuerza a recargar la imagen cuando se cambia la marca; sin él
  // el navegador muestra la anterior.
  const [version, setVersion] = useState(() => Date.now());
  const [mostrandoPreview, setMostrandoPreview] = useState(false);

  // Los controles se mueven en el navegador y recién se guardan al enviar, así
  // se puede probar cómo queda sin dejarlo aplicado.
  const guardados = {
    mosaico: porcentaje(ajustes.mosaico),
    centro: porcentaje(ajustes.centro),
    calidad: Math.round(ajustes.calidad),
  };
  const [mosaico, setMosaico] = useState(guardados.mosaico);
  const [centro, setCentro] = useState(guardados.centro);
  const [calidad, setCalidad] = useState(guardados.calidad);

  const actuales = { mosaico, centro, calidad };
  const sinGuardar =
    mosaico !== guardados.mosaico ||
    centro !== guardados.centro ||
    calidad !== guardados.calidad;

  // La foto de muestra se vuelve a generar en el servidor, así que no puede
  // seguir el arrastre del control paso a paso: se espera a que la mano pare.
  const [enMuestra, setEnMuestra] = useState(actuales);
  const parametrosActuales = aParametros(actuales);
  const parametrosEnMuestra = aParametros(enMuestra);
  const regenerando = parametrosActuales !== parametrosEnMuestra;

  useEffect(() => {
    if (!regenerando) return;
    const t = setTimeout(() => setEnMuestra(actuales), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regenerando, parametrosActuales]);

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
                <BotonEnvioNativo
                  enviando="Subiendo"
                  className="bg-accent-solid text-accent-ink rounded py-2.5 hover:opacity-90 inline-flex items-center justify-center"
                >
                  Subir
                </BotonEnvioNativo>
              </form>

              {propia && (
                <form method="POST" action="/api/admin/marca">
                  <input type="hidden" name="slot" value={slot} />
                  <input type="hidden" name="accion" value="borrar" />
                  <BotonEnvioNativo
                    enviando="Volviendo…"
                    variante="discreto"
                    className="text-muted hover:text-danger"
                  >
                    Volver a mi logo
                  </BotonEnvioNativo>
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

        <h3 className="etiqueta text-muted mb-1">Cómo se publica cada foto</h3>
        <p className="text-sm text-muted mb-5 max-w-prose">
          Los dos primeros controlan cuánto se ve la marca: más fuerte protege mejor, más
          suave deja apreciar la foto y ayuda a que la compren. El tercero es la calidad de
          la foto grande: bajarla le deja menos material a quien quiera robarla y
          mejorarla con inteligencia artificial, pero también se ve peor. Movelos y mirá
          abajo cómo queda.
        </p>

        <div className="grid gap-5 sm:grid-cols-3">
          {(
            [
              ["mosaico", "Mosaico", "%", mosaico, setMosaico, 5, 90],
              ["centro", "Marca del centro", "%", centro, setCentro, 5, 90],
              ["calidad", "Calidad de la foto grande", "", calidad, setCalidad, 20, 90],
            ] as const
          ).map(([campo, titulo, unidad, valor, setValor, minimo, maximo]) => (
            <div key={campo}>
              <label
                htmlFor={`op-${campo}`}
                className="flex items-baseline justify-between gap-3 mb-2"
              >
                <span className="text-sm">{titulo}</span>
                <span className="cifra text-sm text-accent">
                  {valor}
                  {unidad}
                </span>
              </label>
              <input
                id={`op-${campo}`}
                name={campo}
                type="range"
                min={minimo}
                max={maximo}
                step={1}
                value={valor}
                onChange={(e) => {
                  setValor(Number(e.target.value));
                  setMostrandoPreview(true);
                }}
                className="w-full accent-[var(--color-accent)]"
              />
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <BotonEnvioNativo
            enviando="Guardando"
            className={`bg-accent-solid text-accent-ink rounded px-6 py-2.5 hover:opacity-90 inline-flex items-center ${
              sinGuardar ? "" : "opacity-40 pointer-events-none"
            }`}
          >
            Guardar intensidad
          </BotonEnvioNativo>
          {sinGuardar ? (
            <span className="text-xs text-muted">
              Sin guardar. Sólo cambia las fotos que subas después.
            </span>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMosaico(22);
                setCentro(26);
                setCalidad(62);
                setMostrandoPreview(true);
              }}
              className="etiqueta text-muted hover:text-ink transition-colors"
            >
              Volver a los valores originales
            </button>
          )}
        </div>
      </form>

      {mostrandoPreview && (
        <div className="mt-6 pt-5 border-t border-line">
          <p className="text-xs text-muted mb-3">
            Así queda sobre la última foto que subiste, con el mismo procesamiento que ve
            el comprador. Si moviste los controles, se ve con esos valores aunque todavía
            no los hayas guardado.
            {regenerando && <span className="text-accent"> Recalculando…</span>}
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/admin/marca/previsualizar?v=${version}&${parametrosEnMuestra}`}
            alt="Previsualización de la marca de agua sobre una foto"
            className={`w-full rounded-md border border-line transition-opacity ${
              regenerando ? "opacity-40" : ""
            }`}
          />
        </div>
      )}
    </section>
  );
}
