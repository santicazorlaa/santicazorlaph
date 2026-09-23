import { calcular, type Escalon } from "@/lib/descuentos";
import { precio } from "@/lib/format";

/**
 * Variantes del aviso de descuento por cantidad, para comparar en /estilo.
 *
 * El actual (A) es la caja con grilla que hoy aparece arriba de la galería:
 * mucho peso visual para algo que el comprador todavía no necesita, porque
 * recién entró y no eligió ninguna foto. B y C bajan ese volumen sin esconder
 * la información: la mejor cifra sigue ahí, sólo que como una línea de texto
 * en vez de una tarjeta con borde y fondo.
 */
export function MuestraDescuento({
  priceArs,
  escalones,
}: {
  priceArs: number;
  escalones: Escalon[];
}) {
  if (escalones.length === 0) return null;

  const mejor = escalones[escalones.length - 1];
  const cuentaMejor = calcular(priceArs * mejor.desde, mejor.desde, escalones);
  const primero = escalones[0];
  const cuentaPrimero = calcular(priceArs * primero.desde, primero.desde, escalones);

  return (
    <div className="px-5 sm:px-8 py-10 sm:py-12 space-y-10">
      <div>
        <p className="etiqueta text-muted mb-3">A · Como está hoy</p>
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
        </div>
      </div>

      <div>
        <p className="etiqueta text-muted mb-3">B · Una línea sola</p>
        <p className="text-sm text-muted">
          Cuantas más lleves, menos sale cada una: desde{" "}
          <span className="cifra text-accent">{precio(cuentaPrimero.unitario)}</span> llevando{" "}
          {primero.desde}, hasta{" "}
          <span className="cifra text-accent">{precio(cuentaMejor.unitario)}</span> llevando{" "}
          {mejor.desde}+.
        </p>
      </div>

      <div>
        <p className="etiqueta text-muted mb-3">C · Línea + detalle a pedido</p>
        <details className="text-sm text-muted group">
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
      </div>
    </div>
  );
}
