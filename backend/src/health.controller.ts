import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}
  @Get() check() { return { success: true, data: { status: 'ok', timestamp: new Date().toISOString(), version: process.env.npm_package_version || '2.5.0' } }; }
  @Get('ready') async ready() {
    try { await this.prisma.$queryRaw`SELECT 1`; return { success: true, data: { status: 'ready', database: 'ok', timestamp: new Date().toISOString() } }; }
    catch { throw new ServiceUnavailableException('Database belum siap.'); }
  }
}
