"use client";

import { useEffect, useRef, useState } from "react";

import { VisorPortfolio, type FotoDeVisor } from "./visor-portfolio";

export type FotoDestacada = FotoDeVisor & { url: string };

/// Cuánto tarda cada foto en recorrer la cinta. No es la velocidad en píxeles:
/// multiplicado por la cantidad de fotos da la vuelta completa, así que sumar
/// fotos alarga el recorrido en vez de acelerarlo. Con 6 segundos se lee cada
/// una sin apuro y sin que parezca que está quieta.
const SEGUNDOS_POR_FOTO = 6;

/// Cuánto crece la foto que está justo abajo del mouse.
const ACERCAMIENTO = 0.16;

/// A qué distancia del mouse, en píxeles, el efecto ya casi no se siente. Es lo
/// que hace que el acercamiento se reparta entre las vecinas en vez de aplicarse
/// sólo a una: con un radio corto, la foto de al lado quedaría en su tamaño
/// normal y el salto se vería como un escalón.
const RADIO = 320;

/**
 * El portfolio como una cinta que se desliza sola de derecha a izquierda.
 *
 * Todas las fotos van en una sola fila y con el mismo alto, cada una con su
 * ancho: ninguna se recorta. Una grilla obligaba a recortarlas a un rectángulo
 * igual para todas, que en un portfolio es justamente lo que no se puede hacer
 * —el encuadre es la mitad del trabajo—.
 *
 * Las de los costados se van desenfocando. Eso hace dos cosas: dice que la
 * cinta sigue más allá del borde en vez de terminar cortada, y manda el ojo al
 * centro, que es donde la foto se ve entera.
 *
 * La lista va repetida dos veces en el HTML. La animación corre exactamente
 * media pista, así que cuando termina y vuelve al principio, lo que se ve es
 * idéntico y el salto no existe.
 */
