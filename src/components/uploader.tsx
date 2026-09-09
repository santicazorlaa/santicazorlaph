"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type Estado = { nombre: string; estado: "esperando" | "subiendo" | "listo" | "error"; error?: string };

/**
 * La foto va en dos pasos: primero el original viaja derecho al bucket con un
 * link firmado, y recién después el servidor la procesa. Nunca pasa por el
 * servidor, porque una foto de 20 MB no entra en una petición a Vercel.
 *
 * Devuelve null si salió bien, o el mensaje de error.
 */
async function subirUna(eventId: string, file: File): Promise<string | null> {
  const permiso = await fetch("/api/admin/subir/autorizar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventId,
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

  const procesado = await fetch("/api/admin/subir/procesar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventId,
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
export function Uploader({ eventId }: { eventId: string }) {
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
        const error = await subirUna(eventId, lista[i]);
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
        Se les pone la marca de agua automáticamente. El original queda guardado aparte y no
        se muestra en ningún lado hasta que alguien lo compra.
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
