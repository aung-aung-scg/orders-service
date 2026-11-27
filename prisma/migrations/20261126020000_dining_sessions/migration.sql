CREATE TABLE "DiningSession" (
  "id" TEXT PRIMARY KEY,
  "tableId" TEXT NOT NULL REFERENCES "DiningTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "joinCode" TEXT NOT NULL,
  "accessToken" TEXT NOT NULL,
  "startedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "endedBy" TEXT,
  "overrideReason" TEXT
);
CREATE UNIQUE INDEX "DiningSession_joinCode_key" ON "DiningSession"("joinCode");
CREATE UNIQUE INDEX "DiningSession_accessToken_key" ON "DiningSession"("accessToken");
CREATE INDEX "DiningSession_tableId_idx" ON "DiningSession"("tableId");
CREATE UNIQUE INDEX "DiningSession_one_active_per_table" ON "DiningSession"("tableId") WHERE "endedAt" IS NULL;
ALTER TABLE "TableOrder" ADD COLUMN "sessionId" TEXT REFERENCES "DiningSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
UPDATE "TableOrder" SET "status" = 'CANCELLED' WHERE "status" = 'OPEN';
ALTER TABLE "TableOrder" ADD CONSTRAINT "TableOrder_open_requires_session" CHECK ("status" <> 'OPEN' OR "sessionId" IS NOT NULL);
