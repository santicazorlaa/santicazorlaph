"use client";

import { useEffect, useState } from "react";

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
  fase = "abierto",
  refFoto,
}: {
  fotos: FotoDeVisor[];
  indice: number;
  alCerrar: () => void;
  alCambiar: (indice: number) => void;
  /// En qué momento del vuelo está. Mientras la foto viaja entre la cinta y
  /// acá, la de adentro del visor se esconde: si no, se verían las dos, la que
  /// vuela y la que ya llegó. El fondo en cambio aparece desde el primer
  /// instante y se va antes de que la foto aterrice, así el visor se abre y se
  /// cierra alrededor del vuelo en vez de después.
  fase?: "entrando" | "abierto" | "saliendo";
  /// Deja ver desde afuera dónde quedó la foto grande. Es el destino del vuelo,
  /// y se toma de acá en vez de recalcularlo para que sea exactamente el mismo
  /// lugar: si fueran dos cuentas, la foto aterrizaría cerca pero no encima.
  refFoto?: React.Ref<HTMLImageElement>;
}) {
  const foto = fotos[indice];
  const [fondoPuesto, setFondoPuesto] = useState(false);

  // El fondo entra por transición, así que tiene que empezar apagado y
  // encenderse en el cuadro siguiente: montándolo ya encendido no habría nada
  // que animar.
  useEffect(() => {
    const t = requestAnimationFrame(() => setFondoPuesto(true));
    return () => cancelAnimationFrame(t);
  }, []);

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
      className="visor-portfolio fixed inset-0 z-50 grid place-items-center p-4 sm:p-10"
      onClick={alCerrar}
      role="dialog"
      aria-modal="true"
      aria-label={foto.titulo || "Foto del portfolio"}
    >
      {/* El fondo va aparte y no sobre el contenedor entero, porque tiene que
          poder desvanecerse por su cuenta mientras la foto todavía está
          volando. */}
      <div
        aria-hidden
        className={`absolute inset-0 bg-ground/85 backdrop-blur-xl transition-opacity duration-300 ease-out motion-reduce:transition-none ${
          fondoPuesto && fase !== "saliendo" ? "opacity-100" : "opacity-0"
        }`}
      />
      <button
        type="button"
        onClick={alCerrar}
        aria-label="Cerrar"
        className="absolute top-4 right-4 z-20 w-11 h-11 grid place-items-center rounded-full border border-line bg-ground/70 text-2xl leading-none con-mouse:hover:border-accent transition-colors"
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
      <figure
        onClick={(e) => e.stopPropagation()}
        className={`max-h-full relative ${fase === "abierto" ? "" : "invisible"}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={foto.id}
          ref={refFoto}
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
      // En el celular no se muestran. La pantalla es angosta y las flechas
      // caen justo encima de la foto —que es lo único que hay que mirar—,
      // tapándole los costados. Ahí se pasa de foto cerrando y abriendo otra,
      // que en una pantalla táctil es un gesto más natural que apuntarle a un
      // botón de once píxeles pegado al borde.
      className={`absolute top-1/2 -translate-y-1/2 z-20 w-11 h-11 hidden sm:grid place-items-center rounded-full border border-line bg-ground/70 text-xl leading-none con-mouse:hover:border-accent transition-colors ${
        lado === "izquierda" ? "left-3" : "right-3"
      }`}
    >
      {lado === "izquierda" ? "‹" : "›"}
    </button>
  );
}
