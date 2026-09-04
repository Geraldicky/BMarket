import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { Button, ErrorState, Loader, Screen } from '@/components/ui';
import { endpoints, errorMessage, SOCKET_URL, TOKEN_KEY } from '@/lib/api';
import { getStoredValue } from '@/lib/token-storage';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/store/auth';
import type { Message } from '@/types';

export default function ChatRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuth(state => state.user);
  const [liveMessages, setLiveMessages] = useState<Message[]>([]);
  const [content, setContent] = useState('');
  const socket = useRef<Socket | null>(null);
  const query = useQuery({ queryKey: ['messages', id], queryFn: () => endpoints.messages(id) });

  useEffect(() => {
    let mounted = true;
    getStoredValue(TOKEN_KEY).then(token => {
      if (!mounted || !token) return;
      const client = io(SOCKET_URL, { auth: { token }, transports: ['websocket'] });
      socket.current = client;
      client.emit('join_room', id);
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
    socket.current?.emit('send_message', { roomId: id, content: value });
    setContent('');
  };
  if (query.isLoading) return <Screen><Loader /></Screen>;
  if (query.isError) return <Screen><ErrorState message={errorMessage(query.error)} retry={() => query.refetch()} /></Screen>;
  const messages = [...(query.data || []), ...liveMessages.filter(message => !query.data?.some(existing => existing.id === message.id))];

  return <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={styles.messages}>{messages.map(message =>
      <View key={message.id} style={[styles.bubble, message.senderId === user?.id ? styles.mine : styles.theirs]}>
        <Text style={[styles.message, message.senderId === user?.id && { color: '#fff' }]}>{message.content}</Text>
      </View>)}</ScrollView>
    <View style={styles.composer}>
      <TextInput value={content} onChangeText={setContent} onSubmitEditing={send} placeholder="Tulis pesan..." placeholderTextColor={colors.muted} style={styles.input} />
      <Button title="Kirim" onPress={send} />
    </View>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background }, messages: { padding: spacing.lg, gap: 10, flexGrow: 1, justifyContent: 'flex-end' },
  bubble: { maxWidth: '82%', paddingHorizontal: 15, paddingVertical: 12, borderRadius: radius.md }, mine: { backgroundColor: colors.primary, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  theirs: { backgroundColor: colors.surface, alignSelf: 'flex-start', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border }, message: { color: colors.text, fontFamily: 'PoppinsRegular', fontSize: 15, lineHeight: 23 },
  composer: { flexDirection: 'row', padding: 12, gap: 10, backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.border }, input: { flex: 1, minHeight: 50, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 15, color: colors.text, fontFamily: 'PoppinsRegular', fontSize: 15 },
});
