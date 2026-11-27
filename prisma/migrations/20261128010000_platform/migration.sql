BEGIN;
ALTER TABLE "StaffUser" ADD COLUMN "credentialVersion" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "PlatformAudit" (
  "id" TEXT PRIMARY KEY,
  "actor" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "PlatformAudit_restaurantId_createdAt_idx" ON "PlatformAudit"("restaurantId", "createdAt");
COMMIT;
