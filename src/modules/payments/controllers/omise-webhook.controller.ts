import { Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  OmiseWebhookService,
  type WebhookResult,
} from '../services/omise-webhook.service.js';

type RawBodyRequest = Request & { rawBody?: Buffer };

@ApiTags('payments')
@Controller('webhooks/omise')
export class OmiseWebhookController {
  constructor(private readonly service: OmiseWebhookService) {}

  @Post()
  @HttpCode(200)
  @ApiExcludeEndpoint()
  handle(
    @Req() request: RawBodyRequest,
    @Headers('omise-signature') signature: string | undefined,
    @Headers('omise-signature-timestamp') timestamp: string | undefined,
  ): Promise<WebhookResult> {
    if (!request.rawBody) throw new Error('Raw webhook body is unavailable');
    return this.service.handle(request.rawBody, signature, timestamp);
  }
}
