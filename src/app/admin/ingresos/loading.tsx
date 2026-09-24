import { AvisoCargando, HuecoLinea, HuecoTitulo } from "@/components/huecos";

/** La espera de la pantalla de ingresos: totales, pestañas y filas del listado. */
export default function CargandoIngresos() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <AvisoCargando texto="Cargando ingresos" />
      <HuecoLinea className="w-20 h-3 mb-6" />
      <HuecoTitulo className="w-40 h-10 mb-2" />
      <HuecoLinea className="w-3/4 max-w-lg h-4 mb-8" />

      <div className="grid gap-4 sm:grid-cols-3 mb-8" aria-hidden>
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="hueco h-24 rounded-lg" />
        ))}
      </div>

      <div className="flex items-center gap-2 mb-6 border-b border-line pb-4" aria-hidden>
        <div className="hueco w-24 h-7 rounded-full" />
        <div className="hueco w-28 h-7 rounded-full" />
        <div className="hueco w-24 h-7 rounded-full" />
      </div>

      <div className="divide-y divide-line border-y border-line" aria-hidden>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="py-3 flex items-center justify-between gap-4">
            <HuecoLinea className="w-32 h-4" />
            <HuecoLinea className="w-56 h-4" />
          </div>
        ))}
      </div>
    </div>
  );
}
