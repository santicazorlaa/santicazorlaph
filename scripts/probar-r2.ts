/**
 * Verifica la conexión con Cloudflare R2: que las credenciales anden, que los
 * dos buckets existan, que se pueda escribir y leer, y —lo más importante— que
 * el bucket de originales NO sea accesible desde internet.
 *
 *   npx tsx --conditions=react-server --env-file=.env scripts/probar-r2.ts
 */
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const cuenta = process.env.R2_ACCOUNT_ID ?? "";
const bucketPublico = process.env.R2_BUCKET_PUBLIC ?? "";
const bucketPrivado = process.env.R2_BUCKET_PRIVATE ?? "";
const urlPublica = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${cuenta}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  },
});

const resultados: [string, boolean, string][] = [];
function check(nombre: string, ok: boolean, detalle = "") {
  resultados.push([nombre, ok, detalle]);
}

async function existeBucket(nombre: string) {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: nombre }));
    return "";
  } catch (e) {
    return e instanceof Error ? e.name : "error";
  }
}

async function main() {
  const errPublico = await existeBucket(bucketPublico);
  check(`existe el bucket ${bucketPublico}`, errPublico === "", errPublico);

  const errPrivado = await existeBucket(bucketPrivado);
  check(`existe el bucket ${bucketPrivado}`, errPrivado === "", errPrivado);

  if (errPublico || errPrivado) {
    imprimir();
    return;
  }

  const clave = `prueba/conexion-${Date.now()}.txt`;
  const contenido = "prueba de conexion";

  for (const bucket of [bucketPublico, bucketPrivado]) {
    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: clave,
          Body: contenido,
          ContentType: "text/plain",
        }),
      );
      const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: clave }));
      const leido = await res.Body!.transformToString();
      check(`escribe y lee en ${bucket}`, leido === contenido, leido.slice(0, 20));
    } catch (e) {
      check(`escribe y lee en ${bucket}`, false, e instanceof Error ? e.message : "error");
    }
  }

  // El bucket de originales no tiene que ser alcanzable por internet. Lo que
  // importa no es qué código devuelve, sino que no entregue el archivo.
  const urlsPrivadas = [
    `https://${bucketPrivado}.${cuenta}.r2.cloudflarestorage.com/${clave}`,
    `https://${cuenta}.r2.cloudflarestorage.com/${bucketPrivado}/${clave}`,
  ];

  for (const url of urlsPrivadas) {
    let entregado = false;
    let detalle = "sin respuesta";
    try {
      const res = await fetch(url);
      const cuerpo = await res.text();
      entregado = res.ok && cuerpo.includes(contenido);
      detalle = `HTTP ${res.status}`;
    } catch {
      // Que ni siquiera responda también sirve.
    }
    check(
      `los originales NO se sirven en ${new URL(url).hostname.split(".")[0]}…`,
      !entregado,
      detalle,
    );
  }

  // El bucket de previews sí tiene que servirse por el dominio propio.
  if (urlPublica) {
    try {
      const res = await fetch(`${urlPublica}/${clave}`);
      const texto = res.ok ? await res.text() : "";
      check(
        `los previews se sirven desde ${urlPublica}`,
        res.ok && texto === contenido,
        `HTTP ${res.status}`,
      );
    } catch (e) {
      check(
        `los previews se sirven desde ${urlPublica}`,
        false,
        e instanceof Error ? e.message : "error",
      );
    }
  } else {
    check("R2_PUBLIC_URL configurada", false, "falta el dominio del bucket publico");
  }

  for (const bucket of [bucketPublico, bucketPrivado]) {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: clave })).catch(() => {});
  }

  imprimir();
}

function imprimir() {
  let fallos = 0;
  for (const [nombre, ok, detalle] of resultados) {
    if (!ok) fallos++;
    console.log(`${ok ? "OK  " : "FALLA"}  ${nombre}${detalle ? `  (${detalle})` : ""}`);
  }
  if (fallos > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
