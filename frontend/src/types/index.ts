export type Role = 'STUDENT' | 'ADMIN';
export type ListingStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SOLD' | 'INACTIVE' | 'HIDDEN' | 'REMOVED';
export type ListingMode = 'ONE_OFF' | 'STOCKED' | 'PREORDER' | 'SERVICE';
export type PreorderStatus = 'OPEN' | 'CLOSED' | 'PROCESSING' | 'READY' | 'COMPLETED' | 'CANCELLED';
export type ComplaintStatus = 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED';
export type TransactionStatus = 'PENDING' | 'PAID' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
export type FulfillmentMethod = 'CAMPUS_MEETUP' | 'INSTANT_COURIER';
export type DisputeStatus = 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'REJECTED';
export type DisputeReason = 'ITEM_NOT_AS_DESCRIBED' | 'ITEM_DAMAGED' | 'NOT_RECEIVED' | 'SELLER_NO_SHOW' | 'BUYER_NO_SHOW' | 'OTHER';
export type DisputeResolution = 'REFUND_BUYER' | 'RELEASE_SELLER' | 'REJECT_DISPUTE';
export type CourierProvider = 'GOSEND' | 'GRABEXPRESS';

export interface User {
  id: string;
  email: string;
  name: string;
  studentId?: string | null;
  phone?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  role: Role;
  isVerified?: boolean;
  isActive?: boolean;
  balance?: number | string;
  escrow?: number | string;
  createdAt?: string;
  _count?: Record<string, number>;
}

export interface Listing {
  id: string;
  title: string;
  description: string;
  price: number | string;
  category: string;
  type: 'PRODUCT' | 'SERVICE';
  mode: ListingMode;
  images: string[];
  status: ListingStatus;
  condition?: string | null;
  stock?: number | null;
  stockLeft?: number | null;
  inventoryState?: 'AVAILABLE' | 'OUT_OF_STOCK' | 'SOLD' | 'PREORDER_OPEN' | 'PREORDER_CLOSED' | 'SERVICE';
  preorderAccepting?: boolean;
  preorderStatus?: PreorderStatus | null;
  preorderDeadline?: string | null;
  preorderReadyAt?: string | null;
  preorderQuota?: number | null;
  preorderMinOrder?: number | null;
  preorderMaxPerBuyer?: number | null;
  preorderPickupLocation?: string | null;
  preorderPickupNote?: string | null;
  fulfillmentMethods: FulfillmentMethod[];
  sellerId: string;
  seller?: Partial<User>;
  createdAt: string;
  openReportCount?: number;
}

export interface Review {
  id: string;
  transactionId?: string;
  reviewerId?: string;
  revieweeId?: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
  reviewer?: Partial<User>;
  listingTitle?: string;
}

export interface PublicProfile {
  id: string;
  name: string;
  avatarUrl?: string | null;
  bio?: string | null;
  isVerified?: boolean;
  createdAt: string;
  avgRating: number;
  totalReviews: number;
  completedSales: number;
  activeListingCount: number;
  listings: Listing[];
  reviews: Review[];
}

export interface Dispute {
  id: string;
  transactionId: string;
  openedById: string;
  reason: DisputeReason;
  description: string;
  evidenceUrls: string[];
  status: DisputeStatus;
  resolution?: DisputeResolution | null;
  resolutionNote?: string | null;
  refundAmount?: number | string | null;
  resolvedAt?: string | null;
  createdAt: string;
  openedBy?: Partial<User>;
  resolvedBy?: Partial<User> | null;
  transaction?: Transaction;
}

export interface Transaction {
  id: string;
  buyerId: string;
  sellerId: string;
  status: TransactionStatus;
  quantity: number;
  price: number | string;
  totalPrice: number | string;
  fulfillmentMethod: FulfillmentMethod;
  meetupCampus?: string | null;
  meetupLocation?: string | null;
  meetupSchedule?: string | null;
  courierProvider?: CourierProvider | null;
  deliveryAddress?: string | null;
  recipientPhone?: string | null;
  shippingFee: number | string;
  grandTotal: number | string;
  trackingNumber?: string | null;
  handoverCodeExpiresAt?: string | null;
  handoverVerifiedAt?: string | null;
  commissionRate: number | string;
  commissionAmt: number | string;
  sellerReceives: number | string;
  isEscrowHeld: boolean;
  note?: string | null;
  paidAt?: string | null;
  confirmedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  cancelledBy?: 'BUYER' | 'SELLER' | 'SYSTEM' | 'ADMIN' | null;
  cancellationReason?: string | null;
  reservationExpiresAt?: string | null;
  listingTitleSnapshot?: string | null;
  listingImageSnapshot?: string | null;
  listingTypeSnapshot?: 'PRODUCT' | 'SERVICE' | null;
  listingModeSnapshot?: ListingMode | null;
  listingConditionSnapshot?: string | null;
  createdAt: string;
  updatedAt?: string;
  listing: Listing;
  buyer: Partial<User>;
  seller: Partial<User>;
  review?: Review | null;
  dispute?: Dispute | null;
}

export interface CheckoutOptions {
  fulfillmentMethods: FulfillmentMethod[];
  couriers: { provider: CourierProvider; label: string; fee: number; eta: string }[];
}

export interface Message {
  id: string;
  chatRoomId: string;
  senderId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  sender?: Partial<User>;
}

export interface ChatRoom {
  id: string;
  userAId: string;
  userBId: string;
  userA: Partial<User>;
  userB: Partial<User>;
  unreadCount: number;
  messages: Message[];
  updatedAt?: string;
  createdAt: string;
}

export interface Complaint {
  id: string;
  reporterId: string;
  targetType: 'USER' | 'LISTING';
  targetId: string;
  reason: string;
  description?: string | null;
  status: ComplaintStatus;
  adminNote?: string | null;
  createdAt: string;
  updatedAt: string;
  reporter?: Partial<User>;
  targetListing?: Listing | null;
  targetUser?: Partial<User> | null;
}


export type NotificationType = 'TRANSACTION' | 'CHAT' | 'REVIEW' | 'DISPUTE' | 'SYSTEM';
export type LedgerType = 'TOPUP' | 'PURCHASE_HOLD' | 'REFUND' | 'ESCROW_RELEASE' | 'SELLER_PAYOUT';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  entityType?: string | null;
  entityId?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface WalletLedger {
  id: string;
  userId: string;
  transactionId?: string | null;
  type: LedgerType;
  balanceDelta: number | string;
  escrowDelta: number | string;
  balanceAfter: number | string;
  escrowAfter: number | string;
  description?: string | null;
  createdAt: string;
}

export interface ApiEnvelope<T> { success: boolean; data: T; message?: string; }
export interface Page<T> { data: T[]; total: number; page: number; limit: number; totalPages: number; }

export interface AdminListingSummary {
  total: number;
  active: number;
  hidden: number;
  removed: number;
  sold: number;
  inactive: number;
  pending: number;
  rejected: number;
}

export interface AdminListingPage extends Page<Listing> {
  summary: AdminListingSummary;
}

export interface ActivityListingEntry {
  id: string;
  createdAt?: string;
  viewedAt?: string;
  listing: Listing;
}
