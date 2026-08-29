import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, MaxLength } from 'class-validator';

export class RequestEmailOtpDto {
  @ApiProperty({ example: 'customer@example.com' })
  @IsEmail()
  @MaxLength(254)
  email!: string;
}
