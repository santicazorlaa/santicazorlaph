"use client";

import { useFormStatus } from "react-dom";

/**
 * El botón de enviar un formulario, que se apaga solo mientras el envío está en
 * curso.
 *
 * No es un adorno: el formulario de "Nuevo partido" no daba ninguna señal de
 * que ya se había enviado, y así aparecieron seis partidos duplicados de un
 * mismo torneo. Apretar dos veces con la página quieta es lo más natural del
 * mundo cuando nada indica que pasó algo.
 *
 * Va en todos los formularios del panel, incluidos los de borrar: ahí el doble
 * clic no duplica nada, pero la duda de si se apretó bien es la misma.
 */
export function BotonEnvio({
  children,
  enviando,
  className = "",
  disabled = false,
  variante = "principal",
  "aria-label": etiquetaAccesible,
}: {
  children: React.ReactNode;
  enviando: string;
  className?: string;
  /// Para los formularios que además se apagan por su cuenta —el de precio y
  /// el de descuentos no dejan guardar si no cambió nada.
  disabled?: boolean;
  /// `discreto` es el botón de texto suelto (borrar, sacar la foto): ahí el
  /// punto de espera no se ve bien sobre el fondo, así que sólo cambia el
  /// texto.
  variante?: "principal" | "discreto";
  /// Para los botones que son un símbolo y no una palabra, como las flechas de
  /// ordenar el portfolio.
  "aria-label"?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      aria-label={etiquetaAccesible}
      className={`etiqueta transition-[opacity,transform] duration-150 ease-out active:scale-[0.98] ${
        pending ? "opacity-60 cursor-progress" : disabled ? "opacity-40 cursor-not-allowed" : ""
      } ${className}`}
    >
      {pending ? enviando : children}
      {pending && variante === "principal" && (
        <span aria-hidden className="senal-link senal-link-activa" />
      )}
    </button>
  );
}
