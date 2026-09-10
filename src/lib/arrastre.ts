/**
 * El arrastre de la cinta con el dedo o con el mouse, y la inercia al soltar.
 *
 * No usa React a propósito: esto se lee y se escribe en cada cuadro, y hacer
 * que React vuelva a dibujar sesenta veces por segundo es exactamente la forma
 * de que la animación empiece a saltar. Es la misma razón por la que el efecto
 * lupa toca los estilos directamente.
 *
 * Sobre los eventos: va con Pointer Events y no con `mouse` + `touch` por
 * separado. Un solo juego de eventos cubre dedo, mouse y lápiz, y
 * `setPointerCapture` hace que el gesto siga siendo nuestro aunque el dedo se
 * salga de la cinta — sin eso, arrastrar rápido y salirse por arriba deja la
 * cinta pegada al dedo para siempre.
 *
 * Y sobre el scroll de la página: el elemento lleva `touch-action: pan-y`, que
 * le dice al navegador "el movimiento horizontal lo manejo yo, el vertical es
 * tuyo". Con eso se puede arrastrar la cinta de costado y seguir scrolleando la
 * página para abajo con el mismo dedo, sin que una cosa robe la otra.
 */

/// Cuánta velocidad conserva por cuadro al soltar. Con 0,94 la cinta recorre
/// un poco más de lo que la mano llegó a empujar y frena sola en menos de un
/// segundo: se siente como algo con peso, no como algo que se apaga.
const FRICCION = 0.94;

/// Debajo de esta velocidad ya no se distingue el movimiento y sigue costando
/// un cuadro entero, así que se corta.
const VELOCIDAD_MINIMA = 0.08;

/// Cuánto espera, después de que la mano soltó y la inercia frenó, antes de
/// que la cinta vuelva a andar sola. Sin esta pausa la cinta arranca encima del
/// dedo que la acaba de acomodar.
const ESPERA_ANTES_DE_SEGUIR = 1000;

/// Un movimiento más corto que esto fue un toque, no un arrastre. Es lo que
/// separa "quiero ver esta foto" de "quiero mover la cinta": sin el umbral,
/// cualquier temblor de la mano al tocar abriría el visor.
const UMBRAL_DE_ARRASTRE = 6;

export type Arrastre = ReturnType<typeof crearArrastre>;

