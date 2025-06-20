-- AlterTable
ALTER TABLE "SellerProfile" ADD COLUMN     "customArtPricing" JSONB,
ADD COLUMN     "doesCustomArt" BOOLEAN NOT NULL DEFAULT false;
