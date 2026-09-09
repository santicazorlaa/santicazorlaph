import { publicUrl } from "./storage";
import { formatBytes, megapixels } from "./watermark";

export const PHOTOS_PER_PAGE = 48;

export type PhotoDTO = {
  id: string;
  code: string;
  thumbUrl: string;
  previewUrl: string;
  ratio: number;
  resolucion: string;
  camara: string | null;
  lente: string | null;
  tomadaEn: string | null;
};

type PhotoRow = {
  id: string;
  code: string;
  thumbKey: string;
  previewKey: string;
  width: number;
  height: number;
  sizeBytes: number;
  camera: string | null;
  lens: string | null;
  takenAt: Date | null;
};

export function toPhotoDTO(p: PhotoRow): PhotoDTO {
  return {
    id: p.id,
    code: p.code,
    thumbUrl: publicUrl(p.thumbKey),
    previewUrl: publicUrl(p.previewKey),
    ratio: p.height > 0 ? p.width / p.height : 1.5,
    resolucion: `${megapixels(p.width, p.height)}MP · ${formatBytes(p.sizeBytes)}`,
    camara: p.camera,
    lente: p.lens,
    tomadaEn: p.takenAt ? p.takenAt.toISOString() : null,
  };
}

export const photoSelect = {
  id: true,
  code: true,
  thumbKey: true,
  previewKey: true,
  width: true,
  height: true,
  sizeBytes: true,
  camera: true,
  lens: true,
  takenAt: true,
} as const;
