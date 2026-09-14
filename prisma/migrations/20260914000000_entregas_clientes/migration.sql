-- CreateTable
CREATE TABLE "ClientDelivery" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "driveUrl" TEXT NOT NULL,
    "driveFolderId" TEXT NOT NULL,
    "pin" TEXT,
    "coverUrl" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryPhoto" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "driveFileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "width" INTEGER NOT NULL DEFAULT 0,
    "height" INTEGER NOT NULL DEFAULT 0,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "camera" TEXT,
    "lens" TEXT,
    "takenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientDelivery_slug_key" ON "ClientDelivery"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ClientDelivery_token_key" ON "ClientDelivery"("token");

-- CreateIndex
CREATE INDEX "ClientDelivery_published_date_idx" ON "ClientDelivery"("published", "date");

-- CreateIndex
CREATE INDEX "ClientDelivery_token_idx" ON "ClientDelivery"("token");

-- CreateIndex
CREATE INDEX "DeliveryPhoto_deliveryId_takenAt_idx" ON "DeliveryPhoto"("deliveryId", "takenAt");

-- AddForeignKey
ALTER TABLE "DeliveryPhoto" ADD CONSTRAINT "DeliveryPhoto_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "ClientDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
