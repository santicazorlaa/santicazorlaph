import { AvisoCargando, HuecoLinea } from "@/components/huecos";

/** El carrito mientras llega. Su forma es la de siempre: las fotos a la
    izquierda y el resumen con el total a la derecha. */
export default function Cargando() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <AvisoCargando texto="Cargando el carrito" />
      <h1 className="titulo text-4xl sm:text-5xl mb-8">Tu carrito</h1>

      <div className="grid gap-10 lg:grid-cols-[1fr_20rem] items-start">
        <div className="space-y-4">
          <HuecoLinea className="w-40 h-3" />
          <div className="grid gap-3 grid-cols-3 sm:grid-cols-4" aria-hidden>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="hueco aspect-[3/2]" />
            ))}
          </div>
        </div>
        <div className="border border-line rounded-lg p-5 space-y-4" aria-hidden>
          <HuecoLinea className="w-24 h-3" />
          <HuecoLinea className="w-full" />
          <HuecoLinea className="w-2/3" />
          <div className="hueco h-12 w-full" />
          <div className="hueco h-12 w-full" />
        </div>
      </div>
    </div>
  );
}
