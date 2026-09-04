import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Empty, ErrorState, Loader, Screen, Title, date } from '@/components/ui';
import { colors } from '@/constants/theme';
import { endpoints, errorMessage } from '@/lib/api';
import type { Notification, NotificationType } from '@/types';

const icons: Record<NotificationType, React.ComponentProps<typeof Ionicons>['name']> = { ORDER: 'bag-handle-outline', PAYMENT: 'wallet-outline', DELIVERY: 'bicycle-outline', DISPUTE: 'shield-outline', REVIEW: 'star-outline', OFFER: 'pricetag-outline', SYSTEM: 'notifications-outline' };

export default function NotificationsScreen() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['notifications'], queryFn: endpoints.notifications, refetchInterval: 15000 });
  const readAll = useMutation({ mutationFn: endpoints.readAllNotifications, onSuccess: () => { client.invalidateQueries({ queryKey: ['notifications'] }); client.invalidateQueries({ queryKey: ['notification-count'] }); } });
  const open = async (item: Notification) => {
    if (!item.isRead) await endpoints.readNotification(item.id).catch(() => undefined);
    client.invalidateQueries({ queryKey: ['notifications'] }); client.invalidateQueries({ queryKey: ['notification-count'] });
    if (item.entityType === 'TRANSACTION' && item.entityId) router.push({ pathname: '/(student)/transaction/[id]', params: { id: item.entityId } });
    else if (item.entityType === 'CHAT' && item.entityId) router.push({ pathname: '/(student)/chat/[id]', params: { id: item.entityId } });
  };
  const unread = query.data?.filter(item => !item.isRead).length || 0;
  return <Screen>
    <Title eyebrow="PUSAT NOTIFIKASI" subtitle="Update pembayaran, pesanan, penawaran, dan keamanan akunmu." action={unread ? <Button title="Tandai semua dibaca" variant="secondary" onPress={() => readAll.mutate()} loading={readAll.isPending} /> : undefined}>Notifikasi</Title>
    {query.isLoading ? <Loader /> : query.isError ? <ErrorState message={errorMessage(query.error)} retry={() => query.refetch()} /> : !query.data?.length ? <Empty icon="notifications-outline" title="Belum ada notifikasi" message="Aktivitas transaksi dan penawaran akan muncul di sini." /> : <Card style={styles.list}>{query.data.map((item, index) => <Pressable key={item.id} onPress={() => open(item)} style={({ pressed }) => [styles.row, index === query.data!.length - 1 && styles.last, !item.isRead && styles.unread, pressed && { opacity: .68 }]}><View style={[styles.icon, !item.isRead && styles.iconUnread]}><Ionicons name={icons[item.type]} size={21} color={item.isRead ? colors.muted : colors.primary} /></View><View style={styles.body}><View style={styles.titleRow}><Text style={styles.title}>{item.title}</Text><Text style={styles.time}>{date(item.createdAt)}</Text></View><Text style={styles.copy}>{item.body}</Text></View>{!item.isRead ? <View style={styles.dot} /> : <Ionicons name="chevron-forward" size={17} color={colors.borderStrong} />}</Pressable>)}</Card>}
  </Screen>;
}

const styles = StyleSheet.create({
  list: { paddingVertical: 4, gap: 0 }, row: { minHeight: 92, paddingVertical: 15, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 14 }, last: { borderBottomWidth: 0 }, unread: { backgroundColor: '#F8FBFF' },
  icon: { width: 48, height: 48, borderRadius: 13, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }, iconUnread: { backgroundColor: colors.primarySoft }, body: { flex: 1, gap: 4 }, titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, title: { flex: 1, fontFamily: 'PoppinsSemiBold', fontSize: 14, color: colors.text }, time: { fontFamily: 'PoppinsRegular', fontSize: 10, color: colors.muted }, copy: { fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 19, color: colors.textSoft }, dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary },
});
