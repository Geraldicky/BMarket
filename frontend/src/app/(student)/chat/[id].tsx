import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { Button, Empty, ErrorState, Field, InlineAlert, Loader } from '@/components/ui';
import { endpoints, errorMessage, SOCKET_URL, TOKEN_KEY } from '@/lib/api';
import { getStoredValue } from '@/lib/token-storage';
import { colors, radius, shadowSoft, spacing } from '@/constants/theme';
import { useAuth } from '@/store/auth';
import type { ChatRoom, Message } from '@/types';

function messageTime(value: string) {
  return new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function roomTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return new Intl.DateTimeFormat('id-ID', sameDay ? { hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: 'short' }).format(date);
}

const statusLabel: Record<string, string> = {
  PENDING: 'Menunggu pembayaran',
  PAID: 'Koordinasi / penyerahan',
  CONFIRMED: 'Sedang diproses',
  COMPLETED: 'Transaksi selesai',
  CANCELLED: 'Transaksi dibatalkan',
};

function RoomItem({ room, currentUserId, active }: { room: ChatRoom; currentUserId?: string; active: boolean }) {
  const other = room.userAId === currentUserId ? room.userB : room.userA;
  const message = room.messages?.[0];
  return (
    <Pressable
      onPress={() => router.replace({ pathname: '/(student)/chat/[id]', params: { id: room.id, name: other.name || 'Chat' } })}
      style={({ pressed }) => [styles.roomRow, active && styles.roomRowActive, pressed && { opacity: .68 }]}
    >
      <View style={styles.sidebarAvatar}><Text style={styles.sidebarAvatarText}>{other.name?.[0]?.toUpperCase() || '?'}</Text></View>
      <View style={styles.sidebarRoomBody}>
        <View style={styles.sidebarNameRow}><Text numberOfLines={1} style={styles.sidebarName}>{other.name || 'Binusian'}</Text><Text style={styles.sidebarTime}>{roomTime(message?.createdAt)}</Text></View>
        <Text numberOfLines={1} style={[styles.sidebarPreview, room.unreadCount ? styles.sidebarPreviewUnread : undefined]}>{message?.content || 'Belum ada pesan'}</Text>
      </View>
      {room.unreadCount ? <View style={styles.sidebarCount}><Text style={styles.sidebarCountText}>{room.unreadCount}</Text></View> : null}
    </Pressable>
  );
}

