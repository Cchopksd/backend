import { validateEnvironment } from './environment.validation.js';

const validEnvironment = {
  NODE_ENV: 'test',
  AUTH_ACCESS_TOKEN_SECRET: 'a'.repeat(32),
  AUTH_REFRESH_TOKEN_SECRET: 'b'.repeat(32),
  MINIO_ACCESS_KEY: 'minioadmin',
  MINIO_SECRET_KEY: 'minioadmin',
};

describe('validateEnvironment', () => {
  it('accepts the local MinIO defaults', () => {
    expect(validateEnvironment(validEnvironment)).toMatchObject({
      MINIO_ENDPOINT: 'http://localhost:9000',
      MINIO_BUCKET: 'marketplace',
      MINIO_REGION: 'us-east-1',
    });
  });

  it('rejects an invalid MinIO endpoint', () => {
    expect(() =>
      validateEnvironment({ ...validEnvironment, MINIO_ENDPOINT: 'minio' }),
    ).toThrow('MINIO_ENDPOINT');
  });
});
