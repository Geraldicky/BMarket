// lib/models/user.model.dart
class UserModel {
  final String id;
  final String email;
  final String name;
  final String? studentId;
  final String? phone;
  final String? bio;
  final String? avatarUrl;
  final String role; // 'STUDENT' | 'ADMIN'
  final bool isVerified;
  final double? avgRating;
  final int? reviewCount;

  UserModel({
    required this.id,
    required this.email,
    required this.name,
    this.studentId,
    this.phone,
    this.bio,
    this.avatarUrl,
    required this.role,
    required this.isVerified,
    this.avgRating,
    this.reviewCount,
  });

  bool get isAdmin => role == 'ADMIN';

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] as String? ?? '',
      // email bisa null kalau data dari seller di listing (partial select)
      email: json['email'] as String? ?? '',
      name: json['name'] as String? ?? '',
      studentId: json['studentId'] as String?,
      phone: json['phone'] as String?,
      bio: json['bio'] as String?,
      avatarUrl: json['avatarUrl'] as String?,
      // role bisa null kalau data partial, default ke STUDENT
      role: json['role'] as String? ?? 'STUDENT',
      isVerified: json['isVerified'] as bool? ?? false,
      avgRating: (json['avgRating'] as num?)?.toDouble(),
      reviewCount: json['reviewCount'] as int?,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id, 'email': email, 'name': name,
    'studentId': studentId, 'phone': phone, 'bio': bio,
    'avatarUrl': avatarUrl, 'role': role, 'isVerified': isVerified,
  };
}

// lib/models/listing.model.dart
class ListingModel {
  final String id;
  final String title;
  final String description;
  final double price;
  final String category;
  final String type; // 'PRODUCT' | 'SERVICE'
  final List<String> images;
  final String status;
  final String? condition;
  final int? stock;      // Stok awal
  final int? stockLeft;  // Stok tersisa
  final String sellerId;
  final UserModel? seller;
  final DateTime createdAt;

  ListingModel({
    required this.id,
    required this.title,
    required this.description,
    required this.price,
    required this.category,
    required this.type,
    required this.images,
    required this.status,
    this.condition,
    this.stock,
    this.stockLeft,
    required this.sellerId,
    this.seller,
    required this.createdAt,
  });

  factory ListingModel.fromJson(Map<String, dynamic> json) {
    // images dari backend berupa JSON string: '["url1","url2"]'
    // perlu di-decode dulu sebelum dipakai
    List<String> parseImages(dynamic raw) {
      if (raw == null) return [];
      if (raw is List) return List<String>.from(raw);
      if (raw is String) {
        try {
          final decoded = raw
              .replaceAll('[', '')
              .replaceAll(']', '')
              .replaceAll('"', '')
              .trim();
          if (decoded.isEmpty) return [];
          return decoded.split(',').where((s) => s.trim().isNotEmpty).toList();
        } catch (_) {
          return [];
        }
      }
      return [];
    }

    return ListingModel(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      description: json['description'] as String? ?? '',
      price: double.parse((json['price'] ?? 0).toString()),
      category: json['category'] as String? ?? 'OTHER',
      type: json['type'] as String? ?? 'PRODUCT',
      images: parseImages(json['images']),
      status: json['status'] as String? ?? 'PENDING',
      condition: json['condition'] as String?,
      stock: json['stock'] as int?,
      stockLeft: json['stockLeft'] as int?,
      sellerId: json['sellerId'] as String? ?? '',
      seller: json['seller'] != null ? UserModel.fromJson(json['seller'] as Map<String, dynamic>) : null,
      createdAt: json['createdAt'] != null ? DateTime.parse(json['createdAt']) : DateTime.now(),
    );
  }

  String get statusLabel {
    switch (status) {
      case 'PENDING': return 'Menunggu Review';
      case 'ACTIVE': return 'Aktif';
      case 'REJECTED': return 'Ditolak';
      case 'SOLD': return 'Terjual';
      case 'INACTIVE': return 'Nonaktif';
      default: return status;
    }
  }

  String get categoryLabel {
    switch (category) {
      case 'ELECTRONICS': return 'Elektronik';
      case 'BOOKS': return 'Buku';
      case 'FASHION': return 'Fashion';
      case 'FOOD': return 'Makanan';
      case 'SERVICES': return 'Jasa';
      case 'SPORTS': return 'Olahraga';
      default: return 'Lainnya';
    }
  }

  bool get hasStock => type == 'PRODUCT' && stock != null;
  bool get isOutOfStock => hasStock && (stockLeft ?? 0) <= 0;
  int get availableStock => stockLeft ?? 0;
}

// lib/models/transaction.model.dart
class TransactionModel {
  final String id;
  final String listingId;
  final Map<String, dynamic>? listing;
  final String buyerId;
  final UserModel? buyer;
  final String sellerId;
  final UserModel? seller;
  final String status;
  final String? note;
  final double price;       // Harga satuan
  final int quantity;       // Jumlah yang dibeli
  final double totalPrice;  // Total = price x quantity
  final double? commissionRate;
  final double? commissionAmt;
  final double? sellerReceives;
  final bool isEscrowHeld;
  final DateTime createdAt;
  final ReviewModel? review;

  TransactionModel({
    required this.id,
    required this.listingId,
    this.listing,
    required this.buyerId,
    this.buyer,
    required this.sellerId,
    this.seller,
    required this.status,
    this.note,
    required this.price,
    this.quantity = 1,
    required this.totalPrice,
    this.commissionRate,
    this.commissionAmt,
    this.sellerReceives,
    this.isEscrowHeld = false,
    required this.createdAt,
    this.review,
  });

