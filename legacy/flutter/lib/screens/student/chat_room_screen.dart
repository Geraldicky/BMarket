// lib/screens/student/chat_room_screen.dart
// UC: Communicate with Buyer/Seller — Chat real-time

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../../models/models.dart';
import '../../services/api_service.dart';
import '../../services/auth_provider.dart';
import '../../theme/app_theme.dart';
import '../../utils/format_utils.dart';

class ChatRoomScreen extends StatefulWidget {
  final String roomId;
  final UserModel otherUser;

  const ChatRoomScreen({super.key, required this.roomId, required this.otherUser});

  @override
  State<ChatRoomScreen> createState() => _ChatRoomScreenState();
}

class _ChatRoomScreenState extends State<ChatRoomScreen> {
  final _msgCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  List<MessageModel> _messages = [];
  IO.Socket? _socket;
  bool _isLoading = true;
  bool _otherTyping = false;
  String? _myId;

  @override
  void initState() {
    super.initState();
    _myId = context.read<AuthProvider>().user?.id;
    _loadMessages();
    _connectSocket();
  }

  @override
  void dispose() {
    _msgCtrl.dispose();
    _scrollCtrl.dispose();
    _socket?.emit('leave_room', widget.roomId);
    _socket?.disconnect();
    super.dispose();
  }

  Future<void> _loadMessages() async {
    try {
      final res = await ApiService.getRoomMessages(widget.roomId);
      final data = res['data'] as List;
      if (mounted) {
        setState(() {
          _messages = data.map((e) => MessageModel.fromJson(e as Map<String, dynamic>)).toList();
          _isLoading = false;
        });
        _scrollToBottom();
        // Pastikan join room setelah pesan dimuat
        // (socket mungkin sudah connect lebih dulu dari loadMessages selesai)
        if (_socket != null && _socket!.connected) {
          _socket!.emit('join_room', widget.roomId);
        }
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _connectSocket() async {
    final token = await ApiService.getToken();
    if (token == null) return;

    const socketUrl = 'http://10.0.2.2:3000';

    _socket = IO.io(
      socketUrl,
      IO.OptionBuilder()
          .setTransports(['polling', 'websocket'])
          .setAuth({'token': token})
          .enableAutoConnect()
          .enableReconnection()
          .setReconnectionAttempts(10)
          .setReconnectionDelay(1000)
          .build(),
    );

    _socket!.onConnect((_) {
      debugPrint('✅ Socket connected: ${_socket!.id}');
      // Join room setiap kali connect/reconnect
      _socket!.emit('join_room', widget.roomId);
    });

    _socket!.onReconnect((_) {
      debugPrint('🔄 Socket reconnected, rejoining room...');
      _socket!.emit('join_room', widget.roomId);
    });

    _socket!.onConnectError((err) {
      debugPrint('❌ Socket connect error: $err');
    });

    _socket!.onDisconnect((_) {
      debugPrint('⚠️ Socket disconnected');
    });

    _socket!.on('new_message', (data) {
      try {
        final msg = MessageModel.fromJson(Map<String, dynamic>.from(data as Map));
        if (!mounted) return;

        setState(() {
          // Hapus pesan optimistic sementara (temp_) jika ini adalah konfirmasi dari server
          // untuk pesan yang kita kirim sendiri
          if (msg.senderId == _myId) {
            _messages.removeWhere((m) => m.isPending);
          }
          // Tambah pesan dari server jika belum ada
          if (!_messages.any((m) => m.id == msg.id)) {
            _messages.add(msg);
          }
        });
        _scrollToBottom();
      } catch (e) {
        debugPrint('❌ Error parsing message: $e');
      }
    });

    _socket!.on('user_typing', (data) {
      try {
        final userId = (data as Map)['userId'];
        if (userId != _myId && mounted) {
          setState(() => _otherTyping = data['isTyping'] as bool? ?? false);
        }
      } catch (_) {}
    });

    _socket!.on('error', (data) {
      debugPrint('❌ Socket error: $data');
    });

    _socket!.connect();
  }

  void _sendMessage() {
    final content = _msgCtrl.text.trim();
    if (content.isEmpty) return;

    if (_socket == null || !(_socket!.connected)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Sedang menghubungkan... coba lagi sebentar'),
          duration: Duration(seconds: 2),
        ),
      );
      _socket?.connect();
      return;
    }

    // Pastikan sudah join room sebelum kirim
    _socket!.emit('join_room', widget.roomId);

    // Optimistic UI: tampilkan pesan segera di sisi pengirim
    final tempId = 'temp_${DateTime.now().millisecondsSinceEpoch}';
    final optimisticMsg = MessageModel(
      id: tempId,
      chatRoomId: widget.roomId,
      senderId: _myId ?? '',
      content: content,
      isRead: false,
      createdAt: DateTime.now(),
      isPending: true,
    );

    setState(() => _messages.add(optimisticMsg));
    _msgCtrl.clear();
    _stopTyping();
    _scrollToBottom();

    // Kirim ke server
    _socket!.emit('send_message', {'roomId': widget.roomId, 'content': content});
  }

  void _onTyping(String value) {
    if (value.isNotEmpty) {
      _socket?.emit('typing', {'roomId': widget.roomId, 'isTyping': true});
    } else {
      _stopTyping();
    }
  }

  void _stopTyping() {
    _socket?.emit('typing', {'roomId': widget.roomId, 'isTyping': false});
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.animateTo(
          _scrollCtrl.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        titleSpacing: 0,
        title: Row(
          children: [
            CircleAvatar(
              radius: 18,
              backgroundColor: Colors.white.withOpacity(0.3),
              child: widget.otherUser.avatarUrl != null
                  ? ClipOval(child: Image.network(widget.otherUser.avatarUrl!))
                  : Text(
                      widget.otherUser.name[0].toUpperCase(),
                      style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.primary),
                    ),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(widget.otherUser.name, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                if (_otherTyping)
                  const Text('sedang mengetik...', style: TextStyle(fontSize: 11, color: Colors.white70)),
              ],
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          // Messages list
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                : _messages.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.chat_bubble_outline_rounded, size: 56, color: AppColors.grey300),
                            const SizedBox(height: 8),
                            Text('Mulai percakapan', style: Theme.of(context).textTheme.bodyMedium),
                          ],
                        ),
                      )
                    : ListView.builder(
                        controller: _scrollCtrl,
                        padding: const EdgeInsets.all(16),
                        itemCount: _messages.length,
                        itemBuilder: (_, i) {
                          final msg = _messages[i];
                          final isMe = msg.senderId == _myId;
                          // Tampilkan tanggal separator jika hari berbeda
                          final showDate = i == 0 ||
                              !_isSameDay(_messages[i - 1].createdAt, msg.createdAt);

                          return Column(
                            children: [
                              if (showDate) _DateSeparator(date: msg.createdAt),
                              _MessageBubble(message: msg, isMe: isMe),
                            ],
                          );
                        },
                      ),
          ),