export function crearArrastre({
  elemento,
  alCorrer,
  conInercia = true,
}: {
  elemento: HTMLElement;
  /// Si al soltar la cinta sigue de largo y frena sola. Se apaga cuando el
  /// sistema pide menos movimiento: ahí la cinta se mueve lo que la mano la
  /// movió y ni un píxel más.
  conInercia?: boolean;
  /// Cuánto se movió la cinta, en píxeles. Positivo cuando la mano la lleva
  /// hacia la izquierda, que es el sentido en el que la cinta avanza sola.
  alCorrer: (delta: number) => void;
}) {
  let arrastrando = false;
  let ocupada = false;
  let frenando = false;
  let velocidad = 0;
  let recorrido = 0;
  let ultimaPos = 0;
  let ultimoTiempo = 0;
  let punteroActivo: number | null = null;
  let capturado = false;
  let esperando: ReturnType<typeof setTimeout> | null = null;

  const programarReanudacion = () => {
    if (esperando) clearTimeout(esperando);
    esperando = setTimeout(() => {
      ocupada = false;
      frenando = false;
      esperando = null;
    }, ESPERA_ANTES_DE_SEGUIR);
  };

  const empezar = (e: PointerEvent) => {
    // Sólo el botón principal del mouse. Con el botón derecho se abre el menú
    // del navegador y el gesto nunca termina.
    if (e.pointerType === "mouse" && e.button !== 0) return;

    arrastrando = true;
    ocupada = true;
    frenando = false;
    velocidad = 0;
    recorrido = 0;
    ultimaPos = e.clientX;
    ultimoTiempo = performance.now();
    punteroActivo = e.pointerId;

    if (esperando) {
      clearTimeout(esperando);
      esperando = null;
    }

    // Acá **no** se captura el puntero, y eso es lo importante.
    //
    // Capturar de entrada rompe el clic: con la captura puesta sobre la cinta,
    // el `click` que viene después ya no le llega al botón de la foto —se lo
    // queda la cinta— y tocar una foto dejaba de abrirla. La captura recién se
    // toma cuando el movimiento confirma que esto es un arrastre y no un toque
    // (ver `mover`), que es justo cuando hace falta: para que el gesto siga
    // siendo nuestro aunque el dedo se vaya de la cinta.
    elemento.style.cursor = "grabbing";
  };

  const mover = (e: PointerEvent) => {
    if (!arrastrando || e.pointerId !== punteroActivo) return;

    const ahora = performance.now();
    const delta = ultimaPos - e.clientX;
    recorrido += Math.abs(delta);

    // La velocidad se mide en píxeles por cuadro de 60 por segundo, para que
    // la inercia después se pueda sumar directo cuadro a cuadro. El piso de
    // 8ms evita que dos eventos casi simultáneos den una velocidad enorme.
    // Recién ahora, con el gesto ya confirmado como arrastre, se pide la
    // captura: de acá en más el dedo puede salirse de la cinta y los eventos
    // nos siguen llegando. Si el navegador no la da, el arrastre igual anda
    // mientras el dedo no se vaya.
    if (!capturado && recorrido > UMBRAL_DE_ARRASTRE) {
      try {
        elemento.setPointerCapture(e.pointerId);
        capturado = true;
      } catch {
        // Sin captura, y listo.
      }
    }

    const dt = Math.max(8, ahora - ultimoTiempo);
    const instantanea = (delta / dt) * 16.6;
    // Promedio corrido: la velocidad del último instante pesa más, pero no
    // manda sola. Sin esto, soltar justo en un tirón manda la cinta volando.
    velocidad = velocidad * 0.4 + instantanea * 0.6;

    alCorrer(delta);

    ultimaPos = e.clientX;
    ultimoTiempo = ahora;
  };

  const soltar = (e: PointerEvent) => {
    if (!arrastrando || e.pointerId !== punteroActivo) return;
    arrastrando = false;
    elemento.style.cursor = "";

    if (capturado) {
      try {
        elemento.releasePointerCapture(e.pointerId);
      } catch {
        // Ya la había soltado el navegador.
      }
      capturado = false;
    }
    punteroActivo = null;

    if (conInercia && Math.abs(velocidad) > 0.5) frenando = true;
    else programarReanudacion();
  };

  elemento.addEventListener("pointerdown", empezar);
  elemento.addEventListener("pointermove", mover);
  elemento.addEventListener("pointerup", soltar);
  elemento.addEventListener("pointercancel", soltar);

  return {
    /// Si la mano tiene la cinta agarrada ahora mismo.
    get arrastrando() {
      return arrastrando;
    },
    /// Si la cinta está bajo control de la mano: arrastrándose, frenando por
    /// inercia, o en la pausa antes de volver a andar sola.
    get ocupada() {
      return ocupada;
    },
    /// Si el gesto que acaba de terminar fue un arrastre y no un toque. Lo
    /// consulta el clic de cada foto antes de abrir el visor.
    fueArrastre() {
      return recorrido > UMBRAL_DE_ARRASTRE;
    },
    /// Un cuadro de inercia. Se llama desde el bucle de la cinta.
    seguirFrenando() {
      if (!frenando) return;

      alCorrer(velocidad);
      velocidad *= FRICCION;

      if (Math.abs(velocidad) < VELOCIDAD_MINIMA) {
        velocidad = 0;
        frenando = false;
        programarReanudacion();
      }
    },
    soltarTodo() {
      elemento.removeEventListener("pointerdown", empezar);
      elemento.removeEventListener("pointermove", mover);
      elemento.removeEventListener("pointerup", soltar);
      elemento.removeEventListener("pointercancel", soltar);
      if (esperando) clearTimeout(esperando);
    },
  };
}
