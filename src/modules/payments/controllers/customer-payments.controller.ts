import { Body, Controller, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiHeader, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { FirebaseAuthGuard, type AuthenticatedRequest } from '../../auth/guards/firebase-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { CreateCustomerPaymentDto, CustomerPaymentParamsDto, CustomerPaymentResponseDto } from '../dto/customer-payment.dto.js';
import { CustomerPaymentService } from '../services/customer-payment.service.js';
@ApiTags('payments') @Controller('payments/orders') @UseGuards(FirebaseAuthGuard, RolesGuard) @Roles('CUSTOMER') @ApiBearerAuth()
export class CustomerPaymentsController {
  constructor(private readonly payments: CustomerPaymentService) {}
  @Get(':orderId') @ApiOkResponse({ type: CustomerPaymentResponseDto }) get(@Req() request: AuthenticatedRequest, @Param() params: CustomerPaymentParamsDto): Promise<CustomerPaymentResponseDto> { return this.payments.get(request.user!, params.orderId); }
  @Post(':orderId/attempts') @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Unique per customer payment-attempt request; reused retries replay the same attempt.' }) @ApiCreatedResponse({ type: CustomerPaymentResponseDto }) create(@Req() request: AuthenticatedRequest, @Param() params: CustomerPaymentParamsDto, @Headers('idempotency-key') idempotencyKey: string | undefined, @Body() dto: CreateCustomerPaymentDto): Promise<CustomerPaymentResponseDto> { return this.payments.create(request.user!, params.orderId, idempotencyKey, dto); }
}
