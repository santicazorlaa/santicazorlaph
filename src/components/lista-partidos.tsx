"use client";

import Link from "next/link";

import { Aparecer } from "./aparecer";
import { VeloDeLink } from "./senal-link";
import { useMemo, useState } from "react";

export type PartidoEnLista = {
  id: string;
  slug: string;
  title: string;
  fecha: string;
  fechaTexto: string;
  actualizado: string | null;
  location: string | null;
  category: string | null;
  fotos: number;
  precioTexto: string;
  portada: string | null;
};

const TODOS = "Todos";

/**
 * Los partidos publicados, con un filtro por deporte arriba.
 *
 * El filtro se calcula de lo que hay cargado, no de una lista fija: si Santi
 * sube un torneo de hockey, el botón "Hockey" aparece solo. Con un solo deporte
 * no se muestra ningún botón, porque filtrar entre una opción no es filtrar.
 */
export function ListaPartidos({ partidos }: { partidos: PartidoEnLista[] }) {
  const deportes = useMemo(() => {
    const vistos: string[] = [];
    for (const p of partidos) {
      if (p.category && !vistos.includes(p.category)) vistos.push(p.category);
    }
    return vistos;
  }, [partidos]);

  const [filtro, setFiltro] = useState(TODOS);
  const visibles =
    filtro === TODOS ? partidos : partidos.filter((p) => p.category === filtro);

  return (
    <>
      {deportes.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-8">
          {[TODOS, ...deportes].map((d) => {
            const activo = d === filtro;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setFiltro(d)}
                aria-pressed={activo}
                className={`etiqueta text-[0.7rem] rounded-full px-4 py-2 border transition-colors ${
                  activo
                    ? "bg-accent-solid text-accent-ink border-accent"
                    : "border-line text-muted con-mouse:hover:border-accent con-mouse:hover:text-ink"
                }`}
              >
                {d}
              </button>
            );
          })}
        </div>
      )}

      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {visibles.map((evento, i) => (
          <li key={evento.id}>
            {/* Entran de a una, con 60ms de diferencia. Es poco tiempo, pero
                alcanza para que se lea como una lista que se arma y no como un
                bloque que aparece de golpe. Se corta en la sexta: más allá,
                esperar a que aparezca lo que ya está en pantalla molesta. */}
            <Aparecer retraso={Math.min(i, 5) * 60} className="h-full">
            <Link
              href={`/e/${evento.slug}`}
              className="group block border border-line rounded-lg overflow-hidden con-mouse:hover:border-accent transition-colors h-full"
            >
              <div className="aspect-[3/2] bg-surface overflow-hidden relative">
                {evento.portada ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={evento.portada}
                    alt=""
                    className="w-full h-full object-cover con-mouse:group-hover:scale-[1.03] transition-transform duration-500"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full grid place-items-center text-muted text-sm">
                    Sin fotos
                  </div>
                )}
                {evento.actualizado && (
                  <span className="absolute top-3 left-3 etiqueta text-[0.6rem] bg-ground/80 backdrop-blur text-accent rounded-full px-3 py-1.5">
                    Actualizado {evento.actualizado}
                  </span>
                )}
                {/* El clic cae sobre la foto, así que la respuesta va acá y no
                    en un rincón: la tarjeta se apaga un poco mientras el
                    partido viene en camino. Sólo se ve si la espera es real. */}
                <VeloDeLink />
              </div>
              <div className="p-4">
                {evento.category && (
                  <p className="etiqueta text-[0.65rem] text-accent mb-1">{evento.category}</p>
                )}
                <h3 className="titulo text-xl con-mouse:group-hover:text-accent transition-colors text-balance">
                  {evento.title}
                </h3>
                <p className="mt-2 text-sm text-muted tabular-nums">
                  {evento.fechaTexto}
                  {evento.location ? ` · ${evento.location}` : ""}
                </p>
                <p className="mt-3 flex items-baseline justify-between text-sm">
                  <span className="text-muted tabular-nums">
                    {evento.fotos === 1 ? "1 foto" : `${evento.fotos} fotos`}
                  </span>
                  <span className="cifra">{evento.precioTexto} c/u</span>
                </p>
              </div>
            </Link>
            </Aparecer>
          </li>
        ))}
      </ul>
    </>
  );
}
