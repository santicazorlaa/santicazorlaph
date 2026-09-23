import { customAlphabet } from "nanoid";
import { db } from "./db";
import { slugify } from "./format";
import {
  driveDownloadUrl,
  driveThumbUrl,
  extractDriveFolderId,
  fetchDriveFolderPhotos,
} from "./google-drive";

const newDeliveryToken = customAlphabet("abcdefghijkmnpqrstuvwxyz23456789", 16);

export type DeliveryPhotoDTO = {
  id: string;
  driveFileId: string;
  name: string;
  code: string;
  width: number;
  height: number;
  ratio: number;
  sizeBytes: number;
  camera: string | null;
  lens: string | null;
  thumbUrl: string;
  previewUrl: string;
  downloadUrl: string;
};

export type ClientDeliveryDTO = {
  id: string;
  slug: string;
  token: string;
  title: string;
  clientName: string;
  date: string;
  location: string | null;
  driveUrl: string;
  hasPin: boolean;
  coverUrl: string | null;
  published: boolean;
  totalPhotos: number;
};

export function toDeliveryPhotoDTO(p: {
  id: string;
  driveFileId: string;
  name: string;
  code: string;
  width: number;
  height: number;
  sizeBytes: number;
  camera: string | null;
  lens: string | null;
  takenAt: Date | null;
}): DeliveryPhotoDTO {
  return {
    id: p.id,
    driveFileId: p.driveFileId,
    name: p.name,
    code: p.code,
    width: p.width,
    height: p.height,
    ratio: p.height > 0 ? p.width / p.height : 1.5,
    sizeBytes: p.sizeBytes,
    camera: p.camera,
    lens: p.lens,
    thumbUrl: driveThumbUrl(p.driveFileId, "thumb"),
    previewUrl: driveThumbUrl(p.driveFileId, "preview"),
    downloadUrl: driveDownloadUrl(p.driveFileId),
  };
}

/**
 * Genera un slug único para la entrega a partir del título y cliente.
 */
export async function generateUniqueDeliverySlug(baseText: string) {
  const base = slugify(baseText);
  let slug = base;
  for (let i = 2; await db.clientDelivery.findUnique({ where: { slug } }); i++) {
    slug = `${base}-${i}`;
  }
  return slug;
}

/**
 * Sincroniza las fotos de la carpeta de Google Drive a la base de datos para una entrega.
 */
export async function syncDeliveryPhotos(deliveryId: string): Promise<{
  success: boolean;
  count: number;
  error?: string;
}> {
  const delivery = await db.clientDelivery.findUnique({
    where: { id: deliveryId },
  });

  if (!delivery) {
    return { success: false, count: 0, error: "Entrega no encontrada" };
  }

  const result = await fetchDriveFolderPhotos(delivery.driveFolderId);
  if (!result.success) {
    return { success: false, count: 0, error: result.error };
  }

  const { photos } = result;

  // Actualizamos o creamos las fotos en lote
  // Para no duplicar ni perder datos existentes, eliminamos las viejas y guardamos las nuevas
  await db.$transaction(async (tx) => {
    await tx.deliveryPhoto.deleteMany({ where: { deliveryId } });

    await tx.deliveryPhoto.createMany({
      data: photos.map((p) => ({
        deliveryId,
        driveFileId: p.id,
        name: p.name,
        code: p.code,
        width: p.width,
        height: p.height,
        sizeBytes: p.sizeBytes,
        camera: p.camera,
        lens: p.lens,
        takenAt: p.takenAt,
      })),
    });

    // Si la entrega no tiene portada asignada, asignamos la miniatura de la primera foto
    if (!delivery.coverUrl && photos.length > 0) {
      await tx.clientDelivery.update({
        where: { id: deliveryId },
        data: { coverUrl: driveThumbUrl(photos[0].id, "preview") },
      });
    }
  });

  return { success: true, count: photos.length };
}

/**
 * Crea una nueva entrega de cliente y sincroniza sus fotos si la carpeta es accesible.
 */
export async function createClientDelivery(data: {
  title: string;
  clientName: string;
  date: Date;
  location?: string;
  driveUrl: string;
  pin?: string;
}) {
  const driveFolderId = extractDriveFolderId(data.driveUrl);
  if (!driveFolderId) {
    throw new Error("El link de Google Drive no es válido o no pudimos extraer el ID de la carpeta.");
  }

  const slug = await generateUniqueDeliverySlug(`${data.title}-${data.clientName}`);
  const token = newDeliveryToken();

  const delivery = await db.clientDelivery.create({
    data: {
      slug,
      token,
      title: data.title.trim(),
      clientName: data.clientName.trim(),
      date: data.date,
      location: data.location?.trim() || null,
      driveUrl: data.driveUrl.trim(),
      driveFolderId,
      pin: data.pin?.trim() || null,
      published: true,
    },
  });

  // Intentamos sincronizar inmediatamente si hay API key configurada
  try {
    await syncDeliveryPhotos(delivery.id);
  } catch (e) {
    // Si falla la sincronización inmediata (ej: falta API Key), no tiramos la entrega,
    // se puede reintentar desde el panel
    console.error("No se pudo sincronizar automáticamente con Google Drive:", e);
  }

  return delivery;
}
