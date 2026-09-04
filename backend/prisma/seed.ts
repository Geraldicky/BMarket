// prisma/seed.ts
// Data awal untuk development & testing

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('🌱 Seeding database...');

  const hashedPassword = await bcrypt.hash('password123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@binus.ac.id' },
    update: {},
    create: {
      email: 'admin@binus.ac.id',
      password: hashedPassword,
      name: 'Admin BINUS',
      role: 'ADMIN',
      isVerified: true,
    },
  });

  const student1 = await prisma.user.upsert({
    where: { email: 'alice@binus.ac.id' },
    update: {},
    create: {
      email: 'alice@binus.ac.id',
      password: hashedPassword,
      name: 'Alice Putri',
      studentId: '2440001234',
      role: 'STUDENT',
      isVerified: true,
      bio: 'Mahasiswa teknik informatika semester 5',
      balance: 5000000, // Saldo awal simulasi Rp 5.000.000
    },
  });

  const student2 = await prisma.user.upsert({
    where: { email: 'bob@binus.ac.id' },
    update: {},
    create: {
      email: 'bob@binus.ac.id',
      password: hashedPassword,
      name: 'Bob Santoso',
      studentId: '2440005678',
      role: 'STUDENT',
      isVerified: true,
      balance: 5000000, // Saldo awal simulasi Rp 5.000.000
    },
  });

  await prisma.listing.create({
    data: {
      title: 'Laptop Asus VivoBook 14',
      description: 'Laptop bekas kondisi baik, Core i5 Gen 11, RAM 8GB, SSD 512GB.',
      price: 4500000,
      category: 'ELECTRONICS',
      type: 'PRODUCT',
      condition: 'GOOD',
      status: 'ACTIVE',
      sellerId: student1.id,
      images: '[]',
      stock: 3,
      stockLeft: 3,
    },
  });

  await prisma.listing.create({
    data: {
      title: 'Jasa Edit Video Tugas Kuliah',
      description: 'Menerima jasa edit video untuk tugas kuliah. Pengerjaan 1-3 hari.',
      price: 75000,
      category: 'SERVICES',
      type: 'SERVICE',
      status: 'ACTIVE',
      sellerId: student1.id,
      images: '[]',
      // Jasa tidak punya stock
    },
  });

  await prisma.listing.create({
    data: {
      title: 'Buku Algoritma & Pemrograman',
      description: 'Buku kuliah semester 1-2, kondisi masih bagus.',
      price: 120000,
      category: 'BOOKS',
      type: 'PRODUCT',
      condition: 'LIKE_NEW',
      status: 'ACTIVE',
      sellerId: student2.id,
      images: '[]',
      stock: 5,
      stockLeft: 5,
    },
  });

  await prisma.listing.create({
    data: {
      title: 'Tas Kuliah Branded',
      description: 'Tas kuliah kondisi baru, belum pernah dipakai.',
      price: 250000,
      category: 'FASHION',
      type: 'PRODUCT',
      condition: 'LIKE_NEW',
      status: 'ACTIVE',
      sellerId: student2.id,
      images: '[]',
    },
  });

  console.log('✅ Seed selesai!');
  console.log('📧 Admin    : admin@binus.ac.id  | password: password123');
  console.log('📧 Student 1: alice@binus.ac.id  | password: password123');
  console.log('📧 Student 2: bob@binus.ac.id    | password: password123');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
