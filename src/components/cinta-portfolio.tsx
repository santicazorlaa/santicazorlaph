"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { VisorPortfolio, type FotoDeVisor } from "./visor-portfolio";
import { acercar, crearLente, empujeSinSolapes } from "@/lib/fisheye";
import { crearArrastre, type Arrastre } from "@/lib/arrastre";
import {
  ABRIR_MS,
  CERRAR_MS,
  VueloDeFoto,
  cajaDe,
  type CajaDeVuelo,
} from "./vuelo-foto";

export type FotoDestacada = FotoDeVisor & { url: string };

/// Cuánto tarda cada foto en recorrer la cinta. No es la velocidad en píxeles:
/// multiplicado por la cantidad de fotos da la vuelta completa, así que sumar
/// fotos alarga el recorrido en vez de acelerarlo. Con 6 segundos se lee cada
/// una sin apuro y sin que parezca que está quieta.
const SEGUNDOS_POR_FOTO = 6;

/// Cuánto crece la foto que está justo abajo del puntero.
///
/// Antes era la mitad de esto. Pudo subir porque ahora las vecinas se corren
/// para hacerle lugar: mientras se montaban unas encima de otras, crecer mucho
/// se veía desprolijo y había que quedarse corto.
///
/// El aire de arriba y abajo de la cinta sale de este mismo número (ver el
/// `paddingBlock` de la fila): la foto crece para los cuatro lados, y si el
/// marco no tiene lugar para lo que crece a lo alto, el borde le corta la
/// cabeza y los pies. Están atados a propósito, así subir el acercamiento no
/// vuelve a dejar el aire corto.
const ACERCAMIENTO = 0.28;

/// El ancho de la lente, como múltiplo del ancho que tienen las fotos en esta
/// pantalla.
///
/// Es una proporción y no un número fijo a propósito: en un celular las fotos
/// miden la mitad que en un monitor, y una lente de 320 píxeles fijos que en el
/// escritorio abarca una foto y sus dos vecinas, en el teléfono abarcaría media
/// cinta. La misma proporción da la misma sensación en las dos.
const RADIO_POR_ANCHO = 1.1;

/// Cuánto del empuje calculado se aplica. Con 1 las fotos nunca se montan, que
/// es lo que dice la cuenta; un poco menos las deja apenas apretadas contra la
/// que creció, y eso se lee como que se corrieron para hacerle lugar y no como
/// que salieron disparadas. Por debajo de 0,8 vuelve a verse el montaje.
const APRIETE = 0.92;

/// El hueco entre fotos, en píxeles. Es el `gap-3` de la fila; hace falta
/// tenerlo también acá para estimar cuántas vueltas entran antes de medir.
const HUECO = 12;

/// Cuántas veces se repite la lista en el HTML. La cinta no tiene fin: cuando
/// una foto sale por la izquierda vuelve a entrar por la derecha, y para que
/// nunca se vea un hueco tiene que haber siempre más fotos que ancho de
/// pantalla. Se estima con el tamaño de escritorio y una pantalla ancha, que es
/// el caso peor, y da el mismo número en el servidor y en el navegador.
const ALTO_ESTIMADO = 320;
const PANTALLA_ESTIMADA = 2200;

function copiasNecesarias(fotos: FotoDestacada[]) {
  const anchoDeUnaVuelta = fotos.reduce(
    (suma, foto) => suma + (ALTO_ESTIMADO * foto.ancho) / foto.alto + HUECO,
    0,
  );
  // Dos vueltas como piso: con una sola no habría de dónde sacar la foto que
  // entra por la derecha mientras esa misma foto todavía está saliendo por la
  // izquierda.
  return Math.max(2, Math.ceil((PANTALLA_ESTIMADA * 2) / anchoDeUnaVuelta) + 1);
}

