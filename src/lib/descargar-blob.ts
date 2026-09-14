"use client";

/**
 * Descarga directamente una imagen al dispositivo del usuario convirtiéndola en un Blob local.
 * Esto evita que el navegador abra una nueva pestaña debido a restricciones de cross-origin
 * y garantiza que se guarde con el nombre de archivo especificado.
 */
export async function descargarFotoBlob(url: string, filename: string): Promise<boolean> {
  try {
    const res = await fetch(url, { referrerPolicy: "no-referrer" });
    if (!res.ok) {
      throw new Error(`Error HTTP ${res.status}`);
    }

    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();

    // Liberar memoria del blob
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 2000);

    return true;
  } catch (err) {
    console.error("No se pudo descargar como blob, usando fallback:", err);
    // Fallback: abrir en pestaña si falla
    window.open(url, "_blank");
    return false;
  }
}
