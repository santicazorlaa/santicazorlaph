"use client";

import { useEffect } from "react";

export type FotoDeVisor = {
  id: string;
  urlGrande: string;
  ancho: number;
  alto: number;
  titulo: string;
};

/**
 * La foto del portfolio en grande, sobre el resto de la página.
 *
 * El fondo se oscurece y se desenfoca en vez de taparse con un color plano: así
 * la página sigue estando ahí, apenas insinuada, y se entiende que esto es algo
 * que se abrió encima y se puede cerrar. Un fondo opaco parece otra pantalla.
 *
 * Se cierra con la ✕, con Escape o tocando fuera de la foto: las tres, porque
 * cada persona intenta una distinta y quedarse encerrado en una imagen es de las
 * cosas que más molestan.
 */
export function VisorPortfolio({
  fotos,
  indice,
  alCerrar,
  alCambiar,
}: {
  fotos: FotoDeVisor[];
  indice: number;
  alCerrar: () => void;
  alCambiar: (indice: number) => void;
}) {
  const foto = fotos[indice];

  useEffect(() => {
    const teclas = (e: KeyboardEvent) => {
      if (e.key === "Escape") alCerrar();
      if (e.key === "ArrowRight") alCambiar((indice + 1) % fotos.length);
      if (e.key === "ArrowLeft") alCambiar((indice - 1 + fotos.length) % fotos.length);
    };
    window.addEventListener("keydown", teclas);

    // Mientras la foto está abierta, la página de atrás no se mueve: si no, al
    // cerrar uno aparece en otro lado del sitio sin saber por qué.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", teclas);
      document.body.style.overflow = overflow;
    };
  }, [indice, fotos.length, alCerrar, alCambiar]);

  if (!foto) return null;

  return (
    <div
      className="visor-portfolio fixed inset-0 z-50 grid place-items-center p-4 sm:p-10 bg-ground/85 backdrop-blur-xl"
      onClick={alCerrar}
      role="dialog"
      aria-modal="true"
      aria-label={foto.titulo || "Foto del portfolio"}
    >
      <button
        type="button"
        onClick={alCerrar}
        aria-label="Cerrar"
        className="absolute top-4 right-4 z-10 w-11 h-11 grid place-items-center rounded-full border border-line bg-ground/70 text-2xl leading-none con-mouse:hover:border-accent transition-colors"
      >
        ×
      </button>

      {fotos.length > 1 && (
        <>
          <Flecha
            lado="izquierda"
            alTocar={() => alCambiar((indice - 1 + fotos.length) % fotos.length)}
          />
          <Flecha lado="derecha" alTocar={() => alCambiar((indice + 1) % fotos.length)} />
        </>
      )}

      {/* Frena el clic para que tocar la foto no cierre el visor: cerrar es lo
          que pasa al tocar *afuera*. */}
      <figure onClick={(e) => e.stopPropagation()} className="max-h-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={foto.id}
          src={foto.urlGrande}
          alt={foto.titulo}
          width={foto.ancho}
          height={foto.alto}
          className="visor-foto max-w-full max-h-[82vh] w-auto h-auto object-contain rounded"
        />
        {foto.titulo && (
          <figcaption className="text-sm text-muted text-center mt-3">{foto.titulo}</figcaption>
        )}
      </figure>
    </div>
  );
}

function Flecha({
  lado,
  alTocar,
}: {
  lado: "izquierda" | "derecha";
  alTocar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        alTocar();
      }}
      aria-label={lado === "izquierda" ? "Foto anterior" : "Foto siguiente"}
      className={`absolute top-1/2 -translate-y-1/2 z-10 w-11 h-11 grid place-items-center rounded-full border border-line bg-ground/70 text-xl leading-none con-mouse:hover:border-accent transition-colors ${
        lado === "izquierda" ? "left-3" : "right-3"
      }`}
    >
      {lado === "izquierda" ? "‹" : "›"}
    </button>
  );
}
