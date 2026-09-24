"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { Vista } from "@/lib/ingresos";

const BOTONES: { id: Vista; etiqueta: string }[] = [
  { id: "dia", etiqueta: "Por día" },
  { id: "semana", etiqueta: "Por semana" },
  { id: "mes", etiqueta: "Por mes" },
];

/**
 * Pestañas de período de la pantalla de ingresos. Como en las de ventas, la
 * tocada se activa en el acto y la lista vieja se atenúa mientras llega la
 * nueva: cambiar de vista consulta la base y no puede parecer que no pasó nada.
 */
export function PestanasIngresos({
  vistaActual,
  children,
}: {
  vistaActual: Vista;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deseada, setDeseada] = useState<Vista | null>(null);

  const activa = isPending && deseada ? deseada : vistaActual;

  const elegir = (nueva: Vista) => {
    if (nueva === vistaActual && !isPending) return;
    setDeseada(nueva);
    startTransition(() => {
      router.push(`/admin/ingresos?vista=${nueva}`);
    });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-6 border-b border-line pb-4">
        {BOTONES.map((b) => {
          const esActiva = activa === b.id;
          const cargando = isPending && deseada === b.id;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => elegir(b.id)}
              disabled={isPending}
              aria-pressed={esActiva}
              className={`etiqueta text-xs rounded-full px-4 py-1.5 transition-colors flex items-center gap-2 select-none ${
                esActiva
                  ? "bg-accent-solid text-accent-ink font-medium"
                  : "border border-line text-muted con-mouse:hover:border-accent con-mouse:hover:text-ink"
              } ${isPending ? "cursor-wait" : ""}`}
            >
              {b.etiqueta}
              {cargando && (
                <span aria-hidden className="w-2 h-2 rounded-full bg-accent-ink animate-ping inline-block" />
              )}
            </button>
          );
        })}
        {isPending && (
          <span role="status" className="text-xs text-accent flex items-center gap-1.5 ml-2 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" />
            Actualizando ingresos…
          </span>
        )}
      </div>

      <div className={`transition-opacity duration-200 ${isPending ? "opacity-35 pointer-events-none" : ""}`}>
        {children}
      </div>
    </div>
  );
}
