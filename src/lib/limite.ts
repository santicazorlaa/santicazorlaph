import "server-only";

import { db } from "./db";

/**
 * Frena lo que se puede adivinar probando: la contraseña del panel, el PIN de
 * una entrega. Sin esto, un programa prueba miles de contraseñas por minuto y
 * un PIN de cuatro números cae en un rato.
 *
 * Cuenta intentos por clave (por ejemplo `login:<ip>`) dentro de una ventana
 * de tiempo. La cuenta se hace en una sola sentencia de la base, así dos
 * pedidos simultáneos no pueden leer el mismo número y pasar los dos.
 *
 * Si la base falla —o la tabla todavía no existe porque la migración no se
 * aplicó— **deja pasar**. Es a propósito: preferimos un panel sin freno por un
 * rato a un Santi que no puede entrar a su propio panel.
 */
export async function superaLimite(clave: string, maximo: number, ventanaSeg: number) {
  try {
    const filas = await db.$queryRaw<{ cuenta: number }[]>`
      INSERT INTO "Intento" ("clave", "cuenta", "desde")
      VALUES (${clave}, 1, CURRENT_TIMESTAMP)
      ON CONFLICT ("clave") DO UPDATE SET
        "cuenta" = CASE
          WHEN "Intento"."desde" < CURRENT_TIMESTAMP - make_interval(secs => ${ventanaSeg})
          THEN 1 ELSE "Intento"."cuenta" + 1 END,
        "desde" = CASE
          WHEN "Intento"."desde" < CURRENT_TIMESTAMP - make_interval(secs => ${ventanaSeg})
          THEN CURRENT_TIMESTAMP ELSE "Intento"."desde" END
      RETURNING "cuenta"`;

    // De vez en cuando se barren los contadores viejos, así la tabla no crece
    // para siempre. No hace falta hacerlo en cada pedido.
    if (Math.random() < 0.05) {
      await db.$executeRaw`DELETE FROM "Intento" WHERE "desde" < CURRENT_TIMESTAMP - INTERVAL '1 day'`;
    }

    return Number(filas[0]?.cuenta ?? 0) > maximo;
  } catch (error) {
    console.error("[limite] no se pudo contar el intento; se deja pasar", error);
    return false;
  }
}

/// Borra el contador: después de un ingreso correcto, los errores anteriores
/// no tienen por qué seguir contando en contra.
export async function olvidarIntentos(clave: string) {
  await db.intento.delete({ where: { clave } }).catch(() => {});
}

/// La dirección de quien pide. En Vercel `x-real-ip` la pone la plataforma y
/// el visitante no la puede falsificar; `x-forwarded-for` queda de respaldo
/// para desarrollo.
export function ipDe(request: Request) {
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "desconocida"
  );
}
