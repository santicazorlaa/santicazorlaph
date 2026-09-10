import { AvisoCargando, HuecoLinea, HuecoTitulo } from "@/components/huecos";

/**
 * Los legales mientras llegan.
 *
 * Tiene su propia espera y no usa la de la portada porque esa dibuja el
 * encabezado con la foto grande, y acá lo que viene es una página de texto: un
 * hueco con la forma equivocada confunde más de lo que acompaña.
 */
export default function Cargando() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <AvisoCargando texto="Cargando" />
      <HuecoTitulo className="w-2/3 max-w-md mb-8" />
      <div className="space-y-3" aria-hidden>
        {Array.from({ length: 10 }, (_, i) => (
          <HuecoLinea key={i} className={i % 4 === 3 ? "w-2/3" : "w-full"} />
        ))}
      </div>
    </div>
  );
}
