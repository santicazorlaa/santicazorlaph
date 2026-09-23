-- La portada de cada equipo, cuando el partido tiene más de uno.
--
-- Escrita a mano y no generada, por el mismo motivo que
-- 20260922000000_actividad_de_entregas, 20260923000000_pago_por_transferencia
-- y 20260923010000_fotos_por_equipo: la base de desarrollo arrastra un desvío
-- viejo en `Photo` que hace que `prisma migrate dev` quiera resolverlo
-- borrando la base entera. Con `IF NOT EXISTS` se aplica igual en las dos
-- bases, usando `prisma migrate deploy`.
CREATE TABLE IF NOT EXISTS "EquipoPortada" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "equipo" TEXT NOT NULL,
    "coverKey" TEXT NOT NULL,

    CONSTRAINT "EquipoPortada_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EquipoPortada_eventId_equipo_key" ON "EquipoPortada"("eventId", "equipo");

ALTER TABLE "EquipoPortada" ADD CONSTRAINT "EquipoPortada_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