  factory TransactionModel.fromJson(Map<String, dynamic> json) {
    final price = double.parse((json['price'] ?? 0).toString());
    final quantity = json['quantity'] as int? ?? 1;
    final totalPrice = json['totalPrice'] != null
        ? double.parse(json['totalPrice'].toString())
        : price * quantity;

    return TransactionModel(
      id: json['id'] as String? ?? '',
      listingId: json['listingId'] as String? ?? '',
      listing: json['listing'] as Map<String, dynamic>?,
      buyerId: json['buyerId'] as String? ?? '',
      buyer: json['buyer'] != null ? UserModel.fromJson(json['buyer']) : null,
      sellerId: json['sellerId'] as String? ?? '',
      seller: json['seller'] != null ? UserModel.fromJson(json['seller']) : null,
      status: json['status'] as String? ?? 'PENDING',
      note: json['note'] as String?,
      price: price,
      quantity: quantity,
      totalPrice: totalPrice,
      commissionRate: json['commissionRate'] != null
          ? double.parse(json['commissionRate'].toString()) : null,
      commissionAmt: json['commissionAmt'] != null
          ? double.parse(json['commissionAmt'].toString()) : null,
      sellerReceives: json['sellerReceives'] != null
          ? double.parse(json['sellerReceives'].toString()) : null,
      isEscrowHeld: json['isEscrowHeld'] as bool? ?? false,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt']) : DateTime.now(),
      review: json['review'] != null ? ReviewModel.fromJson(json['review']) : null,
    );
  }

  String get statusLabel {
    switch (status) {
      case 'PENDING': return 'Menunggu Pembayaran';
      case 'PAID': return 'Sudah Dibayar';
      case 'CONFIRMED': return 'Dikonfirmasi Seller';
      case 'COMPLETED': return 'Selesai';
      case 'CANCELLED': return 'Dibatalkan';
      default: return status;
    }
  }

  bool get canPay => status == 'PENDING';
  bool get buyerCanCancel => status == 'PENDING' || status == 'PAID';
  bool get sellerCanConfirm => status == 'PAID';
  bool get sellerCanComplete => status == 'CONFIRMED';
  bool get sellerCanCancel => status == 'PAID' || status == 'CONFIRMED';
  bool get canReview => status == 'COMPLETED' && review == null;
}

// lib/models/review.model.dart
class ReviewModel {
  final String id;
  final String transactionId;
  final String reviewerId;
  final UserModel? reviewer;
  final int rating;
  final String? comment;
  final DateTime createdAt;

  ReviewModel({
    required this.id,
    required this.transactionId,
    required this.reviewerId,
    this.reviewer,
    required this.rating,
    this.comment,
    required this.createdAt,
  });

  factory ReviewModel.fromJson(Map<String, dynamic> json) {
    return ReviewModel(
      id: json['id'],
      transactionId: json['transactionId'],
      reviewerId: json['reviewerId'],
      reviewer: json['reviewer'] != null ? UserModel.fromJson(json['reviewer']) : null,
      rating: json['rating'],
      comment: json['comment'],
      createdAt: DateTime.parse(json['createdAt']),
    );
  }
}

// lib/models/message.model.dart
class MessageModel {
  final String id;
  final String chatRoomId;
  final String senderId;
  final UserModel? sender;
  final String content;
  final bool isRead;
  final DateTime createdAt;
  final bool isPending; // true = pesan optimistic belum dikonfirmasi server

  MessageModel({
    required this.id,
    required this.chatRoomId,
    required this.senderId,
    this.sender,
    required this.content,
    required this.isRead,
    required this.createdAt,
    this.isPending = false,
  });

  factory MessageModel.fromJson(Map<String, dynamic> json) {
    return MessageModel(
      id: json['id'] as String? ?? '',
      chatRoomId: json['chatRoomId'] as String? ?? '',
      senderId: json['senderId'] as String? ?? '',
      sender: json['sender'] != null ? UserModel.fromJson(json['sender'] as Map<String, dynamic>) : null,
      content: json['content'] as String? ?? '',
      isRead: json['isRead'] as bool? ?? false,
      createdAt: json['createdAt'] != null ? DateTime.parse(json['createdAt']) : DateTime.now(),
      isPending: false,
    );
  }
}

// lib/models/chat_room.model.dart
class ChatRoomModel {
  final String id;
  final UserModel? userA;
  final UserModel? userB;
  final List<MessageModel> messages;
  final int unreadCount;

  ChatRoomModel({
    required this.id,
    this.userA,
    this.userB,
    required this.messages,
    required this.unreadCount,
  });

  factory ChatRoomModel.fromJson(Map<String, dynamic> json) {
    return ChatRoomModel(
      id: json['id'],
      userA: json['userA'] != null ? UserModel.fromJson(json['userA']) : null,
      userB: json['userB'] != null ? UserModel.fromJson(json['userB']) : null,
      messages: (json['messages'] as List? ?? [])
          .map((m) => MessageModel.fromJson(m))
          .toList(),
      unreadCount: json['unreadCount'] ?? 0,
    );
  }

  MessageModel? get lastMessage => messages.isNotEmpty ? messages.last : null;

  UserModel? otherUser(String myId) => userA?.id == myId ? userB : userA;
}
