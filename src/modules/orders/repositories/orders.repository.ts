import { Injectable } from '@nestjs/common';
import { Prisma, type Prisma as PrismaNamespace } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service.js';

export type CheckoutCartItem = {
  skuId: string;
  quantity: number;
  sellerId: string;
  productName: string;
  variantName: string;
  skuCode: string;
};
export type CreatedOrder = {
  orderId: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  currency: string;
  totalAmount: number;
};

@Injectable()
export class OrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOrderByCheckoutReference(
    reference: string,
  ): Promise<CreatedOrder | null> {
    const rows = await this.prisma.$queryRaw<
      CreatedOrder[]
    >`SELECT "id" AS "orderId", "orderNumber", "status", "paymentStatus", "currency", "totalAmount" FROM "Order" WHERE "checkoutReference" = ${reference} LIMIT 1`;
    return rows[0] ?? null;
  }

  async selectedCartItems(
    transaction: PrismaNamespace.TransactionClient,
    userId: string,
    sellerId: string,
  ): Promise<CheckoutCartItem[]> {
    return transaction.$queryRaw<CheckoutCartItem[]>`
      SELECT item."skuId", item."quantity", seller."id" AS "sellerId", product."name" AS "productName", variant."name" AS "variantName", sku."code" AS "skuCode"
      FROM "CartItem" item JOIN "Cart" cart ON cart."id" = item."cartId"
      JOIN "SKU" sku ON sku."id" = item."skuId" JOIN "Variant" variant ON variant."id" = sku."variantId"
      JOIN "Product" product ON product."id" = variant."productId" JOIN "Seller" seller ON seller."id" = product."sellerId"
      WHERE cart."userId" = ${userId}::uuid AND cart."status" = 'ACTIVE'::"CartStatus" AND item."selected" = true
        AND seller."id" = ${sellerId}::uuid AND sku."isActive" = true AND product."status" = 'ACTIVE'::"ProductStatus" AND seller."status" = 'ACTIVE'::"SellerStatus"
      ORDER BY item."createdAt", item."id"`;
  }

  async create(
    transaction: PrismaNamespace.TransactionClient,
    input: {
      id: string;
      orderNumber: string;
      checkoutReference: string;
      customerId: string;
      sellerId: string;
      currency: string;
      subtotalAmount: number;
      discountAmount: number;
      totalAmount: number;
      promotionSnapshot: Prisma.InputJsonValue;
      shippingAddress: Prisma.InputJsonValue;
      items: Array<
        CheckoutCartItem & {
          unitPriceAmount: number;
          discountAmount: number;
          totalAmount: number;
          promotionSnapshot: Prisma.InputJsonValue;
        }
      >;
    },
  ): Promise<CreatedOrder> {
    const order = await transaction.order.create({
      data: {
        id: input.id,
        orderNumber: input.orderNumber,
        checkoutReference: input.checkoutReference,
        customerId: input.customerId,
        sellerId: input.sellerId,
        currency: input.currency,
        subtotalAmount: input.subtotalAmount,
        discountAmount: input.discountAmount,
        shippingAmount: 0,
        totalAmount: input.totalAmount,
        promotionSnapshot: input.promotionSnapshot,
        shippingAddress: input.shippingAddress,
        items: {
          create: input.items.map((item) => ({
            skuId: item.skuId,
            productName: item.productName,
            variantName: item.variantName,
            skuCode: item.skuCode,
            quantity: item.quantity,
            unitPriceAmount: item.unitPriceAmount,
            discountAmount: item.discountAmount,
            totalAmount: item.totalAmount,
            promotionSnapshot: item.promotionSnapshot,
          })),
        },
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        currency: true,
        totalAmount: true,
      },
    });
    return { ...order, orderId: order.id };
  }

  async clearCheckedOutItems(
    transaction: PrismaNamespace.TransactionClient,
    userId: string,
    sellerId: string,
  ): Promise<void> {
    await transaction.$executeRaw`DELETE FROM "CartItem" item USING "Cart" cart, "SKU" sku, "Variant" variant, "Product" product WHERE item."cartId" = cart."id" AND item."skuId" = sku."id" AND sku."variantId" = variant."id" AND variant."productId" = product."id" AND cart."userId" = ${userId}::uuid AND cart."status" = 'ACTIVE'::"CartStatus" AND item."selected" = true AND product."sellerId" = ${sellerId}::uuid`;
  }
}
