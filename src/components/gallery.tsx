"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { Aparecer } from "./aparecer";
import { useCart, type CartItem } from "./cart-context";
import { SenalDeLink } from "./senal-link";
import { EmpujeDescuento } from "./empuje-descuento";
import { HuecoGrilla } from "./huecos";
import { Lightbox } from "./lightbox";
import type { PhotoDTO } from "@/lib/photos";
import { precio } from "@/lib/format";

/// Cuántas columnas entran según el ancho. Los cortes coinciden con los de
/// Tailwind (sm y lg) para que la grilla acompañe al resto del sitio.
function columnasSegunAncho(ancho: number) {
  if (ancho >= 1024) return 4;
  if (ancho >= 640) return 3;
  return 2;
}

/// Cuántas columnas entran ahora mismo, atento a los cambios de tamaño.
///
/// Se suscribe al `resize` en vez de guardar el número en un estado: así no hay
/// un render de más en cada cambio, y en el servidor —donde no existe ventana—
/// devuelve 2, que es lo que corresponde a un celular.
function useColumnas() {
  return useSyncExternalStore(
    (avisar) => {
      window.addEventListener("resize", avisar);
      return () => window.removeEventListener("resize", avisar);
    },
    () => columnasSegunAncho(window.innerWidth),
    () => 2,
  );
}

type Ubicada = { photo: PhotoDTO; indice: number };

/// Reparte las fotos en columnas mandando cada una a la columna más corta,
/// midiendo el alto en "anchos de columna" (una foto apaisada 3:2 mide 0,66).
///
/// Recorrer siempre desde el principio no es un descuido: como cada foto se
/// decide mirando sólo las anteriores, al traer más fotos las que ya estaban
/// caen exactamente en el mismo lugar. Si en cambio dejáramos que el navegador
/// balancee las columnas solo, cada tanda nueva te movería de lugar todas las
/// fotos de arriba, justo cuando estás mirándolas.
function repartir(photos: PhotoDTO[], columnas: number): Ubicada[][] {
  const cols: Ubicada[][] = Array.from({ length: columnas }, () => []);
  const altos = new Array<number>(columnas).fill(0);

  photos.forEach((photo, indice) => {
    let masCorta = 0;
    for (let c = 1; c < columnas; c++) {
      if (altos[c] < altos[masCorta]) masCorta = c;
    }
    cols[masCorta].push({ photo, indice });
    // ratio = ancho / alto, así que el alto relativo es su inversa.
    altos[masCorta] += 1 / (photo.ratio || 1.5);
  });

  return cols;
}

type Equipo = { nombre: string; cantidad: number };

type Props = {
  eventSlug: string;
  eventTitle: string;
  priceArs: number;
  totalPhotos: number;
  packPriceArs: number | null;
  initialPhotos: PhotoDTO[];
  equipos: Equipo[];
};

