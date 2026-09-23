import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const repo = path.resolve(process.cwd(), '..');
const out = path.join(repo, 'poster-output', 'assets', 'screenshots');
await mkdir(out, { recursive: true });

const now = new Date().toISOString();
const user = { id: 'poster-buyer', email: 'kevin@binus.ac.id', name: 'Kevin', studentId: '270000001', role: 'STUDENT', isVerified: true, balance: 4750000, escrow: 250000, createdAt: now };
const sellers = {
  gerrad: { id: '5c472f13-0394-4bfd-8727-41aa81bcf296', name: 'Gerrad Geraldicky', isVerified: true },
  nadia: { id: 'demo-seller', name: 'Nadia Seller', isVerified: true },
  raka: { id: 'demo-seller-2', name: 'Raka Merchant', isVerified: true },
};
const image = label => {
  const safeLabel = String(label).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><rect width="1200" height="900" fill="#eaf3ff"/><rect x="72" y="72" width="1056" height="756" rx="56" fill="#fff" stroke="#c8e0fa" stroke-width="8"/><circle cx="600" cy="350" r="110" fill="#ddeeff"/><path d="M550 405h100V295H550z" fill="#1167d8"/><text x="600" y="575" text-anchor="middle" font-family="Arial,sans-serif" font-size="54" font-weight="700" fill="#0c4fa8">${safeLabel}</text><text x="600" y="650" text-anchor="middle" font-family="Arial,sans-serif" font-size="28" fill="#4a6072">Demo BMarket</text></svg>`;
  return [`data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`];
};
const listings = [
  { id: 'e069f941-10ef-4da0-a9f9-314f69e7c250', title: 'iPad', description: 'iPad kondisi baik untuk kuliah, mencatat, dan kebutuhan organisasi.', price: 100000, category: 'ELECTRONICS', type: 'PRODUCT', mode: 'ONE_OFF', condition: 'GOOD', images: image('iPad'), fulfillmentMethods: ['CAMPUS_MEETUP'], sellerId: sellers.gerrad.id, seller: sellers.gerrad, status: 'ACTIVE', stock: 1, stockLeft: 1, inventoryState: 'AVAILABLE', createdAt: now },
  { id: 'demo-laptop', title: 'MacBook Air M2 13-inch', description: 'Unit preloved, kondisi sangat baik, charger lengkap.', price: 10900000, category: 'ELECTRONICS', type: 'PRODUCT', mode: 'ONE_OFF', condition: 'LIKE_NEW', images: image('MacBook Air M2'), fulfillmentMethods: ['CAMPUS_MEETUP'], sellerId: sellers.nadia.id, seller: sellers.nadia, status: 'ACTIVE', stock: 1, stockLeft: 1, inventoryState: 'AVAILABLE', createdAt: now },
  { id: 'demo-book', title: 'Buku Data Structures & Algorithms', description: 'Ready stock untuk kebutuhan kuliah semester awal.', price: 125000, category: 'BOOKS', type: 'PRODUCT', mode: 'STOCKED', condition: 'GOOD', images: image('Data Structures Book'), fulfillmentMethods: ['CAMPUS_MEETUP'], sellerId: sellers.nadia.id, seller: sellers.nadia, status: 'ACTIVE', stock: 12, stockLeft: 8, inventoryState: 'AVAILABLE', createdAt: now },
  { id: 'demo-food', title: 'Rice Bowl Ayam Mentai', description: 'Ready stock harian untuk makan siang di kampus.', price: 28000, category: 'FOOD', type: 'PRODUCT', mode: 'STOCKED', images: image('Rice Bowl Mentai'), fulfillmentMethods: ['CAMPUS_MEETUP'], sellerId: sellers.raka.id, seller: sellers.raka, status: 'ACTIVE', stock: 30, stockLeft: 21, inventoryState: 'AVAILABLE', createdAt: now },
  { id: 'demo-preorder', title: 'PO Hoodie Angkatan 2026', description: 'Pre-order hoodie angkatan dengan pickup di kampus.', price: 185000, category: 'FASHION', type: 'PRODUCT', mode: 'PREORDER', images: image('Hoodie Angkatan 2026'), fulfillmentMethods: ['CAMPUS_MEETUP'], sellerId: sellers.nadia.id, seller: sellers.nadia, status: 'ACTIVE', stock: 40, stockLeft: 27, inventoryState: 'PREORDER_OPEN', preorderAccepting: true, preorderStatus: 'OPEN', preorderDeadline: new Date(Date.now()+7*86400000).toISOString(), preorderReadyAt: new Date(Date.now()+14*86400000).toISOString(), preorderQuota: 40, preorderMinOrder: 10, preorderMaxPerBuyer: 3, preorderPickupLocation: 'BINUS Anggrek Lobby', createdAt: now },
  { id: 'demo-service', title: 'Jasa Desain Poster Organisasi', description: 'Desain poster event dan kebutuhan organisasi kampus.', price: 90000, category: 'SERVICES', type: 'SERVICE', mode: 'SERVICE', images: image('Jasa Desain Poster'), fulfillmentMethods: [], sellerId: sellers.raka.id, seller: sellers.raka, status: 'ACTIVE', inventoryState: 'SERVICE', createdAt: now },
];

const envelope = data => ({ success: true, data });
async function installMockApi(page) {
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    const p = url.pathname.replace(/^\/api/, '');
    let data;
    if (p === '/auth/login') data = { user, token: 'poster-capture-token' };
    else if (p === '/auth/me') data = user;
    else if (p === '/listings') data = { data: listings, total: listings.length, page: 1, limit: 48, totalPages: 1 };
    else if (p.startsWith('/listings/')) data = listings.find(item => item.id === decodeURIComponent(p.split('/').pop())) || listings[0];
    else if (p === '/activity/wishlist') data = [];
    else if (p === '/activity/recent') data = [];
    else if (p.includes('/activity/wishlist/') && p.endsWith('/status')) data = { saved: false };
    else if (p === '/notifications/unread-count') data = { count: 0 };
    else if (p.startsWith('/users/')) data = { ...sellers.gerrad, bio: 'Binusian seller', createdAt: now, avgRating: 4.9, totalReviews: 8, completedSales: 12, activeListingCount: 1, listings: [listings[0]], reviews: [] };
    else data = {};
    await route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify(envelope(data)) });
  });
}

async function capture(viewport, scale, suffix) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: scale });
  const page = await context.newPage();
  await installMockApi(page);
  await page.goto(process.env.PLAYWRIGHT_BASE_URL || 'https://binus-market.vercel.app', { waitUntil: 'networkidle', timeout: 90_000 });
  await page.getByPlaceholder('nama@binus.ac.id').fill('kevin@binus.ac.id');
  await page.getByPlaceholder('Masukkan password').fill('poster-capture');
  await page.getByText('Masuk', { exact: true }).last().click();
  await page.getByText('Baru di BMarket', { exact: true }).waitFor({ timeout: 45_000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(out, `marketplace-home-${suffix}.png`), fullPage: false });

  await page.getByText('iPad', { exact: true }).first().click();
  await page.getByText('SELLER TERVERIFIKASI', { exact: true }).waitFor({ timeout: 30_000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(out, `listing-ipad-${suffix}.png`), fullPage: false });

  await page.getByText('Lanjut ke checkout', { exact: true }).click();
  await page.getByText('Periksa pesananmu', { exact: true }).waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1600);
  await page.screenshot({ path: path.join(out, `checkout-${suffix}.png`), fullPage: false });
  await context.close();
}

const browser = await chromium.launch({ headless: true });
await capture({ width: 1440, height: 1000 }, 1.5, 'desktop');
await capture({ width: 430, height: 932 }, 2, 'mobile');
await browser.close();
console.log('Captured authentic BMarket UI with repository/demo data and the live listing image.');
