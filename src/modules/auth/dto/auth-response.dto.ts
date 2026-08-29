import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { UserRole } from '../types/auth-user.type.js';

export class AuthUserResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() firebaseUid!: string;
  @ApiPropertyOptional({ nullable: true }) email!: string | null;
  @ApiPropertyOptional({ nullable: true }) displayName!: string | null;
  @ApiProperty({ enum: ['CUSTOMER', 'SELLER', 'ADMIN'] }) role!: UserRole;
}

export class OtpRequestResponseDto {
  @ApiProperty() challengeId!: string;
  @ApiProperty() expiresAt!: string;
}

export class OtpVerificationResponseDto {
  @ApiProperty() customToken!: string;
  @ApiProperty({ type: AuthUserResponseDto }) user!: AuthUserResponseDto;
}