export default function ChatRoomScreen() {
  const { id, transactionId, name } = useLocalSearchParams<{ id: string; transactionId?: string; name?: string }>();
  const { width } = useWindowDimensions();
  const desktop = width >= 960;
  const user = useAuth(state => state.user);

  useEffect(() => {
    if (!desktop || !id) return;
    router.replace({
      pathname: '/(student)/(tabs)/chats',
      params: { roomId: id, ...(transactionId ? { transactionId } : {}) },
    } as never);
  }, [desktop, id, transactionId]);
  const [liveMessages, setLiveMessages] = useState<Message[]>([]);
  const [content, setContent] = useState('');
  const [sendError, setSendError] = useState('');
  const [roomSearch, setRoomSearch] = useState('');
  const socket = useRef<Socket | null>(null);
  const messageScroll = useRef<ScrollView | null>(null);
  const query = useQuery({ queryKey: ['messages', id], queryFn: () => endpoints.messages(id) });
  const roomsQuery = useQuery({ queryKey: ['rooms'], queryFn: endpoints.rooms, refetchInterval: 15000 });
  const transaction = useQuery({ queryKey: ['transaction', transactionId], queryFn: () => endpoints.transaction(transactionId!), enabled: Boolean(transactionId) });
  const rooms = useMemo(() => roomsQuery.data?.filter(room => {
    const other = room.userAId === user?.id ? room.userB : room.userA;
    return (other.name || '').toLowerCase().includes(roomSearch.toLowerCase());
  }) || [], [roomsQuery.data, roomSearch, user?.id]);
  const currentRoom = roomsQuery.data?.find(room => room.id === id);
  const other = currentRoom ? (currentRoom.userAId === user?.id ? currentRoom.userB : currentRoom.userA) : undefined;
  const otherName = other?.name || name || 'Percakapan';

  useEffect(() => {
    setLiveMessages([]);
    setContent('');
    setSendError('');
  }, [id]);

  useEffect(() => {
    let mounted = true;
    getStoredValue(TOKEN_KEY).then(token => {
      if (!mounted || !token) return;
      const client = io(SOCKET_URL, { auth: { token }, transports: ['websocket'] });
      socket.current = client;
      client.emit('join_room', id);
      client.on('connect', () => setSendError(''));
      client.on('connect_error', () => setSendError('Koneksi chat terputus. Pesan belum dikirim.'));
      client.on('new_message', (message: Message) => {
        if (message.chatRoomId === id) {
          setLiveMessages(current => current.some(item => item.id === message.id) ? current : [...current, message]);
        }
      });
    });
    return () => {
      mounted = false;
      socket.current?.emit('leave_room', id);
      socket.current?.disconnect();
    };
  }, [id]);

  const send = () => {
    const value = content.trim();
    if (!value) return;
    if (!socket.current?.connected) {
      setSendError('Chat belum tersambung. Tunggu beberapa detik lalu coba kirim lagi.');
      return;
    }
    setSendError('');
    socket.current.emit('send_message', { roomId: id, content: value });
    setContent('');
  };

  if (desktop) return <View style={styles.full}><Loader /></View>;
  if (query.isLoading) return <View style={styles.full}><Loader /></View>;
  if (query.isError) return <View style={styles.full}><ErrorState message={errorMessage(query.error)} retry={() => query.refetch()} /></View>;
  const messages = [...(query.data || []), ...liveMessages.filter(message => !query.data?.some(existing => existing.id === message.id))];

  const conversation = (
    <View style={[styles.conversation, desktop && styles.conversationDesktop]}>
      {desktop ? <View style={styles.chatHeader}>
        <View style={styles.chatAvatar}><Text style={styles.chatAvatarText}>{otherName[0]?.toUpperCase() || '?'}</Text></View>
        <View style={styles.chatHeaderBody}><Text numberOfLines={1} style={styles.chatName}>{otherName}</Text><Text style={styles.chatStatus}>Percakapan BMarket · gunakan chat untuk koordinasi meetup</Text></View>
        {transaction.data ? <Pressable onPress={() => router.push({ pathname: '/(student)/transaction/[id]', params: { id: transaction.data!.id } })} style={styles.orderButton}><Ionicons name="receipt-outline" size={16} color={colors.primary} /><Text style={styles.orderButtonText}>Lihat pesanan</Text></Pressable> : null}
      </View> : null}

      {transaction.data ? <Pressable onPress={() => router.push({ pathname: '/(student)/transaction/[id]', params: { id: transaction.data!.id } })} style={[styles.contextCard, desktop && styles.contextCardDesktop]}>
        <View style={styles.contextIcon}><Ionicons name="receipt-outline" size={20} color={colors.primary} /></View>
        <View style={styles.contextBody}><Text numberOfLines={1} style={styles.contextTitle}>{transaction.data.listing.title}</Text><Text style={styles.contextMeta}>{statusLabel[transaction.data.status] || transaction.data.status} · Meetup dibahas di chat ini</Text></View>
        {!desktop ? <><Text style={styles.contextLink}>Lihat pesanan</Text><Ionicons name="chevron-forward" size={17} color={colors.primary} /></> : null}
      </Pressable> : null}

      {sendError ? <View style={styles.alertWrap}><InlineAlert message={sendError} /></View> : null}

      <ScrollView
        ref={messageScroll}
        style={styles.messageScroll}
        contentContainerStyle={[styles.messages, desktop && styles.messagesDesktop]}
        onContentSizeChange={() => messageScroll.current?.scrollToEnd({ animated: false })}
        showsVerticalScrollIndicator={false}
      >
        {messages.map(message => {
          const mine = message.senderId === user?.id;
          return <View key={message.id} style={[styles.bubbleWrap, desktop && styles.bubbleWrapDesktop, mine ? styles.bubbleWrapMine : styles.bubbleWrapTheirs]}>
            <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}><Text style={[styles.message, mine && styles.messageMine]}>{message.content}</Text></View>
            <View style={[styles.metaRow, mine && styles.metaRowMine]}><Text style={styles.time}>{messageTime(message.createdAt)}</Text>{mine ? <Text style={styles.delivery}>{message.isRead ? 'Dibaca' : 'Terkirim'}</Text> : null}</View>
          </View>;
        })}
      </ScrollView>

      <View style={[styles.composer, desktop && styles.composerDesktop]}>
        <TextInput value={content} onChangeText={setContent} onSubmitEditing={send} placeholder="Ketik pesan di sini..." placeholderTextColor={colors.muted} style={[styles.input, desktop && styles.inputDesktop]} />
        {desktop ? <Pressable onPress={send} style={({ pressed }) => [styles.sendButton, pressed && { opacity: .75 }]}><Ionicons name="send" size={19} color={colors.white} /></Pressable> : <Button title="Kirim" onPress={send} />}
      </View>
    </View>
  );

  if (!desktop) {
    return <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>{conversation}</KeyboardAvoidingView>;
  }

  return (
    <KeyboardAvoidingView style={styles.desktopPage} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.desktopWorkspace}>
        <View style={styles.sidebar}>
          <View style={styles.sidebarHeader}>
            <View><Text style={styles.sidebarEyebrow}>PESAN BMARKET</Text><Text style={styles.sidebarTitle}>Percakapan</Text></View>
            <Pressable onPress={() => router.replace('/(student)/(tabs)/chats')} style={styles.backToList}><Ionicons name="arrow-back" size={17} color={colors.textSoft} /></Pressable>
          </View>
          <View style={styles.sidebarSearch}><Field value={roomSearch} onChangeText={setRoomSearch} icon="search-outline" placeholder="Cari percakapan..." /></View>
          <ScrollView style={styles.sidebarScroll} contentContainerStyle={styles.sidebarList} showsVerticalScrollIndicator={false}>
            {roomsQuery.isLoading ? <Loader /> : roomsQuery.isError ? <ErrorState message={errorMessage(roomsQuery.error)} retry={() => roomsQuery.refetch()} /> : !rooms.length ? <Empty title="Tidak ada percakapan" message="Belum ada chat yang cocok." icon="chatbubble-outline" /> : rooms.map(room => <RoomItem key={room.id} room={room} currentUserId={user?.id} active={room.id === id} />)}
          </ScrollView>
        </View>
        {conversation}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  page: { flex: 1, backgroundColor: colors.background },
  desktopPage: { flex: 1, backgroundColor: '#F5F7FA', paddingHorizontal: 24, paddingVertical: 22 },
  desktopWorkspace: { width: '100%', maxWidth: 1200, flex: 1, minHeight: 620, maxHeight: 780, alignSelf: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, overflow: 'hidden', flexDirection: 'row', ...shadowSoft },
  sidebar: { width: 330, minWidth: 330, borderRightWidth: 1, borderRightColor: colors.border, backgroundColor: colors.surface },
  sidebarHeader: { minHeight: 70, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  sidebarEyebrow: { fontFamily: 'PoppinsBold', fontSize: 10, letterSpacing: .7, color: colors.primary },
  sidebarTitle: { marginTop: 2, fontFamily: 'PoppinsBold', fontSize: 19, color: colors.text },
  backToList: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  sidebarSearch: { padding: 11, borderBottomWidth: 1, borderBottomColor: colors.border },
  sidebarScroll: { flex: 1 },
  sidebarList: { paddingVertical: 4 },
  roomRow: { minHeight: 72, paddingHorizontal: 13, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#EEF2F6' },
  roomRowActive: { backgroundColor: colors.primarySoft, borderLeftWidth: 3, borderLeftColor: colors.primary, paddingLeft: 10 },
  sidebarAvatar: { width: 41, height: 41, borderRadius: 13, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  sidebarAvatarText: { fontFamily: 'PoppinsBold', fontSize: 13, color: colors.primary },
  sidebarRoomBody: { flex: 1, minWidth: 0, gap: 2 },
  sidebarNameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sidebarName: { flex: 1, fontFamily: 'PoppinsSemiBold', fontSize: 12.5, color: colors.text },
  sidebarTime: { fontFamily: 'PoppinsRegular', fontSize: 10, color: colors.muted },
  sidebarPreview: { fontFamily: 'PoppinsRegular', fontSize: 11, color: colors.muted },
  sidebarPreviewUnread: { fontFamily: 'PoppinsMedium', color: colors.textSoft },
  sidebarCount: { minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  sidebarCountText: { fontFamily: 'PoppinsBold', fontSize: 9.5, color: colors.white },
  conversation: { flex: 1, minWidth: 0, backgroundColor: colors.background },
  conversationDesktop: { backgroundColor: '#F7F8FA' },
  chatHeader: { minHeight: 70, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 11 },
  chatAvatar: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  chatAvatarText: { fontFamily: 'PoppinsBold', fontSize: 14, color: colors.primary },
  chatHeaderBody: { flex: 1, minWidth: 0 },
  chatName: { fontFamily: 'PoppinsSemiBold', fontSize: 14, color: colors.text },
  chatStatus: { marginTop: 1, fontFamily: 'PoppinsRegular', fontSize: 10.5, color: colors.muted },
  orderButton: { minHeight: 38, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 6 },
  orderButtonText: { fontFamily: 'PoppinsSemiBold', fontSize: 11, color: colors.primary },
  contextCard: { marginHorizontal: spacing.lg, marginTop: spacing.md, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#C8E0FA', backgroundColor: colors.primarySoft, flexDirection: 'row', alignItems: 'center', gap: 10 },
  contextCardDesktop: { marginHorizontal: 14, marginTop: 12, paddingVertical: 9, backgroundColor: '#EEF5FD' },
  contextIcon: { width: 40, height: 40, borderRadius: 11, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  contextBody: { flex: 1 },
  contextTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 12, color: colors.text },
  contextMeta: { marginTop: 2, fontFamily: 'PoppinsRegular', fontSize: 11, color: colors.muted },
  contextLink: { fontFamily: 'PoppinsSemiBold', fontSize: 12, color: colors.primary },
  alertWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  messageScroll: { flex: 1 },
  messages: { padding: spacing.lg, gap: 10, flexGrow: 1, justifyContent: 'flex-end' },
  messagesDesktop: { paddingHorizontal: 18, paddingVertical: 16, justifyContent: 'flex-start', gap: 9 },
  bubbleWrap: { maxWidth: '82%', gap: 3 },
  bubbleWrapDesktop: { maxWidth: 520 },
  bubbleWrapMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubbleWrapTheirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.md },
  mine: { backgroundColor: '#DCEBFF', borderBottomRightRadius: 4 },
  theirs: { backgroundColor: colors.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
  message: { color: colors.text, fontFamily: 'PoppinsRegular', fontSize: 13, lineHeight: 20 },
  messageMine: { color: colors.text },
  metaRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  metaRowMine: { justifyContent: 'flex-end' },
  time: { fontFamily: 'PoppinsRegular', fontSize: 10.5, color: colors.muted },
  delivery: { fontFamily: 'PoppinsMedium', fontSize: 10.5, color: colors.muted },
  composer: { flexDirection: 'row', padding: 12, gap: 10, backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.border },
  composerDesktop: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  input: { flex: 1, minHeight: 50, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 15, color: colors.text, fontFamily: 'PoppinsRegular', fontSize: 15 },
  inputDesktop: { minHeight: 42, height: 42, fontSize: 12.5, backgroundColor: colors.surface, borderRadius: 11 },
  sendButton: { width: 42, height: 42, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
