-- Pagar por transferencia bancaria, como alternativa a MercadoPago sin su
-- comisión.
--
-- Escrita a mano y no generada, por el mismo motivo que
-- 20260922000000_actividad_de_entregas: la base de desarrollo arrastra un
-- desvío viejo en `Photo` que hace que `prisma migrate dev` quiera resolver
-- borrando la base entera. Con `IF NOT EXISTS` se aplica igual en las dos
-- bases, sin tocar nada de eso, usando `prisma migrate deploy`.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "metodoPago" TEXT NOT NULL DEFAULT 'mercadopago';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "avisoTransferenciaEn" TIMESTAMP(3);