export function CintaPortfolio({ fotos }: { fotos: FotoDestacada[] }) {
  const marco = useRef<HTMLDivElement>(null);
  const [abierta, setAbierta] = useState<number | null>(null);

  useAcercamientoRepartido(marco);

  return (
    <>
      <div
        ref={marco}
        className="cinta-portfolio-marco relative w-screen left-1/2 -translate-x-1/2 overflow-hidden"
      >
        <ul
          className="cinta-portfolio relative z-0 flex gap-3 w-max py-2"
          style={
            { "--duracion-cinta": `${fotos.length * SEGUNDOS_POR_FOTO}s` } as React.CSSProperties
          }
        >
          {[0, 1].map((vuelta) =>
            fotos.map((foto, i) => (
              <li
                key={`${vuelta}-${foto.id}`}
                data-foto
                className="h-56 sm:h-72 lg:h-80 shrink-0 origin-center transition-transform duration-200 ease-out motion-reduce:transition-none"
                // El espacio de cada foto queda reservado antes de que cargue,
                // con la proporción que tiene en la base. Sin esto, la fila se
                // reacomoda sola a medida que van llegando las imágenes.
                style={{ aspectRatio: `${foto.ancho} / ${foto.alto}` }}
                // La segunda vuelta es la misma lista: para quien escucha la
                // página, repetirla sería leer el portfolio dos veces.
                aria-hidden={vuelta === 1}
              >
                <button
                  type="button"
                  onClick={() => setAbierta(i)}
                  tabIndex={vuelta === 1 ? -1 : undefined}
                  className="block w-full h-full rounded overflow-hidden border border-line bg-surface cursor-zoom-in"
                  aria-label={foto.titulo ? `Ver ${foto.titulo}` : "Ver la foto en grande"}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={foto.url}
                    alt={vuelta === 0 ? foto.titulo : ""}
                    className="w-full h-full object-cover"
                    // La primera vuelta se carga entera aunque esté fuera de
                    // pantalla. Es al revés de lo habitual, pero acá la foto que
                    // está a la derecha del borde va a entrar sola en unos
                    // segundos: si esperara a ser visible, la cinta mostraría
                    // huecos blancos mientras avanza. La segunda vuelta sí va
                    // perezosa, porque son las mismas direcciones y a esa altura
                    // ya están en la memoria del navegador.
                    loading={vuelta === 0 ? "eager" : "lazy"}
                    decoding="async"
                  />
                </button>
              </li>
            )),
          )}
        </ul>

        {/* El desenfoque de los costados, en dos capas por lado: una ancha y
            suave, otra angosta y más fuerte pegada al borde. Dos capas simples
            dan una progresión que una sola no logra, y ninguna pasa de 8px, que
            es donde el desenfoque empieza a costar caro. */}
        <Costado lado="left" ancho="28%" desenfoque="2px" />
        <Costado lado="left" ancho="12%" desenfoque="8px" />
        <Costado lado="right" ancho="28%" desenfoque="2px" />
        <Costado lado="right" ancho="12%" desenfoque="8px" />

        {/* Y encima, el fondo del sitio entrando desde los bordes: la cinta se
            va apagando en vez de terminar en un corte recto. */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-[15%] bg-gradient-to-r from-ground to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-[15%] bg-gradient-to-l from-ground to-transparent" />
      </div>

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

/**
 * El acercamiento que sigue al mouse y se reparte entre las fotos vecinas.
 *
 * La que está justo abajo del puntero crece del todo y las de al lado un poco
 * menos, cada vez menos a medida que se alejan. Es lo que hace que se sienta
 * como una superficie que se hunde bajo el dedo y no como una foto que se
 * enciende sola.
 *
 * Toca los estilos directamente, sin pasar por el estado de React: esto corre en
 * cada cuadro y hacer que React vuelva a dibujar sesenta veces por segundo es
 * exactamente la forma de que la animación empiece a saltar.
 */
function useAcercamientoRepartido(marco: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const elemento = marco.current;
    if (!elemento) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // En una pantalla táctil no hay puntero que seguir, y el efecto sólo
    // gastaría batería.
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    let x: number | null = null;
    let cuadro = 0;

    /// Lee dónde está cada foto y le aplica la escala que le toca según su
    /// distancia al puntero.
    const pintar = () => {
      const fotos = elemento.querySelectorAll<HTMLElement>("[data-foto]");

      if (x === null) {
        for (const foto of fotos) {
          foto.style.transform = "";
          foto.style.zIndex = "";
        }
        return;
      }

      // Primero se leen todas las posiciones y después se escriben todas las
      // escalas. Mezclar lecturas y escrituras obliga al navegador a recalcular
      // la página en el medio, una vez por foto.
      const centros: number[] = [];
      for (const foto of fotos) {
        const caja = foto.getBoundingClientRect();
        centros.push(caja.left + caja.width / 2);
      }

      fotos.forEach((foto, i) => {
        const distancia = (centros[i] - x!) / RADIO;
        const cerca = Math.exp(-distancia * distancia);
        foto.style.transform = `scale(${1 + ACERCAMIENTO * cerca})`;
        // La que está creciendo tiene que quedar por encima de sus vecinas.
        foto.style.zIndex = cerca > 0.5 ? "1" : "";
      });
    };

    /// La cinta se mueve sola, así que aunque el mouse se quede quieto lo que
    /// tiene abajo cambia todo el tiempo: hay que repintar por cuadro y no sólo
    /// cuando el puntero se mueve.
    const bucle = () => {
      pintar();
      cuadro = x === null ? 0 : requestAnimationFrame(bucle);
    };

    const seguir = (e: PointerEvent) => {
      x = e.clientX;
      // Se pinta en el acto y además se arranca el bucle. Responder en el mismo
      // evento es lo que hace que el efecto no dependa de que el próximo cuadro
      // llegue a tiempo.
      pintar();
      if (!cuadro) cuadro = requestAnimationFrame(bucle);
    };

    const soltar = () => {
      x = null;
      if (cuadro) cancelAnimationFrame(cuadro);
      cuadro = 0;
      pintar();
    };

    elemento.addEventListener("pointermove", seguir);
    elemento.addEventListener("pointerleave", soltar);

    return () => {
      elemento.removeEventListener("pointermove", seguir);
      elemento.removeEventListener("pointerleave", soltar);
      if (cuadro) cancelAnimationFrame(cuadro);
    };
  }, [marco]);
}

function Costado({
  lado,
  ancho,
  desenfoque,
}: {
  lado: "left" | "right";
  ancho: string;
  desenfoque: string;
}) {
  const haciaAdentro = lado === "left" ? "to right" : "to left";
  return (
    <div
      className="pointer-events-none absolute inset-y-0 z-10"
      style={{
        [lado]: 0,
        width: ancho,
        backdropFilter: `blur(${desenfoque})`,
        WebkitBackdropFilter: `blur(${desenfoque})`,
        // La máscara es lo que hace que el desenfoque sea progresivo: fuerte
        // contra el borde y desvaneciéndose hacia el centro.
        maskImage: `linear-gradient(${haciaAdentro}, black, transparent)`,
        WebkitMaskImage: `linear-gradient(${haciaAdentro}, black, transparent)`,
      }}
    />
  );
}
