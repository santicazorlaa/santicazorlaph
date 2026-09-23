-- Separar las fotos de un partido por equipo, para partidos donde Santi
-- cubrió a los dos.
--
-- Escrita a mano y no generada, por el mismo motivo que
-- 20260922000000_actividad_de_entregas y 20260923000000_pago_por_transferencia:
-- la base de desarrollo arrastra un desvío viejo en `Photo` que hace que
-- `prisma migrate dev` quiera resolverlo borrando la base entera. Con
-- `IF NOT EXISTS` se aplica igual en las dos bases, usando `prisma migrate deploy`.
ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "equipo" TEXT;
CREATE INDEX IF NOT EXISTS "Photo_eventId_equipo_idx" ON "Photo"("eventId", "equipo");
