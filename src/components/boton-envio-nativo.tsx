"use client";

import { useEffect, useRef, useState } from "react";

/**
 * El mismo botón que se apaga al enviar, pero para los formularios que van
 * derecho a una dirección de la API (`method="POST" action="/api/..."`) en vez
 * de a una acción de servidor.
 *
 * Esos formularios los manda el navegador por su cuenta, no React, así que
 * `useFormStatus` —que es lo que usa el otro botón— nunca se entera. Acá el
 * aviso se toma del propio evento de envío del formulario.
 *
 * A propósito no se usa `disabled`: apagar el botón dentro del mismo evento que
 * lo envía puede llegar a impedir el envío según el navegador. Lo que se hace
 * en cambio es sacarle el puntero y bajarle la opacidad, que evita el segundo
 * clic sin tocar el primero.
 */
export function BotonEnvioNativo({
  children,
  enviando,
  className = "",
  variante = "principal",
}: {
  children: React.ReactNode;
  enviando: string;
  className?: string;
  variante?: "principal" | "discreto";
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [pendiente, setPendiente] = useState(false);

  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;

    const alEnviar = () => setPendiente(true);
    // Volver con la flecha "atrás" devuelve la página tal como estaba, botón
    // apagado incluido. Sin esto, el formulario queda muerto hasta recargar.
    const alVolver = () => setPendiente(false);

    form.addEventListener("submit", alEnviar);
    window.addEventListener("pageshow", alVolver);
    return () => {
      form.removeEventListener("submit", alEnviar);
      window.removeEventListener("pageshow", alVolver);
    };
  }, []);

  return (
    <button
      ref={ref}
      type="submit"
      aria-busy={pendiente}
      className={`etiqueta transition-[opacity,transform] duration-150 ease-out active:scale-[0.98] ${
        pendiente ? "opacity-60 cursor-progress pointer-events-none" : ""
      } ${className}`}
    >
      {pendiente ? enviando : children}
      {pendiente && variante === "principal" && (
        <span aria-hidden className="senal-link senal-link-activa" />
      )}
    </button>
  );
}
