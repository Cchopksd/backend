import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import { InventoryService } from '../../inventory/services/inventory.service.js';

type Reservation = {
  skuId: string;
  quantity: number;
  channel: 'STANDARD' | 'FLASH_SALE';
};

@Injectable()
export class ReservationExpiryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  async expire(orderId: string): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      const orders = await transaction.$queryRaw<{ status: string }[]>`
        SELECT "status" FROM "Order" WHERE "id" = ${orderId}::uuid FOR UPDATE`;
      if (orders[0]?.status !== 'PENDING_PAYMENT') return false;
      const successfulAttempts = await transaction.paymentAttempt.count({
        where: { orderId, status: 'SUCCESSFUL' },
      });
      if (successfulAttempts > 0) return false;
      await transaction.order.update({
        where: { id: orderId },
        data: {
          status: 'CANCELLED',
          paymentStatus: 'EXPIRED',
          statusVersion: { increment: 1 },
        },
      });
      const reservations = await transaction.$queryRaw<Reservation[]>`
        SELECT "skuId", SUM(-"quantityDelta")::integer AS "quantity", "metadata"->>'channel' AS "channel"
        FROM "InventoryLedger"
        WHERE "type" = 'RESERVE'::"LedgerType" AND "referenceId" = ${orderId}
          AND "metadata"->>'channel' IN ('STANDARD', 'FLASH_SALE')
        GROUP BY "skuId", "metadata"->>'channel'`;
      for (const reservation of reservations) {
        await this.inventory.releaseInTransaction(
          transaction,
          reservation.skuId,
          reservation.quantity,
          reservation.channel,
          {
            referenceType: 'ORDER_EXPIRY',
            referenceId: orderId,
            idempotencyKey: `${orderId}:release:${reservation.channel}:${reservation.skuId}`,
          },
        );
      }
      return true;
    });
  }
}
