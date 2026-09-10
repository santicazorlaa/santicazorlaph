import { AvisoCargando, HuecoLinea, HuecoTitulo } from "@/components/huecos";

/**
 * El panel mientras llega, para todas sus pantallas.
 *
 * Va en `/admin` y no en cada apartado porque el panel entero tiene la misma
 * forma: un título arriba y bloques abajo. Todas sus pantallas consultan la
 * base sin caché —tienen que mostrar el número de ahora, no el de hace un
 * rato—, así que todas tienen esta espera.
 */
export default function Cargando() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <AvisoCargando texto="Cargando el panel" />
      <HuecoLinea className="w-24 h-3 mb-4" />
      <HuecoTitulo className="w-1/2 max-w-sm mb-10" />
      <div className="grid gap-5 sm:grid-cols-2" aria-hidden>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="border border-line rounded-lg p-5 space-y-3">
            <HuecoLinea className="w-1/3 h-3" />
            <HuecoLinea className="w-2/3 h-8" />
            <HuecoLinea className="w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
