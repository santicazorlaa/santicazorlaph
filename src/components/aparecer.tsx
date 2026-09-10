"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Muestra lo que envuelve cuando llega a la pantalla: sube un poco y se hace
 * visible.
 *
 * El movimiento es corto —dieciséis píxeles— y va con `ease-out`, que arranca
 * rápido y frena al final. Es lo que corresponde a algo que entra: da la
 * sensación de que ya venía en camino y termina de acomodarse, en vez de
 * arrancar despacio y parecer pesado.
 *
 * Pasa una sola vez por elemento. Una sección que se desvanece cada vez que se
 * sube y se baja convierte el scroll en un parpadeo y cansa enseguida.
 *
 * El estado escondido se aplica desde el servidor, así que si algo saliera mal
 * con el JavaScript el contenido quedaría invisible. Por eso `globals.css`
 * revela todo cuando no hay JavaScript: el sitio se lee igual, sin animación.
 */
export function Aparecer({
  children,
  retraso = 0,
  className = "",
}: {
  children: React.ReactNode;
  /// Milisegundos de espera. Sirve para que una lista entre de a una en vez de
  /// toda junta, que es lo que hace que se lea como una secuencia.
  retraso?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const elemento = ref.current;
    if (!elemento) return;

    let listo = false;

    /// Se muestra si ya entró en pantalla, y también si quedó por encima: eso
    /// último es lo que salva el caso de un salto de scroll —entrar al sitio
    /// con un ancla, o recargar a media página—, donde la sección pasa de
    /// estar abajo a estar arriba sin haber sido visible en ningún momento.
    /// Sin esa segunda condición se quedaba invisible para siempre.
    const comprobar = () => {
      if (listo) return;
      const caja = elemento.getBoundingClientRect();
      // El 0.88 es el mismo margen que el observador: que haya entrado un poco
      // de verdad, no que asome el primer píxel.
      if (caja.top >= window.innerHeight * 0.88) return;
      listo = true;
      setVisible(true);
      observador.disconnect();
      window.removeEventListener("scroll", comprobar);
    };

    const observador = new IntersectionObserver(comprobar, {
      rootMargin: "0px 0px -12% 0px",
    });
    observador.observe(elemento);

    // El observador no avisa cuando un salto de scroll se saltea el elemento
    // entero, así que además se escucha el scroll. Es una comparación por
    // evento y sólo hasta que la sección apareció, momento en el que se quita.
    window.addEventListener("scroll", comprobar, { passive: true });
    comprobar();

    return () => {
      observador.disconnect();
      window.removeEventListener("scroll", comprobar);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`aparece ${visible ? "aparece-visible" : ""} ${className}`}
      style={visible && retraso ? { transitionDelay: `${retraso}ms` } : undefined}
    >
      {children}
    </div>
  );
}
