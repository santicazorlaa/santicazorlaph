import { AvisoCargando, HuecoLinea, HuecoTitulo } from "@/components/huecos";

/**
 * La espera de la sección de ventas del panel.
 *
 * Muestra la silueta de los totales, las tres pestañas de filtro y las filas de
 * ventas mientras el servidor trae los datos de la base.
 */
export default function CargandoVentas() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <AvisoCargando texto="Cargando ventas" />
      <HuecoLinea className="w-20 h-3 mb-6" />
      <div className="flex flex-wrap items-baseline justify-between gap-4 mb-2">
        <HuecoTitulo className="w-36 h-10" />
        <HuecoLinea className="w-56 h-4" />
      </div>
      <HuecoLinea className="w-3/4 max-w-lg h-4 mb-6" />

      {/* Silueta de las pestañas */}
      <div className="flex items-center gap-2 mb-6 border-b border-line pb-4" aria-hidden>
        <div className="hueco w-28 h-7 rounded-full" />
        <div className="hueco w-44 h-7 rounded-full" />
        <div className="hueco w-24 h-7 rounded-full" />
      </div>

      {/* Silueta de las filas de ventas */}
      <div className="divide-y divide-line border-y border-line" aria-hidden>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="hueco w-4 h-4 rounded" />
              <div className="space-y-1">
                <HuecoLinea className="w-36 h-4" />
                <HuecoLinea className="w-48 h-3" />
              </div>
            </div>
            <div className="flex items-center gap-6">
              <HuecoLinea className="w-20 h-4" />
              <HuecoLinea className="w-16 h-4" />
              <HuecoLinea className="w-16 h-4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
