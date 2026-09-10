import { AvisoCargando, HuecoLinea, HuecoTitulo } from "@/components/huecos";

/**
 * La pantalla de la compra mientras se resuelve.
 *
 * Es la espera más larga del sitio y la que peor se aguanta: si la orden figura
 * pendiente, el servidor le pregunta a MercadoPago si hay un pago aprobado
 * antes de dibujar nada. Es la red de seguridad que evita que un pago cobrado
 * quede sin entregar, así que no se saca — pero el que acaba de pagar tiene que
 * ver algo mientras tanto, y no una pantalla congelada.
 */
export default function Cargando() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <AvisoCargando texto="Buscando tu compra" />

      <HuecoLinea className="w-40 mb-4 h-3" />
      <HuecoTitulo className="w-2/3 max-w-lg mb-4" />
      <div className="space-y-2 max-w-xl">
        <HuecoLinea className="w-full" />
        <HuecoLinea className="w-4/5" />
      </div>

      <p className="text-sm text-muted mt-8">
        Estamos confirmando tu pago con MercadoPago. Puede tardar unos segundos.
      </p>

      <ul className="grid gap-4 grid-cols-2 sm:grid-cols-3 mt-8" aria-hidden>
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="hueco aspect-[3/2]" />
        ))}
      </ul>
    </div>
  );
}
