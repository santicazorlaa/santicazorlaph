-- Va con IF EXISTS en todo lo que borra porque la base real nunca llegó a
-- tener estas columnas: el código que las usaba se probó en desarrollo y se
-- publicó recién junto con este cambio. Sin eso, la migración se caía en
-- producción intentando borrar algo que no existía.

-- DropIndex
DROP INDEX IF EXISTS "Photo_destacada_ordenPortfolio_idx";

-- AlterTable
ALTER TABLE "Photo" DROP COLUMN IF EXISTS "destacada",
DROP COLUMN IF EXISTS "ordenPortfolio",
DROP COLUMN IF EXISTS "portfolioKey";

-- CreateTable
CREATE TABLE IF NOT EXISTS "PortfolioPhoto" (
    "id" TEXT NOT NULL,
    "originalKey" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "thumbKey" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "titulo" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PortfolioPhoto_orden_createdAt_idx" ON "PortfolioPhoto"("orden", "createdAt");

