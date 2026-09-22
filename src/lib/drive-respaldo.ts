/**
 * La dirección de respaldo de una foto de Google Drive.
 *
 * Las fotos de una entrega se piden al CDN de Google (`driveThumbUrl` en
 * `google-drive.ts`), que es rápido y deja elegir la medida. Cuando esa no
 * responde —pasa, sobre todo con un archivo recién subido— se cae a esta, que
 * es la miniatura que Drive sirve por su cuenta.
 *
 * Vive acá y no en `google-drive.ts` porque la usa el navegador: ese módulo
 * tiene adentro todo el trabajo de listar una carpeta con la clave de la API, y
 * arrastrarlo al paquete que baja el visitante sería cargarle código del
 * servidor para armar una dirección de texto. Acá no hay nada más que eso: sin
 * `server-only`, como las otras cuentas que comparten los dos lados.
 *
 * Estaba escrita a mano en la grilla y en el visor, con medidas distintas y sin
 * escapar el identificador. Una sola vez y en un lugar, para que no se queden
 * desparejas.
 */
export function respaldoDriveThumbUrl(
  fileId: string,
  variant: "thumb" | "preview" = "thumb",
): string {
  const medida = variant === "thumb" ? "w600" : "w1600";
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=${medida}`;
}
