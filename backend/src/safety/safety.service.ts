import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
@Injectable()
export class SafetyService {
  constructor(private prisma: PrismaService) {}
  async block(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) throw new BadRequestException('Tidak dapat memblokir diri sendiri.');
    const target = await this.prisma.user.findUnique({ where: { id: blockedId }, select: { id: true } });
    if (!target) throw new NotFoundException('Pengguna tidak ditemukan.');
    return this.prisma.userBlock.upsert({ where: { blockerId_blockedId: { blockerId, blockedId } }, create: { blockerId, blockedId }, update: {} });
  }
  async unblock(blockerId: string, blockedId: string) { await this.prisma.userBlock.deleteMany({ where: { blockerId, blockedId } }); }
  async status(blockerId: string, blockedId: string) { return { blocked: Boolean(await this.prisma.userBlock.findUnique({ where: { blockerId_blockedId: { blockerId, blockedId } }, select: { id: true } })) }; }
  async blocks(blockerId: string) { return this.prisma.userBlock.findMany({ where: { blockerId }, orderBy: { createdAt: 'desc' }, include: { blocked: { select: { id: true, name: true, avatarUrl: true } } } }); }
  async isBlockedEitherWay(a: string, b: string) { return (await this.prisma.userBlock.count({ where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] } })) > 0; }
}
