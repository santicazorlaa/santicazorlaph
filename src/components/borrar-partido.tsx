"use client";

import { useState } from "react";

import { BotonEnvio } from "./boton-envio";
import { plural } from "@/lib/format";

/**
 * Botón de borrar un partido, con su confirmación.
 *
 * La confirmación no es un trámite: borrar se lleva también las fotos y los
 * originales del bucket, y eso no se deshace. Por eso el aviso dice cuántas
 * cosas se van a perder, y cuando hay fotos de por medio pide además tildar que
 * se entendió. Un partido vacío se borra de un clic; uno con 60 fotos, no.
 */
export function BorrarPartido({
  eventId,
  titulo,
  cantidadFotos,
  vendidas,
  action,
}: {
  eventId: string;
  titulo: string;
  cantidadFotos: number;
  /// Cuántas de sus fotos están en alguna compra.
  vendidas: number;
  action: (formData: FormData) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [entendido, setEntendido] = useState(false);

  // Una foto vendida no se puede borrar: alguien la compró y su link tiene que
  // seguir funcionando. La base lo impide igual; esto es para no hacerle perder
  // el viaje.
  if (vendidas > 0) {
    return (
      <span
        className="etiqueta text-[0.65rem] text-muted/60"
        title={`Tiene ${plural(vendidas, "foto vendida", "fotos vendidas")}. Se puede despublicar, pero no borrar.`}
      >
        No se puede borrar
      </span>
    );
  }

  const hayQueTildar = cantidadFotos > 0;
  const puedeBorrar = !hayQueTildar || entendido;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setEntendido(false);
          setAbierto(true);
        }}
        className="etiqueta text-[0.65rem] text-muted hover:text-danger transition-colors"
      >
        Borrar
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Borrar ${titulo}`}
          className="fixed inset-0 z-50 bg-ground/80 backdrop-blur-sm grid place-items-center p-5"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAbierto(false);
          }}
        >
          <div className="bg-surface border border-line rounded-lg p-6 max-w-md w-full">
            <h2 className="titulo text-2xl text-balance">Borrar {titulo}</h2>

            <p className="mt-4 text-sm text-muted">
              {cantidadFotos > 0 ? (
                <>
                  Se borra el partido y sus{" "}
                  <span className="text-ink">
                    {plural(cantidadFotos, "foto", "fotos")}
                  </span>
                  , incluidos los originales guardados. Esto no se puede deshacer.
                </>
              ) : (
                <>Este partido no tiene fotos. Se borra y listo.</>
              )}
            </p>

            {hayQueTildar && (
              <label className="mt-5 flex items-start gap-3 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={entendido}
                  onChange={(e) => setEntendido(e.target.checked)}
                  className="mt-0.5 accent-[var(--color-danger)]"
                />
                <span>
                  Entiendo que también se borran los originales de{" "}
                  {plural(cantidadFotos, "esa foto", "esas fotos")}.
                </span>
              </label>
            )}

            <div className="mt-6 flex flex-wrap gap-3 justify-end">
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="etiqueta border border-line rounded-full px-5 py-2.5 hover:border-ink transition-colors"
              >
                Cancelar
              </button>
              <form action={action}>
                <input type="hidden" name="eventId" value={eventId} />
                <BotonEnvio
                  enviando="Borrando"
                  disabled={!puedeBorrar}
                  className="rounded-full px-5 py-2.5 bg-danger text-ground inline-flex items-center"
                >
                  Borrar definitivamente
                </BotonEnvio>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
