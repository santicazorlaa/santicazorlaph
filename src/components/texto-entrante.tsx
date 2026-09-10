"use client";

import { useEffect, useRef, useState } from "react";

/// Cuánto se demora cada palabra respecto de la anterior. Sesenta milisegundos
/// alcanzan para que se lea como algo que se va escribiendo solo; más que eso ya
/// se siente como esperar a que termine.
const ESCALON = 60;

/// Todo el barrido tiene un techo: en un título largo, cien palabras a 60ms
/// serían seis segundos. Pasado el tope, las últimas entran cada vez más juntas.
const DEMORA_MAXIMA = 700;

/**
 * Un texto que entra palabra por palabra al llegar a la pantalla: cada una sube
 * un poco, se enfoca y aparece.
 *
 * El desenfoque es la mitad del efecto. Sin él, una palabra que aparece de golpe
 * se lee como un parpadeo; saliendo de foco, se lee como algo que se termina de
 * acomodar. Es corto —seis píxeles— porque desenfocar es de las cosas más caras
 * que se le pueden pedir a un navegador.
 *
 * Va sobre títulos y frases sueltas, no sobre párrafos largos: leer un texto que
 * todavía se está armando cansa. Para bloques largos está `Aparecer`, que los
 * muestra enteros de una.
 */
export function TextoEntrante({
  children,
  className = "",
  as: Etiqueta = "p",
}: {
  children: string;
  className?: string;
  as?: "h1" | "h2" | "h3" | "p" | "span";
}) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const elemento = ref.current;
    if (!elemento) return;

    let listo = false;
    const comprobar = () => {
      if (listo) return;
      // Igual que en `Aparecer`: se muestra al entrar en pantalla y también si
      // quedó por encima, que es lo que pasa cuando el scroll se saltea el
      // bloque entero al entrar con un ancla.
      if (elemento.getBoundingClientRect().top >= window.innerHeight * 0.9) return;
      listo = true;
      setVisible(true);
      observador.disconnect();
      window.removeEventListener("scroll", comprobar);
    };

    const observador = new IntersectionObserver(comprobar, {
      rootMargin: "0px 0px -10% 0px",
    });
    observador.observe(elemento);
    window.addEventListener("scroll", comprobar, { passive: true });
    comprobar();

    return () => {
      observador.disconnect();
      window.removeEventListener("scroll", comprobar);
    };
  }, []);

  const palabras = children.split(" ");

  return (
    <Etiqueta ref={ref as React.Ref<never>} className={className}>
      {palabras.map((palabra, i) => (
        <span key={i} className="inline-block whitespace-pre">
          {/* Dos capas: la de afuera reserva el lugar de la palabra y la de
              adentro es la que se mueve. Animar la de afuera cambiaría el
              acomodo de la línea en cada cuadro. */}
          <span
            className={`palabra-entrante inline-block ${visible ? "palabra-visible" : ""}`}
            style={{
              transitionDelay: visible
                ? `${Math.min(i * ESCALON, DEMORA_MAXIMA + i)}ms`
                : undefined,
            }}
          >
            {palabra}
          </span>
          {i < palabras.length - 1 ? " " : ""}
        </span>
      ))}
    </Etiqueta>
  );
}
