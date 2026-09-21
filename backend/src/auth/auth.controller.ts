import { Controller, Post, Body, HttpCode, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly configService: ConfigService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    const adminUser = this.configService.get<string>('ADMIN_USERNAME', 'admin');
    const adminPass = this.configService.get<string>('ADMIN_PASSWORD', 'admin123');
    const secret = this.configService.get<string>('JWT_SECRET', 'super-secret-hotel-scraper-key-2026');

    if (dto.username !== adminUser || dto.password !== adminPass) {
      throw new UnauthorizedException('Invalid username or password credentials.');
    }

    const token = `token_${adminUser}_${secret}`;
    return {
      success: true,
      token,
      username: adminUser,
      message: 'Login successful',
    };
  }
}
