"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  acotar,
  encuadreCompleto,
  escribirEncuadre,
  leerEncuadre,
  TAPA_CELULAR,
  TAPA_ESCRITORIO,
  type Encuadre,
  type Formato,
} from "@/lib/encuadre";

/// A cuánto se achica en el navegador antes de mandarla. No es la medida final
/// —de eso se encarga el servidor— sino el techo que hace que la petición entre
/// en el límite de 4,5 MB de Vercel aun viniendo de una cámara de 19 MB. Queda
/// por encima del ancho con el que se publica la tapa (1920) para que el
/// servidor nunca tenga que agrandar una imagen ya achicada.
const LADO_MAXIMO = 2600;

/// Cuánto se puede acercar como máximo. Más que esto es agrandar píxeles: el
/// recorte se vuelve más chico que lo que se publica y sale borroso.
const ACERCAMIENTO_MAXIMO = 5;

async function achicar(archivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("No se pudo preparar la imagen"))),
      "image/jpeg",
      0.85,
    ),
  );
}

/**
 * Elegir y encuadrar la tapa del sitio.
 *
 * La tapa se publica dos veces, con dos recortes distintos de la misma foto:
 * en una pantalla de escritorio es una franja bien apaisada y en un celular un
 * rectángulo alto. Dejando que el navegador recorte solo —siempre por el
 * centro— pasaba que en el teléfono se veía el pasto y la jugada quedaba
 * afuera. Acá Santi mueve y acerca cada recorte, con el degradado y el título
 * encima, viendo exactamente lo que va a salir publicado.
 */
export function EncuadrarTapa({
  actualEscritorio,
  actualCelular,
  hayOrigen,
  encuadreEscritorio,
  encuadreCelular,
  titular,
}: {
  actualEscritorio: string | null;
  actualCelular: string | null;
  hayOrigen: boolean;
  encuadreEscritorio: string;
  encuadreCelular: string;
  titular: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<{ src: string; archivo: Blob | null } | null>(null);
  const [preparando, setPreparando] = useState(false);

  async function elegir(archivo: File) {
    setPreparando(true);
    setError(null);
    try {
      const blob = await achicar(archivo);
      setEditando({ src: URL.createObjectURL(blob), archivo: blob });
    } catch {
      setError("No pudimos leer esa imagen. Probá con un JPG o un PNG.");
    } finally {
      setPreparando(false);
      if (input.current) input.current.value = "";
    }
  }

  function cerrar(seGuardo: boolean) {
    if (editando?.archivo) URL.revokeObjectURL(editando.src);
    setEditando(null);
    if (seGuardo) router.refresh();
  }

  return (
    <div>
      <h3 className="etiqueta text-muted mb-1">Foto de fondo</h3>
      <p className="text-sm text-muted mb-3 max-w-prose">
        Va detrás del título, oscurecida para que el texto se lea. Al elegirla vas a poder
        acomodar por separado cómo se ve en una computadora y en un celular. Si no elegís
        ninguna, se usa la portada del último partido.
      </p>

      {actualEscritorio ? (
        <div className="flex flex-wrap items-end gap-3 mb-3">
          <div className="w-72 rounded-md overflow-hidden border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={actualEscritorio} alt="" className="w-full h-auto" />
            <p className="etiqueta text-[0.65rem] text-muted px-2 py-1.5">Computadora</p>
          </div>
          {actualCelular && (
            <div className="w-28 rounded-md overflow-hidden border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={actualCelular} alt="" className="w-full h-auto" />
              <p className="etiqueta text-[0.65rem] text-muted px-2 py-1.5">Celular</p>
            </div>
          )}
        </div>
      ) : (
        <div className="w-72 aspect-[12/5] grid place-items-center bg-surface-2 rounded-md border border-line text-xs text-muted mb-3">
          Sin imagen
        </div>
      )}

      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          if (archivo) elegir(archivo);
        }}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={preparando}
          onClick={() => input.current?.click()}
          className="etiqueta border border-line rounded-md px-5 py-2.5 con-mouse:hover:border-accent transition-colors disabled:opacity-50"
        >
          {preparando ? "Abriendo…" : actualEscritorio ? "Cambiar foto" : "Elegir foto"}
        </button>

        {/* Reencuadrar no vuelve a subir nada: el archivo original quedó
            guardado, así que mover el recorte no cuesta una subida. */}
        {actualEscritorio && hayOrigen && (
          <button
            type="button"
            onClick={() => setEditando({ src: "/api/admin/contenido/imagen?campo=tapa", archivo: null })}
            className="etiqueta border border-line rounded-md px-5 py-2.5 con-mouse:hover:border-accent transition-colors"
          >
            Acomodar el recorte
          </button>
        )}
      </div>

      {error && <p className="text-sm text-danger mt-2">{error}</p>}

      {editando && (
        <Editor
          src={editando.src}
          archivo={editando.archivo}
          titular={titular}
          inicial={{
            escritorio: leerEncuadre(encuadreEscritorio),
            celular: leerEncuadre(encuadreCelular),
          }}
          alCerrar={cerrar}
        />
      )}
    </div>
  );
}

