import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';

export class CustomerPaymentParamsDto { @ApiProperty({ format: 'uuid' }) @IsUUID() orderId!: string; }
export class CreateCustomerPaymentDto {
  @ApiProperty({ enum: ['PROMPTPAY', 'CARD'] }) @IsIn(['PROMPTPAY', 'CARD']) method!: 'PROMPTPAY' | 'CARD';
  @ApiPropertyOptional({ description: 'Omise card token only; raw card fields are never accepted.' }) @ValidateIf((value: CreateCustomerPaymentDto) => value.method === 'CARD') @IsString() @MaxLength(255) omiseToken?: string;
}
export class CustomerPaymentResponseDto {
  @ApiProperty() orderId!: string; @ApiProperty() orderNumber!: string; @ApiProperty() orderStatus!: string;
  @ApiProperty() amount!: number; @ApiProperty() currency!: string;
  @ApiPropertyOptional() attemptId?: string; @ApiPropertyOptional() method?: string; @ApiPropertyOptional() status?: string;
  @ApiPropertyOptional() expiresAt?: string; @ApiPropertyOptional() promptPayQrPayload?: string; @ApiPropertyOptional() failureCode?: string;
}
