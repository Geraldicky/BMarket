import { create, isAxiosError } from 'axios';
import Constants from 'expo-constants';
import { getStoredValue } from './token-storage';
import type { ActivityListingEntry, AdminListingPage, ApiEnvelope, ChatRoom, CheckoutOptions, Complaint, CourierProvider, Dispute, DisputeReason, FulfillmentMethod, Listing, ListingMode, ListingStatus, Message, Notification, Page, PreorderStatus, PublicProfile, Review, Transaction, TransactionStatus, User, WalletLedger } from '@/types';

export type AuthResult = { user: User; token: string };
export type VerificationPending = {
  verificationRequired: true;
  email: string;
  maskedEmail: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
};
export type PasswordResetPending = Omit<VerificationPending, 'verificationRequired'>;
export type PasswordResetAuthorization = { resetToken: string; expiresInSeconds: number };

const host = Constants.expoConfig?.hostUri?.split(':')[0];
export const API_URL = process.env.EXPO_PUBLIC_API_URL || `http://${host || 'localhost'}:3000/api`;
export const SOCKET_URL = API_URL.replace(/\/api\/?$/, '');
export const TOKEN_KEY = 'bmarket_access_token';
export const api = create({ baseURL: API_URL, timeout: 15000 });
api.interceptors.request.use(async config => { const token = await getStoredValue(TOKEN_KEY); if (token) config.headers.Authorization = `Bearer ${token}`; return config; });
const unwrap = <T>(response: { data: ApiEnvelope<T> }) => response.data.data;

