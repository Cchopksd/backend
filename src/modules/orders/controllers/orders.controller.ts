import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import {
  FirebaseAuthGuard,
  type AuthenticatedRequest,
} from '../../auth/guards/firebase-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { CheckoutDto, CheckoutResponseDto } from '../dto/checkout.dto.js';
import { CheckoutService } from '../services/checkout.service.js';

@ApiTags('orders')
@Controller('orders')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles('CUSTOMER')
@ApiBearerAuth()
export class OrdersController {
  constructor(private readonly checkout: CheckoutService) {}

  @Post('checkout')
  @ApiCreatedResponse({ type: CheckoutResponseDto })
  checkoutCart(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CheckoutDto,
  ): Promise<CheckoutResponseDto> {
    return this.checkout.checkout(request.user!, dto);
  }
}
