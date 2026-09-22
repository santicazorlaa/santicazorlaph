"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  acomodar,
  acotar,
  anclar,
  distancia,
  ESCALA_DOBLE_TOQUE,
  ESCALA_MAXIMA,
  medio,
  RESISTENCIA,
  SIN_ZOOM,
  textoEscala,
  type Encuadre,
  type Punto,
} from "@/lib/zoom-foto";

/// El visor de fotos, con su forma de moverse entre una y otra.
///
/// Está acá afuera y no adentro de cada pantalla porque hay dos lugares donde
/// se miran fotos —la galería de un partido y la entrega privada de un equipo—
/// y tienen que moverse exactamente igual. Cuando eran dos copias, la de las
/// entregas se quedó atrás: sin el freno al navegador en el celular, sin la
/// red de seguridad de la animación y cambiando de foto con un salto en el
/// medio. Todo eso está resuelto una sola vez acá.
///
/// Lo que cambia entre un lugar y el otro es qué dice la barra de arriba, qué
/// botones tiene la de abajo y de dónde sale la imagen; eso entra por
/// `cabecera`, `pie` y `foto`.

/// Cuánto hay que arrastrar para que suelte a la foto siguiente. Un quinto del
/// ancho, pero nunca más de 120 px: en un celular angosto un umbral fijo se
/// siente pesado, y en una pantalla ancha uno proporcional se vuelve imposible.
const umbral = (ancho: number) => Math.min(120, ancho * 0.2);

/// Lo que tarda la foto en terminar de entrar cuando se suelta el dedo.
const DURACION_MS = 260;

/// Lo que tarda el zoom en acomodarse cuando no lo está llevando la mano: el
/// doble toque, la vuelta al borde, el botón de salir. Más corto que el cambio
/// de foto porque no recorre distancia, sólo acomoda.
const DURACION_ZOOM_MS = 200;

/// Dos toques más separados que esto ya no son un doble toque, son dos toques.
/// Se mide desde que se levanta el primer dedo hasta que se apoya el segundo,
/// así que es más corto de lo que parece: con 300ms, un doble toque de una mano
/// de verdad se quedaba afuera la mitad de las veces.
const DOBLE_TOQUE_MS = 350;
/// Dos dedos no caen nunca exactamente en el mismo píxel.
const DOBLE_TOQUE_PX = 40;

/// Cuánto rato después de tocar la pantalla hay que desconfiar de un `dblclick`.
///
/// Un teléfono, después de un doble toque, manda además los eventos de mouse
/// que mandaría una computadora —entre ellos `dblclick`— para que ande una
/// página que sólo sabe de mouse. Acá eso era un tiro en el pie: los dos dedos
/// acercaban la foto y ese evento de más la volvía a alejar en el acto, así que
/// el doble toque no hacía nada. Pasa sólo en el teléfono, que es justo donde
/// no se puede probar con la máquina en la que uno escribe.
const SOSPECHA_DE_TACTO_MS = 900;

/// El alto que de verdad se ve, medido a mano.
///
/// En un celular la barra del navegador se superpone a la página: el hueco que
/// mide `inset-0` es más alto que lo que el ojo alcanza, y todo lo que caiga en
/// esa franja queda cortado. Como sólo las fotos verticales llegan tan abajo,
/// el recorte parecía cosa de ellas.
///
/// Las unidades `dvh` existen justamente para esto, pero no están en todos los
/// iPhone: en el que se probó, el navegador descartaba la regla y el visor se
/// quedaba sin alto. Medirlo con JavaScript no depende de que el navegador
/// conozca nada nuevo, y `visualViewport` además avisa cuando la barra aparece
/// o desaparece.
export function useAltoVisible() {
  return useSyncExternalStore(
    (avisar) => {
      const vista = window.visualViewport;
      vista?.addEventListener("resize", avisar);
      window.addEventListener("resize", avisar);
      window.addEventListener("orientationchange", avisar);
      return () => {
        vista?.removeEventListener("resize", avisar);
        window.removeEventListener("resize", avisar);
        window.removeEventListener("orientationchange", avisar);
      };
    },
    () => Math.round(window.visualViewport?.height ?? window.innerHeight),
    () => 0,
  );
}

