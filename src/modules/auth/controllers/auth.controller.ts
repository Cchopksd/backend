import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthUserResponseDto, OtpRequestResponseDto, OtpVerificationResponseDto } from '../dto/auth-response.dto.js';
import { EmailPasswordSignInDto } from '../dto/email-password-sign-in.dto.js';
import { SessionResponseDto } from '../dto/session-response.dto.js';
import { RequestEmailOtpDto } from '../dto/request-email-otp.dto.js';
import { VerifyEmailOtpDto } from '../dto/verify-email-otp.dto.js';
import type { AuthenticatedRequest } from '../guards/firebase-auth.guard.js';
import { GoogleAuthGuard } from '../guards/google-auth.guard.js';
import { AccessTokenGuard } from '../guards/access-token.guard.js';
import { AuthService } from '../services/auth.service.js';
import { SessionService } from '../services/session.service.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService, private readonly sessions: SessionService) {}

  @Post('email-otp/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a six-digit email verification code' })
  @ApiOkResponse({ type: OtpRequestResponseDto })
  async requestEmailOtp(@Body() dto: RequestEmailOtpDto, @Req() request: Request): Promise<OtpRequestResponseDto> {
    const sourceIp = request.ip ?? request.socket.remoteAddress ?? 'unknown';
    const result = await this.authService.requestEmailOtp(dto.email, sourceIp);
    return { challengeId: result.challengeId, expiresAt: result.expiresAt.toISOString() };
  }

  @Post('email-otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify an email OTP and receive a Firebase custom token' })
  @ApiOkResponse({ type: OtpVerificationResponseDto })
  async verifyEmailOtp(@Body() dto: VerifyEmailOtpDto, @Res({ passthrough: true }) response: Response): Promise<OtpVerificationResponseDto> {
    return this.withSession(await this.authService.verifyEmailOtp(dto.challengeId, dto.code), response);
  }

  @Post('email-password/sign-in')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in with a Firebase email/password account' })
  @ApiOkResponse({ type: OtpVerificationResponseDto })
  async signInWithEmailPassword(@Body() dto: EmailPasswordSignInDto, @Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<OtpVerificationResponseDto> {
    const sourceIp = request.ip ?? request.socket.remoteAddress ?? 'unknown';
    return this.withSession(await this.authService.signInWithEmailPassword(dto.email, dto.password, sourceIp), response);
  }

  @Post('session/refresh')
  @HttpCode(HttpStatus.OK)
  async refreshSession(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<{ accessToken: string }> {
    const result = await this.sessions.refresh(request.cookies?.refresh_token ?? '');
    this.setRefreshCookie(response, result.refreshToken);
    return { accessToken: result.accessToken };
  }

  @Post('session/logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<void> {
    await this.sessions.revoke(request.cookies?.refresh_token ?? '');
    response.clearCookie('refresh_token', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/auth/session' });
  }

  @Post('google')
  @UseGuards(GoogleAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resolve or create a local profile for a verified Google Firebase identity' })
  @ApiOkResponse({ type: SessionResponseDto })
  async googleSignIn(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: Response): Promise<SessionResponseDto> {
    const session = await this.sessions.create(request.user!);
    this.setRefreshCookie(response, session.refreshToken);
    return { accessToken: session.accessToken, user: request.user! };
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the authenticated local profile' })
  @ApiOkResponse({ type: AuthUserResponseDto })
  getMe(@Req() request: AuthenticatedRequest): AuthUserResponseDto {
    return request.user!;
  }

  private async withSession(result: { customToken: string; user: AuthUserResponseDto }, response: Response): Promise<OtpVerificationResponseDto> {
    const session = await this.sessions.create(result.user);
    this.setRefreshCookie(response, session.refreshToken);
    return { ...result, accessToken: session.accessToken };
  }

  private setRefreshCookie(response: Response, refreshToken: string): void {
    response.cookie('refresh_token', refreshToken, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/auth/session', maxAge: 30 * 24 * 60 * 60 * 1000 });
  }
}
