export class OmiseConfigurationError extends Error {
  constructor() {
    super('Omise is not configured');
    this.name = 'OmiseConfigurationError';
  }
}

export class OmiseRequestError extends Error {
  constructor(
    readonly providerCode: string | undefined,
    readonly statusCode: number,
  ) {
    super('Omise request failed');
    this.name = 'OmiseRequestError';
  }
}

export class OmiseResponseError extends Error {
  constructor() {
    super('Omise returned an invalid response');
    this.name = 'OmiseResponseError';
  }
}

export class OmiseWebhookSignatureError extends Error {
  constructor() {
    super('Omise webhook signature is invalid');
    this.name = 'OmiseWebhookSignatureError';
  }
}
