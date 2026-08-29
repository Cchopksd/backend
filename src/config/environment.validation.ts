import { plainToInstance, Transform } from 'class-transformer';
import { IsIn, IsInt, IsString, IsUrl, Max, Min, MinLength, validateSync } from 'class-validator';

const DEFAULT_DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5432/marketplace?schema=public';

class EnvironmentVariables {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV = 'development';

  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 3000;

  @IsIn(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
  LOG_LEVEL = 'info';

  @IsUrl({ protocols: ['postgresql', 'postgres'], require_tld: false })
  DATABASE_URL = DEFAULT_DATABASE_URL;

  @IsUrl({ protocols: ['redis', 'rediss'], require_tld: false })
  REDIS_URL = 'redis://localhost:6379';

  @IsUrl({ protocols: ['amqp', 'amqps'], require_tld: false })
  RABBITMQ_URL = 'amqp://localhost:5672';

  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(100)
  @Max(30000)
  RABBITMQ_CONNECTION_TIMEOUT_MS = 5000;

  FIREBASE_PROJECT_ID?: string;
  FIREBASE_CLIENT_EMAIL?: string;
  FIREBASE_PRIVATE_KEY?: string;
  FIREBASE_WEB_API_KEY?: string;

  @IsString()
  @MinLength(32)
  AUTH_ACCESS_TOKEN_SECRET!: string;

  @IsString()
  @MinLength(32)
  AUTH_REFRESH_TOKEN_SECRET!: string;

  OMISE_SECRET_KEY?: string;
  OMISE_WEBHOOK_SECRET?: string;

  @IsUrl({ require_tld: false })
  OMISE_API_URL = 'https://api.omise.co';

  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(100)
  @Max(30000)
  OMISE_TIMEOUT_MS = 10000;

  @IsUrl({ protocols: ['http', 'https'], require_tld: false })
  MINIO_ENDPOINT = 'http://localhost:9000';

  @IsString()
  @MinLength(3)
  MINIO_ACCESS_KEY!: string;

  @IsString()
  @MinLength(8)
  MINIO_SECRET_KEY!: string;

  @IsString()
  @MinLength(3)
  MINIO_BUCKET = 'marketplace';

  @IsString()
  @MinLength(1)
  MINIO_REGION = 'us-east-1';
}

export function validateEnvironment(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const environment = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
    exposeDefaultValues: true,
  });
  const errors = validateSync(environment, { skipMissingProperties: false });

  if (errors.length > 0) {
    const invalidKeys = errors.map((error) => error.property).join(', ');
    throw new Error(`Invalid environment configuration: ${invalidKeys}`);
  }

  return { ...environment };
}