function Editor({
  src,
  archivo,
  titular,
  inicial,
  alCerrar,
}: {
  src: string;
  archivo: Blob | null;
  titular: string;
  inicial: { escritorio: Encuadre | null; celular: Encuadre | null };
  alCerrar: (seGuardo: boolean) => void;
}) {
  const [medidas, setMedidas] = useState<{ W: number; H: number } | null>(null);
  const [escritorio, setEscritorio] = useState<Encuadre | null>(null);
  const [celular, setCelular] = useState<Encuadre | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hasta no saber cuánto mide la foto no se puede calcular ningún recorte: el
  // recorte más grande posible depende de si la foto es apaisada o vertical.
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const W = img.naturalWidth;
      const H = img.naturalHeight;
      setMedidas({ W, H });
      // Un recorte guardado con otra foto no sirve, pero acotarlo alcanza: las
      // fracciones valen igual en cualquier medida.
      setEscritorio(inicial.escritorio ?? encuadreCompleto(W, H, TAPA_ESCRITORIO));
      setCelular(inicial.celular ?? encuadreCompleto(W, H, TAPA_CELULAR));
    };
    img.onerror = () => setError("No pudimos abrir la foto.");
    img.src = src;
    // Sólo al abrir: si se rehiciera con cada cambio, perdería lo acomodado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  async function guardar() {
    if (!escritorio || !celular) return;
    setGuardando(true);
    setError(null);
    try {
      const cuerpo = new FormData();
      cuerpo.append("campo", "tapa");
      if (archivo) cuerpo.append("archivo", archivo, "imagen.jpg");
      cuerpo.append("encuadreEscritorio", escribirEncuadre(escritorio));
      cuerpo.append("encuadreCelular", escribirEncuadre(celular));

      const respuesta = await fetch("/api/admin/contenido/imagen", {
        method: "POST",
        body: cuerpo,
      });
      if (!respuesta.ok) {
        const datos = await respuesta.json().catch(() => ({}));
        throw new Error(datos.error ?? "No se pudo guardar");
      }
      alCerrar(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ground overflow-y-auto">
      <div className="mx-auto max-w-5xl px-5 py-10">
        <h2 className="titulo text-2xl">Acomodá la tapa</h2>
        <p className="text-sm text-muted mt-2 max-w-prose">
          Arrastrá la foto dentro de cada recuadro y usá la barra para acercarla. Son dos
          recortes distintos de la misma foto: así se va a ver en una computadora y así en un
          celular.
        </p>

        {medidas && escritorio && celular ? (
          <div className="mt-8 grid gap-8 md:grid-cols-[1fr_auto]">
            <Marco
              titulo="En una computadora"
              src={src}
              medidas={medidas}
              formato={TAPA_ESCRITORIO}
              encuadre={escritorio}
              alCambiar={setEscritorio}
              titular={titular}
              tamañoTitular="text-2xl sm:text-3xl"
            />
            <div className="md:w-64">
              <Marco
                titulo="En un celular"
                src={src}
                medidas={medidas}
                formato={TAPA_CELULAR}
                encuadre={celular}
                alCambiar={setCelular}
                titular={titular}
                tamañoTitular="text-xl"
              />
            </div>
          </div>
        ) : (
          <p className="text-muted py-20 text-center">{error ?? "Abriendo la foto…"}</p>
        )}

        {error && medidas && <p className="text-sm text-danger mt-4">{error}</p>}

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={guardando || !medidas}
            onClick={guardar}
            className="etiqueta bg-accent-solid text-accent-ink rounded-md px-6 py-3 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {guardando ? "Guardando…" : "Guardar la tapa"}
          </button>
          <button
            type="button"
            disabled={guardando}
            onClick={() => alCerrar(false)}
            className="etiqueta border border-line rounded-md px-6 py-3 con-mouse:hover:border-accent transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Un recuadro con la proporción exacta con la que se publica, la foto adentro
 * para arrastrar y acercar, y encima el degradado y el título del sitio.
 *
 * La foto se posiciona en porcentajes, no en píxeles: el recorte tiene la misma
 * proporción que el recuadro, así que "la foto mide 1/ancho del recorte" vale
 * igual en la pantalla del panel que en el archivo final. Es lo que hace que lo
 * que se ve acá sea de verdad lo que se publica.
 */
function Marco({
  titulo,
  src,
  medidas,
  formato,
  encuadre,
  alCambiar,
  titular,
  tamañoTitular,
}: {
  titulo: string;
  src: string;
  medidas: { W: number; H: number };
  formato: Formato;
  encuadre: Encuadre;
  alCambiar: (e: Encuadre) => void;
  titular: string;
  tamañoTitular: string;
}) {
  const arrastre = useRef<{ x: number; y: number; ancho: number; alto: number } | null>(null);
  const maximo = encuadreCompleto(medidas.W, medidas.H, formato);
  const acercamiento = maximo.ancho / encuadre.ancho;

  /// Acercar o alejar dejando quieto el centro de lo que se está mirando.
  function acercar(nuevo: number) {
    const z = Math.min(ACERCAMIENTO_MAXIMO, Math.max(1, nuevo));
    const ancho = maximo.ancho / z;
    const alto = maximo.alto / z;
    alCambiar(
      acotar({
        ancho,
        alto,
        x: encuadre.x + (encuadre.ancho - ancho) / 2,
        y: encuadre.y + (encuadre.alto - alto) / 2,
      }),
    );
  }

  return (
    <div>
      <p className="etiqueta text-muted mb-2">{titulo}</p>

      <div
        className="relative overflow-hidden rounded-lg border border-line bg-surface-2 cursor-grab active:cursor-grabbing touch-none select-none"
        style={{ aspectRatio: `${formato.ancho} / ${formato.alto}` }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          const caja = e.currentTarget.getBoundingClientRect();
          arrastre.current = { x: e.clientX, y: e.clientY, ancho: caja.width, alto: caja.height };
        }}
        onPointerMove={(e) => {
          const inicio = arrastre.current;
          if (!inicio) return;
          // El recuadro muestra `encuadre.ancho` de la foto a lo largo de
          // `inicio.ancho` píxeles de pantalla, así que un píxel de arrastre
          // vale esa fracción. La foto se mueve al revés que el recorte: si se
          // arrastra a la derecha, lo que se ve está más a la izquierda.
          const dx = ((e.clientX - inicio.x) / inicio.ancho) * encuadre.ancho;
          const dy = ((e.clientY - inicio.y) / inicio.alto) * encuadre.alto;
          alCambiar(acotar({ ...encuadre, x: encuadre.x - dx, y: encuadre.y - dy }));
          arrastre.current = { ...inicio, x: e.clientX, y: e.clientY };
        }}
        onPointerUp={() => (arrastre.current = null)}
        onPointerCancel={() => (arrastre.current = null)}
        onWheel={(e) => acercar(acercamiento * (e.deltaY < 0 ? 1.1 : 1 / 1.1))}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          draggable={false}
          className="absolute max-w-none"
          style={{
            width: `${(1 / encuadre.ancho) * 100}%`,
            height: `${(1 / encuadre.alto) * 100}%`,
            left: `${(-encuadre.x / encuadre.ancho) * 100}%`,
            top: `${(-encuadre.y / encuadre.alto) * 100}%`,
          }}
        />

        {/* El mismo degradado y el mismo título que el home, para que lo que se
            acomoda acá sea lo que se ve allá. */}
        <div className="absolute inset-0 bg-gradient-to-t from-ground via-ground/85 to-ground/45 pointer-events-none" />
        <div className="absolute inset-0 flex items-end p-4 pointer-events-none">
          <p className={`titulo ${tamañoTitular} text-balance`}>{titular}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-3">
        <span className="etiqueta text-[0.65rem] text-muted">Acercar</span>
        <input
          type="range"
          min={1}
          max={ACERCAMIENTO_MAXIMO}
          step={0.01}
          value={acercamiento}
          onChange={(e) => acercar(Number(e.target.value))}
          className="flex-1 accent-[var(--color-accent-solid)]"
        />
        <button
          type="button"
          onClick={() => alCambiar(maximo)}
          className="etiqueta text-[0.65rem] text-muted hover:text-fg transition-colors"
        >
          Centrar
        </button>
      </div>

      {/* Acercar de más recorta un pedazo con menos píxeles de los que se
          publican, y el servidor tiene que agrandarlo: se ve blando. Vale
          decirlo acá, mientras se puede corregir, y no después de publicar. */}
      {encuadre.ancho * medidas.W < formato.ancho * 0.8 && (
        <p className="text-xs text-muted mt-2">
          Muy acercada: a este tamaño la foto va a verse algo blanda. Alejala un poco si podés.
        </p>
      )}
    </div>
  );
}
