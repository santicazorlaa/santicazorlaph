-- AlterTable
ALTER TABLE "Photo" ADD COLUMN     "destacada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ordenPortfolio" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "portfolioKey" TEXT;

-- CreateIndex
CREATE INDEX "Photo_destacada_ordenPortfolio_idx" ON "Photo"("destacada", "ordenPortfolio");
