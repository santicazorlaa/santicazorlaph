import { calcular, type Escalon } from "@/lib/descuentos";
import { precio } from "@/lib/format";

/**
 * La escala de precios, arriba de la galería.
 *
 * Muestra el precio POR FOTO de cada escalón, no el porcentaje. "20% menos"
 * obliga a hacer una cuenta antes de saber si conviene; "$2.800 cada una" se
 * entiende sin pensar, y es la cifra que se compara contra la de al lado.
 */
export function PreciosEscalonados({
  priceArs,
  escalones,
}: {
  priceArs: number;
  escalones: Escalon[];
}) {
  if (escalones.length === 0) return null;

  const mejor = escalones[escalones.length - 1];

  return (
    <div className="border border-line rounded-lg p-4 sm:p-5">
      <p className="font-medium">Cuantas más lleves, menos sale cada una</p>
      <p className="text-sm text-muted mt-1">
        El descuento se aplica solo al llegar a cada cantidad.
      </p>

      <ul className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4">
        <li className="border border-line rounded-md px-3 py-2.5">
          <span className="etiqueta text-[0.6rem] text-muted block">1 foto</span>
          <span className="cifra text-sm mt-1 block">{precio(priceArs)}</span>
          <span className="text-[0.65rem] text-muted">cada una</span>
        </li>

        {escalones.map((e) => {
          const cuenta = calcular(priceArs * e.desde, e.desde, escalones);
          const esElMejor = e.desde === mejor.desde;
          return (
            <li
              key={e.desde}
              className={`rounded-md px-3 py-2.5 border ${
                esElMejor ? "border-accent bg-accent/5" : "border-line"
              }`}
            >
              <span className="etiqueta text-[0.6rem] text-muted block">
                Desde {e.desde}
              </span>
              <span
                className={`cifra text-sm mt-1 block ${esElMejor ? "text-accent" : ""}`}
              >
                {precio(cuenta.unitario)}
              </span>
              <span className="text-[0.65rem] text-accent">
                {esElMejor ? `ahorrás ${e.porcentaje}%` : `−${e.porcentaje}%`}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="text-[0.7rem] text-muted mt-3">
        Se descargan al instante, en resolución completa y sin marca de agua.
      </p>
    </div>
  );
}