          // Typing indicator
          if (_otherTyping)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
              alignment: Alignment.centerLeft,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(color: AppColors.white, borderRadius: BorderRadius.circular(16)),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _TypingDot(delay: 0),
                    SizedBox(width: 3),
                    _TypingDot(delay: 150),
                    SizedBox(width: 3),
                    _TypingDot(delay: 300),
                  ],
                ),
              ),
            ),

          // Input bar
          Container(
            padding: EdgeInsets.fromLTRB(16, 8, 8, MediaQuery.of(context).viewInsets.bottom + 12),
            decoration: BoxDecoration(
              color: AppColors.white,
              boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 8, offset: const Offset(0, -2))],
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _msgCtrl,
                    onChanged: _onTyping,
                    maxLines: null,
                    textCapitalization: TextCapitalization.sentences,
                    decoration: InputDecoration(
                      hintText: 'Tulis pesan...',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: BorderSide.none),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: BorderSide.none),
                      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: BorderSide.none),
                      filled: true,
                      fillColor: AppColors.grey100,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: _sendMessage,
                  child: Container(
                    width: 44,
                    height: 44,
                    decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
                    child: const Icon(Icons.send_rounded, color: Colors.white, size: 20),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  bool _isSameDay(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month && a.day == b.day;
}

class _MessageBubble extends StatelessWidget {
  final MessageModel message;
  final bool isMe;
  const _MessageBubble({required this.message, required this.isMe});

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 6),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.72),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          // Pesan pending tampil sedikit transparan
          color: isMe
              ? (message.isPending ? AppColors.primaryLight.withOpacity(0.8) : AppColors.primary)
              : AppColors.white,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(16),
            topRight: const Radius.circular(16),
            bottomLeft: Radius.circular(isMe ? 16 : 4),
            bottomRight: Radius.circular(isMe ? 4 : 16),
          ),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 4, offset: const Offset(0, 2))],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              message.content,
              style: TextStyle(fontFamily: 'Poppins', fontSize: 14, color: isMe ? Colors.white : AppColors.textPrimary),
            ),
            const SizedBox(height: 4),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  FormatUtils.time(message.createdAt),
                  style: TextStyle(fontFamily: 'Poppins', fontSize: 10, color: isMe ? Colors.white60 : AppColors.textHint),
                ),
                if (isMe) ...[
                  const SizedBox(width: 4),
                  Icon(
                    message.isPending ? Icons.access_time_rounded : Icons.done_rounded,
                    size: 11,
                    color: Colors.white60,
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _DateSeparator extends StatelessWidget {
  final DateTime date;
  const _DateSeparator({required this.date});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          decoration: BoxDecoration(color: AppColors.grey200, borderRadius: BorderRadius.circular(20)),
          child: Text(FormatUtils.date(date), style: Theme.of(context).textTheme.labelSmall?.copyWith(color: AppColors.grey600)),
        ),
      ),
    );
  }
}

class _TypingDot extends StatefulWidget {
  final int delay;
  const _TypingDot({required this.delay});

  @override
  State<_TypingDot> createState() => _TypingDotState();
}

class _TypingDotState extends State<_TypingDot> with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 600));
    _anim = Tween<double>(begin: 0.4, end: 1).animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut));
    Future.delayed(Duration(milliseconds: widget.delay), () {
      if (mounted) _ctrl.repeat(reverse: true);
    });
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _anim,
      child: const CircleAvatar(radius: 4, backgroundColor: AppColors.grey500),
    );
  }
}
