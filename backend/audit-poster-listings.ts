import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
async function main() {
  const listings = await prisma.listing.findMany({
    where: { status: 'ACTIVE' },
    take: 12,
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, description: true, price: true, category: true, type: true, mode: true, condition: true, images: true, fulfillmentMethods: true, seller: { select: { id: true, name: true, isVerified: true } } },
  });
  console.log(JSON.stringify(listings, null, 2));
}
main().finally(() => prisma.$disconnect());
