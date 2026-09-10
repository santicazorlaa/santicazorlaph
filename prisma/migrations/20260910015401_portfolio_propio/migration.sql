-- DropIndex
DROP INDEX "Photo_destacada_ordenPortfolio_idx";

-- AlterTable
ALTER TABLE "Photo" DROP COLUMN "destacada",
DROP COLUMN "ordenPortfolio",
DROP COLUMN "portfolioKey";

-- CreateTable
CREATE TABLE "PortfolioPhoto" (
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
CREATE INDEX "PortfolioPhoto_orden_createdAt_idx" ON "PortfolioPhoto"("orden", "createdAt");

