import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthUserResponseDto, OtpRequestResponseDto, OtpVerificationResponseDto } from '../dto/auth-response.dto.js';
import { RequestEmailOtpDto } from '../dto/request-email-otp.dto.js';
import { VerifyEmailOtpDto } from '../dto/verify-email-otp.dto.js';
import { FirebaseAuthGuard, type AuthenticatedRequest } from '../guards/firebase-auth.guard.js';
import { GoogleAuthGuard } from '../guards/google-auth.guard.js';
import { AuthService } from '../services/auth.service.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
  async verifyEmailOtp(@Body() dto: VerifyEmailOtpDto): Promise<OtpVerificationResponseDto> {
    return this.authService.verifyEmailOtp(dto.challengeId, dto.code);
  }

  @Post('google')
  @UseGuards(GoogleAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resolve or create a local profile for a verified Google Firebase identity' })
  @ApiOkResponse({ type: AuthUserResponseDto })
  async googleSignIn(@Req() request: AuthenticatedRequest): Promise<AuthUserResponseDto> {
    return request.user!;
  }

  @Get('me')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the authenticated local profile' })
  @ApiOkResponse({ type: AuthUserResponseDto })
  getMe(@Req() request: AuthenticatedRequest): AuthUserResponseDto {
    return request.user!;
  }
}
