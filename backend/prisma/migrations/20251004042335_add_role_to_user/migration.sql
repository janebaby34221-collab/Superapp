/*
  Warnings:

  - Made the column `vehicleId` on table `Ride` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN', 'DRIVER');

-- DropForeignKey
ALTER TABLE "Ride" DROP CONSTRAINT "Ride_vehicleId_fkey";

-- AlterTable
ALTER TABLE "Ride" ALTER COLUMN "vehicleId" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'USER',
ALTER COLUMN "password" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "userId" INTEGER;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ride" ADD CONSTRAINT "Ride_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
