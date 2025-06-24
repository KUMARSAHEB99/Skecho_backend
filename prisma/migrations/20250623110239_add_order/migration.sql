-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('product', 'custom');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('requested', 'accepted', 'rejected', 'paid', 'shipping', 'delivered');

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "type" "OrderType" NOT NULL,
    "userId" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "productId" TEXT,
    "referenceImage" TEXT,
    "description" TEXT,
    "paperSize" TEXT,
    "paperType" TEXT,
    "numPeople" INTEGER,
    "basePrice" INTEGER,
    "status" "OrderStatus" NOT NULL,
    "rejectionReason" TEXT,
    "deliveryUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
