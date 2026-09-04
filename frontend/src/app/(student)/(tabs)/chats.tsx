import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { io, Socket } from 'socket.io-client';
import { Card, Empty, ErrorState, Field, InlineAlert, Loader, Screen, Title } from '@/components/ui';
import { endpoints, errorMessage, SOCKET_URL, TOKEN_KEY } from '@/lib/api';
import { getStoredValue } from '@/lib/token-storage';
import { colors, radius, shadowSoft, spacing } from '@/constants/theme';
import { useAuth } from '@/store/auth';
import type { ChatRoom, Message } from '@/types';

function messageTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return new Intl.DateTimeFormat('id-ID', sameDay ? { hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: 'short' }).format(date);
}

function exactMessageTime(value: string) {
  return new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

const statusLabel: Record<string, string> = {
  PENDING: 'Menunggu pembayaran',
  PAID: 'Koordinasi / penyerahan',
  CONFIRMED: 'Sedang diproses',
  COMPLETED: 'Transaksi selesai',
  CANCELLED: 'Transaksi dibatalkan',
};

function RoomRow({ room, currentUserId, active = false, onPress }: { room: ChatRoom; currentUserId?: string; active?: boolean; onPress?: () => void }) {
  const other = room.userAId === currentUserId ? room.userB : room.userA;
  const message = room.messages?.[0];
  return (
    <Pressable
      onPress={onPress ?? (() => router.push({ pathname: '/(student)/chat/[id]', params: { id: room.id, name: other.name || 'Chat' } }))}
      style={({ pressed }) => [styles.roomRow, active && styles.roomRowActive, pressed && styles.pressed]}
    >
      <View style={styles.avatar}><Text style={styles.avatarText}>{other.name?.[0]?.toUpperCase() || '?'}</Text></View>
      <View style={styles.roomBody}>
        <View style={styles.nameRow}><Text numberOfLines={1} style={styles.name}>{other.name || 'Binusian'}</Text><Text style={styles.time}>{messageTime(message?.createdAt)}</Text></View>
        <Text numberOfLines={1} style={[styles.preview, room.unreadCount ? styles.previewUnread : undefined]}>{message?.content || 'Belum ada pesan'}</Text>
      </View>
      {room.unreadCount ? <View style={styles.count}><Text style={styles.countText}>{room.unreadCount}</Text></View> : null}
    </Pressable>
  );
}

function DesktopConversation({ roomId, transactionId, rooms, currentUserId }: { roomId: string; transactionId?: string; rooms: ChatRoom[]; currentUserId?: string }) {
  const [liveMessages, setLiveMessages] = useState<Message[]>([]);
  const [content, setContent] = useState('');
  const [sendError, setSendError] = useState('');
  const socket = useRef<Socket | null>(null);
  const messageScroll = useRef<ScrollView | null>(null);
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['messages', roomId], queryFn: () => endpoints.messages(roomId), enabled: Boolean(roomId) });
  const transaction = useQuery({ queryKey: ['transaction', transactionId], queryFn: () => endpoints.transaction(transactionId!), enabled: Boolean(transactionId) });
  const currentRoom = rooms.find(room => room.id === roomId);
  const other = currentRoom ? (currentRoom.userAId === currentUserId ? currentRoom.userB : currentRoom.userA) : undefined;
  const otherName = other?.name || 'Percakapan';

  useEffect(() => {
    setLiveMessages([]);
    setContent('');
    setSendError('');
  }, [roomId]);

  useEffect(() => {
    let mounted = true;
    getStoredValue(TOKEN_KEY).then(token => {
      if (!mounted || !token) return;
      const socketClient = io(SOCKET_URL, { auth: { token }, transports: ['websocket'] });
      socket.current = socketClient;
      socketClient.emit('join_room', roomId);
      socketClient.on('connect', () => setSendError(''));
      socketClient.on('connect_error', () => setSendError('Koneksi chat terputus. Pesan belum dikirim.'));
      socketClient.on('new_message', (message: Message) => {
        if (message.chatRoomId !== roomId) return;
        setLiveMessages(current => current.some(item => item.id === message.id) ? current : [...current, message]);
        client.invalidateQueries({ queryKey: ['rooms'] });
      });
    });
    return () => {
      mounted = false;
      socket.current?.emit('leave_room', roomId);
      socket.current?.disconnect();
      socket.current = null;
    };
  }, [roomId, client]);

  const send = () => {
    const value = content.trim();
    if (!value) return;
    if (!socket.current?.connected) {
      setSendError('Chat belum tersambung. Tunggu beberapa detik lalu coba kirim lagi.');
      return;
    }
    setSendError('');
    socket.current.emit('send_message', { roomId, content: value });
    setContent('');
  };

  if (query.isLoading) return <View style={styles.conversationLoading}><Loader /></View>;
  if (query.isError) return <View style={styles.conversationLoading}><ErrorState message={errorMessage(query.error)} retry={() => query.refetch()} /></View>;

  const messages = [...(query.data || []), ...liveMessages.filter(message => !query.data?.some(existing => existing.id === message.id))];

  return (
    <View style={styles.conversation}>
      <View style={styles.chatHeader}>
        <View style={styles.chatAvatar}><Text style={styles.chatAvatarText}>{otherName[0]?.toUpperCase() || '?'}</Text></View>
        <View style={styles.chatHeaderBody}>
          <Text numberOfLines={1} style={styles.chatName}>{otherName}</Text>
          <Text style={styles.chatStatus}>Percakapan BMarket · gunakan chat untuk koordinasi meetup</Text>
        </View>
        {transaction.data ? <Pressable onPress={() => router.push({ pathname: '/(student)/transaction/[id]', params: { id: transaction.data!.id } })} style={styles.orderButton}><Ionicons name="receipt-outline" size={16} color={colors.primary} /><Text style={styles.orderButtonText}>Lihat pesanan</Text></Pressable> : null}
      </View>

      {transaction.data ? <Pressable onPress={() => router.push({ pathname: '/(student)/transaction/[id]', params: { id: transaction.data!.id } })} style={styles.contextCard}>
        <View style={styles.contextIcon}><Ionicons name="receipt-outline" size={19} color={colors.primary} /></View>
        <View style={styles.contextBody}><Text numberOfLines={1} style={styles.contextTitle}>{transaction.data.listing.title}</Text><Text style={styles.contextMeta}>{statusLabel[transaction.data.status] || transaction.data.status} · Meetup dibahas di chat ini</Text></View>
        <Ionicons name="chevron-forward" size={16} color={colors.primary} />
      </Pressable> : null}

      {sendError ? <View style={styles.alertWrap}><InlineAlert message={sendError} /></View> : null}

      <ScrollView
        ref={messageScroll}
        style={styles.messageScroll}
        contentContainerStyle={styles.messages}
        onContentSizeChange={() => messageScroll.current?.scrollToEnd({ animated: false })}
        showsVerticalScrollIndicator={false}
      >
        {messages.map(message => {
          const mine = message.senderId === currentUserId;
          return <View key={message.id} style={[styles.bubbleWrap, mine ? styles.bubbleWrapMine : styles.bubbleWrapTheirs]}>
            <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}><Text style={styles.message}>{message.content}</Text></View>
            <View style={[styles.metaRow, mine && styles.metaRowMine]}><Text style={styles.messageMeta}>{exactMessageTime(message.createdAt)}</Text>{mine ? <Text style={styles.delivery}>{message.isRead ? 'Dibaca' : 'Terkirim'}</Text> : null}</View>
          </View>;
        })}
      </ScrollView>

      <View style={styles.composer}>
        <TextInput value={content} onChangeText={setContent} onSubmitEditing={send} placeholder="Ketik pesan di sini..." placeholderTextColor={colors.muted} style={styles.input} />
        <Pressable onPress={send} style={({ pressed }) => [styles.sendButton, pressed && styles.pressed]}><Ionicons name="send" size={18} color={colors.white} /></Pressable>
      </View>
    </View>
  );
}

