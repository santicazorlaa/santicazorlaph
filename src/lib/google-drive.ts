export type DrivePhotoItem = {
  id: string;
  name: string;
  code: string;
  width: number;
  height: number;
  sizeBytes: number;
  camera: string | null;
  lens: string | null;
  takenAt: Date | null;
  thumbUrl: string;
  previewUrl: string;
  downloadUrl: string;
};

/**
 * Extrae el ID de una carpeta de Google Drive a partir de una URL compartida
 * o devuelve el texto limpio si ya era un ID.
 *
 * Soporta formatos:
 * - https://drive.google.com/drive/folders/1AbC...
 * - https://drive.google.com/drive/u/0/folders/1AbC...?usp=sharing
 * - https://drive.google.com/open?id=1AbC...
 * - 1AbC... (ID directo)
 */
export function extractDriveFolderId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Si ya es un ID simple (alfanumérico y guiones comunes de Google Drive)
  if (/^[a-zA-Z0-9_-]{25,}$/.test(trimmed)) {
    return trimmed;
  }

  // URL /folders/ID
  const matchFolders = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (matchFolders?.[1]) return matchFolders[1];

  // URL ?id=ID
  const matchIdParam = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchIdParam?.[1]) return matchIdParam[1];

  return null;
}

/**
 * Genera el enlace de descarga directa para un archivo de Google Drive en resolución original.
 * Este enlace dispara la descarga inmediata del archivo individual en el navegador del usuario.
 */
export function driveDownloadUrl(fileId: string): string {
  return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download`;
}

/**
 * URL de visualización optimizada servida por el CDN de Google (lh3.googleusercontent.com).
 * Permite redimensionar dinámicamente la imagen para que la galería web cargue al instante.
 */
export function driveThumbUrl(
  fileId: string,
  variant: "thumb" | "preview" | "large" = "thumb",
): string {
  const sizeParam = variant === "thumb" ? "w600" : variant === "preview" ? "w1600" : "w2400";
  return `https://lh3.googleusercontent.com/d/${encodeURIComponent(fileId)}=${sizeParam}`;
}

/**
 * Parsea fechas EXIF típicas de cámaras ("YYYY:MM:DD HH:MM:SS" o ISO).
 */
function parseExifDate(str?: string): Date | null {
  if (!str) return null;
  if (/^\d{4}:\d{2}:\d{2}/.test(str)) {
    const [d, t] = str.split(" ");
    const isoStr = `${d.replace(/:/g, "-")}T${t || "00:00:00"}Z`;
    const parsed = new Date(isoStr);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Genera un código legible de 4 a 6 caracteres para la foto a partir del nombre o índice.
 * Ej: "DSC_0142.jpg" -> "0142" o "F042".
 */
function generatePhotoCode(name: string, index: number): string {
  const match = name.match(/(\d{3,5})/);
  if (match?.[1]) {
    return match[1];
  }
  return String(index + 1).padStart(4, "0");
}

type GoogleDriveFileResponse = {
  id: string;
  name: string;
  mimeType?: string;
  size?: string;
  createdTime?: string;
  imageMediaMetadata?: {
    width?: number;
    height?: number;
    rotation?: number;
    cameraMake?: string;
    cameraModel?: string;
    lens?: string;
    time?: string;
  };
};

type GoogleDriveListResponse = {
  files?: GoogleDriveFileResponse[];
  nextPageToken?: string;
  error?: {
    code: number;
    message: string;
  };
};

/**
 * Consulta la API pública de Google Drive para indexar todas las fotos de una carpeta compartida.
 * Requiere que la carpeta tenga permiso "Cualquiera con el enlace puede ver" y una API Key configurada.
 */
export async function fetchDriveFolderPhotos(
  folderId: string,
  apiKey?: string,
): Promise<{ success: true; photos: DrivePhotoItem[] } | { success: false; error: string }> {
  const key = apiKey || process.env.GOOGLE_DRIVE_API_KEY;

  if (!key) {
    return {
      success: false,
      error:
        "Falta configurar la variable GOOGLE_DRIVE_API_KEY en tu archivo .env. Podés generarla gratis en Google Cloud Console en 2 minutos.",
    };
  }

  const allFiles: GoogleDriveFileResponse[] = [];
  let pageToken: string | undefined = undefined;

  try {
    do {
      const query = encodeURIComponent(
        `'${folderId}' in parents and trashed = false and (mimeType contains 'image/' or name contains '.jpg' or name contains '.jpeg' or name contains '.png' or name contains '.webp')`,
      );
      const fields = encodeURIComponent(
        "nextPageToken,files(id,name,mimeType,size,imageMediaMetadata,createdTime)",
      );

      let url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&pageSize=1000&key=${key}`;
      if (pageToken) {
        url += `&pageToken=${encodeURIComponent(pageToken)}`;
      }

      const res = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      const data = (await res.json()) as GoogleDriveListResponse;

      if (!res.ok || data.error) {
        const msg = data.error?.message || `Error de Google Drive (${res.status})`;
        if (res.status === 404 || msg.includes("File not found")) {
          return {
            success: false,
            error:
              "No se encontró la carpeta. Asegurate de que el enlace sea correcto y esté configurada como 'Cualquiera con el enlace puede ver'.",
          };
        }
        if (res.status === 403) {
          return {
            success: false,
            error: `Google Drive denegó el acceso: ${msg}. Verificá que la carpeta sea pública para lectura y que la API Key esté habilitada para Google Drive API v3.`,
          };
        }
        return { success: false, error: msg };
      }

      if (data.files && data.files.length > 0) {
        allFiles.push(...data.files);
      }

      pageToken = data.nextPageToken;
    } while (pageToken);

    if (allFiles.length === 0) {
      return {
        success: false,
        error:
          "La carpeta no contiene fotos válidas (JPG/PNG/WebP) o aún no terminó de procesarse en Google Drive.",
      };
    }

    // Mapear archivos a nuestro formato enriquecido
    const photos: DrivePhotoItem[] = allFiles.map((file, idx) => {
      const meta = file.imageMediaMetadata;
      const width = meta?.width || 0;
      const height = meta?.height || 0;
      const sizeBytes = file.size ? parseInt(file.size, 10) : 0;
      const camera = meta?.cameraModel
        ? meta.cameraMake && !meta.cameraModel.includes(meta.cameraMake)
          ? `${meta.cameraMake} ${meta.cameraModel}`
          : meta.cameraModel
        : meta?.cameraMake || null;
      const lens = meta?.lens || null;
      const takenAt = parseExifDate(meta?.time) || parseExifDate(file.createdTime);

      return {
        id: file.id,
        name: file.name,
        code: generatePhotoCode(file.name, idx),
        width,
        height,
        sizeBytes,
        camera,
        lens,
        takenAt,
        thumbUrl: driveThumbUrl(file.id, "thumb"),
        previewUrl: driveThumbUrl(file.id, "preview"),
        downloadUrl: driveDownloadUrl(file.id),
      };
    });

    return { success: true, photos };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Error inesperado al conectar con Google Drive";
    return { success: false, error: errorMsg };
  }
}
