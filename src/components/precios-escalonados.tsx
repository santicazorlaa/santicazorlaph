import { calcular, type Escalon } from "@/lib/descuentos";
import { precio } from "@/lib/format";

/**
 * El aviso de descuento por cantidad, arriba de la galería.
 *
 * Antes era una caja con borde y una grilla de 5 tarjetas, apenas se entraba
 * al partido y sin haber elegido ninguna foto todavía: mucho peso visual para
 * algo que el comprador recién va a necesitar. Ahora es una sola línea, con el
 * mejor precio como anzuelo; el detalle de cada escalón queda a un clic
 * (`<details>`), para el que ya está pensando en llevar varias.
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
  const cuentaMejor = calcular(priceArs * mejor.desde, mejor.desde, escalones);

  return (
    <details className="text-sm text-muted">
      <summary className="cursor-pointer list-none marker:content-none con-mouse:hover:text-ink transition-colors">
        Cuantas más lleves, menos sale cada una: hasta{" "}
        <span className="cifra text-accent">{precio(cuentaMejor.unitario)}</span> llevando{" "}
        {mejor.desde}+.{" "}
        <span className="underline underline-offset-2">Ver los precios</span>
      </summary>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        <li>
          <span className="text-muted">1 foto </span>
          <span className="cifra">{precio(priceArs)}</span>
        </li>
        {escalones.map((e) => {
          const cuenta = calcular(priceArs * e.desde, e.desde, escalones);
          return (
            <li key={e.desde}>
              <span className="text-muted">{e.desde}+ </span>
              <span className="cifra text-accent">{precio(cuenta.unitario)}</span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