export default function ChatsScreen() {
  const user = useAuth(state => state.user);
  const params = useLocalSearchParams<{ roomId?: string; transactionId?: string }>();
  const { width } = useWindowDimensions();
  const desktop = width >= 960;
  const [search, setSearch] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState(typeof params.roomId === 'string' ? params.roomId : '');
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | undefined>(typeof params.transactionId === 'string' ? params.transactionId : undefined);
  const query = useQuery({ queryKey: ['rooms'], queryFn: endpoints.rooms, refetchInterval: 15000 });
  const rooms = useMemo(() => query.data?.filter(room => {
    const other = room.userAId === user?.id ? room.userB : room.userA;
    return (other.name || '').toLowerCase().includes(search.toLowerCase());
  }) || [], [query.data, search, user?.id]);
  const unread = query.data?.reduce((sum, room) => sum + (room.unreadCount || 0), 0) || 0;

  useEffect(() => {
    if (typeof params.roomId === 'string' && params.roomId) {
      setSelectedRoomId(params.roomId);
      setSelectedTransactionId(typeof params.transactionId === 'string' ? params.transactionId : undefined);
    }
  }, [params.roomId, params.transactionId]);

  const selectRoom = (room: ChatRoom) => {
    setSelectedRoomId(room.id);
    setSelectedTransactionId(undefined);
  };

  if (desktop) {
    return (
      <Screen scroll={false} style={styles.desktopPage}>
        <View style={styles.desktopWorkspace}>
          <View style={styles.sidebar}>
            <View style={styles.sidebarHeader}>
              <View><Text style={styles.sidebarEyebrow}>PESAN BMARKET</Text><Text style={styles.sidebarTitle}>Pesan</Text></View>
              <View style={styles.unreadCompact}><View style={[styles.unreadDot, !unread && styles.unreadDotIdle]} /><Text style={styles.unreadCompactText}>{unread || '✓'}</Text></View>
            </View>
            <View style={styles.sidebarSearch}><Field value={search} onChangeText={setSearch} icon="search-outline" placeholder="Cari percakapan..." /></View>
            <ScrollView style={styles.roomScroll} contentContainerStyle={styles.roomList} showsVerticalScrollIndicator={false}>
              {query.isLoading ? <Loader /> : query.isError ? <ErrorState message={errorMessage(query.error)} retry={() => query.refetch()} /> : !rooms.length ? <Empty title={search ? 'Tidak ditemukan' : 'Belum ada percakapan'} message={search ? 'Coba nama lain.' : 'Mulai chat dari detail listing.'} icon="chatbubble-ellipses-outline" /> : rooms.map(room => <RoomRow key={room.id} room={room} currentUserId={user?.id} active={room.id === selectedRoomId} onPress={() => selectRoom(room)} />)}
            </ScrollView>
          </View>

          {selectedRoomId ? <DesktopConversation roomId={selectedRoomId} transactionId={selectedTransactionId} rooms={query.data || []} currentUserId={user?.id} /> : <View style={styles.emptyConversation}>
            <View style={styles.emptyIcon}><Ionicons name="chatbubbles-outline" size={34} color={colors.primary} /></View>
            <Text style={styles.emptyTitle}>Pilih percakapan</Text>
            <Text style={styles.emptyCopy}>Pilih salah satu chat di kiri untuk mulai berdiskusi tentang kondisi barang, lokasi meetup, atau detail transaksi.</Text>
            <View style={styles.safeInline}><Ionicons name="shield-checkmark-outline" size={17} color={colors.success} /><Text style={styles.safeInlineText}>Jaga transaksi dan percakapan tetap di BMarket.</Text></View>
          </View>}
        </View>
      </Screen>
    );
  }

  return <Screen>
    <Title eyebrow="PESAN BMARKET" subtitle="Tanyakan kondisi, sepakati lokasi, dan simpan detail transaksi.">Pesan</Title>
    <View style={styles.safety}><View style={styles.safetyIcon}><Ionicons name="shield-checkmark-outline" size={21} color={colors.success} /></View><View style={styles.safetyBody}><Text style={styles.safetyTitle}>Jaga percakapan tetap di BMarket</Text><Text style={styles.safetyText}>Hindari membagikan OTP atau data pribadi kepada pengguna lain.</Text></View></View>
    <View style={styles.toolbar}><View style={styles.search}><Field value={search} onChangeText={setSearch} icon="search-outline" placeholder="Cari nama pengguna..." /></View><View style={styles.unread}><View style={[styles.unreadDot, !unread && styles.unreadDotIdle]} /><Text style={styles.unreadText}>{unread ? `${unread} belum dibaca` : 'Semua sudah dibaca'}</Text></View></View>
    {query.isLoading ? <Loader /> : query.isError ? <ErrorState message={errorMessage(query.error)} retry={() => query.refetch()} /> : !rooms.length ? <Empty title={search ? 'Percakapan tidak ditemukan' : 'Belum ada percakapan'} message={search ? 'Coba nama pengguna yang lain.' : 'Mulai percakapan dari halaman detail barang atau jasa.'} icon="chatbubble-ellipses-outline" /> : <Card style={styles.list}>{rooms.map(room => <RoomRow key={room.id} room={room} currentUserId={user?.id} />)}</Card>}
  </Screen>;
}

