/**
 * Escribe a disco el mail que recibiría el comprador, con datos de una orden
 * real, para poder mirarlo antes de mandar ninguno.
 *
 *   npx tsx --conditions=react-server --env-file=.env scripts/previsualizar-mail.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { db } from "../src/lib/db";
import { construirMailDeCompra } from "../src/lib/email";

async function main() {
  const orden = await db.order.findFirst({
    where: { status: "PAID" },
    orderBy: { paidAt: "desc" },
  });
  if (!orden) throw new Error("No hay ninguna orden pagada para previsualizar");

  const mail = await construirMailDeCompra(orden.id);
  if (!mail) throw new Error("No se pudo armar el mail");

  const salida = path.join(".data", "prueba");
  await mkdir(salida, { recursive: true });
  await writeFile(path.join(salida, "mail.html"), mail.html, "utf8");

  console.log(`para:    ${mail.to}`);
  console.log(`asunto:  ${mail.subject}`);
  console.log(`link:    ${mail.urlCompra}`);
  console.log(`\n--- version en texto plano ---\n${mail.text}`);
  console.log(`\nHTML escrito en ${path.join(salida, "mail.html")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
