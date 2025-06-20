/*
  Warnings:

  - Added the required column `pickupAddress` to the `SellerProfile` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "images" TEXT[];

-- AlterTable
ALTER TABLE "SellerProfile" ADD COLUMN     "pickupAddress" TEXT NOT NULL,
ADD COLUMN     "profileImage" TEXT;

-- CreateTable
CREATE TABLE "_CategoryToSellerProfile" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CategoryToSellerProfile_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_CategoryToSellerProfile_B_index" ON "_CategoryToSellerProfile"("B");

-- AddForeignKey
ALTER TABLE "_CategoryToSellerProfile" ADD CONSTRAINT "_CategoryToSellerProfile_A_fkey" FOREIGN KEY ("A") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CategoryToSellerProfile" ADD CONSTRAINT "_CategoryToSellerProfile_B_fkey" FOREIGN KEY ("B") REFERENCES "SellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
