// src/common/guards/jwt-auth.guard.ts
// =============================================
// Guard menggantikan middleware authenticate di Express
// Lebih rapi karena bisa di-attach langsung ke controller
// dengan decorator @UseGuards(JwtAuthGuard)
// =============================================

import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor() {
    super({});
  }

  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any) {
    if (err || !user) {
      throw new UnauthorizedException(
        'Token tidak valid atau sesi telah berakhir. Silakan login kembali.',
      );
    }
    if (!user.isActive) {
      throw new UnauthorizedException(
        'Akun Anda telah dinonaktifkan. Hubungi admin.',
      );
    }
    return user;
  }
}