/**
 * El portfolio como una cinta que se desliza sola de derecha a izquierda.
 *
 * Todas las fotos van en una sola fila y con el mismo alto, cada una con su
 * ancho: ninguna se recorta. Una grilla obligaba a recortarlas a un rectángulo
 * igual para todas, que en un portfolio es justamente lo que no se puede hacer
 * —el encuadre es la mitad del trabajo—.
 *
 * Las de los costados se van desenfocando. Eso hace dos cosas: dice que la
 * cinta sigue más allá del borde en vez de terminar cortada, y manda el ojo al
 * centro, que es donde la foto se ve entera.
 *
 * **El movimiento lo lleva el JavaScript y ya no una animación de CSS.** La de
 * CSS era más barata porque corre sin molestar al resto de la página. Se cambió
 * porque el desplazamiento, la lupa y el arrastre con el dedo tienen que salir
 * de la misma cuenta: si el CSS corre la cinta por su lado y el JavaScript
 * acomoda las fotos por el suyo, agarrar la cinta con la mano pelea contra la
 * animación en vez de reemplazarla. La animación de CSS quedó igual como
 * respaldo: es lo que se ve mientras el motor no arrancó, y lo único que queda
 * si no hay JavaScript en absoluto.
 */
export function CintaPortfolio({ fotos }: { fotos: FotoDestacada[] }) {
  const marco = useRef<HTMLDivElement>(null);
  const pista = useRef<HTMLUListElement>(null);
  const [abierta, setAbierta] = useState<number | null>(null);
  // Mientras es falso manda la animación de CSS. El motor lo pone en verdadero
  // cuando arranca y ahí se apaga la de CSS, para que no se peleen. Arranca
  // apagado en el servidor y en el primer dibujo del navegador, que es lo que
  // hace que los dos coincidan.
  const [motorAndando, setMotorAndando] = useState(false);
  // La foto en pleno viaje entre la cinta y el visor. Mientras esto existe, el
  // visor esconde su propia foto para que no se vean las dos.
  const [vuelo, setVuelo] = useState<Vuelo | null>(null);
  // Si la capa del vuelo ya dibujó su primer cuadro. Hasta que lo haga, el
  // visor sigue mostrando su propia foto: si la escondiera antes, quedaría un
  // cuadro sin ninguna foto en pantalla y eso se ve como un parpadeo negro.
  const [vueloPintado, setVueloPintado] = useState(false);
  // Si la foto ya llegó a destino. La capa se queda un ratito más apagándose
  // encima, y ese ratito tiene que caer sobre algo que ya esté a la vista.
  const [aterrizado, setAterrizado] = useState(false);
  const fotoDelVisor = useRef<HTMLImageElement>(null);
  // La tarjeta que está escondida ahora mismo, para poder devolverla después.
  const escondida = useRef<HTMLElement | null>(null);

  /// Esconde una tarjeta de la cinta y devuelve la que estuviera escondida
  /// antes.
  ///
  /// Mientras la foto está volando o abierta en el visor, su lugar en la cinta
  /// tiene que quedar vacío. Si no, se ven las dos a la vez —la que vuela y la
  /// que sigue en la fila— y eso es lo que se lee como un parpadeo: dos copias
  /// de la misma foto, una moviéndose y otra quieta. En el escritorio es peor,
  /// porque al abrir se apaga la lupa y la de la fila se desinfla justo
  /// mientras la otra crece.
  ///
  /// Va con `visibility` y no con `opacity` porque no cambia el lugar que
  /// ocupa: el vuelo de vuelta le sigue preguntando dónde está, cuadro a
  /// cuadro, y tiene que poder contestar.
  const esconderTarjeta = useCallback((tarjeta: HTMLElement | null) => {
    if (escondida.current && escondida.current !== tarjeta) {
      escondida.current.style.visibility = "";
    }
    if (tarjeta) tarjeta.style.visibility = "hidden";
    escondida.current = tarjeta;
  }, []);

  const revelarTarjeta = useCallback(() => {
    if (escondida.current) escondida.current.style.visibility = "";
    escondida.current = null;
  }, []);

  const copias = copiasNecesarias(fotos);

  const { abrir, avisarVisor } = useMotorDeCinta({
    marco,
    pista,
    avisarQueAnda: setMotorAndando,
    alAbrir: (indice, tarjeta) => {
      setAbierta(indice);
      setVueloPintado(false);
      setAterrizado(false);
      setVuelo({
        fase: "entrando",
        tarjeta,
        indice,
        // La miniatura y no la grande: ya está cargada, así que el vuelo
        // arranca en el mismo instante del clic. La grande la pone el visor
        // cuando el vuelo termina, y para entonces ya tuvo medio segundo para
        // llegar. Con la grande acá, un clic sobre una foto todavía sin
        // descargar volaría un rectángulo vacío.
        url: fotos[indice].url,
        desde: cajaDe(tarjeta),
      });
    },
  });

  /// El destino del vuelo de entrada: la foto grande del visor, que ya está
  /// montada —invisible— justamente para poder medirla.
  const haciaElVisor = useCallback(
    () => (fotoDelVisor.current ? cajaDe(fotoDelVisor.current) : null),
    [],
  );

  useEffect(() => revelarTarjeta, [revelarTarjeta]);

  const cerrarVisor = useCallback(() => {
    const grande = fotoDelVisor.current;
    const indice = abierta;
    if (grande === null || indice === null) {
      revelarTarjeta();
      avisarVisor(false);
      setAbierta(null);
      return;
    }

    // A qué copia vuelve se decide **una sola vez**, acá, y no en cada cuadro:
    // si se recalculara mientras vuela, un empate entre dos copias la haría
    // saltar de una a la otra en pleno viaje. Lo que sí se relee cuadro a
    // cuadro es dónde está esa copia, que es lo que se mueve.
    const destino = copiaMasALaVista(pista.current, indice);
    esconderTarjeta(destino);

    // La cinta vuelve a andar *antes* de que empiece el vuelo de vuelta, no
    // después. Es a propósito: así la tarjeta a la que hay que volver ya se
    // está moviendo y el vuelo tiene que perseguirla, que es exactamente para
    // lo que el destino se relee en cada cuadro.
    avisarVisor(false);
    setVueloPintado(false);
    setAterrizado(false);
    setVuelo({
      fase: "saliendo",
      tarjeta: destino,
      indice,
      // Acá sí la grande: es la que estuvo en pantalla todo este rato, así que
      // está cargada, y cambiarla por la chica se vería como un bajón de
      // calidad en el primer cuadro del cierre.
      url: fotos[indice].urlGrande,
      desde: cajaDe(grande),
    });
  }, [abierta, avisarVisor, fotos, pista, esconderTarjeta, revelarTarjeta]);

  /// El destino del vuelo de vuelta: de todas las copias de esa foto que hay en
  /// la cinta, la que esté más cerca del centro **y se vea**.
  ///
  /// Elegir la copia y no quedarse con la tarjeta que se tocó evita un caso
  /// feo: la cinta siguió andando mientras la foto estaba abierta y esa tarjeta
  /// puede estar ahora del otro lado del borde. Como todas las copias muestran
  /// la misma imagen, volver a cualquiera es igual de cierto.
  ///
  /// Y puede pasar que **ninguna** se vea: una vuelta entera de la cinta es
  /// varias veces más ancha que la pantalla, así que en cualquier momento la
  /// mayoría de las fotos está afuera. Ahí esto devuelve nulo, y el vuelo se
  /// apaga en el lugar en vez de irse hacia un punto fuera de la pantalla, que
  /// se leería como que la foto se escapó.
  const haciaLaCinta = useCallback(
    () => (vuelo?.tarjeta ? cajaDe(vuelo.tarjeta) : null),
    [vuelo],
  );

  /// La capa del vuelo dibujó su primer cuadro. Recién ahora se puede esconder
  /// lo que había debajo.
  ///
  /// Al abrir, la capa arranca *exactamente encima* de la tarjeta. Si la
  /// tarjeta se escondiera en el mismo instante en que se monta la capa,
  /// quedaría un cuadro con la tarjeta ya invisible y la capa todavía sin
  /// dibujar —un `<img>` recién puesto en la página no pinta hasta que el
  /// navegador lo decodifica, aunque el archivo ya esté en su memoria— y en ese
  /// cuadro no hay ninguna foto: se ve como si la imagen se apagara y volviera
  /// enseguida. Esperando a que la capa dibuje, las dos se superponen un cuadro
  /// y no se nota nada.
  const marcarVueloPintado = useCallback(() => {
    setVueloPintado(true);
    if (vuelo?.fase === "entrando") esconderTarjeta(vuelo.tarjeta);
  }, [vuelo, esconderTarjeta]);

  /// La foto llegó a destino, y todavía le falta apagarse.
  ///
  /// Ese apagado de una décima de segundo tiene que caer encima de algo que ya
  /// se vea, o al llegar a cero queda un hueco y la foto parece apagarse y
  /// volver. Así que es acá —y no cuando la capa termina de irse— donde se
  /// destapa lo que hay debajo: al abrir, la foto del visor; al cerrar, la
  /// tarjeta de la cinta. El visor se desmonta también acá, mientras la capa
  /// todavía tapa ese lugar: su fondo desenfocado es lo más caro de sacar.
  const aterrizarVuelo = useCallback(() => {
    setAterrizado(true);
    if (vuelo?.fase === "saliendo") {
      revelarTarjeta();
      setAbierta(null);
    }
  }, [vuelo, revelarTarjeta]);

  /// La capa terminó de apagarse y ya no hace falta. Lo que había debajo se
  /// destapó al aterrizar, así que acá sólo queda sacarla.
  const terminarVuelo = useCallback(() => {
    setVuelo(null);
    setVueloPintado(false);
    setAterrizado(false);
  }, []);

  /// Qué momento del vuelo ve el visor.
  ///
  /// Al salir se le miente por un cuadro: sigue en "abierto" —con su foto a la
  /// vista— hasta que la capa del vuelo dibujó. Las dos fotos quedan una encima
  /// de la otra, en la misma posición y del mismo tamaño, así que la
  /// superposición no se nota; lo que sí se notaba era el hueco de cuando no
  /// había ninguna. Al entrar no hace falta: ahí el visor arranca escondido y
  /// tiene que seguir así.
  const faseDelVisor = !vuelo
    ? "abierto"
    : vuelo.fase === "entrando"
      ? // Al llegar la foto, el visor muestra la suya: la capa se apaga encima
        // de ella y el relevo no se ve.
        aterrizado
        ? "abierto"
        : "entrando"
      : // Al salir se le miente por un cuadro, hasta que la capa dibuje.
        vueloPintado
        ? "saliendo"
        : "abierto";

  return (
    <>
      <div
        ref={marco}
        className="cinta-portfolio-marco relative w-screen left-1/2 -translate-x-1/2 overflow-hidden select-none"
        // El movimiento horizontal lo maneja la cinta y el vertical lo sigue
        // manejando el navegador: así se puede arrastrar de costado y seguir
        // scrolleando la página para abajo con el mismo dedo, sin que una cosa
        // le robe la otra.
        style={{ touchAction: "pan-y" }}
      >
        <ul
          ref={pista}
          // El alto de las fotos vive acá como variable y no en cada una: lo
          // necesitan además el aire de arriba y abajo, que se calcula a partir
          // de él.
          className={`relative z-0 flex gap-3 w-max [--alto-cinta:14rem] sm:[--alto-cinta:18rem] lg:[--alto-cinta:20rem] ${
            motorAndando ? "" : "cinta-portfolio"
          }`}
          style={
            {
              "--duracion-cinta": `${fotos.length * SEGUNDOS_POR_FOTO}s`,
              // Lugar para lo que la foto crece hacia arriba y hacia abajo: la
              // mitad del crecimiento de cada lado, más un poco de respiro. Sin
              // esto el marco le recorta la cabeza y los pies a la foto que está
              // bajo el puntero, que es justo la que se está mirando.
              paddingBlock: `calc(var(--alto-cinta) * ${ACERCAMIENTO / 2} + 0.5rem)`,
            } as React.CSSProperties
          }
        >
          {Array.from({ length: copias }, (_, vuelta) =>
            fotos.map((foto, i) => (
              <li
                key={`${vuelta}-${foto.id}`}
                data-foto
                data-indice={i}
                className="h-[var(--alto-cinta)] shrink-0 origin-center"
                // El espacio de cada foto queda reservado antes de que cargue,
                // con la proporción que tiene en la base. Sin esto la fila se
                // reacomoda sola a medida que llegan las imágenes, justo
                // mientras el motor la está midiendo.
                style={{ aspectRatio: `${foto.ancho} / ${foto.alto}` }}
                // Las vueltas de más son la misma lista: para quien escucha la
                // página, repetirlas sería leer el portfolio varias veces.
                aria-hidden={vuelta > 0}
              >
                <button
                  type="button"
                  onClick={(e) => abrir(i, e.currentTarget.parentElement!)}
                  tabIndex={vuelta > 0 ? -1 : undefined}
                  className="block w-full h-full rounded overflow-hidden border border-line bg-surface cursor-zoom-in"
                  aria-label={foto.titulo ? `Ver ${foto.titulo}` : "Ver la foto en grande"}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={foto.url}
                    alt={vuelta === 0 ? foto.titulo : ""}
                    className="w-full h-full object-cover pointer-events-none"
                    draggable={false}
                    // La primera vuelta se carga entera aunque esté fuera de
                    // pantalla. Es al revés de lo habitual, pero acá la foto que
                    // está a la derecha del borde va a entrar sola en unos
                    // segundos: si esperara a ser visible, la cinta mostraría
                    // huecos blancos mientras avanza. Las vueltas de más sí van
                    // perezosas, porque son las mismas direcciones y a esa
                    // altura ya están en la memoria del navegador.
                    loading={vuelta === 0 ? "eager" : "lazy"}
                    decoding="async"
                  />
                </button>
              </li>
            )),
          )}
        </ul>

        {/* El desenfoque de los costados, en dos capas por lado: una ancha y
            suave, otra angosta y más fuerte pegada al borde. Dos capas simples
            dan una progresión que una sola no logra, y ninguna pasa de 8px, que
            es donde el desenfoque empieza a costar caro. */}
        <Costado lado="left" ancho="28%" desenfoque="2px" />
        <Costado lado="left" ancho="12%" desenfoque="8px" />
        <Costado lado="right" ancho="28%" desenfoque="2px" />
        <Costado lado="right" ancho="12%" desenfoque="8px" />

        {/* Y encima, el fondo del sitio entrando desde los bordes: la cinta se
            va apagando en vez de terminar en un corte recto. */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-[15%] bg-gradient-to-r from-ground to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-[15%] bg-gradient-to-l from-ground to-transparent" />
      </div>

      {abierta !== null && (
        <VisorPortfolio
          fotos={fotos}
          indice={abierta}
          alCerrar={cerrarVisor}
          alCambiar={setAbierta}
          fase={faseDelVisor}
          refFoto={fotoDelVisor}
        />
      )}

      {vuelo && (
        <VueloDeFoto
          url={vuelo.url}
          desde={vuelo.desde}
          hacia={vuelo.fase === "entrando" ? haciaElVisor : haciaLaCinta}
          duracionMs={vuelo.fase === "entrando" ? ABRIR_MS : CERRAR_MS}
          alPrimerCuadro={marcarVueloPintado}
          alAterrizar={aterrizarVuelo}
          alTerminar={terminarVuelo}
        />
      )}
    </>
  );
}

type Vuelo = {
  fase: "entrando" | "saliendo";
  indice: number;
  url: string;
  desde: CajaDeVuelo;
  /// La tarjeta de la cinta que le corresponde a esta foto: de la que salió al
  /// abrir, o a la que vuelve al cerrar. Está escondida mientras dura el vuelo.
  tarjeta: HTMLElement | null;
};

/// De todas las copias de una foto que hay en la cinta, la que esté más cerca
/// del centro **y se vea**.
///
/// Elegir la copia y no quedarse con la tarjeta que se tocó evita un caso feo:
/// la cinta siguió andando mientras la foto estaba abierta y esa tarjeta puede
/// estar ahora del otro lado del borde. Como todas las copias muestran la misma
/// imagen, volver a cualquiera es igual de cierto.
///
/// Puede pasar que **ninguna** se vea: una vuelta de la cinta es varias veces
/// más ancha que la pantalla, así que es lo normal. Ahí devuelve nulo y la foto
/// se apaga en el lugar en vez de irse hacia un punto fuera de la pantalla, que
/// se leería como que se escapó. El corte de "se ve" va bajo a propósito, un
/// octavo de la foto: volver a una medio salida sigue siendo mejor que apagarse
/// en el aire, porque se entiende adónde fue.
function copiaMasALaVista(pista: HTMLElement | null, indice: number) {
  if (!pista) return null;

  const centro = window.innerWidth / 2;
  let elegida: HTMLElement | null = null;
  let mejor = Infinity;

  for (const el of pista.querySelectorAll<HTMLElement>(`[data-indice="${indice}"]`)) {
    const r = el.getBoundingClientRect();
    const dentro = Math.min(r.right, window.innerWidth) - Math.max(r.left, 0);
    if (dentro < r.width / 8) continue;

    const distancia = Math.abs(r.left + r.width / 2 - centro);
    if (distancia < mejor) {
      mejor = distancia;
      elegida = el;
    }
  }
  return elegida;
}

/// Lo que el motor sabe de cada foto: dónde nace en la fila, cuánto mide, y en
/// qué punto está de su viaje hacia la escala y el corrimiento que le tocan.
type FotoEnCinta = {
  el: HTMLElement;
  /// Dónde la puso el navegador dentro de la fila, en píxeles desde el
  /// principio. Se mide una sola vez —y otra si cambia el tamaño de la
  /// ventana—: es la posición contra la que se calcula todo lo demás.
  origen: number;
  ancho: number;
  escala: number;
  escalaBuscada: number;
  corrimiento: number;
  corrimientoBuscado: number;
  ultimoX: number | null;
  ultimaEscala: number | null;
  ultimoZ: number | null;
};

/**
 * El motor de la cinta: el desplazamiento continuo, la lupa que sigue al
 * puntero y el arrastre con la mano, los tres en el mismo bucle.
 *
 * Toca los estilos directamente, sin pasar por el estado de React: esto corre
 * en cada cuadro, y hacer que React vuelva a dibujar sesenta veces por segundo
 * es exactamente la forma de que la animación empiece a saltar.
 */
function useMotorDeCinta({
  marco,
  pista,
  alAbrir,
  avisarQueAnda,
}: {
  marco: React.RefObject<HTMLDivElement | null>;
  pista: React.RefObject<HTMLUListElement | null>;
  alAbrir: (indice: number, tarjeta: HTMLElement) => void;
  avisarQueAnda: (anda: boolean) => void;
}) {
  const arrastre = useRef<Arrastre | null>(null);
  // El bucle lee esto en cada cuadro para saber si tiene que quedarse quieto.
  // Va en un `ref` y no en el estado justamente por eso: el bucle no puede
  // esperar a que React vuelva a dibujar para enterarse.
  const visorAbierto = useRef(false);

  useEffect(() => {
    const elMarco = marco.current;
    const laPista = pista.current;
    if (!elMarco || !laPista) return;


    let fotos: FotoEnCinta[] = [];
    let largoDeLaCinta = 0;
    let velocidad = 0;
    let lente = crearLente({ radio: 300, acercamiento: ACERCAMIENTO, empuje: 60 });
    let desplazamiento = 0;
    let punteroX: number | null = null;
    let visible = false;
    let cuadro = 0;

    // ---- Medición ---------------------------------------------------------
    // Se mide una vez y se guarda. La alternativa —preguntarle al navegador la
    // posición de cada foto en cada cuadro— lo obliga a recalcular la página
    // treinta veces por cuadro, que es de las cosas más caras que se le pueden
    // pedir. Es lo que hacía la versión anterior de este efecto.
    const medir = () => {
      const elementos = Array.from(laPista.querySelectorAll<HTMLElement>("[data-foto]"));
      if (elementos.length === 0) return false;

      // Antes de medir hay que sacar lo que el motor haya escrito, o se estaría
      // midiendo la posición deformada en vez de la de la fila.
      for (const el of elementos) el.style.transform = "";

      fotos = elementos.map((el) => ({
        el,
        origen: el.offsetLeft,
        ancho: el.offsetWidth,
        escala: 1,
        escalaBuscada: 1,
        corrimiento: 0,
        corrimientoBuscado: 0,
        ultimoX: null,
        ultimaEscala: null,
        ultimoZ: null,
      }));

      const ultima = fotos[fotos.length - 1];
      // El largo total llega hasta el final de la última más el hueco que la
      // separaría de la primera si la fila siguiera. Sin ese hueco, al dar la
      // vuelta las dos quedarían pegadas.
      largoDeLaCinta = ultima.origen + ultima.ancho + HUECO;

      const anchoMedio = fotos.reduce((suma, f) => suma + f.ancho, 0) / fotos.length;
      const radio = anchoMedio * RADIO_POR_ANCHO;
      lente = crearLente({
        radio,
        acercamiento: ACERCAMIENTO,
        empuje:
          empujeSinSolapes({
            ancho: anchoMedio,
            paso: anchoMedio + HUECO,
            radio,
            acercamiento: ACERCAMIENTO,
          }) * APRIETE,
      });

      // La velocidad sale del tiempo que ya estaba elegido, no de un número de
      // píxeles: la cinta entera tarda seis segundos por foto distinta, midan
      // lo que midan y estén repetidas las veces que estén.
      const distintas = new Set(fotos.map((f) => f.el.dataset.indice)).size;
      const cuadrosDeUnaVuelta = distintas * SEGUNDOS_POR_FOTO * 60;
      velocidad = largoDeLaCinta / (cuadrosDeUnaVuelta * (fotos.length / distintas));

      return true;
    };

    if (!medir()) return;

    // ---- La mano ----------------------------------------------------------
    const manejador = crearArrastre({
      elemento: elMarco,
      alCorrer: (delta) => {
        desplazamiento += delta;
      },
    });
    arrastre.current = manejador;

    // ---- El puntero -------------------------------------------------------
    // Se sigue en la ventana entera y no sólo dentro de la cinta: saliendo
    // rápido por arriba, el aviso de "salí" puede no llegar nunca y la lupa
    // quedaría clavada en la última posición conocida.
    const hayMouse = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    const seguirPuntero = (e: PointerEvent) => {
      const caja = elMarco.getBoundingClientRect();
      const adentro =
        e.clientX >= caja.left &&
        e.clientX <= caja.right &&
        e.clientY >= caja.top &&
        e.clientY <= caja.bottom;
      punteroX = adentro ? e.clientX - caja.left : null;
    };

    if (hayMouse) window.addEventListener("pointermove", seguirPuntero, { passive: true });

    // ---- El bucle ---------------------------------------------------------
    const pintar = () => {
      manejador.seguirFrenando();

      // La cinta avanza sola salvo que la tenga la mano o esté abierto el
      // visor. Pasar el mouse por encima **no** la frena: se acerca bajo el
      // puntero y sigue andando, que es lo que la mantiene viva. Frenarla
      // contestaba la misma pregunta cortando el movimiento.
      if (!manejador.ocupada && !visorAbierto.current) desplazamiento += velocidad;

      const conLupa = punteroX !== null && !manejador.arrastrando && !visorAbierto.current;

      for (const foto of fotos) {
        // Dónde cae en la fila después de descontar lo que corrió la cinta.
        let x = (foto.origen - desplazamiento) % largoDeLaCinta;
        // Recién cuando terminó de salir del todo por la izquierda reaparece
        // por la derecha. Envolverla antes la haría desaparecer a mitad de
        // camino, a la vista.
        if (x < -foto.ancho) x += largoDeLaCinta;

        if (conLupa) {
          const distancia = x + foto.ancho / 2 - punteroX!;
          const { escala, corrimiento } = lente.calcular(distancia);
          foto.escalaBuscada = escala;
          foto.corrimientoBuscado = corrimiento;
        } else {
          foto.escalaBuscada = 1;
          foto.corrimientoBuscado = 0;
        }

        foto.escala = acercar(foto.escala, foto.escalaBuscada);
        foto.corrimiento = acercar(foto.corrimiento, foto.corrimientoBuscado);

        // El desplazamiento se escribe contra la posición que la foto ya tiene
        // en la fila, no contra el principio de la cinta. Por eso, con la cinta
        // quieta en cero, el motor no escribe nada y lo que se ve es
        // exactamente lo que mandó el servidor.
        const dx = Math.round((x - foto.origen + foto.corrimiento) * 10) / 10;
        const escala = Math.round(foto.escala * 1000) / 1000;
        // La que está creciendo tiene que quedar por encima de sus vecinas,
        // pero sólo mientras crece: dejarles a todas un z-index propio arma una
        // pila de capas que no hace falta.
        const z = foto.escala > 1.02 ? Math.round(foto.escala * 100) : 0;

        // Escribir un estilo que ya vale lo mismo igual obliga al navegador a
        // revisar si algo cambió. Con treinta fotos por cuadro, eso se nota.
        if (foto.ultimoX !== dx || foto.ultimaEscala !== escala) {
          foto.el.style.transform = `translate3d(${dx}px, 0, 0) scale(${escala})`;
          foto.ultimoX = dx;
          foto.ultimaEscala = escala;
        }
        if (foto.ultimoZ !== z) {
          foto.el.style.zIndex = z === 0 ? "" : String(z);
          foto.ultimoZ = z;
        }
      }

      cuadro = requestAnimationFrame(pintar);
    };

    // ---- Cuándo vale la pena animar ---------------------------------------
    // Con la cinta fuera de pantalla no hay nada que mirar, así que el bucle se
    // apaga entero. En la portada la cinta está bien abajo: sin esto, todo el
    // rato que alguien pasa leyendo arriba serían sesenta cuadros por segundo
    // calculando algo que nadie ve.
    const mirador = new IntersectionObserver(
      ([entrada]) => {
        visible = entrada.isIntersecting;
        if (visible && !cuadro) cuadro = requestAnimationFrame(pintar);
        if (!visible && cuadro) {
          cancelAnimationFrame(cuadro);
          cuadro = 0;
        }
      },
      { rootMargin: "200px" },
    );
    mirador.observe(elMarco);

    avisarQueAnda(true);

    // ---- Si cambia el tamaño, todo se vuelve a medir -----------------------
    // El alto de las fotos cambia por breakpoint y con él cambian todos los
    // anchos, el largo de la cinta y el tamaño de la lente.
    let primeraMedicion = true;
    const observadorDeTamano = new ResizeObserver(() => {
      if (primeraMedicion) {
        primeraMedicion = false;
        return;
      }
      const guardado = desplazamiento;
      if (medir()) desplazamiento = guardado;
    });
    observadorDeTamano.observe(elMarco);

    return () => {
      if (cuadro) cancelAnimationFrame(cuadro);
      mirador.disconnect();
      observadorDeTamano.disconnect();
      manejador.soltarTodo();
      if (hayMouse) window.removeEventListener("pointermove", seguirPuntero);
      for (const foto of fotos) {
        foto.el.style.transform = "";
        foto.el.style.zIndex = "";
      }
      avisarQueAnda(false);
    };
  }, [marco, pista, avisarQueAnda]);

  const abrir = useCallback(
    (indice: number, tarjeta: HTMLElement) => {
      // Un tirón para mover la cinta no es un clic para abrir una foto. Sin
      // este corte, cualquier arrastre terminaría abriendo lo que quedó abajo
      // del dedo al soltar.
      if (arrastre.current?.fueArrastre()) return;
      visorAbierto.current = true;
      alAbrir(indice, tarjeta);
    },
    [alAbrir],
  );

  const avisarVisor = useCallback((abierto: boolean) => {
    visorAbierto.current = abierto;
  }, []);

  return { abrir, avisarVisor };
}

function Costado({
  lado,
  ancho,
  desenfoque,
}: {
  lado: "left" | "right";
  ancho: string;
  desenfoque: string;
}) {
  const haciaAdentro = lado === "left" ? "to right" : "to left";
  return (
    <div
      className="pointer-events-none absolute inset-y-0 z-10"
      style={{
        [lado]: 0,
        width: ancho,
        backdropFilter: `blur(${desenfoque})`,
        WebkitBackdropFilter: `blur(${desenfoque})`,
        // La máscara es lo que hace que el desenfoque sea progresivo: fuerte
        // contra el borde y desvaneciéndose hacia el centro.
        maskImage: `linear-gradient(${haciaAdentro}, black, transparent)`,
        WebkitMaskImage: `linear-gradient(${haciaAdentro}, black, transparent)`,
      }}
    />
  );
}
