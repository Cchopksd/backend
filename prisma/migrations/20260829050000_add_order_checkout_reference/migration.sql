ALTER TABLE "Order" ADD COLUMN "checkoutReference" TEXT;
CREATE UNIQUE INDEX "Order_checkoutReference_key" ON "Order"("checkoutReference");
