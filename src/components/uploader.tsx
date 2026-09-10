"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type Estado = { nombre: string; estado: "esperando" | "subiendo" | "listo" | "error"; error?: string };

type Destino = { tipo: "partido" | "portfolio"; extra: Record<string, string> };

/// Los dos destinos posibles. Comparten el camino en dos pasos —el original
/// viaja derecho al bucket, el servidor lo procesa después— y se diferencian en
/// qué hace ese procesado: una foto de partido lleva marca de agua, una del
/// portfolio no.
const RUTAS = {
  partido: {
    autorizar: "/api/admin/subir/autorizar",
    procesar: "/api/admin/subir/procesar",
  },
  portfolio: {
    autorizar: "/api/admin/portfolio/autorizar",
    procesar: "/api/admin/portfolio/procesar",
  },
} as const;

/**
 * La foto va en dos pasos: primero el original viaja derecho al bucket con un
 * link firmado, y recién después el servidor la procesa. Nunca pasa por el
 * servidor, porque una foto de 20 MB no entra en una petición a Vercel.
 *
 * Devuelve null si salió bien, o el mensaje de error.
 */
async function subirUna(destino: Destino, file: File): Promise<string | null> {
  const rutas = RUTAS[destino.tipo];
  const permiso = await fetch(rutas.autorizar, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...destino.extra,
      contentType: file.type || "image/jpeg",
      size: file.size,
    }),
  });
  const datosPermiso = await permiso.json();
  if (!permiso.ok) return datosPermiso.error ?? "No pudimos autorizar la subida";

  const puesta = await fetch(datosPermiso.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "image/jpeg" },
    body: file,
  });
  if (!puesta.ok) return `No se pudo subir el archivo (${puesta.status})`;

  const procesado = await fetch(rutas.procesar, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...destino.extra,
      objeto: datosPermiso.objeto,
      filename: file.name,
    }),
  });
  const datosProceso = await procesado.json();
  if (!procesado.ok) return datosProceso.error ?? "No pudimos procesar la foto";

  return null;
}

/// Las fotos se suben de a una y en serie: cada una se procesa en el servidor
/// (marca de agua + miniaturas) y mandarlas todas juntas lo satura.
export function Uploader({ eventId }: { eventId?: string }) {
  // Sin partido, la foto va al portfolio: la selección curada, que no pertenece
  // a ningún partido y no está a la venta.
  const destino: Destino = eventId
    ? { tipo: "partido", extra: { eventId } }
    : { tipo: "portfolio", extra: {} };

  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [cola, setCola] = useState<Estado[]>([]);
  const [trabajando, setTrabajando] = useState(false);

  const subir = async (files: FileList) => {
    const lista = Array.from(files);
    setCola(lista.map((f) => ({ nombre: f.name, estado: "esperando" })));
    setTrabajando(true);

    for (let i = 0; i < lista.length; i++) {
      setCola((prev) =>
        prev.map((c, j) => (j === i ? { ...c, estado: "subiendo" } : c)),
      );

      try {
        const error = await subirUna(destino, lista[i]);
        setCola((prev) =>
          prev.map((c, j) =>
            j === i
              ? error
                ? { ...c, estado: "error", error }
                : { ...c, estado: "listo" }
              : c,
          ),
        );
      } catch {
        setCola((prev) =>
          prev.map((c, j) =>
            j === i ? { ...c, estado: "error", error: "Falló la conexión" } : c,
          ),
        );
      }
    }

    setTrabajando(false);
    if (input.current) input.current.value = "";
    router.refresh();
  };

  const listas = cola.filter((c) => c.estado === "listo").length;
  const fallidas = cola.filter((c) => c.estado === "error");

  return (
    <section className="border border-line rounded-lg p-5">
      <h2 className="etiqueta text-muted mb-4">Subir fotos</h2>

      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        disabled={trabajando}
        onChange={(e) => e.target.files?.length && subir(e.target.files)}
        className="block w-full text-sm text-muted file:mr-4 file:rounded-md file:border-0 file:bg-accent-solid file:px-5 file:py-2.5 file:text-accent-ink file:font-medium file:uppercase file:tracking-wider file:text-xs disabled:opacity-50"
      />

      <p className="mt-3 text-xs text-muted">
        {destino.tipo === "partido"
          ? "Se les pone la marca de agua automáticamente. El original queda guardado aparte y no se muestra en ningún lado hasta que alguien lo compra."
          : "Van sin marca de agua y se ven grandes: son tu carta de presentación, no están a la venta. El original queda guardado y no se publica."}
      </p>

      {cola.length > 0 && (
        <div className="mt-5 pt-5 border-t border-line">
          <p className="text-sm tabular-nums">
            {listas} de {cola.length} listas
            {trabajando && <span className="text-muted"> · procesando…</span>}
          </p>

          <div className="mt-2 h-1 bg-surface-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-[width] duration-300"
              style={{ width: `${(listas / cola.length) * 100}%` }}
            />
          </div>

          {fallidas.length > 0 && (
            <ul className="mt-4 space-y-1 text-xs text-danger">
              {fallidas.map((f) => (
                <li key={f.nombre}>
                  {f.nombre} — {f.error ?? "falló"}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
