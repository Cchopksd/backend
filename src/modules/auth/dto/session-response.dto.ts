import { ApiProperty } from '@nestjs/swagger';
import { AuthUserResponseDto } from './auth-response.dto.js';

export class SessionResponseDto {
  @ApiProperty() accessToken!: string;
  @ApiProperty({ type: AuthUserResponseDto }) user!: AuthUserResponseDto;
}
