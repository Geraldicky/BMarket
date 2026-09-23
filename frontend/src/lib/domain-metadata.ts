export const CATEGORY_METADATA = {
  ELECTRONICS: { label: 'Elektronik', icon: 'game-controller-outline', color: '#5F72E0' },
  BOOKS: { label: 'Buku', icon: 'book-outline', color: '#E0801F' },
  FASHION: { label: 'Fashion', icon: 'shirt-outline', color: '#A064D6' },
  FOOD: { label: 'Makanan', icon: 'fast-food-outline', color: '#DE6155' },
  SERVICES: { label: 'Jasa', icon: 'construct-outline', color: '#1F9C80' },
  SPORTS: { label: 'Olahraga', icon: 'basketball-outline', color: '#D0961E' },
  OTHER: { label: 'Lainnya', icon: 'apps-outline', color: '#7C8EA2' },
} as const;

export type ListingCategory = keyof typeof CATEGORY_METADATA;

export const PRODUCT_CATEGORIES = ['ELECTRONICS', 'BOOKS', 'FASHION', 'FOOD', 'SPORTS', 'OTHER'] as const;

export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_METADATA).map(([key, value]) => [key, value.label]),
);

export const CONDITION_LABELS: Record<string, string> = {
  NEW: 'Baru', LIKE_NEW: 'Seperti baru', GOOD: 'Kondisi baik', FAIR: 'Cukup baik',
};

export const LISTING_MODE_LABELS: Record<string, string> = {
  ONE_OFF: 'BARANG SATUAN', STOCKED: 'PRODUK STOK', PREORDER: 'PRE-ORDER', SERVICE: 'JASA',
};

export const DISPUTE_REASON_OPTIONS = [
  { value: 'ITEM_NOT_AS_DESCRIBED', label: 'Barang tidak sesuai deskripsi' },
  { value: 'ITEM_DAMAGED', label: 'Barang rusak' },
  { value: 'NOT_RECEIVED', label: 'Barang tidak diterima' },
  { value: 'SELLER_NO_SHOW', label: 'Seller tidak hadir' },
  { value: 'BUYER_NO_SHOW', label: 'Buyer tidak hadir' },
  { value: 'OTHER', label: 'Masalah lainnya' },
] as const;
