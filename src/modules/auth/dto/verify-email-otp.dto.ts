import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, Matches } from 'class-validator';

export class VerifyEmailOtpDto {
  @ApiProperty({ format: 'uuid' })
  @IsString()
  @IsUUID()
  challengeId!: string;

  @ApiProperty({ example: '123456' })
  @Matches(/^\d{6}$/)
  code!: string;
}
