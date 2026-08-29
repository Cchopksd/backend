import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

class BundleRequestDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() bundleId!: string;
  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;
}

class FlashSaleRequestDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() skuId!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() flashSaleId!: string;
}

export class CheckoutDto {
  @ApiProperty({
    format: 'uuid',
    description: 'The seller group being checked out.',
  })
  @IsUUID()
  sellerId!: string;
  @ApiProperty({
    description: 'Persisted as the order shipping-address snapshot.',
  })
  @IsObject()
  shippingAddress!: Record<string, unknown>;
  @ApiProperty({
    description: 'A client-generated key used to make checkout retries safe.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  idempotencyKey!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  couponCode?: string;
  @ApiPropertyOptional({ type: [BundleRequestDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => BundleRequestDto)
  bundles?: BundleRequestDto[];
  @ApiPropertyOptional({ type: [FlashSaleRequestDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => FlashSaleRequestDto)
  flashSales?: FlashSaleRequestDto[];
}

export class CheckoutResponseDto {
  @ApiProperty({ format: 'uuid' }) orderId!: string;
  @ApiProperty() orderNumber!: string;
  @ApiProperty() status!: string;
  @ApiProperty() paymentStatus!: string;
  @ApiProperty() currency!: string;
  @ApiProperty() totalAmount!: number;
}