export function Gallery({
  eventSlug,
  eventTitle,
  priceArs,
  totalPhotos,
  packPriceArs,
  initialPhotos,
  equipos,
}: Props) {
  const cart = useCart();
  const [photos, setPhotos] = useState(initialPhotos);
  const [loading, setLoading] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [codigo, setCodigo] = useState("");
  const columnas = useColumnas();
  const [buscando, setBuscando] = useState(false);
  const [sinResultado, setSinResultado] = useState(false);
  // Si la grilla está mostrando el resultado de una búsqueda por código en vez
  // de todas las fotos. Es estado y no un `useRef` porque de esto depende lo
  // que se dibuja —el botón "Ver todas" y si se piden más fotos—, y leer un ref
  // durante el render es justo lo que React no garantiza: los doce avisos de
  // lint que arrastraba este archivo eran todos por eso.
  const [filtrando, setFiltrando] = useState(false);
  // Si el último pedido de fotos se cayó, y si el servidor ya dijo que no hay
  // más. Sin botón que apretar, son las dos cosas que evitan que la pantalla
  // se quede pidiendo al vacío o en silencio.
  const [fallo, setFallo] = useState(false);
  const [finDeLista, setFinDeLista] = useState(false);
  // Qué equipo se está mostrando. `null` es "Todas". La búsqueda por código
  // mira todo el partido sin importar el equipo, así que las dos pestañas se
  // pisan: elegir una limpia la otra, para no mostrar un estado imposible.
  const [equipoActivo, setEquipoActivo] = useState<string | null>(null);
  const [cambiandoEquipo, setCambiandoEquipo] = useState(false);
  const centinela = useRef<HTMLDivElement>(null);
  const inputCodigo = useRef<HTMLInputElement>(null);
  /// Si hay un pedido en vuelo. Va en una referencia y no en el estado de
  /// `loading` porque el estado tarda un dibujo en actualizarse, y en ese hueco
  /// el final de la grilla y la apertura de una foto pueden pedir los dos la
  /// misma tanda: las fotos entrarían repetidas, con el id repetido, que es de
  /// lo peor que le puede pasar a una lista. Antes no era alcanzable porque
  /// había un solo botón; ahora hay dos cosas que piden solas.
  const pidiendo = useRef(false);

  const toItem = useCallback(
    (photo: PhotoDTO): CartItem => ({
      photoId: photo.id,
      code: photo.code,
      eventSlug,
      eventTitle,
      thumbUrl: photo.thumbUrl,
      priceArs,
      totalFotosEvento: totalPhotos,
      packPriceArs,
    }),
    [eventSlug, eventTitle, priceArs, totalPhotos, packPriceArs],
  );

  // El total de "Todas" es el del partido entero; el de un equipo, el que
  // vino agrupado del servidor. `totalPhotos` en sí no se toca: de ahí sale
  // `totalFotosEvento` en el carrito, del que depende el pack completo —ese
  // sigue siendo llevarse todas las fotos del partido, no las de un equipo.
  const totalActual = equipoActivo
    ? (equipos.find((e) => e.nombre === equipoActivo)?.cantidad ?? 0)
    : totalPhotos;

  const quedanPorCargar = !filtrando && !finDeLista && photos.length < totalActual;

  const pedirMas = useCallback(async () => {
    if (pidiendo.current || !quedanPorCargar) return;
    pidiendo.current = true;
    setLoading(true);
    setFallo(false);
    try {
      const res = await fetch(
        `/api/eventos/${eventSlug}/fotos?desde=${photos.length}${
          equipoActivo ? `&equipo=${encodeURIComponent(equipoActivo)}` : ""
        }`,
      );
      if (!res.ok) throw new Error(`respondió ${res.status}`);
      const data = (await res.json()) as { photos: PhotoDTO[] };
      // Una tanda vacía es el final de verdad, diga lo que diga la cuenta. Sin
      // esto, cualquier diferencia entre el total y lo que hay —una foto
      // borrada, por ejemplo— se vuelve un pedido atrás del otro para siempre,
      // porque nadie aprieta nada: las pide la pantalla sola.
      if (data.photos.length === 0) setFinDeLista(true);
      else setPhotos((prev) => [...prev, ...data.photos]);
    } catch {
      setFallo(true);
    } finally {
      pidiendo.current = false;
      setLoading(false);
    }
  }, [quedanPorCargar, eventSlug, photos.length, equipoActivo]);

  /// Cambia de pestaña de equipo, pidiendo su primera página al servidor.
  /// Limpia cualquier búsqueda por código activa: son dos filtros que no se
  /// combinan, y dejar los dos prendidos mostraría un estado imposible.
  const elegirEquipo = useCallback(
    async (nombre: string | null) => {
      if (nombre === equipoActivo || cambiandoEquipo) return;
      setCambiandoEquipo(true);
      setFallo(false);
      setFiltrando(false);
      setCodigo("");
      setSinResultado(false);
      try {
        const res = await fetch(
          `/api/eventos/${eventSlug}/fotos${nombre ? `?equipo=${encodeURIComponent(nombre)}` : ""}`,
        );
        if (!res.ok) throw new Error(`respondió ${res.status}`);
        const data = (await res.json()) as { photos: PhotoDTO[] };
        setEquipoActivo(nombre);
        setPhotos(data.photos);
        setFinDeLista(false);
      } catch {
        setFallo(true);
      } finally {
        setCambiandoEquipo(false);
      }
    },
    [eventSlug, equipoActivo, cambiandoEquipo],
  );

  /// Abre una foto en el visor y, si está cerca del final, pide la tanda que
  /// sigue. Se pide antes de llegar y no al llegar porque en la última foto el
  /// visor no deja seguir: el que desliza se chocaba contra una pared y tenía
  /// que cerrar, apretar "cargar más" y volver a entrar.
  const irA = useCallback(
    (i: number) => {
      setOpenIndex(i);
      if (i >= photos.length - 3) void pedirMas();
    },
    [photos.length, pedirMas],
  );

  // Las fotos siguen solas al llegar al final de la grilla. El aviso lo da un
  // hueco invisible puesto al pie: cuando se acerca a la pantalla, se piden las
  // que siguen. El margen es de casi una pantalla entera, así que llegan antes
  // de que se acaben las que hay y no se ve ningún corte.
  useEffect(() => {
    const el = centinela.current;
    if (!el) return;
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((entrada) => entrada.isIntersecting)) void pedirMas();
      },
      { rootMargin: "800px" },
    );
    observador.observe(el);
    return () => observador.disconnect();
  }, [pedirMas]);

  // Safari a veces reabre esta pantalla con el buscador ya enfocado —al volver
  // con el botón "atrás" restaura el foco tal cual quedó, teclado incluido— y
  // con la letra chica de este campo eso dispara además el zoom automático de
  // iOS sobre inputs enfocados. `pageshow` es el único evento que avisa de esa
  // restauración: un efecto de montaje no alcanza, porque la página no se
  // remonta, se reanuda tal cual estaba congelada.
  useEffect(() => {
    const quitarFoco = () => {
      if (document.activeElement === inputCodigo.current) inputCodigo.current?.blur();
    };
    quitarFoco();
    window.addEventListener("pageshow", quitarFoco);
    return () => window.removeEventListener("pageshow", quitarFoco);
  }, []);

  const buscarPorCodigo = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = codigo.trim().toUpperCase().replace(/^#/, "");
    if (!q) {
      setFiltrando(false);
      setSinResultado(false);
      setFinDeLista(false);
      setFallo(false);
      setEquipoActivo(null);
      setPhotos(initialPhotos);
      return;
    }
    setBuscando(true);
    setSinResultado(false);
    try {
      const res = await fetch(
        `/api/eventos/${eventSlug}/fotos?codigo=${encodeURIComponent(q)}`,
      );
      const data = (await res.json()) as { photos: PhotoDTO[] };
      // El código busca en todo el partido, sin importar la pestaña de
      // equipo: la vuelve a "Todas" para que no quede una marcada mientras se
      // ve el resultado de una búsqueda que las mira a todas.
      setEquipoActivo(null);
      setFiltrando(true);
      setPhotos(data.photos);
      setSinResultado(data.photos.length === 0);
    } finally {
      setBuscando(false);
    }
  };

  // Las flechas del teclado y Escape las escucha el visor, que es el que sabe
  // en qué foto está: acá había una segunda copia que hacía lo mismo.

  return (
    <section className="py-8">
      {/* Sólo aparece si Santi separó las fotos en dos o más equipos. Con uno
          solo (o ninguno), la pestaña no agregaría nada. */}
      {equipos.length > 1 && (
        <div
          className={`flex flex-wrap gap-2 mb-4 transition-opacity duration-200 ${
            cambiandoEquipo ? "opacity-60" : "opacity-100"
          }`}
        >
          {[{ nombre: null, cantidad: totalPhotos }, ...equipos].map((e) => {
            const activa = e.nombre === equipoActivo;
            return (
              <button
                key={e.nombre ?? "todas"}
                type="button"
                onClick={() => void elegirEquipo(e.nombre)}
                disabled={cambiandoEquipo}
                aria-pressed={activa}
                className={`etiqueta text-xs rounded-full px-4 py-1.5 transition-colors flex items-center gap-1.5 ${
                  activa
                    ? "bg-accent-solid text-accent-ink font-medium"
                    : "border border-line text-muted con-mouse:hover:border-accent con-mouse:hover:text-fg"
                } ${cambiandoEquipo ? "cursor-wait" : ""}`}
              >
                {e.nombre ?? "Todas"}
                <span className="opacity-70 tabular-nums">({e.cantidad})</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-4 items-center justify-between mb-6">
        <form onSubmit={buscarPorCodigo} className="flex gap-2">
          <label className="sr-only" htmlFor="codigo">
            Buscar por código de foto
          </label>
          <input
            id="codigo"
            ref={inputCodigo}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Código de foto"
            maxLength={6}
            className="bg-surface border border-line rounded-md px-3 py-2 text-base sm:text-sm w-40 uppercase tracking-widest placeholder:normal-case placeholder:tracking-normal placeholder:text-muted focus:border-accent outline-none"
          />
          <button
            type="submit"
            disabled={buscando}
            className="etiqueta border border-line rounded-md px-4 hover:border-accent transition-[color,border-color,transform] duration-150 ease-out active:scale-[0.97] disabled:opacity-50 disabled:cursor-progress"
          >
            {buscando ? "Buscando…" : "Buscar"}
          </button>
          {filtrando && (
            <button
              type="button"
              onClick={() => {
                setFiltrando(false);
                setCodigo("");
                setSinResultado(false);
                setFinDeLista(false);
                setFallo(false);
                setEquipoActivo(null);
                setPhotos(initialPhotos);
              }}
              className="etiqueta text-muted hover:text-ink px-2"
            >
              Ver todas
            </button>
          )}
        </form>

        <p className="text-sm text-muted tabular-nums">
          Mostrando {photos.length} de {totalActual}
        </p>
      </div>

      {sinResultado && (
        <p className="text-muted border border-dashed border-line rounded-lg py-12 text-center">
          Ninguna foto de este partido tiene ese código.
        </p>
      )}

      <div
        className={`flex gap-3 items-start transition-opacity duration-200 ${
          cambiandoEquipo ? "opacity-40 pointer-events-none" : "opacity-100"
        }`}
      >
        {repartir(photos, columnas).map((columna, c) => (
          <ul key={c} className="flex-1 min-w-0 flex flex-col gap-3">
            {columna.map(({ photo, indice }) => {
              const enCarrito = cart.has(photo.id);
              return (
                <li key={photo.id} className="relative group">
                  {/* Cada foto entra por su cuenta al llegar a la pantalla. En
                      una galería que se recorre scrolleando, que aparezcan de a
                      una acompaña el movimiento; que estén todas puestas de
                      antemano lo vuelve una pared quieta. El escalón se calcula
                      sobre la posición dentro de la tanda, no sobre el total:
                      trayendo más fotos, la número 300 no puede esperar veinte
                      segundos. */}
                  <Aparecer retraso={Math.min(indice % 12, 5) * 45}>
                  <button
                    type="button"
                    onClick={() => irA(indice)}
                    className="block w-full bg-surface rounded-md overflow-hidden ring-1 ring-transparent con-mouse:group-hover:ring-accent/70 active:scale-[0.985] transition-[transform,box-shadow] duration-200"
                    aria-label={`Ver foto ${photo.code} en grande`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.thumbUrl}
                      alt={`Foto ${photo.code}`}
                      loading="lazy"
                      // El alto sale de la proporción real de la foto: así la
                      // grilla se acomoda a cada imagen y ninguna se recorta.
                      style={{ aspectRatio: String(photo.ratio || 1.5) }}
                      className="w-full h-auto object-cover con-mouse:group-hover:scale-[1.03] con-mouse:group-hover:brightness-110 transition-[transform,filter] duration-500 ease-out"
                    />
                  </button>

                  {/* Se hunde al tocarlo. El texto ya cambiaba, pero el dedo
                      tapa el botón justo cuando cambia: el que aprieta en el
                      celular no ve nada. El hundido se siente igual con el
                      dedo encima. */}
                  <button
                    type="button"
                    onClick={() => cart.toggle(toItem(photo))}
                    aria-pressed={enCarrito}
                    className={`absolute inset-x-2 bottom-2 etiqueta rounded px-2 py-1.5 transition-[opacity,transform,background-color] duration-150 ease-out active:scale-[0.96] ${
                      enCarrito
                        ? "bg-accent-solid text-accent-ink"
                        : "bg-ground/80 text-ink backdrop-blur-sm con-mouse:opacity-0 con-mouse:group-hover:opacity-100 con-mouse:focus-visible:opacity-100"
                    }`}
                  >
                    {enCarrito ? "En el carrito" : "Agregar"}
                  </button>

                  <span className="absolute top-2 left-2 etiqueta text-[0.6rem] bg-ground/70 backdrop-blur-sm rounded px-1.5 py-0.5 text-muted">
                    #{photo.code}
                  </span>
                  </Aparecer>
                </li>
              );
            })}
          </ul>
        ))}
      </div>

      {/* Mientras vienen, se dibujan sus huecos abajo de las que ya están.
          Ahora que se piden solas son más importantes todavía: son lo único que
          dice que hay más en camino, y sin ellas el final de la grilla parece
          el final de las fotos. */}
      {loading && (
        <div className="mt-3">
          <HuecoGrilla cantidad={8} />
        </div>
      )}

      {/* Ya no hay botón de "Cargar más fotos": las que siguen se piden solas al
          llegar al final. Éste es el hueco invisible que lo avisa, y va abajo
          de los huecos grises para que quede siempre al pie de todo. */}
      {quedanPorCargar && !fallo && <div ref={centinela} aria-hidden className="h-px" />}

      {/* Si el pedido se cae, hay que decirlo y dar con qué reintentar: sin
          botón que apretar, la grilla se quedaría corta sin explicar por qué. */}
      {fallo && (
        <div className="mt-8 text-center">
          <p className="text-sm text-muted mb-3">
            No se pudieron traer más fotos. Puede ser la conexión.
          </p>
          <button
            onClick={() => void pedirMas()}
            disabled={loading}
            aria-busy={loading}
            className="etiqueta border border-line rounded-full px-8 py-3 con-mouse:hover:border-accent transition-[color,border-color,transform] duration-150 ease-out active:scale-[0.98] disabled:opacity-50 disabled:cursor-progress inline-flex items-center"
          >
            {loading ? "Probando de nuevo" : "Reintentar"}
            {loading && <span aria-hidden className="senal-link senal-link-activa" />}
          </button>
        </div>
      )}

      {cart.count > 0 && (
        <div className="sticky bottom-4 mt-10 flex flex-col items-center gap-2">
          <div className="max-w-md w-full bg-ground/90 backdrop-blur rounded-md">
            <EmpujeDescuento compacto />
          </div>
          <Link
            href="/carrito"
            className="bg-accent-solid text-accent-ink etiqueta rounded-full px-6 py-3 shadow-lg flex items-center gap-3"
          >
            <span>
              {cart.count} {cart.count === 1 ? "foto" : "fotos"}
            </span>
            <span className="opacity-60">·</span>
            <span className="cifra">{precio(cart.total)}</span>
            <span className="opacity-60">·</span>
            <span className="flex items-center">
              Ir al carrito
              <SenalDeLink />
            </span>
          </Link>
        </div>
      )}

      {openIndex !== null && photos[openIndex] && (
        <Lightbox
          photos={photos}
          index={openIndex}
          priceArs={priceArs}
          inCart={cart.has(photos[openIndex].id)}
          onToggle={() => cart.toggle(toItem(photos[openIndex]))}
          onClose={() => setOpenIndex(null)}
          onIndex={irA}
        />
      )}
    </section>
  );
}
