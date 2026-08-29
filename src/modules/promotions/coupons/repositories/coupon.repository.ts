import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service.js';
import type {
  Coupon,
  CouponRedemptionResult,
  CouponRestrictions,
} from '../types/coupon.type.js';

type CouponRow = Omit<Coupon, 'restrictions'> & { restrictions: unknown };

@Injectable()
export class CouponRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByCode(code: string): Promise<Coupon | null> {
    const rows = await this.prisma.$queryRaw<CouponRow[]>`
      SELECT "id", "code", "type", "value", "minimumSpendAmount", "maximumDiscountAmount",
             "usageLimit", "usageCount", "perUserLimit", "startsAt", "endsAt", "status", "restrictions"
      FROM "Coupon" WHERE "code" = ${code} LIMIT 1`;
    return rows[0] ? this.toCoupon(rows[0]) : null;
  }

  async findById(id: string): Promise<Coupon | null> {
    const rows = await this.prisma.$queryRaw<CouponRow[]>`
      SELECT "id", "code", "type", "value", "minimumSpendAmount", "maximumDiscountAmount",
             "usageLimit", "usageCount", "perUserLimit", "startsAt", "endsAt", "status", "restrictions"
      FROM "Coupon" WHERE "id" = ${id}::uuid LIMIT 1`;
    return rows[0] ? this.toCoupon(rows[0]) : null;
  }

  async countUserUsage(couponId: string, userId: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ usageCount: number }[]>`
      SELECT "usageCount" FROM "CouponUsage"
      WHERE "couponId" = ${couponId}::uuid AND "userId" = ${userId}::uuid`;
    return rows[0]?.usageCount ?? 0;
  }

  async redeem(
    coupon: Coupon,
    userId: string,
    referenceId: string,
    now: Date,
  ): Promise<CouponRedemptionResult> {
    return this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "CouponRedemption"
        WHERE "couponId" = ${coupon.id}::uuid AND "referenceId" = ${referenceId}
        LIMIT 1`;
      if (existing[0]) return 'DUPLICATE';

      const userUsage = await transaction.$queryRaw<{ usageCount: number }[]>`
        INSERT INTO "CouponUsage" ("id", "couponId", "userId", "usageCount", "createdAt", "updatedAt")
        SELECT gen_random_uuid(), ${coupon.id}::uuid, ${userId}::uuid, 1, NOW(), NOW()
        WHERE ${coupon.perUserLimit}::integer IS NULL OR ${coupon.perUserLimit} > 0
        ON CONFLICT ("couponId", "userId") DO UPDATE
          SET "usageCount" = "CouponUsage"."usageCount" + 1, "updatedAt" = NOW()
          WHERE ${coupon.perUserLimit}::integer IS NULL
             OR "CouponUsage"."usageCount" < ${coupon.perUserLimit}
        RETURNING "usageCount"`;
      if (!userUsage[0]) return 'PER_USER_LIMIT_REACHED';

      const redeemed = await transaction.$queryRaw<{ id: string }[]>`
        UPDATE "Coupon"
        SET "usageCount" = "usageCount" + 1, "updatedAt" = NOW()
        WHERE "id" = ${coupon.id}::uuid
          AND "status" = 'ACTIVE'::"PromotionStatus"
          AND "startsAt" <= ${now}
          AND "endsAt" > ${now}
          AND ("usageLimit" IS NULL OR "usageCount" < "usageLimit")
        RETURNING "id"`;
      if (!redeemed[0]) return 'EXHAUSTED';

      await transaction.$executeRaw`
        INSERT INTO "CouponRedemption" ("id", "couponId", "userId", "referenceId", "createdAt")
        VALUES (gen_random_uuid(), ${coupon.id}::uuid, ${userId}::uuid, ${referenceId}, NOW())`;
      return 'REDEEMED';
    });
  }

  async redeemInTransaction(
    transaction: Prisma.TransactionClient,
    coupon: Coupon,
    userId: string,
    referenceId: string,
    now: Date,
  ): Promise<CouponRedemptionResult> {
    const existing = await transaction.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "CouponRedemption"
      WHERE "couponId" = ${coupon.id}::uuid AND "referenceId" = ${referenceId}
      LIMIT 1`;
    if (existing[0]) return 'DUPLICATE';

    const userUsage = await transaction.$queryRaw<{ usageCount: number }[]>`
      INSERT INTO "CouponUsage" ("id", "couponId", "userId", "usageCount", "createdAt", "updatedAt")
      SELECT gen_random_uuid(), ${coupon.id}::uuid, ${userId}::uuid, 1, NOW(), NOW()
      WHERE ${coupon.perUserLimit}::integer IS NULL OR ${coupon.perUserLimit} > 0
      ON CONFLICT ("couponId", "userId") DO UPDATE
        SET "usageCount" = "CouponUsage"."usageCount" + 1, "updatedAt" = NOW()
        WHERE ${coupon.perUserLimit}::integer IS NULL OR "CouponUsage"."usageCount" < ${coupon.perUserLimit}
      RETURNING "usageCount"`;
    if (!userUsage[0]) return 'PER_USER_LIMIT_REACHED';

    const redeemed = await transaction.$queryRaw<{ id: string }[]>`
      UPDATE "Coupon" SET "usageCount" = "usageCount" + 1, "updatedAt" = NOW()
      WHERE "id" = ${coupon.id}::uuid AND "status" = 'ACTIVE'::"PromotionStatus"
        AND "startsAt" <= ${now} AND "endsAt" > ${now}
        AND ("usageLimit" IS NULL OR "usageCount" < "usageLimit") RETURNING "id"`;
    if (!redeemed[0]) return 'EXHAUSTED';
    await transaction.$executeRaw`
      INSERT INTO "CouponRedemption" ("id", "couponId", "userId", "referenceId", "createdAt")
      VALUES (gen_random_uuid(), ${coupon.id}::uuid, ${userId}::uuid, ${referenceId}, NOW())`;
    return 'REDEEMED';
  }

  private toCoupon(row: CouponRow): Coupon {
    return { ...row, restrictions: this.restrictions(row.restrictions) };
  }

  private restrictions(value: unknown): CouponRestrictions {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const candidate = value as Record<string, unknown>;
    return {
      productIds: this.stringArray(candidate.productIds),
      categoryIds: this.stringArray(candidate.categoryIds),
    };
  }

  private stringArray(value: unknown): string[] | undefined {
    return Array.isArray(value) &&
      value.every((item) => typeof item === 'string')
      ? value
      : undefined;
  }
}
