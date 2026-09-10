"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

/// A cuánto se achica en el navegador antes de mandarla. No es la medida final
/// —de eso se encarga el servidor— sino el techo que hace que la petición entre
/// en el límite de 4,5 MB de Vercel aun viniendo de una cámara de 19 MB.
///
/// Tiene que quedar cómodamente por encima de la medida más grande con la que
/// el servidor publica (la tapa, a 1920): si el techo fuera más chico, el
/// servidor estaría agrandando una imagen ya achicada y la tapa saldría
/// borrosa aunque el número diga otra cosa.
const LADO_MAXIMO = 2600;

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
 * Elegir una imagen del sitio: la tapa o el retrato.
 *
 * La achica antes de subirla porque una foto de la cámara de Santi pesa unos
 * 19 MB y el servidor rechaza cualquier petición de más de 4,5 MB. Es el mismo
 * motivo por el que las fotos de los partidos se suben directo al bucket, sólo
 * que acá, siendo una sola imagen chica, alcanza con achicarla.
 */
export function SubirImagen({
  campo,
  etiqueta,
  ayuda,
  actual,
  proporcion,
}: {
  campo: "tapa" | "retrato";
  etiqueta: string;
  ayuda: string;
  actual: string | null;
  proporcion: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState<"listo" | "subiendo">("listo");
  const [error, setError] = useState<string | null>(null);

  async function elegir(archivo: File) {
    setEstado("subiendo");
    setError(null);
    try {
      const blob = await achicar(archivo);
      const cuerpo = new FormData();
      cuerpo.append("campo", campo);
      cuerpo.append("archivo", blob, "imagen.jpg");

      const respuesta = await fetch("/api/admin/contenido/imagen", {
        method: "POST",
        body: cuerpo,
      });
      if (!respuesta.ok) {
        const datos = await respuesta.json().catch(() => ({}));
        throw new Error(datos.error ?? "No se pudo subir");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir");
    } finally {
      setEstado("listo");
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div>
      <h3 className="etiqueta text-muted mb-1">{etiqueta}</h3>
      <p className="text-sm text-muted mb-3 max-w-prose">{ayuda}</p>

      <div className="max-w-72 bg-surface-2 rounded-md overflow-hidden border border-line mb-3">
        {actual ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={actual} alt="" className="w-full h-auto" />
        ) : (
          <div className={`${proporcion} grid place-items-center text-xs text-muted px-4 text-center`}>
            Sin imagen
          </div>
        )}
      </div>

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
      <button
        type="button"
        disabled={estado === "subiendo"}
        onClick={() => input.current?.click()}
        className="etiqueta border border-line rounded-md px-5 py-2.5 con-mouse:hover:border-accent transition-colors disabled:opacity-50"
      >
        {estado === "subiendo" ? "Subiendo…" : actual ? "Cambiar imagen" : "Elegir imagen"}
      </button>

      {error && <p className="text-sm text-danger mt-2">{error}</p>}
    </div>
  );
}
