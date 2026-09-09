import { fechaBreve, plural, precio } from "@/lib/format";

export type DatosMuestra = {
  titulo: string;
  fecha: Date;
  lugar: string | null;
  cantidadFotos: number;
  precioArs: number;
  portada: string | null;
  fotos: { id: string; code: string; thumbUrl: string }[];
};

/// Un recorte del sitio real —portada, tarjeta de partido y grilla— para poder
/// juzgar una variante con las fotos de Santi y no con cuadraditos de relleno.
export function Muestra({ datos }: { datos: DatosMuestra }) {
  return (
    <div className="px-5 sm:px-8 py-10 sm:py-12">
      <p className="etiqueta text-muted">Portada</p>

      <h2 className="titulo text-4xl sm:text-5xl mt-5 max-w-lg text-balance">
        Encontrá las fotos de tu partido
      </h2>
      <p className="mt-5 max-w-md text-muted">
        Entrá al partido que jugaste, elegí las fotos que te gusten y llevátelas en alta
        resolución, sin marca de agua.
      </p>

      <div className="mt-8 grid gap-6 sm:grid-cols-[minmax(0,20rem)_1fr] items-start">
        <div className="border border-line rounded-lg overflow-hidden">
          <div className="aspect-[3/2] bg-surface overflow-hidden">
            {datos.portada && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={datos.portada}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
              />
            )}
          </div>
          <div className="p-4">
            <h3 className="titulo text-xl text-balance">{datos.titulo}</h3>
            <p className="mt-2 text-sm text-muted tabular-nums">
              {fechaBreve(datos.fecha)}
              {datos.lugar ? ` · ${datos.lugar}` : ""}
            </p>
            <p className="mt-3 flex items-baseline justify-between text-sm">
              <span className="text-muted tabular-nums">
                {plural(datos.cantidadFotos, "foto", "fotos")}
              </span>
              <span className="cifra">{precio(datos.precioArs)} c/u</span>
            </p>
          </div>
        </div>

        <div>
          <p className="etiqueta text-accent tabular-nums">{fechaBreve(datos.fecha)}</p>
          <h3 className="titulo text-2xl sm:text-3xl mt-3 text-balance">{datos.titulo}</h3>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span className="etiqueta border border-line rounded-full px-4 py-2">
              Código de foto
            </span>
            <span className="etiqueta bg-accent-solid text-accent-ink rounded-full px-4 py-2">
              Agregar al carrito
            </span>
          </div>

          <ul className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {datos.fotos.map((foto) => (
              <li
                key={foto.id}
                className="relative aspect-[3/2] bg-surface rounded-md overflow-hidden border border-line"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={foto.thumbUrl}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <span className="etiqueta absolute top-2 left-2 bg-ground/80 backdrop-blur rounded px-2 py-1 text-[0.65rem]">
                  #{foto.code}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
