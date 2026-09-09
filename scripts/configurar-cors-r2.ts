/**
 * Autoriza al navegador a subir originales directo al bucket privado.
 *
 * Sin esto el navegador bloquea la subida: pide permiso al bucket antes de
 * mandar el archivo y, si el bucket no contesta que ese origen está permitido,
 * cancela. Es la contracara de subir sin pasar por el servidor.
 *
 * Hay que volver a correrlo si cambia el dominio del sitio.
 *
 *   npx tsx --env-file=.env scripts/configurar-cors-r2.ts
 */
import { GetBucketCorsCommand, PutBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";

const ORIGENES = [
  "http://localhost:3000",
  "https://santicazorlaph.com",
  "https://www.santicazorlaph.com",
];

const bucket = process.env.R2_BUCKET_PRIVATE ?? "";

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  },
});

async function main() {
  await s3.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: ORIGENES,
            // Sólo PUT: el navegador sube, pero nunca lee de este bucket.
            AllowedMethods: ["PUT"],
            AllowedHeaders: ["*"],
            ExposeHeaders: ["ETag"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  );

  const actual = await s3.send(new GetBucketCorsCommand({ Bucket: bucket }));
  console.log(`CORS aplicado en ${bucket}:`);
  for (const regla of actual.CORSRules ?? []) {
    console.log(`  origenes: ${regla.AllowedOrigins?.join(", ")}`);
    console.log(`  metodos:  ${regla.AllowedMethods?.join(", ")}`);
  }
}

main().catch((e) => {
  console.error(`No se pudo configurar el CORS: ${e.message}`);
  console.error(
    "\nSi es por permisos, se puede cargar a mano desde el panel de Cloudflare:\n" +
      `  R2 > ${bucket} > Settings > CORS Policy`,
  );
  process.exit(1);
});
