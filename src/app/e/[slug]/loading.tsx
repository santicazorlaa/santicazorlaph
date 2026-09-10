import { AvisoCargando, HuecoGrilla, HuecoLinea, HuecoTitulo } from "@/components/huecos";

/**
 * Lo que se ve mientras viene un partido.
 *
 * La página del partido consulta la base tres veces —el partido, los escalones
 * de descuento y la primera tanda de fotos— antes de poder dibujar nada. Sin
 * esto, tocar una tarjeta en la portada dejaba la pantalla anterior quieta todo
 * ese rato, sin ninguna marca de que el toque llegó.
 */
export default function Cargando() {
  return (
    <div className="mx-auto max-w-6xl px-5">
      <AvisoCargando texto="Cargando el partido" />

      <section className="py-10 sm:py-14 border-b border-line">
        <HuecoLinea className="w-32 mb-4 h-3" />
        <HuecoTitulo className="w-3/4 max-w-2xl" />
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
          <HuecoLinea className="w-24" />
          <HuecoLinea className="w-20" />
          <HuecoLinea className="w-28" />
        </div>
      </section>

      <div className="mt-8">
        <HuecoLinea className="w-full max-w-lg h-12" />
      </div>

      <div className="py-8 space-y-6">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <HuecoLinea className="w-56 h-9" />
          <HuecoLinea className="w-32" />
        </div>
        <HuecoGrilla cantidad={16} />
      </div>
    </div>
  );
}
