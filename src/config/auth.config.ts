import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  accessTokenSecret: process.env.AUTH_ACCESS_TOKEN_SECRET,
  refreshTokenSecret: process.env.AUTH_REFRESH_TOKEN_SECRET,
}));
