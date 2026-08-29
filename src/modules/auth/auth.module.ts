import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../../database/database.module.js';
import { FirebaseModule } from '../../integrations/firebase/firebase.module.js';
import { CacheModule } from '../../infrastructure/cache/cache.module.js';
import { AuthController } from './controllers/auth.controller.js';
import { FirebaseAuthGuard } from './guards/firebase-auth.guard.js';
import { AccessTokenGuard } from './guards/access-token.guard.js';
import { GoogleAuthGuard } from './guards/google-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { AuthRepository } from './repositories/auth.repository.js';
import { AuthService } from './services/auth.service.js';
import { EMAIL_OTP_SENDER, UnconfiguredEmailOtpSender } from './services/email-otp-sender.service.js';
import { OtpCryptoService } from './services/otp-crypto.service.js';
import { SessionService } from './services/session.service.js';

@Module({
  imports: [DatabaseModule, CacheModule, FirebaseModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthRepository,
    AuthService,
    OtpCryptoService,
    SessionService,
    FirebaseAuthGuard,
    AccessTokenGuard,
    GoogleAuthGuard,
    RolesGuard,
    { provide: EMAIL_OTP_SENDER, useClass: UnconfiguredEmailOtpSender },
  ],
  exports: [AuthService, SessionService, FirebaseAuthGuard, RolesGuard],
})
export class AuthModule {}
