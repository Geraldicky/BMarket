// lib/screens/student/chat_list_screen.dart
// UC: Communicate with Buyer/Seller — Daftar Chat

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';
import '../../services/auth_provider.dart';
import '../../theme/app_theme.dart';
import '../../utils/format_utils.dart';
import 'chat_room_screen.dart';

class ChatListScreen extends StatefulWidget {
  const ChatListScreen({super.key});

  @override
  State<ChatListScreen> createState() => _ChatListScreenState();
}

class _ChatListScreenState extends State<ChatListScreen> {
  List<ChatRoomModel> _rooms = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _isLoading = true);
    try {
      final res = await ApiService.getChatRooms();
      final data = res['data'] as List;
      setState(() {
        _rooms = data.map((e) => ChatRoomModel.fromJson(e)).toList();
        _isLoading = false;
      });
    } catch (_) {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final myId = context.read<AuthProvider>().user?.id ?? '';

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Pesan')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : RefreshIndicator(
              color: AppColors.primary,
              onRefresh: _load,
              child: _rooms.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.chat_bubble_outline_rounded, size: 72, color: AppColors.grey300),
                          const SizedBox(height: 12),
                          Text('Belum ada pesan', style: Theme.of(context).textTheme.titleMedium?.copyWith(color: AppColors.grey500)),
                          const SizedBox(height: 4),
                          Text('Chat dimulai dari halaman produk', style: Theme.of(context).textTheme.bodySmall),
                        ],
                      ),
                    )
                  : ListView.separated(
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemCount: _rooms.length,
                      itemBuilder: (_, i) {
                        final room = _rooms[i];
                        final other = room.otherUser(myId);
                        final lastMsg = room.lastMessage;

                        return ListTile(
                          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          leading: Stack(
                            children: [
                              CircleAvatar(
                                radius: 26,
                                backgroundColor: AppColors.primaryLighter,
                                child: other?.avatarUrl != null
                                    ? ClipOval(child: Image.network(other!.avatarUrl!))
                                    : Text(
                                        other?.name[0].toUpperCase() ?? '?',
                                        style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.primary, fontSize: 18),
                                      ),
                              ),
                              if (room.unreadCount > 0)
                                Positioned(
                                  right: 0,
                                  top: 0,
                                  child: Container(
                                    padding: const EdgeInsets.all(4),
                                    decoration: const BoxDecoration(color: AppColors.error, shape: BoxShape.circle),
                                    child: Text(
                                      room.unreadCount > 9 ? '9+' : room.unreadCount.toString(),
                                      style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700),
                                    ),
                                  ),
                                ),
                            ],
                          ),
                          title: Text(
                            other?.name ?? '-',
                            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              fontWeight: room.unreadCount > 0 ? FontWeight.w700 : FontWeight.w500,
                            ),
                          ),
                          subtitle: lastMsg != null
                              ? Text(
                                  lastMsg.senderId == myId ? 'Kamu: ${lastMsg.content}' : lastMsg.content,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    
                                    fontSize: 13,
                                    color: room.unreadCount > 0 ? AppColors.textPrimary : AppColors.textSecondary,
                                    fontWeight: room.unreadCount > 0 ? FontWeight.w600 : FontWeight.normal,
                                  ),
                                )
                              : const Text('Mulai percakapan', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                          trailing: lastMsg != null
                              ? Text(FormatUtils.chatTime(lastMsg.createdAt), style: Theme.of(context).textTheme.bodySmall)
                              : null,
                          onTap: () async {
                            if (other == null) return;
                            await Navigator.of(context).push(
                              MaterialPageRoute(builder: (_) => ChatRoomScreen(roomId: room.id, otherUser: other)),
                            );
                            _load(); // Refresh setelah kembali
                          },
                        );
                      },
                    ),
            ),
    );
  }
}
