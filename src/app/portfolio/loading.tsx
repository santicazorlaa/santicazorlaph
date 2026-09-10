import { AvisoCargando, HuecoGrilla, HuecoLinea, HuecoTitulo } from "@/components/huecos";

/** El portfolio mientras llega. */
export default function Cargando() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-16">
      <AvisoCargando texto="Cargando el portfolio" />
      <HuecoLinea className="w-20 h-3" />
      <HuecoTitulo className="w-2/3 max-w-xl mt-6 mb-3" />
      <HuecoLinea className="w-full max-w-xl mb-12" />
      <HuecoGrilla cantidad={12} />
    </div>
  );
}
