import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { FirebaseAuthGuard, type AuthenticatedRequest } from '../../auth/guards/firebase-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { AddCartItemDto, CartItemParamsDto, CartResponseDto, SetCartItemSelectionDto, UpdateCartItemDto } from '../dto/cart.dto.js';
import { CartService } from '../services/cart.service.js';

@ApiTags('cart')
@Controller('cart')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles('CUSTOMER')
@ApiBearerAuth()
export class CartController {
  constructor(private readonly service: CartService) {}

  @Get()
  @ApiOkResponse({ type: CartResponseDto })
  get(@Req() request: AuthenticatedRequest): Promise<CartResponseDto> {
    return this.service.get(request.user!);
  }

  @Post('items')
  @ApiCreatedResponse({ type: CartResponseDto })
  add(@Req() request: AuthenticatedRequest, @Body() dto: AddCartItemDto): Promise<CartResponseDto> {
    return this.service.add(request.user!, dto.skuId, dto.quantity);
  }

  @Patch('selection')
  @ApiOkResponse({ type: CartResponseDto })
  setAllSelection(@Req() request: AuthenticatedRequest, @Body() dto: SetCartItemSelectionDto): Promise<CartResponseDto> {
    return this.service.setAllSelection(request.user!, dto.selected);
  }

  @Patch('items/:itemId/selection')
  @ApiOkResponse({ type: CartResponseDto })
  setItemSelection(@Req() request: AuthenticatedRequest, @Param() params: CartItemParamsDto, @Body() dto: SetCartItemSelectionDto): Promise<CartResponseDto> {
    return this.service.setItemSelection(request.user!, params.itemId, dto.selected);
  }

  @Patch('items/:itemId')
  @ApiOkResponse({ type: CartResponseDto })
  updateQuantity(@Req() request: AuthenticatedRequest, @Param() params: CartItemParamsDto, @Body() dto: UpdateCartItemDto): Promise<CartResponseDto> {
    return this.service.updateQuantity(request.user!, params.itemId, dto.quantity);
  }

  @Delete('items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async remove(@Req() request: AuthenticatedRequest, @Param() params: CartItemParamsDto): Promise<void> {
    await this.service.remove(request.user!, params.itemId);
  }
}