const styles = StyleSheet.create({
  desktopPage: { maxWidth: 1220, paddingVertical: 24, paddingHorizontal: 20, gap: 0 },
  desktopWorkspace: { flex: 1, minHeight: 620, maxHeight: 760, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, overflow: 'hidden', flexDirection: 'row', ...shadowSoft },
  sidebar: { width: 338, minWidth: 338, borderRightWidth: 1, borderRightColor: colors.border, backgroundColor: colors.surface },
  sidebarHeader: { minHeight: 72, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sidebarEyebrow: { fontFamily: 'PoppinsBold', fontSize: 10, letterSpacing: .7, color: colors.primary },
  sidebarTitle: { marginTop: 2, fontFamily: 'PoppinsBold', fontSize: 20, color: colors.text },
  unreadCompact: { minWidth: 28, height: 28, paddingHorizontal: 8, borderRadius: 14, backgroundColor: colors.surfaceMuted, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  unreadCompactText: { fontFamily: 'PoppinsSemiBold', fontSize: 11, color: colors.textSoft },
  sidebarSearch: { padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  roomScroll: { flex: 1 },
  roomList: { paddingVertical: 4 },
  roomRow: { minHeight: 74, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 1, borderBottomColor: '#EEF2F6' },
  roomRowActive: { backgroundColor: colors.primarySoft, borderLeftWidth: 3, borderLeftColor: colors.primary, paddingLeft: 11 },
  avatar: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'PoppinsBold', fontSize: 14, color: colors.primary },
  roomBody: { flex: 1, minWidth: 0, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontFamily: 'PoppinsSemiBold', fontSize: 13, color: colors.text },
  time: { fontFamily: 'PoppinsRegular', fontSize: 10.5, color: colors.muted },
  preview: { fontFamily: 'PoppinsRegular', fontSize: 11.5, color: colors.muted },
  previewUnread: { fontFamily: 'PoppinsMedium', color: colors.textSoft },
  count: { minWidth: 21, height: 21, paddingHorizontal: 6, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  countText: { fontFamily: 'PoppinsBold', fontSize: 10, color: colors.white },
  pressed: { opacity: .65 },
  emptyConversation: { flex: 1, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon: { width: 70, height: 70, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontFamily: 'PoppinsBold', fontSize: 20, color: colors.text },
  emptyCopy: { maxWidth: 460, marginTop: 6, textAlign: 'center', fontFamily: 'PoppinsRegular', fontSize: 13, lineHeight: 21, color: colors.muted },
  safeInline: { marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 10, backgroundColor: colors.successSoft },
  safeInlineText: { fontFamily: 'PoppinsMedium', fontSize: 11.5, color: colors.success },
  conversationLoading: { flex: 1, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' },
  conversation: { flex: 1, minWidth: 0, backgroundColor: '#F8FAFC' },
  chatHeader: { minHeight: 72, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 11 },
  chatAvatar: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  chatAvatarText: { fontFamily: 'PoppinsBold', fontSize: 14, color: colors.primary },
  chatHeaderBody: { flex: 1, minWidth: 0 },
  chatName: { fontFamily: 'PoppinsSemiBold', fontSize: 14, color: colors.text },
  chatStatus: { marginTop: 1, fontFamily: 'PoppinsRegular', fontSize: 10.5, color: colors.muted },
  orderButton: { minHeight: 38, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 6 },
  orderButtonText: { fontFamily: 'PoppinsSemiBold', fontSize: 11, color: colors.primary },
  contextCard: { marginHorizontal: 14, marginTop: 12, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, borderWidth: 1, borderColor: '#C8E0FA', backgroundColor: '#EEF5FD', flexDirection: 'row', alignItems: 'center', gap: 10 },
  contextIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  contextBody: { flex: 1 },
  contextTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 12, color: colors.text },
  contextMeta: { marginTop: 2, fontFamily: 'PoppinsRegular', fontSize: 11, color: colors.muted },
  alertWrap: { paddingHorizontal: 14, paddingTop: 10 },
  messageScroll: { flex: 1 },
  messages: { paddingHorizontal: 18, paddingVertical: 16, gap: 9, flexGrow: 1, justifyContent: 'flex-start' },
  bubbleWrap: { maxWidth: 520, gap: 3 },
  bubbleWrapMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubbleWrapTheirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.md },
  mine: { backgroundColor: '#DCEBFF', borderBottomRightRadius: 4 },
  theirs: { backgroundColor: colors.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
  message: { color: colors.text, fontFamily: 'PoppinsRegular', fontSize: 13, lineHeight: 20 },
  metaRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  metaRowMine: { justifyContent: 'flex-end' },
  messageMeta: { fontFamily: 'PoppinsRegular', fontSize: 10.5, color: colors.muted },
  delivery: { fontFamily: 'PoppinsMedium', fontSize: 10.5, color: colors.muted },
  composer: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, gap: 8, backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.border },
  input: { flex: 1, height: 42, borderRadius: 11, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 15, color: colors.text, backgroundColor: colors.surface, fontFamily: 'PoppinsRegular', fontSize: 12.5 },
  sendButton: { width: 42, height: 42, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  safety: { minHeight: 72, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#C9EDDE', backgroundColor: colors.successSoft, flexDirection: 'row', alignItems: 'center', gap: 12 },
  safetyIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  safetyBody: { flex: 1 },
  safetyTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 13, color: colors.text },
  safetyText: { marginTop: 2, fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 18, color: colors.textSoft },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  search: { flex: 1 },
  unread: { minHeight: 48, paddingHorizontal: 15, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 8 },
  unreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
  unreadDotIdle: { backgroundColor: colors.success },
  unreadText: { fontFamily: 'PoppinsMedium', fontSize: 11.5, color: colors.textSoft },
  list: { padding: 0, overflow: 'hidden' },
});
