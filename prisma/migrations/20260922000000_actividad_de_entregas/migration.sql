-- Qué pasó adentro de una entrega: quién entró, qué fotos miró y qué se bajó.
--
-- Escrita a mano y no generada, a propósito: la base de desarrollo arrastra
-- columnas viejas de `Photo` que el historial ya dio por borradas, y
-- `prisma migrate dev` quería resolver esa diferencia borrando la base entera.
-- Acotada a la tabla nueva, se aplica igual en las dos sin tocar nada más.
--
-- Va todo con IF NOT EXISTS por la regla de siempre: las dos bases no están en
-- el mismo punto y esto se aplica primero en desarrollo y semanas después en
-- producción.
CREATE TABLE IF NOT EXISTS "DeliveryEvent" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "photoId" TEXT,
    "codigo" TEXT,
    "tipo" TEXT NOT NULL,
    "visitante" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DeliveryEvent_deliveryId_createdAt_idx" ON "DeliveryEvent"("deliveryId", "createdAt");
CREATE INDEX IF NOT EXISTS "DeliveryEvent_deliveryId_tipo_idx" ON "DeliveryEvent"("deliveryId", "tipo");
CREATE INDEX IF NOT EXISTS "DeliveryEvent_deliveryId_photoId_idx" ON "DeliveryEvent"("deliveryId", "photoId");

-- Si se borra la entrega se va toda su actividad con ella. Si se borra una foto
-- —la saca Santi de Drive y la sincronización la limpia— el evento queda, con
-- el código copiado al lado: la historia de lo que pasó no se pierde por eso.
DO $$
BEGIN
    ALTER TABLE "DeliveryEvent" ADD CONSTRAINT "DeliveryEvent_deliveryId_fkey"
        FOREIGN KEY ("deliveryId") REFERENCES "ClientDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "DeliveryEvent" ADD CONSTRAINT "DeliveryEvent_photoId_fkey"
        FOREIGN KEY ("photoId") REFERENCES "DeliveryPhoto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
