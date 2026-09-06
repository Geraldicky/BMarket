import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const password = 'demo12345';
const image = (label: string) => JSON.stringify([`https://placehold.co/1200x900/png?text=${encodeURIComponent(label)}`]);

const day = 24 * 60 * 60 * 1000;
const now = new Date();
const inDays = (days: number) => new Date(now.getTime() + days * day);
const agoDays = (days: number) => new Date(now.getTime() - days * day);

async function main() {
  console.log('🌱 Seeding BMarket v2.7 demo dataset...');
  const hashedPassword = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email: 'demo.admin@binus.ac.id' },
    update: { password: hashedPassword, name: 'Demo Admin', role: 'ADMIN', isVerified: true, isActive: true },
    create: { email: 'demo.admin@binus.ac.id', password: hashedPassword, name: 'Demo Admin', role: 'ADMIN', isVerified: true, isActive: true },
  });
  const seller = await prisma.user.upsert({
    where: { email: 'demo.seller@binus.ac.id' },
    update: { password: hashedPassword, name: 'Nadia Seller', role: 'STUDENT', isVerified: true, isActive: true, balance: 2500000 },
    create: { email: 'demo.seller@binus.ac.id', password: hashedPassword, name: 'Nadia Seller', studentId: 'DEMO27001', role: 'STUDENT', isVerified: true, isActive: true, balance: 2500000, bio: 'Demo seller untuk presentasi BMarket.' },
  });
  const seller2 = await prisma.user.upsert({
    where: { email: 'demo.seller2@binus.ac.id' },
    update: { password: hashedPassword, name: 'Raka Merchant', role: 'STUDENT', isVerified: true, isActive: true, balance: 1800000 },
    create: { email: 'demo.seller2@binus.ac.id', password: hashedPassword, name: 'Raka Merchant', studentId: 'DEMO27002', role: 'STUDENT', isVerified: true, isActive: true, balance: 1800000 },
  });
  const buyer = await prisma.user.upsert({
    where: { email: 'demo.buyer@binus.ac.id' },
    update: { password: hashedPassword, name: 'Kevin Buyer', role: 'STUDENT', isVerified: true, isActive: true, balance: 4750000, escrow: 250000 },
    create: { email: 'demo.buyer@binus.ac.id', password: hashedPassword, name: 'Kevin Buyer', studentId: 'DEMO27003', role: 'STUDENT', isVerified: true, isActive: true, balance: 4750000, escrow: 250000 },
  });
  const buyer2 = await prisma.user.upsert({
    where: { email: 'demo.buyer2@binus.ac.id' },
    update: { password: hashedPassword, name: 'Salsa Buyer', role: 'STUDENT', isVerified: true, isActive: true, balance: 3200000 },
    create: { email: 'demo.buyer2@binus.ac.id', password: hashedPassword, name: 'Salsa Buyer', studentId: 'DEMO27004', role: 'STUDENT', isVerified: true, isActive: true, balance: 3200000 },
  });
  const reported = await prisma.user.upsert({
    where: { email: 'demo.reported@binus.ac.id' },
    update: { password: hashedPassword, name: 'Demo Reported User', role: 'STUDENT', isVerified: true, isActive: true },
    create: { email: 'demo.reported@binus.ac.id', password: hashedPassword, name: 'Demo Reported User', studentId: 'DEMO27005', role: 'STUDENT', isVerified: true, isActive: true },
  });

  const listingData = [
    {
      id: 'demo-v27-laptop', title: 'MacBook Air M2 13-inch', description: 'Unit preloved untuk demo. Kondisi sangat baik, charger lengkap.', price: 10900000,
      category: 'ELECTRONICS' as const, type: 'PRODUCT' as const, mode: 'ONE_OFF' as const, condition: 'LIKE_NEW' as const,
      sellerId: seller.id, stock: 1, stockLeft: 1, images: image('MacBook Air M2'), fulfillmentMethods: ['CAMPUS_MEETUP', 'INSTANT_COURIER'] as const,
    },
    {
      id: 'demo-v27-book', title: 'Buku Data Structures & Algorithms', description: 'Ready stock untuk kebutuhan kuliah semester awal.', price: 125000,
      category: 'BOOKS' as const, type: 'PRODUCT' as const, mode: 'STOCKED' as const, condition: 'GOOD' as const,
      sellerId: seller.id, stock: 12, stockLeft: 8, images: image('DSA Book'), fulfillmentMethods: ['CAMPUS_MEETUP'] as const,
    },
    {
      id: 'demo-v27-food', title: 'Rice Bowl Ayam Mentai', description: 'Ready stock harian. Cocok untuk makan siang di kampus.', price: 28000,
      category: 'FOOD' as const, type: 'PRODUCT' as const, mode: 'STOCKED' as const, condition: null,
      sellerId: seller2.id, stock: 30, stockLeft: 21, images: image('Rice Bowl Mentai'), fulfillmentMethods: ['CAMPUS_MEETUP', 'INSTANT_COURIER'] as const,
    },
    {
      id: 'demo-v27-service', title: 'Jasa Desain Poster Organisasi', description: 'Desain poster event, seminar, dan kebutuhan organisasi kampus.', price: 90000,
      category: 'SERVICES' as const, type: 'SERVICE' as const, mode: 'SERVICE' as const, condition: null,
      sellerId: seller2.id, stock: null, stockLeft: null, images: image('Poster Design Service'), fulfillmentMethods: ['CAMPUS_MEETUP'] as const,
    },
  ];

  for (const item of listingData) {
    await prisma.listing.upsert({
      where: { id: item.id },
      update: { ...item, status: 'ACTIVE', sellerArchivedAt: null } as any,
      create: { ...item, status: 'ACTIVE' } as any,
    });
  }

  const preorder = await prisma.listing.upsert({
    where: { id: 'demo-v27-preorder' },
    update: {
      title: 'PO Hoodie Angkatan 2026', description: 'Pre-order hoodie angkatan dengan pickup di kampus.', price: 185000,
      category: 'FASHION', type: 'PRODUCT', mode: 'PREORDER', condition: null, sellerId: seller.id, images: image('Hoodie Angkatan 2026'),
      status: 'ACTIVE', stock: 40, stockLeft: 27, fulfillmentMethods: ['CAMPUS_MEETUP'], preorderStatus: 'OPEN', preorderDeadline: inDays(7),
      preorderReadyAt: inDays(14), preorderQuota: 40, preorderMinOrder: 10, preorderMaxPerBuyer: 3, preorderPickupLocation: 'BINUS Anggrek Lobby',
      preorderPickupNote: 'Bawa bukti transaksi saat pengambilan.', sellerArchivedAt: null,
    },
    create: {
      id: 'demo-v27-preorder', title: 'PO Hoodie Angkatan 2026', description: 'Pre-order hoodie angkatan dengan pickup di kampus.', price: 185000,
      category: 'FASHION', type: 'PRODUCT', mode: 'PREORDER', condition: null, sellerId: seller.id, images: image('Hoodie Angkatan 2026'),
      status: 'ACTIVE', stock: 40, stockLeft: 27, fulfillmentMethods: ['CAMPUS_MEETUP'], preorderStatus: 'OPEN', preorderDeadline: inDays(7),
      preorderReadyAt: inDays(14), preorderQuota: 40, preorderMinOrder: 10, preorderMaxPerBuyer: 3, preorderPickupLocation: 'BINUS Anggrek Lobby',
      preorderPickupNote: 'Bawa bukti transaksi saat pengambilan.',
    },
  });

  const completed = await prisma.transaction.upsert({
    where: { id: 'demo-v27-tx-completed' },
    update: {},
    create: {
      id: 'demo-v27-tx-completed', listingId: 'demo-v27-book', buyerId: buyer.id, sellerId: seller.id, status: 'COMPLETED', quantity: 2,
      price: 125000, totalPrice: 250000, grandTotal: 250000, fulfillmentMethod: 'CAMPUS_MEETUP', meetupCampus: 'BINUS Anggrek', meetupLocation: 'Lobby',
      commissionRate: 5, commissionAmt: 12500, sellerReceives: 237500, isEscrowHeld: false, paidAt: agoDays(5), completedAt: agoDays(4),
      handoverVerifiedAt: agoDays(4), listingTitleSnapshot: 'Buku Data Structures & Algorithms', listingImageSnapshot: image('DSA Book'), listingTypeSnapshot: 'PRODUCT',
      listingModeSnapshot: 'STOCKED', listingConditionSnapshot: 'GOOD',
    },
  });

  const pending = await prisma.transaction.upsert({
    where: { id: 'demo-v27-tx-pending' },
    update: { reservationExpiresAt: new Date(Date.now() + 15 * 60 * 1000) },
    create: {
      id: 'demo-v27-tx-pending', listingId: 'demo-v27-laptop', buyerId: buyer2.id, sellerId: seller.id, status: 'PENDING', quantity: 1,
      price: 10900000, totalPrice: 10900000, grandTotal: 10900000, fulfillmentMethod: 'CAMPUS_MEETUP', meetupCampus: 'BINUS Anggrek', meetupLocation: 'Food Court',
      commissionRate: 5, commissionAmt: 545000, sellerReceives: 10355000, isEscrowHeld: false, reservationExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
      listingTitleSnapshot: 'MacBook Air M2 13-inch', listingImageSnapshot: image('MacBook Air M2'), listingTypeSnapshot: 'PRODUCT', listingModeSnapshot: 'ONE_OFF', listingConditionSnapshot: 'LIKE_NEW',
    },
  });

  const disputed = await prisma.transaction.upsert({
    where: { id: 'demo-v27-tx-disputed' },
    update: {},
    create: {
      id: 'demo-v27-tx-disputed', listingId: 'demo-v27-food', buyerId: buyer.id, sellerId: seller2.id, status: 'PAID', quantity: 2,
      price: 28000, totalPrice: 56000, grandTotal: 56000, fulfillmentMethod: 'CAMPUS_MEETUP', meetupCampus: 'BINUS Anggrek', meetupLocation: 'Lobby',
      commissionRate: 5, commissionAmt: 2800, sellerReceives: 53200, isEscrowHeld: true, paidAt: agoDays(1),
      listingTitleSnapshot: 'Rice Bowl Ayam Mentai', listingImageSnapshot: image('Rice Bowl Mentai'), listingTypeSnapshot: 'PRODUCT', listingModeSnapshot: 'STOCKED', listingConditionSnapshot: null,
    },
  });

  await prisma.review.upsert({
    where: { transactionId: completed.id },
    update: { rating: 5, comment: 'Barang sesuai deskripsi dan meetup tepat waktu.' },
    create: { id: 'demo-v27-review', transactionId: completed.id, reviewerId: buyer.id, revieweeId: seller.id, rating: 5, comment: 'Barang sesuai deskripsi dan meetup tepat waktu.' },
  });

  await prisma.dispute.upsert({
    where: { transactionId: disputed.id },
    update: { status: 'OPEN', reason: 'ITEM_NOT_AS_DESCRIBED', description: 'Pesanan demo tidak sesuai deskripsi untuk mengisi moderation queue.', evidenceUrls: image('Dispute Evidence') },
    create: { id: 'demo-v27-dispute', transactionId: disputed.id, openedById: buyer.id, status: 'OPEN', reason: 'ITEM_NOT_AS_DESCRIBED', description: 'Pesanan demo tidak sesuai deskripsi untuk mengisi moderation queue.', evidenceUrls: image('Dispute Evidence') },
  });

  await prisma.complaint.upsert({
    where: { reporterId_targetType_targetId: { reporterId: buyer2.id, targetType: 'LISTING', targetId: preorder.id } },
    update: { status: 'OPEN', reason: 'Informasi listing perlu ditinjau', description: 'Laporan demo agar admin moderation queue memiliki data.' },
    create: { id: 'demo-v27-complaint', reporterId: buyer2.id, targetType: 'LISTING', targetId: preorder.id, status: 'OPEN', reason: 'Informasi listing perlu ditinjau', description: 'Laporan demo agar admin moderation queue memiliki data.' },
  });

  await prisma.complaint.upsert({
    where: { reporterId_targetType_targetId: { reporterId: buyer.id, targetType: 'USER', targetId: reported.id } },
    update: { status: 'IN_REVIEW', reason: 'Perilaku pengguna perlu ditinjau', description: 'Contoh laporan user untuk demo admin.' },
    create: { id: 'demo-v27-user-complaint', reporterId: buyer.id, targetType: 'USER', targetId: reported.id, status: 'IN_REVIEW', reason: 'Perilaku pengguna perlu ditinjau', description: 'Contoh laporan user untuk demo admin.' },
  });

  await prisma.wishlist.upsert({
    where: { userId_listingId: { userId: buyer.id, listingId: preorder.id } },
    update: {},
    create: { userId: buyer.id, listingId: preorder.id },
  });
  await prisma.recentlyViewed.upsert({
    where: { userId_listingId: { userId: buyer.id, listingId: 'demo-v27-laptop' } },
    update: { viewedAt: new Date() },
    create: { userId: buyer.id, listingId: 'demo-v27-laptop' },
  });

  const [userA, userB] = [buyer.id, seller.id].sort();
  const room = await prisma.chatRoom.upsert({
    where: { id: 'demo-v27-chat' },
    update: {},
    create: { id: 'demo-v27-chat', userAId: userA, userBId: userB },
  });
  await prisma.message.upsert({
    where: { id: 'demo-v27-message-1' },
    update: { content: 'Halo, bukunya masih ready untuk meetup besok?' },
    create: { id: 'demo-v27-message-1', chatRoomId: room.id, senderId: buyer.id, content: 'Halo, bukunya masih ready untuk meetup besok?', isRead: true },
  });
  await prisma.message.upsert({
    where: { id: 'demo-v27-message-2' },
    update: { content: 'Masih, bisa meetup di lobby Anggrek.' },
    create: { id: 'demo-v27-message-2', chatRoomId: room.id, senderId: seller.id, content: 'Masih, bisa meetup di lobby Anggrek.', isRead: false },
  });

  await prisma.notification.deleteMany({ where: { id: { startsWith: 'demo-v27-notification-' } } });
  await prisma.notification.createMany({ data: [
    { id: 'demo-v27-notification-1', userId: buyer.id, type: 'TRANSACTION', title: 'Transaksi selesai', body: 'Transaksi Buku Data Structures & Algorithms berhasil diselesaikan.', entityType: 'TRANSACTION', entityId: completed.id, isRead: false },
    { id: 'demo-v27-notification-2', userId: buyer.id, type: 'DISPUTE', title: 'Dispute sedang ditinjau', body: 'Admin akan meninjau dispute demo yang kamu ajukan.', entityType: 'DISPUTE', entityId: 'demo-v27-dispute', isRead: false },
    { id: 'demo-v27-notification-3', userId: seller.id, type: 'SYSTEM', title: 'Demo dataset aktif', body: 'Database ini berisi data demo BMarket v2.7.', entityType: 'SYSTEM', entityId: 'v2.7', isRead: true },
  ] });

  await prisma.walletLedger.upsert({
    where: { idempotencyKey: 'demo-v27-topup-buyer' },
    update: { balanceAfter: 5000000, escrowAfter: 0 },
    create: { userId: buyer.id, type: 'TOPUP', balanceDelta: 5000000, escrowDelta: 0, balanceAfter: 5000000, escrowAfter: 0, description: 'Saldo awal demo', idempotencyKey: 'demo-v27-topup-buyer' },
  });
  await prisma.walletLedger.upsert({
    where: { idempotencyKey: 'demo-v27-purchase-hold' },
    update: { balanceAfter: 4750000, escrowAfter: 250000 },
    create: { userId: buyer.id, transactionId: completed.id, type: 'PURCHASE_HOLD', balanceDelta: -250000, escrowDelta: 250000, balanceAfter: 4750000, escrowAfter: 250000, description: 'Demo escrow hold', idempotencyKey: 'demo-v27-purchase-hold' },
  });

  console.log('✅ Demo seed selesai.');
  console.log(`Admin   : demo.admin@binus.ac.id / ${password}`);
  console.log(`Student : demo.buyer@binus.ac.id / ${password}`);
  console.log(`Seller  : demo.seller@binus.ac.id / ${password}`);
  console.log('Dataset: listings multi-mode, transactions, review, dispute, reports, wishlist, notifications, wallet ledger, chat.');
}

main()
  .catch((error) => {
    console.error('❌ Demo seed error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
