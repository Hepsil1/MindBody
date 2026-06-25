-- Fulfillment fields collected at checkout but previously never persisted on
-- the Order, so the admin could not ship a placed order (destination survived
-- only in the transient email/Telegram). Nullable for legacy orders.
ALTER TABLE "Order" ADD COLUMN "shippingCity" TEXT;
ALTER TABLE "Order" ADD COLUMN "shippingWarehouse" TEXT;
ALTER TABLE "Order" ADD COLUMN "deliveryMethod" TEXT;
ALTER TABLE "Order" ADD COLUMN "paymentMethod" TEXT;
ALTER TABLE "Order" ADD COLUMN "comment" TEXT;
