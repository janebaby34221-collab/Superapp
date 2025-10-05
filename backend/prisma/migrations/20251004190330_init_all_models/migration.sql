/*
  Warnings:

  - You are about to drop the column `currency` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `destLat` on the `Ride` table. All the data in the column will be lost.
  - You are about to drop the column `destLng` on the `Ride` table. All the data in the column will be lost.
  - You are about to drop the column `originLat` on the `Ride` table. All the data in the column will be lost.
  - You are about to drop the column `originLng` on the `Ride` table. All the data in the column will be lost.
  - You are about to drop the column `active` on the `Vehicle` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `Ride` table without a default value. This is not possible if the table is not empty.
  - Made the column `phone` on table `User` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `updatedAt` to the `Vehicle` table without a default value. This is not possible if the table is not empty.
  - Made the column `driver` on table `Vehicle` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'DRIVER';

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "currency",
ALTER COLUMN "status" SET DEFAULT 'completed';

-- AlterTable
ALTER TABLE "Ride" DROP COLUMN "destLat",
DROP COLUMN "destLng",
DROP COLUMN "originLat",
DROP COLUMN "originLng",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "phone" SET NOT NULL;

-- AlterTable
ALTER TABLE "Vehicle" DROP COLUMN "active",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "driver" SET NOT NULL;
