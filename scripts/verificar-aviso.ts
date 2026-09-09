/**
 * Crea un checkout contra el sitio publicado y comprueba que la direccion de
 * aviso que le damos a MercadoPago responda directo, sin redireccion.
 *
 * Una redireccion ahi hace que el aviso de pago se pierda en silencio.
 *
 *   npx tsx --conditions=react-server --env-file=.env scripts/verificar-aviso.ts
 */
import { db } from "../src/lib/db";

const BASE = "https://www.santicazorlaph.com";
const TOKEN = process.env.MP_ACCESS_TOKEN ?? "";

async function main() {
  const foto = await db.photo.findFirst({
    where: { event: { published: true } },
    select: { id: true },
  });
  if (!foto) throw new Error("No hay fotos publicadas");

  const res = await fetch(`${BASE}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "control@ejemplo.com", photoIds: [foto.id] }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`checkout fallo: ${JSON.stringify(data)}`);

  const orden = await db.order.findUnique({ where: { token: data.token } });
  const pref = await fetch(
    `https://api.mercadopago.com/checkout/preferences/${orden!.mpPreferenceId}`,
    { headers: { Authorization: `Bearer ${TOKEN}` } },
  ).then((r) => r.json());

  const aviso: string = pref.notification_url ?? "";
  console.log(`direccion de aviso: ${aviso || "(ninguna)"}`);

  const checks: [string, boolean, string?][] = [];
  checks.push(["hay direccion de aviso", Boolean(aviso)]);

  if (aviso) {
    const r = await fetch(aviso, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "payment", data: { id: "1" } }),
      redirect: "manual",
    });
    const redirige = r.status >= 300 && r.status < 400;
    checks.push([
      "la direccion de aviso NO redirige",
      !redirige,
      redirige ? `HTTP ${r.status} -> ${r.headers.get("location")}` : `HTTP ${r.status}`,
    ]);
    checks.push([
      "responde rechazando lo no firmado",
      r.status === 401,
      `HTTP ${r.status}`,
    ]);
  }

  // La orden de control no sirve para nada mas: la borramos.
  await db.order.delete({ where: { id: orden!.id } }).catch(() => {});

  let fallos = 0;
  for (const [n, ok, d] of checks) {
    if (!ok) fallos++;
    console.log(`${ok ? "OK  " : "FALLA"}  ${n}${d ? `  (${d})` : ""}`);
  }
  if (fallos > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
