export type FotoDestacada = {
  id: string;
  url: string;
  alto: number;
  ancho: number;
  titulo: string;
};

/// Cuánto tarda cada foto en recorrer la cinta. No es la velocidad en píxeles:
/// multiplicado por la cantidad de fotos da la vuelta completa, así que sumar
/// fotos alarga el recorrido en vez de acelerarlo. Con 6 segundos se lee cada
/// una sin apuro y sin que parezca que está quieta.
const SEGUNDOS_POR_FOTO = 6;

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
  const duracion = `${fotos.length * SEGUNDOS_POR_FOTO}s`;

  return (
    <div
      className="cinta-portfolio-marco relative w-screen left-1/2 -translate-x-1/2 overflow-hidden"
      aria-label="Fotos destacadas"
    >
      <ul
        className="cinta-portfolio relative z-0 flex gap-3 w-max"
        style={{ "--duracion-cinta": duracion } as React.CSSProperties}
      >
        {[0, 1].map((vuelta) =>
          fotos.map((foto) => (
            <li
              key={`${vuelta}-${foto.id}`}
              className="h-56 sm:h-72 lg:h-80 shrink-0 bg-surface rounded overflow-hidden border border-line"
              // El espacio de cada foto queda reservado antes de que cargue, con
              // la proporción que tiene en la base. Sin esto, la fila se
              // reacomoda sola a medida que van llegando las imágenes.
              style={{ aspectRatio: `${foto.ancho} / ${foto.alto}` }}
              // La segunda vuelta es la misma lista: para quien escucha la
              // página, repetirla sería leer el portfolio dos veces.
              aria-hidden={vuelta === 1}
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
  );
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
