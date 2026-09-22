import { AvisoCargando, HuecoLinea, HuecoTitulo } from "@/components/huecos";

/**
 * Lo que se ve mientras se cuenta la actividad de una entrega.
 *
 * Son cuatro consultas de agrupado contra la base antes de poder dibujar un
 * solo número, y con un lote grande eso se nota. Sin esto, tocar "Ver
 * actividad" dejaba la pantalla anterior quieta sin ninguna señal.
 */
export default function Cargando() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <AvisoCargando texto="Contando la actividad" />

      <HuecoLinea className="w-64 h-3 mb-6" />
      <HuecoLinea className="w-32 h-3 mb-3" />
      <HuecoTitulo className="w-2/3 max-w-lg" />
      <HuecoLinea className="w-full max-w-2xl mt-4" />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-8">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="border border-line rounded-lg p-4">
            <HuecoLinea className="w-12 h-8" />
            <HuecoLinea className="w-20 h-2 mt-3" />
            <HuecoLinea className="w-full h-2 mt-2" />
          </div>
        ))}
      </div>

      <HuecoLinea className="w-40 h-6 mt-12" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-5">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="border border-line rounded-lg overflow-hidden">
            <div className="hueco w-full aspect-[3/2]" />
            <div className="p-2.5">
              <HuecoLinea className="w-10 h-2" />
              <HuecoLinea className="w-8 h-5 mt-2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
