// src/common/guards/roles.guard.ts
// Guard khusus untuk proteksi endpoint admin

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Akses ditolak. Hanya admin yang dapat melakukan ini.',
      );
    }
    return true;
  }
}
