import { AvisoCargando, HuecoGrilla, HuecoLinea, HuecoTitulo } from "@/components/huecos";

/**
 * Lo que se ve mientras viene una entrega.
 *
 * La pantalla consulta la base dos veces —la entrega y su primera tanda de
 * fotos— y además revisa el pase del PIN antes de poder dibujar nada. Sin esto,
 * el que entraba desde el link o acababa de escribir el PIN se quedaba mirando
 * la pantalla anterior, quieta, sin ninguna marca de que el toque llegó. La
 * galería de un partido ya tenía la suya y por eso se sentía más despierta.
 */
export default function Cargando() {
  return (
    <div className="mx-auto max-w-6xl px-5">
      <AvisoCargando texto="Abriendo la entrega" />

      <section className="py-10 sm:py-14 border-b border-line">
        <HuecoLinea className="w-40 mb-4 h-3" />
        <HuecoTitulo className="w-3/4 max-w-2xl" />
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
          <HuecoLinea className="w-24" />
          <HuecoLinea className="w-20" />
          <HuecoLinea className="w-28" />
        </div>
        <div className="mt-5">
          <HuecoLinea className="w-56 h-10" />
        </div>
      </section>

      <div className="py-8 space-y-6">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <HuecoLinea className="w-64 h-9" />
          <HuecoLinea className="w-32" />
        </div>
        <HuecoGrilla cantidad={16} />
      </div>
    </div>
  );
}
