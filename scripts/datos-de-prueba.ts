/**
 * Crea un partido con fotos sintéticas para poder ver el sitio funcionando
 * antes de tener fotos reales. Se puede correr las veces que haga falta.
 *
 *   npx tsx scripts/datos-de-prueba.ts
 */
import sharp from "sharp";

import { db } from "../src/lib/db";
import { slugify } from "../src/lib/format";
import { generatePhotoCode } from "../src/lib/orders";
import { putObject } from "../src/lib/storage";
import { processPhoto } from "../src/lib/watermark";

const EQUIPOS = [
  ["#1b3a6b", "#e8edf3"],
  ["#0f5132", "#f5f0e1"],
  ["#7a1f2b", "#f2f2f2"],
  ["#2b2b2b", "#e6b422"],
];

function jugada(i: number) {
  const [camiseta, short] = EQUIPOS[i % EQUIPOS.length];
  const x = 500 + ((i * 337) % 1900);
  const y = 1000 + ((i * 211) % 500);
  const cielo = i % 3 === 0 ? "#c9dcec" : i % 3 === 1 ? "#e6d9c3" : "#8fa8bd";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="3000" height="2000">
    <defs>
      <linearGradient id="c" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${cielo}"/>
        <stop offset="100%" stop-color="#a9bccd"/>
      </linearGradient>
      <linearGradient id="p" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#548a45"/>
        <stop offset="100%" stop-color="#1d3a19"/>
      </linearGradient>
    </defs>
    <rect width="3000" height="780" fill="url(#c)"/>
    <rect y="780" width="3000" height="1220" fill="url(#p)"/>
    <rect x="0" y="860" width="3000" height="10" fill="#ffffff" opacity="0.6"/>
    <circle cx="1500" cy="1450" r="340" fill="none" stroke="#ffffff" stroke-width="10" opacity="0.4"/>
    <g transform="translate(${x} ${y})">
      <rect x="-70" y="0" width="140" height="330" rx="24" fill="${camiseta}"/>
      <rect x="-60" y="330" width="120" height="150" rx="16" fill="${short}"/>
      <circle cx="0" cy="-60" r="62" fill="#c98d63"/>
      <text x="0" y="200" text-anchor="middle" font-family="Arial" font-size="90"
            font-weight="bold" fill="${short}">${(i % 30) + 1}</text>
    </g>
    <circle cx="${x + 240}" cy="${y + 460}" r="48" fill="#fbfbfb"/>
  </svg>`;
}

async function main() {
  const title = "CAT vs Lastenia";
  const slug = slugify(title);

  await db.event.deleteMany({ where: { slug } });

  const evento = await db.event.create({
    data: {
      title,
      slug,
      date: new Date("2026-09-04T12:00:00"),
      location: "San Miguel de Tucumán",
      priceArs: 2500,
      published: true,
    },
  });

  console.log(`partido creado: ${evento.title}`);

  for (let i = 0; i < 14; i++) {
    const original = await sharp(Buffer.from(jugada(i))).jpeg({ quality: 92 }).toBuffer();
    const procesada = await processPhoto(original);
    const code = await generatePhotoCode();

    const base = `${evento.id}/${code}`;
    const originalKey = `originales/${base}.jpg`;
    const previewKey = `preview/${base}.jpg`;
    const thumbKey = `thumb/${base}.jpg`;

    await Promise.all([
      putObject("private", originalKey, original, "image/jpeg"),
      putObject("public", previewKey, procesada.preview, "image/jpeg"),
      putObject("public", thumbKey, procesada.thumb, "image/jpeg"),
    ]);

    await db.photo.create({
      data: {
        eventId: evento.id,
        code,
        originalKey,
        previewKey,
        thumbKey,
        originalName: `_SC${String(2000 + i)}.jpg`,
        width: procesada.width,
        height: procesada.height,
        sizeBytes: procesada.sizeBytes,
        camera: "Canon EOS R6 Mark II",
        lens: "RF 100-500mm F4.5-7.1 L IS USM",
        takenAt: new Date(`2026-09-04T${13 + Math.floor(i / 8)}:${String((i * 7) % 60).padStart(2, "0")}:00`),
      },
    });

    process.stdout.write(`  foto ${i + 1}/14 (#${code})\r`);
  }

  console.log(`\nlisto: http://localhost:3000/e/${slug}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
