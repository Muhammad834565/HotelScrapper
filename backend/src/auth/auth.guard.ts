import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader) {
      throw new UnauthorizedException('Authentication token missing. Please log in.');
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const expectedSecret = this.configService.get<string>('JWT_SECRET', 'super-secret-hotel-scraper-key-2026');
    const adminUser = this.configService.get<string>('ADMIN_USERNAME', 'admin');

    const validToken = `token_${adminUser}_${expectedSecret}`;

    if (token !== validToken && token !== expectedSecret) {
      throw new UnauthorizedException('Invalid or expired authentication token.');
    }

    return true;
  }
}
