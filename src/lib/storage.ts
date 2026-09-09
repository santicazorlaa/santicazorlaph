import "server-only";

import { createHmac } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { authSecret, r2, siteUrl, usingLocalStorage } from "./env";

export type Bucket = "public" | "private";

const LOCAL_ROOT = path.join(process.cwd(), ".data", "storage");

let client: S3Client | null = null;
function s3() {
  if (!client) {
    const cfg = r2();
    client = new S3Client({
      region: "auto",
      endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
    });
  }
  return client;
}

function bucketName(bucket: Bucket) {
  const cfg = r2();
  return bucket === "public" ? cfg.publicBucket : cfg.privateBucket;
}

function localPath(bucket: Bucket, key: string) {
  return path.join(LOCAL_ROOT, bucket, key);
}

export async function putObject(
  bucket: Bucket,
  key: string,
  body: Buffer,
  contentType: string,
) {
  if (usingLocalStorage()) {
    const file = localPath(bucket, key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
    return;
  }

  await s3().send(
    new PutObjectCommand({
      Bucket: bucketName(bucket),
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl:
        bucket === "public" ? "public, max-age=31536000, immutable" : "private, no-store",
    }),
  );
}

export async function getObject(bucket: Bucket, key: string): Promise<Buffer> {
  if (usingLocalStorage()) {
    return readFile(localPath(bucket, key));
  }

  const res = await s3().send(
    new GetObjectCommand({ Bucket: bucketName(bucket), Key: key }),
  );
  return Buffer.from(await res.Body!.transformToByteArray());
}

export async function deleteObject(bucket: Bucket, key: string) {
  if (usingLocalStorage()) {
    await unlink(localPath(bucket, key)).catch(() => {});
    return;
  }
  await s3().send(new DeleteObjectCommand({ Bucket: bucketName(bucket), Key: key }));
}

/// URL pública y cacheable de un preview con marca de agua.
export function publicUrl(key: string) {
  if (usingLocalStorage()) return `${siteUrl}/api/media/${key}`;
  return `${r2().publicUrl}/${key}`;
}

/// Link de descarga del original que caduca. Es lo único que ve el comprador
/// después de pagar, y deja de servir a los pocos minutos.
export async function signedDownloadUrl(
  key: string,
  filename: string,
  expiresInSeconds = 300,
) {
  if (usingLocalStorage()) {
    const expires = Date.now() + expiresInSeconds * 1000;
    const sig = createHmac("sha256", authSecret())
      .update(`${key}:${expires}`)
      .digest("hex");
    const params = new URLSearchParams({ key, expires: String(expires), sig, filename });
    return `${siteUrl}/api/download?${params}`;
  }

  return getSignedUrl(
    s3(),
    new GetObjectCommand({
      Bucket: bucketName("private"),
      Key: key,
      ResponseContentDisposition: `attachment; filename="${filename}"`,
    }),
    { expiresIn: expiresInSeconds },
  );
}

/**
 * Link para que el navegador suba el original directo al bucket, sin pasar por
 * el servidor. Es la única forma de subir fotos de 20 MB: las funciones de
 * Vercel rechazan cualquier petición de más de 4,5 MB.
 */
export async function signedUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds = 900,
) {
  if (usingLocalStorage()) {
    const expires = Date.now() + expiresInSeconds * 1000;
    const sig = createHmac("sha256", authSecret())
      .update(`upload:${key}:${expires}`)
      .digest("hex");
    const params = new URLSearchParams({ key, expires: String(expires), sig });
    return `${siteUrl}/api/upload?${params}`;
  }

  return getSignedUrl(
    s3(),
    new PutObjectCommand({
      Bucket: bucketName("private"),
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: expiresInSeconds },
  );
}

export function verifyLocalUploadSignature(
  key: string,
  expires: string,
  sig: string,
) {
  if (Number(expires) < Date.now()) return false;
  const expected = createHmac("sha256", authSecret())
    .update(`upload:${key}:${expires}`)
    .digest("hex");
  return expected === sig;
}

export function verifyLocalDownloadSignature(
  key: string,
  expires: string,
  sig: string,
) {
  if (Number(expires) < Date.now()) return false;
  const expected = createHmac("sha256", authSecret())
    .update(`${key}:${expires}`)
    .digest("hex");
  return expected === sig;
}
