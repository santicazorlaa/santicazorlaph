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
 */
export function BotonEnvio({
  children,
  enviando,
  className = "",
}: {
  children: React.ReactNode;
  enviando: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`etiqueta rounded-md transition-[opacity,transform] duration-150 ease-out disabled:opacity-60 disabled:cursor-progress active:scale-[0.98] ${className}`}
    >
      {pending ? enviando : children}
    </button>
  );
}
