"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export type FiltroVenta = "pagadas" | "pendientes" | "todas";

/**
 * Pestañas de filtrado de ventas con respuesta visual inmediata.
 *
 * Al hacer clic en un filtro, el cambio en el servidor puede tardar unos
 * cientos de milisegundos en consultar la base. Sin un indicador, parece que el
 * clic no entró o que la página se colgó.
 *
 * Con `useTransition`:
 * 1. La pestaña tocada se activa visualmente al instante.
 * 2. Muestra un indicador pulsante activo mientras se traen los datos.
 * 3. La lista anterior se atenúa suavemente y muestra "Actualizando lista…".
 * 4. Al llegar los nuevos datos, la transición termina sola y la lista se
 *    ilumina al 100%.
 */
export function PanelVentas({
  filtroActual,
  cantPagadas,
  cantPendientes,
  cantTotal,
  botonLimpiar,
  children,
}: {
  filtroActual: FiltroVenta;
  cantPagadas: number;
  cantPendientes: number;
  cantTotal: number;
  botonLimpiar?: React.ReactNode;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filtroDeseado, setFiltroDeseado] = useState<FiltroVenta | null>(null);

  const filtroActivo = isPending && filtroDeseado ? filtroDeseado : filtroActual;

  const seleccionarFiltro = (nuevo: FiltroVenta) => {
    if (nuevo === filtroActual && !isPending) return;
    setFiltroDeseado(nuevo);
    startTransition(() => {
      router.push(`/admin/ventas?filtro=${nuevo}`);
    });
  };

  const botones: { id: FiltroVenta; etiqueta: string; cantidad: number }[] = [
    { id: "pagadas", etiqueta: "Pagadas", cantidad: cantPagadas },
    { id: "pendientes", etiqueta: "Pendientes / Carritos", cantidad: cantPendientes },
    { id: "todas", etiqueta: "Todas", cantidad: cantTotal },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 border-b border-line pb-4">
        <div className="flex flex-wrap items-center gap-2">
          {botones.map((b) => {
            const esActivo = filtroActivo === b.id;
            const esElQueCarga = isPending && filtroDeseado === b.id;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => seleccionarFiltro(b.id)}
                disabled={isPending}
                aria-pressed={esActivo}
                className={`etiqueta text-xs rounded-full px-4 py-1.5 transition-all flex items-center gap-2 select-none ${
                  esActivo
                    ? "bg-accent-solid text-accent-ink font-medium shadow-sm"
                    : "border border-line text-muted hover:border-accent hover:text-fg"
                } ${isPending ? "cursor-wait" : ""}`}
              >
                <span>
                  {b.etiqueta} ({b.cantidad})
                </span>
                {esElQueCarga && (
                  <span
                    aria-hidden
                    className="w-2 h-2 rounded-full bg-accent-ink animate-ping inline-block"
                  />
                )}
              </button>
            );
          })}

          {isPending && (
            <span
              role="status"
              className="text-xs text-accent flex items-center gap-1.5 ml-2 font-mono"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" />
              Actualizando lista…
            </span>
          )}
        </div>

        {botonLimpiar}
      </div>

      <div
        className={`transition-opacity duration-200 relative ${
          isPending ? "opacity-35 pointer-events-none" : "opacity-100"
        }`}
      >
        {isPending && (
          <div className="absolute inset-x-0 top-6 flex justify-center z-10">
            <span className="bg-surface/95 border border-line text-ink text-xs px-4 py-1.5 rounded-full shadow-md backdrop-blur flex items-center gap-2 font-mono">
              <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
              Cargando {filtroDeseado}…
            </span>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
