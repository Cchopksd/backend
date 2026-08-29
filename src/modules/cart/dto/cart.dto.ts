import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsUUID, Min } from 'class-validator';

export class AddCartItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  skuId!: string;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class UpdateCartItemDto {
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class SetCartItemSelectionDto {
  @ApiProperty()
  @IsBoolean()
  selected!: boolean;
}

export class CartItemParamsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  itemId!: string;
}

export class CartItemResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() skuId!: string;
  @ApiProperty() skuCode!: string;
  @ApiProperty() productId!: string;
  @ApiProperty() productName!: string;
  @ApiProperty() variantName!: string;
  @ApiProperty() sellerId!: string;
  @ApiProperty() sellerName!: string;
  @ApiProperty() unitPriceAmount!: number;
  @ApiProperty() currency!: string;
  @ApiProperty() quantity!: number;
  @ApiProperty() selected!: boolean;
  @ApiProperty() availableQuantity!: number;
  @ApiProperty() available!: boolean;
  @ApiPropertyOptional({ nullable: true }) productMedia!: unknown;
}

export class CartSellerGroupResponseDto {
  @ApiProperty() sellerId!: string;
  @ApiProperty() sellerName!: string;
  @ApiProperty({ type: [CartItemResponseDto] }) items!: CartItemResponseDto[];
}

export class CartResponseDto {
  @ApiProperty({ type: [CartSellerGroupResponseDto] }) sellerGroups!: CartSellerGroupResponseDto[];
}
