-- DropForeignKey
ALTER TABLE "public"."Ride" DROP CONSTRAINT "Ride_vehicleId_fkey";

-- AlterTable
ALTER TABLE "public"."Ride" ALTER COLUMN "vehicleId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "password" TEXT NOT NULL DEFAULT 'changeme';

-- AddForeignKey
ALTER TABLE "public"."Ride" ADD CONSTRAINT "Ride_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "public"."Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
