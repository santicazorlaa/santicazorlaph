"use client";

import { useState } from "react";

import { VisorPortfolio, type FotoDeVisor } from "./visor-portfolio";
import { Aparecer } from "./aparecer";

export type FotoDeGrilla = FotoDeVisor & { url: string };

/**
 * El portfolio completo, en columnas de alto libre.
 *
 * Reparte igual que la galería de un partido: cada foto va a la columna más
 * corta mirando sólo las anteriores. Es a propósito y no un detalle —dejarle el
 * reparto al navegador con `columns` de CSS haría que todo se reacomodara cada
 * vez que entra una foto nueva—, y además así ninguna se recorta: cada una
 * conserva su proporción.
 */
export function GrillaPortfolio({ fotos }: { fotos: FotoDeGrilla[] }) {
  const [abierta, setAbierta] = useState<number | null>(null);

  return (
    <>
      {/* Dos columnas en pantallas chicas y tres en grandes. Son dos repartos
          distintos, no el mismo estirado: con tres columnas el equilibrio de
          alturas es otro, así que se calcula para cada caso. */}
      <Columnas fotos={fotos} columnas={2} clase="grid gap-3 grid-cols-2 items-start lg:hidden" alAbrir={setAbierta} />
      <Columnas fotos={fotos} columnas={3} clase="hidden lg:grid gap-3 grid-cols-3 items-start" alAbrir={setAbierta} />

      {abierta !== null && (
        <VisorPortfolio
          fotos={fotos}
          indice={abierta}
          alCerrar={() => setAbierta(null)}
          alCambiar={setAbierta}
        />
      )}
    </>
  );
}

function Columnas({
  fotos,
  columnas,
  clase,
  alAbrir,
}: {
  fotos: FotoDeGrilla[];
  columnas: number;
  clase: string;
  alAbrir: (indice: number) => void;
}) {
  return (
    <div className={clase}>
      {repartir(fotos, columnas).map((columna, c) => (
        <div key={c} className="flex flex-col gap-3">
          {columna.map(({ foto, indice }) => (
            <Aparecer key={foto.id} retraso={Math.min(indice, 6) * 50}>
              <button
                type="button"
                onClick={() => alAbrir(indice)}
                className="group block w-full rounded overflow-hidden border border-line bg-surface cursor-zoom-in"
                aria-label={foto.titulo ? `Ver ${foto.titulo}` : "Ver la foto en grande"}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={foto.url}
                  alt={foto.titulo}
                  width={foto.ancho}
                  height={foto.alto}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-auto con-mouse:group-hover:scale-[1.02] transition-transform duration-300 ease-out motion-reduce:transition-none"
                />
              </button>
            </Aparecer>
          ))}
        </div>
      ))}
    </div>
  );
}

/// Reparte las fotos entre las columnas, cada una a la más corta de ese
/// momento. La altura se mide en proporción al ancho de la columna, que es lo
/// que iguala fotos de distintas medidas.
function repartir(fotos: FotoDeGrilla[], columnas: number) {
  const resultado: { foto: FotoDeGrilla; indice: number }[][] = Array.from(
    { length: columnas },
    () => [],
  );
  const alturas = new Array(columnas).fill(0);

  fotos.forEach((foto, indice) => {
    const masCorta = alturas.indexOf(Math.min(...alturas));
    resultado[masCorta].push({ foto, indice });
    alturas[masCorta] += foto.alto / foto.ancho;
  });

  return resultado;
}