type Props<T> = {
  fotos: T[];
  indice: number;
  /// Identidad de cada foto. Es lo que le permite a React mover el nodo de la
  /// vecina al lugar de la actual en vez de cambiarle la dirección a la
  /// imagen: al moverlo, la foto que ya se descargó y se dibujó aparece en el
  /// acto. Cambiándole la dirección, el navegador la vuelve a resolver y se ve
  /// un parpadeo con la anterior todavía puesta. En las entregas, con fotos
  /// que vienen de Google Drive, esa espera era de casi un segundo.
  claveDe: (foto: T) => string;
  /// Ancho dividido alto de la foto. Lo usa el zoom para saber qué parte del
  /// marco ocupa de verdad la imagen y no dejar arrastrarla hacia el aire.
  proporcionDe: (foto: T) => number;
  /// Qué se lee del visor si no se ve la pantalla.
  etiqueta: string;
  cabecera: ReactNode;
  pie: ReactNode;
  /// La imagen. `actual` es para el texto alternativo: las vecinas no lo
  /// llevan, porque nombrar tres veces la misma foto no ayuda a nadie.
  foto: (foto: T, actual: boolean) => ReactNode;
  onIndice: (i: number) => void;
  onCerrar: () => void;
};

export function VisorDeslizante<T>({
  fotos,
  indice,
  claveDe,
  proporcionDe,
  etiqueta,
  cabecera,
  pie,
  foto,
  onIndice,
  onCerrar,
}: Props<T>) {
  const pista = useRef<HTMLDivElement>(null);
  const carro = useRef<HTMLDivElement>(null);
  /// El hueco donde se dibuja la foto actual, sin la transformación del zoom
  /// encima. Hace falta medirlo sin transformar para saber dónde está su centro
  /// —de ahí salen todas las cuentas del zoom— y preguntarle a un nodo ya
  /// transformado devolvería la caja después de agrandada, que es otra cosa.
  const medidor = useRef<HTMLDivElement>(null);
  const [arrastre, setArrastre] = useState(0);
  const [animando, setAnimando] = useState(false);
  const altoVisible = useAltoVisible();

  // --- El zoom --------------------------------------------------------------
  //
  // Vive acá y no en cada foto porque el gesto que lo mueve es el mismo que el
  // de pasar de foto: los dos salen de los mismos dedos sobre la misma franja,
  // y quién se queda con el movimiento se decide en un solo lugar. La regla es
  // corta: **con la foto entera (escala 1) todo funciona exactamente como
  // antes**; acercada, el dedo mueve la foto en vez de pasar a la siguiente.
  //
  // El acercamiento se escribe sobre la foto y el deslizamiento sobre el carro
  // que lleva a las tres, así que son dos transformaciones en dos nodos
  // distintos y no se pisan nunca. Es lo que permite sumar esto sin tocar lo
  // que ya andaba.
  const encuadreRef = useRef<Encuadre>(SIN_ZOOM);
  const [encuadre, setEncuadre] = useState<Encuadre & { indice: number }>({
    indice,
    ...SIN_ZOOM,
  });
  const [animandoZoom, setAnimandoZoom] = useState(false);
  const relojZoom = useRef<number | null>(null);

  // Al cambiar de foto el zoom vuelve a cero. Se decide mirando el índice que
  // trae el estado en vez de acomodarlo desde un efecto: así la foto nueva se
  // dibuja entera desde el primer cuadro, sin un parpadeo acercado.
  const zoom: Encuadre = encuadre.indice === indice ? encuadre : SIN_ZOOM;
  const acercada = zoom.escala > 1;

  const aplicarEncuadre = useCallback(
    (nuevo: Encuadre, animado = false) => {
      encuadreRef.current = nuevo;
      setEncuadre({ indice, ...nuevo });
      if (relojZoom.current !== null) {
        clearTimeout(relojZoom.current);
        relojZoom.current = null;
      }
      setAnimandoZoom(animado);
      if (animado) {
        relojZoom.current = window.setTimeout(
          () => setAnimandoZoom(false),
          DURACION_ZOOM_MS + 20,
        );
      }
    },
    [indice],
  );

  useEffect(
    () => () => {
      if (relojZoom.current !== null) clearTimeout(relojZoom.current);
    },
    [],
  );

  useEffect(() => {
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previo;
    };
  }, []);

  // Flechas del teclado y Escape, para quien está en una computadora.
  useEffect(() => {
    const alApretar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
      if (e.key === "ArrowRight" && indice < fotos.length - 1) onIndice(indice + 1);
      if (e.key === "ArrowLeft" && indice > 0) onIndice(indice - 1);
    };
    window.addEventListener("keydown", alApretar);
    return () => window.removeEventListener("keydown", alApretar);
  }, [indice, fotos.length, onIndice, onCerrar]);

  /// Lo último que mandó la pantalla de arriba, para que el gesto lo lea recién
  /// cuando lo necesita. Sin esto, una pantalla que pasara una función escrita
  /// en el momento haría que el gesto se desarme y se vuelva a armar en cada
  /// dibujo, y un dedo apoyado en el medio perdería a dónde iba.
  const avisos = useRef({ onIndice, onCerrar, cuantas: fotos.length });
  useEffect(() => {
    avisos.current = { onIndice, onCerrar, cuantas: fotos.length };
  });

  const proporcion = fotos[indice] ? proporcionDe(fotos[indice]) : 1.5;

  // --- Los dedos ------------------------------------------------------------
  //
  // Todo el gesto vive dentro de este efecto, con escuchas nativas y no con las
  // de React. La razón es concreta: React entrega `touchmove` en modo pasivo,
  // que es una promesa al navegador de que nadie va a frenar el gesto. Con esa
  // promesa hecha, Safari en iPhone se queda con el movimiento y lo interpreta
  // como desplazar o agrandar la página. Con la escucha nativa podemos pedir
  // `passive: false` y frenarlo cuando el gesto es nuestro.
  //
  // Se muestran tres fotos —la anterior, la actual y la siguiente— y se corre
  // el carro que las contiene. Al soltar, o completa el viaje o vuelve al
  // lugar; el cambio de foto se hace al terminar la animación, cuando la vecina
  // ya quedó en el medio, así el salto no se ve.
  useEffect(() => {
    const zona = pista.current;
    const carroEl = carro.current;
    if (!zona || !carroEl) return;

    // Entrar a una foto es entrarle entera.
    encuadreRef.current = SIN_ZOOM;

    // Se preguntan en el momento y no se calculan una vez al armar el gesto,
    // porque cuántas fotos hay cambia solo: desde que las tandas se piden
    // mientras el visor está abierto, en el medio de un deslizamiento pueden
    // aparecer cincuenta fotos nuevas. Por eso además este efecto **no** puede
    // depender de cuántas hay: rehacerlo en el medio del gesto le borraba la
    // memoria del zoom —la foto se veía acercada pero el dedo la deslizaba en
    // vez de moverla— y dejaba un deslizamiento a mitad de camino, con la foto
    // siguiente en pantalla y el número de la anterior en el encabezado.
    const hayAnterior = () => indice > 0;
    const haySiguiente = () => indice < avisos.current.cuantas - 1;

    let gesto: { x: number; y: number; horizontal: boolean } | null = null;
    /// Un dedo moviendo una foto ya acercada.
    let mano: { x: number; y: number; desde: Encuadre } | null = null;
    /// Dos dedos. Guarda lo último medido, no lo del principio: cada cuadro es
    /// un paso desde el anterior, y así el gesto no se desarma aunque el marco
    /// se mueva abajo de los dedos.
    let pinza: { dist: number; medio: Punto } | null = null;
    /// El mouse arrastrando una foto acercada, en una computadora.
    let manoMouse: { x: number; y: number; desde: Encuadre; tomado: boolean } | null = null;
    /// El dedo que está apoyado ahora, para saber al levantarlo si fue un toque
    /// o un movimiento. Sólo un toque quieto cuenta como mitad de un doble
    /// toque: tomando cualquier apoyo, dos deslizamientos rápidos y seguidos
    /// desde el mismo lugar —que es exactamente cómo se recorre una galería—
    /// se leerían como un doble toque y la foto se acercaría sola.
    let dedoApoyado: { x: number; y: number; movido: boolean } | null = null;
    let ultimoToqueQuieto = { cuando: 0, x: 0, y: 0 };
    /// Cuándo fue la última vez que alguien tocó la pantalla, para poder
    /// descartar los eventos de mouse que el teléfono inventa después.
    let ultimoTacto = 0;
    let corrido = 0;
    let destino: number | null = null;
    let reloj: number | null = null;

    const caja = () => ({
      ancho: medidor.current?.clientWidth ?? 0,
      alto: medidor.current?.clientHeight ?? 0,
    });

    /// Un dedo, en los términos en los que están escritas las cuentas.
    const comoPunto = (t: Touch): Punto => ({ x: t.clientX, y: t.clientY });

    /// Un punto de la pantalla, medido desde el centro del hueco de la foto,
    /// que es de donde sale la transformación del zoom.
    const enElMarco = (x: number, y: number): Punto => {
      const el = medidor.current;
      if (!el) return { x: 0, y: 0 };
      const r = el.getBoundingClientRect();
      return { x: x - (r.left + r.width / 2), y: y - (r.top + r.height / 2) };
    };

    /// Un toque sobre una flecha o el botón de salir no es un gesto sobre la
    /// foto: es un botón que hay que dejar en paz.
    const sobreUnBoton = (blanco: EventTarget | null) =>
      blanco instanceof Element && blanco.closest("button") !== null;

    const correr = (px: number) => {
      corrido = px;
      setArrastre(px);
    };

    /// El corrimiento y el cambio de foto se acomodan los dos con estado de
    /// React, y eso no es un detalle de estilo: al ser dos estados, React los
    /// aplica en la misma pasada. Escribiendo el corrimiento a mano en el nodo
    /// —que es como estaba en las entregas— el carro volvía al centro antes de
    /// que React dibujara la foto nueva, y ese cuadro intermedio se ve como un
    /// salto.
    const finalizar = () => {
      if (reloj !== null) {
        clearTimeout(reloj);
        reloj = null;
      }
      setAnimando(false);
      if (destino !== null) {
        const i = destino;
        destino = null;
        correr(0);
        avisos.current.onIndice(i);
      }
    };

    /// Arranca la animación y programa el cierre por las suyas. Esperar sólo al
    /// evento de fin de transición no alcanza: no llega si la pestaña queda en
    /// segundo plano. Sin esta red, el visor se trabaría sin responder.
    const animarHasta = (px: number) => {
      setAnimando(true);
      correr(px);
      if (reloj !== null) clearTimeout(reloj);
      reloj = window.setTimeout(finalizar, DURACION_MS + 120);
    };

    /// Devuelve la foto adentro de sus bordes si el gesto la dejó estirada.
    const acomodarSuave = () => {
      const actual = encuadreRef.current;
      const puesta = acomodar(actual, caja(), proporcion, 0);
      if (puesta.x !== actual.x || puesta.y !== actual.y) aplicarEncuadre(puesta, true);
    };

    /// Acerca o vuelve a la foto entera, según cómo esté. Es lo que hace el
    /// doble toque y el doble clic: una sola cosa que alterna, para no tener
    /// que explicar nada.
    const alternarZoom = (punto: Punto) => {
      if (encuadreRef.current.escala > 1.05) {
        aplicarEncuadre(SIN_ZOOM, true);
        return;
      }
      const acercado = anclar(encuadreRef.current, punto, punto, ESCALA_DOBLE_TOQUE);
      aplicarEncuadre(acomodar(acercado, caja(), proporcion, 0), true);
    };

    const alEmpezar = (e: TouchEvent) => {
      ultimoTacto = Date.now();
      // Dos dedos son un pellizco: lo que estuviera haciendo un dedo solo se
      // cancela acá. Sin esto, un deslizamiento a medio camino se quedaba
      // colgado con el carro fuera de lugar y sin nadie que lo devolviera.
      if (e.touches.length >= 2) {
        gesto = null;
        mano = null;
        dedoApoyado = null; // un pellizco no es un toque
        if (corrido !== 0) animarHasta(0);
        const [a, b] = [comoPunto(e.touches[0]), comoPunto(e.touches[1])];
        const centro = medio(a, b);
        pinza = { dist: distancia(a, b), medio: enElMarco(centro.x, centro.y) };
        return;
      }

      if (e.touches.length !== 1) return;
      const t = e.touches[0];

      const esDoble =
        Date.now() - ultimoToqueQuieto.cuando < DOBLE_TOQUE_MS &&
        Math.hypot(t.clientX - ultimoToqueQuieto.x, t.clientY - ultimoToqueQuieto.y) <
          DOBLE_TOQUE_PX;

      if (esDoble && !sobreUnBoton(e.target)) {
        ultimoToqueQuieto.cuando = 0; // un tercer toque ya no alterna de nuevo
        gesto = null;
        mano = null;
        dedoApoyado = null;
        alternarZoom(enElMarco(t.clientX, t.clientY));
        return;
      }

      dedoApoyado = { x: t.clientX, y: t.clientY, movido: false };

      // Acá se decide todo: con la foto entera, el dedo pasa de foto como
      // siempre; acercada, el dedo mueve la foto.
      if (encuadreRef.current.escala > 1) {
        mano = { x: t.clientX, y: t.clientY, desde: encuadreRef.current };
        return;
      }
      gesto = { x: t.clientX, y: t.clientY, horizontal: false };
    };

    const alMover = (e: TouchEvent) => {
      if (dedoApoyado && e.touches.length >= 1) {
        const t = e.touches[0];
        if (Math.hypot(t.clientX - dedoApoyado.x, t.clientY - dedoApoyado.y) > 8) {
          dedoApoyado.movido = true;
        }
      }

      if (pinza && e.touches.length >= 2) {
        e.preventDefault();
        const [a, b] = [comoPunto(e.touches[0]), comoPunto(e.touches[1])];
        const dist = distancia(a, b);
        const centro = medio(a, b);
        const ahora = enElMarco(centro.x, centro.y);
        if (pinza.dist > 0) {
          const escalaNueva = acotar(
            encuadreRef.current.escala * (dist / pinza.dist),
            1,
            ESCALA_MAXIMA,
          );
          const anclado = anclar(encuadreRef.current, pinza.medio, ahora, escalaNueva);
          // Corta seco y no con resistencia: el cuadro siguiente arranca de
          // donde quedó éste, así que un borde que cede se acumularía.
          aplicarEncuadre(acomodar(anclado, caja(), proporcion, 0));
        }
        pinza = { dist, medio: ahora };
        return;
      }

      if (mano && e.touches.length === 1) {
        e.preventDefault();
        const t = e.touches[0];
        const propuesto = {
          escala: mano.desde.escala,
          x: mano.desde.x + (t.clientX - mano.x),
          y: mano.desde.y + (t.clientY - mano.y),
        };
        aplicarEncuadre(acomodar(propuesto, caja(), proporcion, RESISTENCIA));
        return;
      }

      if (!gesto || e.touches.length !== 1) return;
      const t = e.touches[0];
      const dx = t.clientX - gesto.x;
      const dy = t.clientY - gesto.y;

      if (!gesto.horizontal) {
        // Todavía no sabemos para dónde va la mano.
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (Math.abs(dx) <= Math.abs(dy)) {
          gesto = null;
          return;
        }
        gesto.horizontal = true;
      }

      // El gesto es nuestro: que el navegador no haga nada más con él.
      e.preventDefault();

      // Contra el borde no hay adónde ir: se deja arrastrar un poco y cuesta,
      // que es la forma de decir "hasta acá" sin un cartel.
      const contraElBorde = (dx > 0 && !hayAnterior()) || (dx < 0 && !haySiguiente());
      correr(contraElBorde ? dx / 4 : dx);
    };

    const alSoltar = (e: TouchEvent) => {
      ultimoTacto = Date.now();
      // Levantó el último dedo: si nunca se movió, fue un toque y puede ser la
      // primera mitad de un doble toque.
      if (e.touches.length === 0 && dedoApoyado) {
        if (!dedoApoyado.movido) {
          ultimoToqueQuieto = { cuando: Date.now(), x: dedoApoyado.x, y: dedoApoyado.y };
        }
        dedoApoyado = null;
      }

      if (pinza) {
        if (e.touches.length >= 2) return; // todavía quedan dos dedos apoyados
        pinza = null;
        // Un pellizco que quedó casi en la foto entera es alguien que quiso
        // salir del zoom: se lo da por salido en vez de dejarlo en 1,02.
        if (encuadreRef.current.escala <= 1.03) aplicarEncuadre(SIN_ZOOM, true);
        else acomodarSuave();
        // Si queda un dedo apoyado, el gesto sigue siendo suyo: pasa a mover la
        // foto. Sin esto, levantar un dedo del pellizco dejaba el otro sin
        // hacer nada hasta que lo levantara también.
        if (e.touches.length === 1 && encuadreRef.current.escala > 1) {
          const t = e.touches[0];
          mano = { x: t.clientX, y: t.clientY, desde: encuadreRef.current };
        }
        return;
      }

      if (mano) {
        if (e.touches.length > 0) return;
        mano = null;
        acomodarSuave();
        return;
      }

      const g = gesto;
      gesto = null;
      if (!g?.horizontal) return;

      const ancho = zona.clientWidth;
      const pasa = Math.abs(corrido) > umbral(ancho);
      const haciaSiguiente = corrido < 0 && haySiguiente();
      const haciaAnterior = corrido > 0 && hayAnterior();

      if (pasa && (haciaSiguiente || haciaAnterior)) {
        destino = indice + (haciaSiguiente ? 1 : -1);
        animarHasta(haciaSiguiente ? -ancho : ancho);
        return;
      }

      if (corrido === 0) return; // no se movió: no hay nada que devolver
      animarHasta(0);
    };

    const alTerminarAnimacion = (e: TransitionEvent) => {
      if (e.propertyName !== "transform" || e.target !== carroEl) return;
      finalizar();
    };

    // --- El mouse ----------------------------------------------------------
    //
    // En una computadora no hay dedos que pellizcar, así que el mismo zoom se
    // maneja con la rueda y el doble clic, y acercada la foto se arrastra con
    // el mouse. Va con Pointer Events y no con los de mouse para poder dejar
    // afuera al dedo, que ya tiene su propio camino más arriba.
    const alRodar = (e: WheelEvent) => {
      if (sobreUnBoton(e.target)) return;
      e.preventDefault();
      const punto = enElMarco(e.clientX, e.clientY);
      // Exponencial y no lineal: así dos vueltas de rueda acercan lo mismo
      // desde donde sea, y alejar deshace exactamente lo que acercó.
      const escalaNueva = acotar(
        encuadreRef.current.escala * Math.exp(-e.deltaY * 0.0015),
        1,
        ESCALA_MAXIMA,
      );
      const anclado = anclar(encuadreRef.current, punto, punto, escalaNueva);
      aplicarEncuadre(acomodar(anclado, caja(), proporcion, 0));
    };

    const alDobleClic = (e: MouseEvent) => {
      // Recién hubo dedos: esto no es un doble clic, es el eco del doble toque
      // que el teléfono manda de más, y atenderlo deshace lo que el toque hizo.
      if (Date.now() - ultimoTacto < SOSPECHA_DE_TACTO_MS) return;
      if (sobreUnBoton(e.target)) return;
      alternarZoom(enElMarco(e.clientX, e.clientY));
    };

    const alApretarPuntero = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      if (encuadreRef.current.escala <= 1) return;
      if (sobreUnBoton(e.target)) return;
      manoMouse = { x: e.clientX, y: e.clientY, desde: encuadreRef.current, tomado: false };
    };

    const alMoverPuntero = (e: PointerEvent) => {
      if (!manoMouse) return;
      const dx = e.clientX - manoMouse.x;
      const dy = e.clientY - manoMouse.y;
      if (!manoMouse.tomado) {
        if (Math.hypot(dx, dy) < 3) return;
        manoMouse.tomado = true;
        // El puntero se toma recién cuando el gesto se confirma, nunca al
        // apretar: tomándolo antes, el clic que viene después se lo queda esta
        // franja y deja de llegarle a los botones de adentro.
        //
        // Va envuelto porque tomar un puntero que ya se soltó es un error que
        // corta la función, y con la función cortada el arrastre se queda a
        // medias. Que no se pueda tomar sólo significa que el gesto se pierde
        // si el mouse se va de la franja, no que no se pueda arrastrar.
        try {
          zona.setPointerCapture(e.pointerId);
        } catch {
          // sin captura, pero el arrastre sigue
        }
      }
      const propuesto = {
        escala: manoMouse.desde.escala,
        x: manoMouse.desde.x + dx,
        y: manoMouse.desde.y + dy,
      };
      aplicarEncuadre(acomodar(propuesto, caja(), proporcion, 0));
    };

    const alSoltarPuntero = (e: PointerEvent) => {
      if (manoMouse?.tomado && zona.hasPointerCapture(e.pointerId)) {
        zona.releasePointerCapture(e.pointerId);
      }
      manoMouse = null;
    };

    /// Al girar el teléfono o cambiar el tamaño de la ventana, el hueco es otro
    /// y lo que antes entraba justo puede quedar corrido. Se reacomoda en vez
    /// de perderse el zoom: alguien que gira el teléfono mirando una jugada
    /// quiere seguir mirándola.
    const alRedimensionar = () => {
      if (encuadreRef.current.escala === 1) return;
      aplicarEncuadre(acomodar(encuadreRef.current, caja(), proporcion, 0));
    };

    zona.addEventListener("touchstart", alEmpezar, { passive: true });
    zona.addEventListener("touchmove", alMover, { passive: false });
    zona.addEventListener("touchend", alSoltar);
    zona.addEventListener("touchcancel", alSoltar);
    zona.addEventListener("wheel", alRodar, { passive: false });
    zona.addEventListener("dblclick", alDobleClic);
    zona.addEventListener("pointerdown", alApretarPuntero);
    zona.addEventListener("pointermove", alMoverPuntero);
    zona.addEventListener("pointerup", alSoltarPuntero);
    zona.addEventListener("pointercancel", alSoltarPuntero);
    window.addEventListener("resize", alRedimensionar);
    carroEl.addEventListener("transitionend", alTerminarAnimacion);

    return () => {
      if (reloj !== null) clearTimeout(reloj);
      zona.removeEventListener("touchstart", alEmpezar);
      zona.removeEventListener("touchmove", alMover);
      zona.removeEventListener("touchend", alSoltar);
      zona.removeEventListener("touchcancel", alSoltar);
      zona.removeEventListener("wheel", alRodar);
      zona.removeEventListener("dblclick", alDobleClic);
      zona.removeEventListener("pointerdown", alApretarPuntero);
      zona.removeEventListener("pointermove", alMoverPuntero);
      zona.removeEventListener("pointerup", alSoltarPuntero);
      zona.removeEventListener("pointercancel", alSoltarPuntero);
      window.removeEventListener("resize", alRedimensionar);
      carroEl.removeEventListener("transitionend", alTerminarAnimacion);
    };
  }, [indice, proporcion, aplicarEncuadre]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={etiqueta}
      // `inset-0` es el piso: da el alto aunque el JavaScript todavía no haya
      // medido. El alto medido lo pisa apenas está, y es el que evita que la
      // barra del navegador se coma el final de una foto vertical.
      className="fixed inset-0 z-50 bg-ground/95 backdrop-blur-sm flex flex-col"
      style={altoVisible > 0 ? { height: altoVisible } : undefined}
    >
      {cabecera}

      <div
        ref={pista}
        className="relative flex-1 min-h-0 overflow-hidden"
        // Acá adentro el gesto lo manejamos nosotros: sin esto Safari se lleva
        // el movimiento y termina agrandando la página en vez de pasar de foto
        // o acercarla. La escucha va sólo en esta franja y no en todo el visor:
        // abarcando las barras de arriba y abajo, arrastrar sobre un botón
        // también correría la foto.
        style={{ touchAction: "none" }}
      >
        <div
          ref={carro}
          className="absolute inset-0"
          style={{
            transform: `translateX(${arrastre}px)`,
            transition: animando
              ? `transform ${DURACION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
              : "none",
          }}
        >
          {[-1, 0, 1].map((corrimiento) => {
            const i = indice + corrimiento;
            const f = fotos[i];
            const actual = corrimiento === 0;
            return (
              <div
                key={f ? claveDe(f) : `vacia-${corrimiento}`}
                // Con relleno en vez de centrado: la imagen de adentro ocupa
                // toda la caja y se encoge sola. Centrarla y limitarla con
                // `max-height: 100%` no alcanzaba —ese límite no se aplicaba y
                // una foto vertical se desbordaba hacia abajo—, y como sólo las
                // verticales llegan tan lejos, parecía un problema de ellas.
                className="absolute inset-0 p-3 sm:p-14"
                // Cada foto ocupa exactamente el ancho del visor, así que
                // correrla un 100% la deja justo al lado de la anterior.
                style={{ transform: `translateX(${corrimiento * 100}%)` }}
              >
                {/* El hueco quieto, que es contra el que se miden las cuentas
                    del zoom, y adentro el que se mueve. Son dos nodos a
                    propósito: midiendo el de afuera se sabe dónde está el
                    centro aunque el de adentro esté agrandado. Sólo la foto
                    del medio se acerca; las vecinas van enteras siempre. */}
                <div ref={actual ? medidor : undefined} className="w-full h-full">
                  <div
                    className="w-full h-full"
                    style={
                      actual
                        ? {
                            transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.escala})`,
                            transition: animandoZoom
                              ? `transform ${DURACION_ZOOM_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
                              : "none",
                            cursor: acercada ? "grab" : undefined,
                          }
                        : undefined
                    }
                  >
                    {f && foto(f, actual)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Las flechas están siempre puestas y se apagan en los extremos. Si
            aparecieran y desaparecieran, llegar a la última foto movería de
            lugar justo lo que el mouse está a punto de apretar. */}
        <button
          onClick={() => indice > 0 && onIndice(indice - 1)}
          disabled={indice === 0}
          aria-label="Foto anterior"
          className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 grid place-items-center rounded-full border border-line bg-ground/70 backdrop-blur-sm disabled:opacity-25 con-mouse:hover:border-accent transition-colors"
        >
          &lsaquo;
        </button>
        <button
          onClick={() => indice < fotos.length - 1 && onIndice(indice + 1)}
          disabled={indice === fotos.length - 1}
          aria-label="Foto siguiente"
          className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 grid place-items-center rounded-full border border-line bg-ground/70 backdrop-blur-sm disabled:opacity-25 con-mouse:hover:border-accent transition-colors"
        >
          &rsaquo;
        </button>

        {/* Con la foto acercada, el dedo la mueve y no pasa a la siguiente. Eso
            hay que decirlo, porque si no se lee como que el visor se trabó: el
            cartel aparece sólo cuando hay zoom, dice cuánto es y es además la
            salida. Sin él, la única forma de volver sería adivinar el doble
            toque. */}
        {acercada && (
          <button
            type="button"
            onClick={() => aplicarEncuadre(SIN_ZOOM, true)}
            aria-label="Volver a ver la foto entera"
            className="absolute left-2 bottom-2 etiqueta text-[0.6rem] rounded-full border border-line bg-ground/80 backdrop-blur-sm px-3 py-1.5 text-muted con-mouse:hover:text-ink con-mouse:hover:border-accent transition-[color,border-color,transform] duration-150 ease-out active:scale-[0.96] tabular-nums"
          >
            {textoEscala(zoom.escala)} · Ver entera
          </button>
        )}
      </div>

      <div
        className="shrink-0 border-t border-line"
        // El borde de abajo se lo queda la barra del sistema en un iPhone.
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {pie}
      </div>
    </div>
  );
}

/// La barra de arriba: el código de la foto, en qué número va y el cierre. Es
/// la misma en los dos visores, así que vive acá; lo que cambia de un lado al
/// otro entra por `extra`.
export function CabeceraVisor({
  codigo,
  posicion,
  total,
  extra,
  onCerrar,
}: {
  codigo: string;
  posicion: number;
  total: number;
  extra?: ReactNode;
  onCerrar: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 h-14 border-b border-line shrink-0">
      <span className="etiqueta text-muted tabular-nums min-w-0 truncate">
        #{codigo}
        <span className="opacity-50 ml-2">
          {posicion} / {total}
        </span>
        {extra}
      </span>
      <button
        onClick={onCerrar}
        className="etiqueta text-muted con-mouse:hover:text-ink transition-colors shrink-0"
        aria-label="Cerrar"
      >
        Cerrar
      </button>
    </div>
  );
}
