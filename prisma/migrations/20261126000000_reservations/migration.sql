CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "DiningTable" ADD COLUMN "capacity" INTEGER NOT NULL DEFAULT 4;
CREATE TYPE "ReservationStatus" AS ENUM ('CONFIRMED', 'SEATED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');
CREATE TABLE "Reservation" (
  "id" TEXT PRIMARY KEY,
  "tableId" TEXT NOT NULL REFERENCES "DiningTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "partySize" INTEGER NOT NULL,
  "startsAt" TIMESTAMPTZ(3) NOT NULL,
  "endsAt" TIMESTAMPTZ(3) NOT NULL,
  "status" "ReservationStatus" NOT NULL DEFAULT 'CONFIRMED',
  "guestName" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT,
  "notes" TEXT,
  "code" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Reservation_no_overlap" EXCLUDE USING gist
    ("tableId" WITH =, tstzrange("startsAt", "endsAt") WITH &&)
    WHERE ("status" IN ('CONFIRMED', 'SEATED'))
);
CREATE UNIQUE INDEX "Reservation_code_key" ON "Reservation"("code");
CREATE INDEX "Reservation_startsAt_idx" ON "Reservation"("startsAt");
