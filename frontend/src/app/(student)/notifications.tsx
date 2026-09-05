import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Button, Card, Empty, ErrorState, FeedbackDialog, Loader, Screen, Title, date } from '@/components/ui';
import { colors } from '@/constants/theme';
import { endpoints, errorMessage } from '@/lib/api';
import type { Notification, NotificationType } from '@/types';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
const icons: Record<NotificationType, IconName> = {
  TRANSACTION: 'receipt-outline', CHAT: 'chatbubble-ellipses-outline', REVIEW: 'star-outline', DISPUTE: 'shield-outline', SYSTEM: 'notifications-outline',
};

export default function NotificationsScreen() {
  const mobile = useWindowDimensions().width < 600;
  const client = useQueryClient();
  const [feedback, setFeedback] = useState<{ title: string; message: string } | null>(null);
  const query = useQuery({ queryKey: ['notifications'], queryFn: endpoints.notifications, refetchInterval: 30000 });
  const readAll = useMutation({
    mutationFn: endpoints.readAllNotifications,
    onSuccess: () => { client.invalidateQueries({ queryKey: ['notifications'] }); client.invalidateQueries({ queryKey: ['notification-count'] }); },
    onError: error => setFeedback({ title: 'Notifikasi belum diperbarui', message: errorMessage(error) }),
  });

  const open = async (item: Notification) => {
    if (!item.isRead) {
      await endpoints.readNotification(item.id).catch(() => undefined);
      client.invalidateQueries({ queryKey: ['notifications'] });
      client.invalidateQueries({ queryKey: ['notification-count'] });
    }
    if (!item.entityId) return;
    if (item.entityType === 'TRANSACTION') router.push({ pathname: '/(student)/transaction/[id]', params: { id: item.entityId } });
    if (item.entityType === 'CHAT_ROOM') router.push({ pathname: '/(student)/chat/[id]', params: { id: item.entityId } });
  };

  const unread = query.data?.filter(item => !item.isRead).length || 0;
  return <Screen>
    <Title eyebrow="AKTIVITAS" subtitle="Pesanan, pesan, review, dan keputusan penting dari BMarket." action={unread ? <Button title="Tandai semua dibaca" variant="ghost" onPress={() => readAll.mutate()} loading={readAll.isPending} /> : undefined}>Notifikasi</Title>
    {query.isLoading ? <Loader /> : query.isError ? <ErrorState message={errorMessage(query.error)} retry={() => query.refetch()} /> : !query.data?.length ? <Empty icon="notifications-outline" title="Belum ada notifikasi" message="Aktivitas penting akan muncul di sini." /> : <Card style={styles.list}>
      {query.data.map((item, index) => <Pressable key={item.id} onPress={() => open(item)} style={({ pressed }) => [styles.row, mobile && styles.rowMobile, index === query.data!.length - 1 && styles.last, !item.isRead && styles.unread, pressed && styles.pressed]}>
        <View style={[styles.icon, mobile && styles.iconMobile, !item.isRead && styles.iconUnread]}><Ionicons name={icons[item.type]} size={21} color={item.isRead ? colors.muted : colors.primary} /></View>
        <View style={styles.body}><View style={[styles.titleRow,mobile&&styles.titleRowMobile]}><Text style={styles.itemTitle}>{item.title}</Text><Text style={styles.time}>{date(item.createdAt)}</Text></View><Text style={styles.copy}>{item.body}</Text></View>
        {!item.isRead ? <View style={styles.dot} /> : <Ionicons name="chevron-forward" size={17} color={colors.borderStrong} />}
      </Pressable>)}
    </Card>}
    <FeedbackDialog visible={Boolean(feedback)} tone="danger" title={feedback?.title || ''} message={feedback?.message || ''} onClose={() => setFeedback(null)} />
  </Screen>;
}

const styles = StyleSheet.create({
  list:{padding:0,gap:0,overflow:'hidden'},row:{minHeight:88,paddingHorizontal:18,paddingVertical:15,flexDirection:'row',alignItems:'center',gap:13,borderBottomWidth:1,borderBottomColor:colors.border},rowMobile:{paddingHorizontal:12,paddingVertical:12,alignItems:'flex-start',gap:10},last:{borderBottomWidth:0},unread:{backgroundColor:'#F7FBFF'},pressed:{opacity:.68},icon:{width:43,height:43,borderRadius:12,backgroundColor:colors.background,alignItems:'center',justifyContent:'center'},iconMobile:{width:38,height:38,borderRadius:10},iconUnread:{backgroundColor:colors.primarySoft},body:{flex:1,gap:4},titleRow:{flexDirection:'row',gap:12,alignItems:'center'},titleRowMobile:{alignItems:'flex-start',gap:4,flexWrap:'wrap'},itemTitle:{flex:1,fontFamily:'PoppinsSemiBold',fontSize:14,color:colors.text},time:{fontFamily:'PoppinsRegular',fontSize:12,color:colors.muted},copy:{fontFamily:'PoppinsRegular',fontSize:12,lineHeight:19,color:colors.textSoft},dot:{width:8,height:8,borderRadius:4,backgroundColor:colors.primary},
});
