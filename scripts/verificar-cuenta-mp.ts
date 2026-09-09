/**
 * Comprueba con qué cuenta de MercadoPago está cobrando el sitio publicado.
 *
 * El id de la preferencia empieza con el id del vendedor, así que alcanza con
 * crear un checkout y mirarlo: no hace falta pagar nada.
 *
 *   npx tsx --conditions=react-server --env-file=.env scripts/verificar-cuenta-mp.ts
 */
import { db } from "../src/lib/db";

const SITIO = "https://www.santicazorlaph.com";
const CUENTA_REAL = "238509129";
const CUENTA_PRUEBA = "3676823380";

async function main() {
  const foto = await db.photo.findFirst({
    where: { event: { published: true } },
    select: { id: true },
  });
  if (!foto) throw new Error("No hay fotos publicadas");

  for (let intento = 0; intento < 30; intento++) {
    const res = await fetch(`${SITIO}/api/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "control@ejemplo.com", photoIds: [foto.id] }),
    });
    const data = await res.json();

    if (res.ok) {
      const orden = await db.order.findUnique({ where: { token: data.token } });
      const pref = orden?.mpPreferenceId ?? "";
      const vendedor = pref.split("-")[0];

      // La orden de control no se paga nunca: la borramos.
      await db.order.delete({ where: { id: orden!.id } }).catch(() => {});

      console.log(`preferencia: ${pref}`);
      console.log(`vendedor:    ${vendedor}`);
      if (vendedor === CUENTA_REAL) {
        console.log("\nOK    el sitio cobra en la CUENTA REAL (SANTIAGONIEVACAZORLA)");
        return;
      }
      if (vendedor === CUENTA_PRUEBA) {
        console.log("\nesperando el despliegue: todavia cobra en la cuenta de prueba");
      } else {
        console.log(`\nFALLA cuenta desconocida: ${vendedor}`);
        process.exitCode = 1;
        return;
      }
    }

    await new Promise((r) => setTimeout(r, 10000));
  }

  console.log("\nFALLA el despliegue no tomo las credenciales nuevas");
  process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
