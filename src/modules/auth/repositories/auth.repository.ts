import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../database/prisma.service.js';
import type { AuthenticatedUser } from '../types/auth-user.type.js';

export type OtpChallenge = {
  id: string;
  email: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  usedAt: Date | null;
  createdAt: Date;
};

type UserRow = AuthenticatedUser;
type ChallengeRow = OtpChallenge;
export type AuthSession = { id: string; userId: string; refreshTokenHash: string; expiresAt: Date; revokedAt: Date | null };

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserByFirebaseUid(firebaseUid: string): Promise<AuthenticatedUser | null> {
    const rows = await this.prisma.$queryRaw<UserRow[]>`
      SELECT "id", "firebaseUid", "email", "displayName", "role"
      FROM "User" WHERE "firebaseUid" = ${firebaseUid} LIMIT 1`;
    return rows[0] ?? null;
  }

  async findUserById(id: string): Promise<AuthenticatedUser | null> {
    const rows = await this.prisma.$queryRaw<UserRow[]>`SELECT "id", "firebaseUid", "email", "displayName", "role" FROM "User" WHERE "id" = ${id}::uuid LIMIT 1`;
    return rows[0] ?? null;
  }

  async upsertUser(input: { firebaseUid: string; email: string; displayName?: string }): Promise<AuthenticatedUser> {
    const rows = await this.prisma.$queryRaw<UserRow[]>`
      INSERT INTO "User" ("id", "firebaseUid", "email", "displayName", "role", "createdAt", "updatedAt")
      VALUES (${randomUUID()}::uuid, ${input.firebaseUid}, ${input.email}, ${input.displayName ?? null}, 'CUSTOMER'::"UserRole", NOW(), NOW())
      ON CONFLICT ("email") DO UPDATE
      SET "displayName" = COALESCE(EXCLUDED."displayName", "User"."displayName"), "updatedAt" = NOW()
      RETURNING "id", "firebaseUid", "email", "displayName", "role"`;
    return rows[0]!;
  }

  async findLatestActiveChallenge(email: string): Promise<OtpChallenge | null> {
    const rows = await this.prisma.$queryRaw<ChallengeRow[]>`
      SELECT "id", "email", "codeHash", "expiresAt", "attempts", "usedAt", "createdAt"
      FROM "EmailOtpChallenge"
      WHERE "email" = ${email} AND "usedAt" IS NULL
      ORDER BY "createdAt" DESC LIMIT 1`;
    return rows[0] ?? null;
  }

  async replaceChallenge(input: { email: string; codeHash: string; expiresAt: Date }): Promise<OtpChallenge> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        UPDATE "EmailOtpChallenge" SET "usedAt" = NOW()
        WHERE "email" = ${input.email} AND "usedAt" IS NULL`;
      const rows = await transaction.$queryRaw<ChallengeRow[]>`
        INSERT INTO "EmailOtpChallenge" ("id", "email", "codeHash", "expiresAt", "attempts", "createdAt")
        VALUES (${randomUUID()}::uuid, ${input.email}, ${input.codeHash}, ${input.expiresAt}, 0, NOW())
        RETURNING "id", "email", "codeHash", "expiresAt", "attempts", "usedAt", "createdAt"`;
      return rows[0]!;
    });
  }

  async invalidateChallenge(challengeId: string): Promise<void> {
    await this.prisma.$executeRaw`UPDATE "EmailOtpChallenge" SET "usedAt" = NOW() WHERE "id" = ${challengeId}::uuid AND "usedAt" IS NULL`;
  }

  async withLockedChallenge<T>(challengeId: string, operation: (challenge: OtpChallenge, commands: { markUsed(): Promise<void>; incrementAttempts(): Promise<void> }) => Promise<T>): Promise<T | null> {
    return this.prisma.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<ChallengeRow[]>`
        SELECT "id", "email", "codeHash", "expiresAt", "attempts", "usedAt", "createdAt"
        FROM "EmailOtpChallenge" WHERE "id" = ${challengeId}::uuid FOR UPDATE`;
      const challenge = rows[0];
      if (!challenge) return null;
      return operation(challenge, {
        markUsed: async (): Promise<void> => {
          await transaction.$executeRaw`UPDATE "EmailOtpChallenge" SET "usedAt" = NOW() WHERE "id" = ${challenge.id}::uuid AND "usedAt" IS NULL`;
        },
        incrementAttempts: async (): Promise<void> => {
          await transaction.$executeRaw`UPDATE "EmailOtpChallenge" SET "attempts" = "attempts" + 1 WHERE "id" = ${challenge.id}::uuid`;
        },
      });
    });
  }

  async createSession(input: { id: string; userId: string; refreshTokenHash: string; expiresAt: Date }): Promise<void> {
    await this.prisma.$executeRaw`INSERT INTO "AuthSession" ("id", "userId", "refreshTokenHash", "expiresAt", "createdAt", "updatedAt") VALUES (${input.id}::uuid, ${input.userId}::uuid, ${input.refreshTokenHash}, ${input.expiresAt}, NOW(), NOW())`;
  }

  async getActiveSession(id: string): Promise<AuthSession | null> {
    const rows = await this.prisma.$queryRaw<AuthSession[]>`SELECT "id", "userId", "refreshTokenHash", "expiresAt", "revokedAt" FROM "AuthSession" WHERE "id" = ${id}::uuid AND "revokedAt" IS NULL AND "expiresAt" > NOW() LIMIT 1`;
    return rows[0] ?? null;
  }

  async rotateSession(id: string, refreshTokenHash: string): Promise<void> {
    await this.prisma.$executeRaw`UPDATE "AuthSession" SET "refreshTokenHash" = ${refreshTokenHash}, "updatedAt" = NOW() WHERE "id" = ${id}::uuid AND "revokedAt" IS NULL`;
  }

  async revokeSession(id: string): Promise<void> {
    await this.prisma.$executeRaw`UPDATE "AuthSession" SET "revokedAt" = NOW(), "updatedAt" = NOW() WHERE "id" = ${id}::uuid AND "revokedAt" IS NULL`;
  }
}
