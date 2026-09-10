/**
 * Los bloques grises que ocupan el lugar de lo que todavía viene en camino.
 *
 * Los usan los `loading.tsx`: apenas se toca un link, Next dibuja esto en el
 * acto y rellena con lo de verdad cuando llega. La pantalla cambia enseguida
 * aunque los datos tarden, que era la mitad de la queja de Santi —"no avisa que
 * te escuchó"—. La otra mitad, la de los botones, se contesta en cada botón.
 *
 * La forma importa: un hueco tiene que tener la silueta de lo que va a llegar.
 * Si es de cualquier tamaño, cuando entra el contenido real todo salta de lugar
 * y se lee peor que una pantalla en blanco.
 */

export function HuecoLinea({ className = "" }: { className?: string }) {
  return <div className={`hueco h-4 ${className}`} />;
}

export function HuecoTitulo({ className = "" }: { className?: string }) {
  return <div className={`hueco h-10 sm:h-14 ${className}`} />;
}

/**
 * La grilla de fotos, con la misma repartija en columnas que la galería y con
 * altos alternados: todas iguales se lee como una tabla, no como fotos.
 */
export function HuecoGrilla({ cantidad = 12 }: { cantidad?: number }) {
  const altos = ["h-40", "h-56", "h-48", "h-64"];
  const columnas = [0, 1, 2, 3];

  return (
    <div className="flex gap-3 items-start" aria-hidden>
      {columnas.map((c) => (
        <div
          key={c}
          className={`flex-1 min-w-0 flex flex-col gap-3 ${
            c === 2 ? "hidden sm:flex" : c === 3 ? "hidden lg:flex" : ""
          }`}
        >
          {Array.from({ length: Math.ceil(cantidad / 4) }, (_, i) => (
            <div key={i} className={`hueco w-full ${altos[(c + i) % altos.length]}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Las tarjetas de la lista de partidos: foto apaisada y dos renglones abajo. */
export function HuecoTarjetas({ cantidad = 3 }: { cantidad?: number }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {Array.from({ length: cantidad }, (_, i) => (
        <div key={i} className="border border-line rounded-lg overflow-hidden">
          <div className="hueco aspect-[3/2] rounded-none" />
          <div className="p-4 space-y-3">
            <HuecoLinea className="w-2/3 h-6" />
            <HuecoLinea className="w-1/2" />
            <HuecoLinea className="w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * El aviso para lectores de pantalla. Los huecos son `aria-hidden` —un bloque
 * gris no le dice nada a quien no lo ve—, así que el estado se cuenta acá.
 */
export function AvisoCargando({ texto = "Cargando" }: { texto?: string }) {
  return (
    <p role="status" aria-live="polite" className="sr-only">
      {texto}
    </p>
  );
}
