"use client";

import { useCart } from "./cart-context";
import { empujeHacia } from "@/lib/descuentos";
import { plural, precio } from "@/lib/format";

/**
 * Le dice al comprador dónde está parado dentro de la escala de precios.
 *
 * El mensaje cambia según cuán cerca esté, porque no es lo mismo avisarle a
 * alguien que todavía no tiene descuento que a alguien al que le falta una sola
 * foto para el mejor. Y siempre nombra el precio al que llegaría: "una más y te
 * quedan a $2.800" mueve, "5% más de descuento" hay que traducirlo.
 */
export function EmpujeDescuento({ compacto = false }: { compacto?: boolean }) {
  const cart = useCart();
  if (!cart.ready || cart.count === 0) return null;

  const precioDeLista = cart.subtotal / cart.count;
  const empuje = empujeHacia(cart.count, cart.escalones, precioDeLista);

  // Ya está en el mejor precio: no hay nada que pedirle, sólo confirmarle que
  // hizo bien.
  if (!empuje) {
    return (
      <div
        className={`border border-accent/40 bg-accent/5 rounded-md px-3 py-2.5 ${
          compacto ? "text-xs" : "text-sm"
        }`}
      >
        <span className="text-accent">Mejor precio desbloqueado.</span>{" "}
        <span className="text-muted">
          Cada foto te queda a <span className="cifra">{precio(cart.cuenta.unitario)}</span>,
          un {cart.cuenta.porcentaje}% menos.
        </span>
      </div>
    );
  }

  const yaTieneDescuento = cart.cuenta.porcentaje > 0;

  return (
    <div
      className={`border border-dashed border-line rounded-md px-3 py-2.5 ${
        compacto ? "text-xs" : "text-sm"
      }`}
    >
      <p className="text-muted">
        {yaTieneDescuento ? (
          <>
            Descuento activo. Sumá{" "}
            <span className="text-ink">
              {plural(empuje.faltan, "foto más", "fotos más")}
            </span>{" "}
            y cada una te queda a{" "}
            <span className="cifra text-accent">{precio(empuje.unitarioDestino)}</span>.
          </>
        ) : (
          <>
            {empuje.faltan === 1 ? "Te falta" : "Te faltan"}{" "}
            <span className="text-ink">
              {plural(empuje.faltan, "foto", "fotos")}
            </span>{" "}
            para que todas te queden a{" "}
            <span className="cifra text-accent">{precio(empuje.unitarioDestino)}</span> cada
            una.
          </>
        )}
      </p>

      <div
        className="mt-2 h-1 rounded-full bg-surface-2 overflow-hidden"
        role="progressbar"
        aria-valuenow={empuje.progreso}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progreso hacia el descuento del ${empuje.escalon.porcentaje}%`}
      >
        <div
          className="h-full bg-accent transition-[width] duration-300"
          style={{ width: `${empuje.progreso}%` }}
        />
      </div>
    </div>
  );
}