export const endpoints = {
  login: (body: { email: string; password: string }) => api.post<ApiEnvelope<AuthResult>>('/auth/login', body).then(unwrap),
  register: (body: { email: string; password: string; name: string; studentId?: string }) => api.post<ApiEnvelope<VerificationPending>>('/auth/register', body).then(unwrap),
  verifyEmail: (body: { email: string; code: string }) => api.post<ApiEnvelope<AuthResult>>('/auth/verify-email', body).then(unwrap),
  resendVerification: (body: { email: string }) => api.post<ApiEnvelope<VerificationPending>>('/auth/resend-verification', body).then(unwrap),
  forgotPassword: (body: { email: string }) => api.post<ApiEnvelope<PasswordResetPending>>('/auth/forgot-password', body).then(unwrap),
  verifyResetCode: (body: { email: string; code: string }) => api.post<ApiEnvelope<PasswordResetAuthorization>>('/auth/verify-reset-code', body).then(unwrap),
  resetPassword: (body: { email: string; resetToken: string; password: string; confirmPassword: string }) => api.post<ApiEnvelope<{ passwordReset: true }>>('/auth/reset-password', body).then(unwrap),
  me: () => api.get<ApiEnvelope<User>>('/auth/me').then(unwrap),
  listings: (params?: Record<string, unknown>) => api.get<ApiEnvelope<Page<Listing>>>('/listings', { params }).then(unwrap),
  listing: (id: string) => api.get<ApiEnvelope<Listing>>(`/listings/${id}`).then(unwrap),
  myListings: () => api.get<ApiEnvelope<Listing[]>>('/listings/my/listings').then(unwrap),
  createListing: (body: Partial<Listing>) => api.post<ApiEnvelope<Listing>>('/listings', body).then(unwrap),
  updateListing: (id: string, body: Partial<Listing>) => api.put<ApiEnvelope<Listing>>(`/listings/${id}`, body).then(unwrap),
  deleteListing: (id: string) => api.delete(`/listings/${id}`),
  archiveInactiveListing: (id: string) => api.delete<ApiEnvelope<{ id: string; archived: true }>>(`/listings/${id}/archive`).then(unwrap),
  restockListing: (id: string, quantity: number) => api.post<ApiEnvelope<Listing>>(`/listings/${id}/restock`, { quantity }).then(unwrap),
  updatePreorderStatus: (id: string, status: PreorderStatus) => api.put<ApiEnvelope<Listing>>(`/listings/${id}/preorder-status`, { status }).then(unwrap),
  transactions: (role?: 'buyer' | 'seller') => api.get<ApiEnvelope<Transaction[]>>('/transactions', { params: role ? { role } : undefined }).then(unwrap),
  transaction: (id: string) => api.get<ApiEnvelope<Transaction>>(`/transactions/${id}`).then(unwrap),
  checkoutOptions: (listingId: string) => api.get<ApiEnvelope<CheckoutOptions>>(`/transactions/checkout-options/${listingId}`).then(unwrap),
  buy: (body: { listingId: string; quantity: number; note?: string; fulfillmentMethod: FulfillmentMethod; courierProvider?: CourierProvider; deliveryAddress?: string; recipientPhone?: string }) => api.post<ApiEnvelope<Transaction>>('/transactions', body).then(unwrap),
  pay: (id: string) => api.post<ApiEnvelope<Transaction>>(`/transactions/${id}/pay`).then(unwrap),
  issueHandoverCode: (id: string) => api.post<ApiEnvelope<{ code: string; expiresAt: string; expiresInSeconds: number }>>(`/transactions/${id}/handover-code`).then(unwrap),
  confirmHandover: (id: string, code: string) => api.post<ApiEnvelope<Transaction>>(`/transactions/${id}/confirm-handover`, { code }).then(unwrap),
  setTransactionStatus: (id: string, status: Exclude<TransactionStatus, 'PENDING' | 'PAID'>, cancellationReason?: string) => api.patch<ApiEnvelope<Transaction>>(`/transactions/${id}/status`, { status, cancellationReason }).then(unwrap),
  balance: () => api.get<ApiEnvelope<{ balance: number; escrow: number }>>('/transactions/balance').then(unwrap),
  topup: (amount: number) => api.post('/transactions/topup', { amount }),
  walletLedger: () => api.get<ApiEnvelope<WalletLedger[]>>('/transactions/wallet/ledger').then(unwrap),
  notifications: () => api.get<ApiEnvelope<Notification[]>>('/notifications').then(unwrap),
  notificationCount: () => api.get<ApiEnvelope<{ count: number }>>('/notifications/unread-count').then(unwrap),
  readNotification: (id: string) => api.patch(`/notifications/${id}/read`),
  readAllNotifications: () => api.patch('/notifications/read-all'),
  rooms: () => api.get<ApiEnvelope<ChatRoom[]>>('/chat/rooms').then(unwrap),
  createRoom: (otherUserId: string) => api.post<ApiEnvelope<ChatRoom>>('/chat/rooms', { otherUserId }).then(unwrap),
  messages: (roomId: string) => api.get<ApiEnvelope<Message[]>>(`/chat/rooms/${roomId}/messages`).then(unwrap),
  updateProfile: (body: Pick<User, 'name' | 'phone' | 'bio'>) => api.put<ApiEnvelope<User>>('/users/me', body).then(unwrap),
  userProfile: (id: string) => api.get<ApiEnvelope<PublicProfile>>(`/users/${id}`).then(unwrap),
  createReview: (body: { transactionId: string; rating: number; comment?: string }) => api.post<ApiEnvelope<Review>>('/reviews', body).then(unwrap),
  userReviews: (id: string) => api.get<{ success: boolean; reviews: Review[]; avgRating: number; totalReviews: number }>(`/reviews/user/${id}`).then(response => response.data),
  wishlist: () => api.get<ApiEnvelope<ActivityListingEntry[]>>('/activity/wishlist').then(unwrap),
  saveListing: (listingId: string) => api.post(`/activity/wishlist/${listingId}`),
  unsaveListing: (listingId: string) => api.delete(`/activity/wishlist/${listingId}`),
  savedStatus: (listingId: string) => api.get<ApiEnvelope<{ saved: boolean }>>(`/activity/wishlist/${listingId}/status`).then(unwrap),
  recentListings: () => api.get<ApiEnvelope<ActivityListingEntry[]>>('/activity/recent').then(unwrap),
  recordRecent: (listingId: string) => api.post(`/activity/recent/${listingId}`),
  report: (body: { targetType: 'USER' | 'LISTING'; targetId: string; reason: string; description?: string }) => api.post('/complaints', body),
  createDispute: (body: { transactionId: string; reason: DisputeReason; description: string; evidenceUrls?: string[] }) => api.post<ApiEnvelope<Dispute>>('/disputes', body).then(unwrap),
  myDisputes: () => api.get<ApiEnvelope<Dispute[]>>('/disputes/mine').then(unwrap),
  blockStatus: (userId: string) => api.get<ApiEnvelope<{ blocked: boolean }>>(`/safety/blocks/${userId}/status`).then(unwrap),
  blockUser: (userId: string) => api.post(`/safety/blocks/${userId}`),
  unblockUser: (userId: string) => api.delete(`/safety/blocks/${userId}`),
  blockedUsers: () => api.get<ApiEnvelope<{ id: string; blocked: Partial<User>; createdAt: string }[]>>('/safety/blocks').then(unwrap),
  upload: async (
    assets: { uri: string; fileName?: string | null; mimeType?: string | null; file?: File | null }[],
    onProgress?: (percent: number) => void,
  ) => {
    const form = new FormData();
    assets.forEach((asset, index) => {
      const name = asset.fileName || `image-${index}.jpg`;
      if (asset.file) form.append('images', asset.file, name);
      else form.append('images', {
        uri: asset.uri,
        name,
        type: asset.mimeType || 'image/jpeg',
      } as never);
    });
    return api.post<ApiEnvelope<{ urls: string[] }>>('/uploads/images', form, {
      onUploadProgress: event => {
        if (!event.total) return;
        onProgress?.(Math.min(86, Math.round((event.loaded / event.total) * 86)));
      },
    }).then(unwrap);
  },
  adminStats: () => api.get<ApiEnvelope<Record<string, number>>>('/admin/dashboard').then(unwrap),
  adminListings: (params?: { keyword?: string; status?: ListingStatus; type?: 'PRODUCT' | 'SERVICE'; mode?: ListingMode; category?: string; page?: number; limit?: number }) => api.get<ApiEnvelope<AdminListingPage>>('/admin/listings', { params }).then(unwrap),
  adminListingStatus: (id: string, status: 'ACTIVE' | 'HIDDEN' | 'REMOVED') => api.patch<ApiEnvelope<Listing>>(`/admin/listings/${id}/status`, { status }).then(unwrap),
  pendingListings: () => api.get<ApiEnvelope<Listing[]>>('/admin/listings/pending').then(unwrap),
  moderate: (id: string, action: 'approve' | 'reject') => api.patch(`/admin/listings/${id}/moderate`, { action }),
  adminUsers: () => api.get<ApiEnvelope<{ users: User[] }>>('/admin/users').then(unwrap),
  toggleUser: (id: string) => api.patch(`/admin/users/${id}/toggle`),
  complaints: (params?: { status?: string; targetType?: 'USER' | 'LISTING'; unresolved?: boolean }) => api.get<ApiEnvelope<Complaint[]>>('/admin/complaints', { params }).then(unwrap),
  adminDisputes: (status?: string) => api.get<ApiEnvelope<Dispute[]>>('/admin/disputes', { params: status ? { status } : undefined }).then(unwrap),
  resolveDispute: (id: string, action: 'START_REVIEW' | 'REFUND_BUYER' | 'RELEASE_SELLER' | 'REJECT', note?: string) => api.patch<ApiEnvelope<Dispute>>(`/admin/disputes/${id}`, { action, note }).then(unwrap),
  complaintStatus: (id: string, status: string, listingAction?: 'KEEP_ACTIVE' | 'HIDE_LISTING' | 'REMOVE_LISTING', adminNote?: string) => api.patch(`/admin/complaints/${id}`, { status, listingAction, adminNote }),
  commission: () => api.get<ApiEnvelope<{ rate: number }>>('/admin/commission').then(unwrap),
  setCommission: (rate: number) => api.patch('/admin/commission', { rate }),
};
export function errorMessage(error: unknown) { if (isAxiosError(error)) return error.response?.data?.message || error.message; return error instanceof Error ? error.message : 'Terjadi kesalahan. Coba lagi.'; }
export function errorCode(error: unknown): string | undefined { return isAxiosError(error) ? error.response?.data?.code : undefined; }
export function errorRetryAfter(error: unknown): number | undefined { return isAxiosError(error) ? error.response?.data?.retryAfterSeconds : undefined; }
