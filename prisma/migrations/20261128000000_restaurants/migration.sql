ALTER TYPE "StaffRole" ADD VALUE 'SUPER_ADMIN';

BEGIN;
CREATE TABLE "Restaurant" (
  "id" TEXT PRIMARY KEY,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Bangkok',
  "openTime" TEXT NOT NULL DEFAULT '10:00',
  "closeTime" TEXT NOT NULL DEFAULT '22:00',
  "slotMinutes" INTEGER NOT NULL DEFAULT 30,
  "durationMinutes" INTEGER NOT NULL DEFAULT 90,
  "maxDaysAhead" INTEGER NOT NULL DEFAULT 30,
  "minLeadMinutes" INTEGER NOT NULL DEFAULT 60,
  "cancelCutoffMinutes" INTEGER NOT NULL DEFAULT 120,
  "maxParty" INTEGER NOT NULL DEFAULT 10,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Restaurant_valid_slug" CHECK (
    length("slug") BETWEEN 3 AND 40 AND "slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    AND "slug" NOT IN ('platform','api','login','book','t','r','admin','menu-images')
  )
);
CREATE UNIQUE INDEX "Restaurant_slug_key" ON "Restaurant"("slug");
INSERT INTO "Restaurant" ("id", "slug", "name") VALUES ('default', 'default', 'Restaurant');

DO $$
DECLARE entity TEXT;
BEGIN
  FOREACH entity IN ARRAY ARRAY['DiningTable','MenuItem','Reservation','DiningSession','TableOrder','StaffUser']
  LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN "restaurantId" TEXT', entity);
    EXECUTE format('UPDATE %I SET "restaurantId" = %L', entity, 'default');
    IF entity <> 'StaffUser' THEN
      EXECUTE format('ALTER TABLE %I ALTER COLUMN "restaurantId" SET NOT NULL', entity);
    END IF;
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
      entity, entity || '_restaurantId_fkey');
  END LOOP;
END $$;

ALTER TABLE "StaffUser" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StaffUser" ADD CONSTRAINT "StaffUser_role_tenant" CHECK (
  ("role"::text = 'SUPER_ADMIN') = ("restaurantId" IS NULL)
);
CREATE UNIQUE INDEX "StaffUser_platform_username_key" ON "StaffUser"("username") WHERE "restaurantId" IS NULL;
DROP INDEX "StaffUser_username_key";
CREATE UNIQUE INDEX "StaffUser_restaurantId_username_key" ON "StaffUser"("restaurantId", "username");
DROP INDEX "DiningTable_number_key";
CREATE UNIQUE INDEX "DiningTable_restaurantId_number_key" ON "DiningTable"("restaurantId", "number");
DROP INDEX "Reservation_startsAt_idx";
CREATE INDEX "Reservation_restaurantId_startsAt_idx" ON "Reservation"("restaurantId", "startsAt");
CREATE INDEX "DiningSession_restaurantId_idx" ON "DiningSession"("restaurantId");
CREATE INDEX "MenuItem_restaurantId_idx" ON "MenuItem"("restaurantId");
CREATE INDEX "TableOrder_restaurantId_status_idx" ON "TableOrder"("restaurantId", "status");
COMMIT;
