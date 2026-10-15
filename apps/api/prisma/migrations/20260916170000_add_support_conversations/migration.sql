-- Hộp thư CSKH bền vững giữa khách hàng và Admin.
CREATE TYPE "SupportConversationStatus" AS ENUM ('OPEN', 'WAITING_CUSTOMER', 'RESOLVED');

CREATE TABLE "SupportConversation" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "status" "SupportConversationStatus" NOT NULL DEFAULT 'OPEN',
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportMessage" (
    "id" SERIAL NOT NULL,
    "conversationId" INTEGER NOT NULL,
    "senderId" INTEGER NOT NULL,
    "senderType" VARCHAR(20) NOT NULL,
    "content" VARCHAR(2000) NOT NULL,
    "readByAdminAt" TIMESTAMP(3),
    "readByCustomerAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupportConversation_customerId_key" ON "SupportConversation"("customerId");
CREATE INDEX "SupportConversation_status_lastMessageAt_idx" ON "SupportConversation"("status", "lastMessageAt");
CREATE INDEX "SupportMessage_conversationId_createdAt_idx" ON "SupportMessage"("conversationId", "createdAt");
CREATE INDEX "SupportMessage_senderType_readByAdminAt_idx" ON "SupportMessage"("senderType", "readByAdminAt");
CREATE INDEX "SupportMessage_senderType_readByCustomerAt_idx" ON "SupportMessage"("senderType", "readByCustomerAt");

ALTER TABLE "SupportConversation"
ADD CONSTRAINT "SupportConversation_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupportMessage"
ADD CONSTRAINT "SupportMessage_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "SupportConversation"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupportMessage"
ADD CONSTRAINT "SupportMessage_senderId_fkey"
FOREIGN KEY ("senderId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
