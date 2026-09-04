import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Button, Card, date, Empty, ErrorState, Loader, money, Screen, Title } from '@/components/ui';
import { colors, radius } from '@/constants/theme';
import { endpoints, errorMessage } from '@/lib/api';
import { useAuth } from '@/store/auth';
import type { Transaction, TransactionStatus } from '@/types';

type RoleFilter = 'ALL' | 'BUYER' | 'SELLER';
type StatusFilter = 'ALL' | 'ACTION' | 'PROCESS' | 'COMPLETED' | 'CANCELLED';

const statusMeta: Record<TransactionStatus, { label: string; color: string; tint: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  PENDING: { label: 'Menunggu pembayaran', color: colors.warning, tint: colors.warningSoft, icon: 'time-outline' },
  PAID: { label: 'Menunggu seller', color: colors.primary, tint: colors.primarySoft, icon: 'shield-checkmark-outline' },
  CONFIRMED: { label: 'Sedang diproses', color: '#7656C5', tint: '#F0EBFF', icon: 'cube-outline' },
  COMPLETED: { label: 'Selesai', color: colors.success, tint: colors.successSoft, icon: 'checkmark-circle-outline' },
  CANCELLED: { label: 'Dibatalkan', color: colors.danger, tint: colors.dangerSoft, icon: 'close-circle-outline' },
};

function isBuyer(transaction: Transaction, userId?: string) {
  return transaction.buyerId === userId || transaction.buyer?.id === userId;
}

function needsAction(transaction: Transaction, userId?: string) {
  const buyer = isBuyer(transaction, userId);
  return (buyer && ['PENDING', 'CONFIRMED'].includes(transaction.status))
    || (!buyer && transaction.status === 'PAID');
}

function actionLabel(transaction: Transaction, userId?: string) {
  if (!needsAction(transaction, userId)) return 'Lihat detail';
  if (transaction.status === 'PENDING') return 'Bayar sekarang';
  if (transaction.status === 'PAID') return 'Konfirmasi pesanan';
  return 'Pesanan diterima';
}

export default function TransactionsScreen() {
  const user = useAuth(state => state.user);
  const mobile = useWindowDimensions().width < 720;
  const [role, setRole] = useState<RoleFilter>('ALL');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const query = useQuery({ queryKey: ['transactions'], queryFn: () => endpoints.transactions() });
  const items = useMemo(() => query.data || [], [query.data]);

  const roleItems = useMemo(() => items.filter(transaction => {
    if (role === 'ALL') return true;
    const buyer = isBuyer(transaction, user?.id);
    return role === 'BUYER' ? buyer : !buyer;
  }), [items, role, user?.id]);

  const visibleItems = useMemo(() => roleItems.filter(transaction => {
    if (status === 'ALL') return true;
    if (status === 'ACTION') return needsAction(transaction, user?.id);
    if (status === 'PROCESS') return ['PAID', 'CONFIRMED'].includes(transaction.status);
    return transaction.status === status;
  }), [roleItems, status, user?.id]);

  const stats = [
    { label: 'Perlu tindakan', value: roleItems.filter(item => needsAction(item, user?.id)).length, icon: 'alert-circle-outline' as const, tint: colors.warningSoft, color: colors.warning, filter: 'ACTION' as const },
    { label: 'Dalam proses', value: roleItems.filter(item => ['PAID', 'CONFIRMED'].includes(item.status)).length, icon: 'sync-outline' as const, tint: colors.primarySoft, color: colors.primary, filter: 'PROCESS' as const },
    { label: 'Selesai', value: roleItems.filter(item => item.status === 'COMPLETED').length, icon: 'checkmark-circle-outline' as const, tint: colors.successSoft, color: colors.success, filter: 'COMPLETED' as const },
    { label: 'Dibatalkan', value: roleItems.filter(item => item.status === 'CANCELLED').length, icon: 'close-circle-outline' as const, tint: colors.dangerSoft, color: colors.danger, filter: 'CANCELLED' as const },
  ];
  const browse = <Button title="Cari barang" icon="search-outline" onPress={() => router.replace('/(student)/(tabs)')} />;

  return (
    <Screen>
      <Title eyebrow="AKTIVITAS TRANSAKSI" subtitle="Pantau pembelian dan penjualan, dari checkout sampai dana selesai diproses.">Transaksi</Title>

      <View style={styles.roleTabs}>
        {([['ALL', 'Semua'], ['BUYER', 'Sebagai pembeli'], ['SELLER', 'Sebagai penjual']] as const).map(([value, label]) => (
          <Pressable key={value} onPress={() => { setRole(value); setStatus('ALL'); }} style={[styles.roleTab, role === value && styles.roleTabActive]}>
            <Ionicons name={value === 'ALL' ? 'swap-horizontal-outline' : value === 'BUYER' ? 'bag-handle-outline' : 'storefront-outline'} size={17} color={role === value ? colors.primary : colors.muted} />
            <Text style={[styles.roleTabText, role === value && styles.roleTabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.stats}>
        {stats.map(stat => (
          <Pressable key={stat.label} onPress={() => setStatus(current => current === stat.filter ? 'ALL' : stat.filter)} style={({ pressed }) => [styles.statPressable, pressed && styles.pressed]}>
            <Card style={[styles.stat, status === stat.filter && styles.statActive]}>
              <View style={[styles.statIcon, { backgroundColor: stat.tint }]}><Ionicons name={stat.icon} size={22} color={stat.color} /></View>
              <View style={styles.statBody}><Text style={styles.statValue}>{stat.value}</Text><Text style={styles.statLabel}>{stat.label}</Text></View>
              <Ionicons name={status === stat.filter ? 'checkmark-circle' : 'chevron-forward'} size={17} color={status === stat.filter ? colors.primary : colors.borderStrong} />
            </Card>
          </Pressable>
        ))}
      </View>

      <View style={styles.toolbar}>
        <View><Text style={styles.heading}>{status === 'ALL' ? 'Riwayat transaksi' : stats.find(item => item.filter === status)?.label}</Text><Text style={styles.copy}>{visibleItems.length} transaksi ditampilkan</Text></View>
        <View style={styles.filters}>
          {([['ALL', 'Semua status'], ['ACTION', 'Perlu tindakan'], ['PROCESS', 'Diproses'], ['COMPLETED', 'Selesai'], ['CANCELLED', 'Dibatalkan']] as const).map(([value, label]) => (
            <Pressable key={value} onPress={() => setStatus(value)} style={[styles.filter, status === value && styles.filterActive]}><Text style={[styles.filterText, status === value && styles.filterActiveText]}>{label}</Text></Pressable>
          ))}
        </View>
      </View>

      {query.isLoading ? <Loader /> : query.isError ? <ErrorState message={errorMessage(query.error)} retry={() => query.refetch()} /> : !visibleItems.length ? (
        <Empty title={items.length ? 'Tidak ada transaksi pada filter ini' : 'Belum ada transaksi'} message={items.length ? 'Coba pilih role atau status yang berbeda.' : 'Barang yang kamu beli atau jual akan tercatat rapi di halaman ini.'} icon="receipt-outline" action={items.length ? <Button title="Reset filter" variant="secondary" icon="refresh-outline" onPress={() => { setRole('ALL'); setStatus('ALL'); }} /> : browse} />
      ) : (
        <View style={styles.list}>
          {visibleItems.map(transaction => {
            const buyer = isBuyer(transaction, user?.id);
            const meta = statusMeta[transaction.status];
            const action = needsAction(transaction, user?.id);
            const counterpart = buyer ? transaction.seller?.name : transaction.buyer?.name;
            return (
              <Pressable key={transaction.id} onPress={() => router.push({ pathname: '/(student)/transaction/[id]', params: { id: transaction.id } })} style={({ pressed }) => [pressed && styles.pressed]}>
                <Card style={[styles.item, mobile && styles.itemMobile, action && styles.itemAction]}>
                  <View style={styles.product}>
                    {transaction.listing.images?.[0] ? <Image source={transaction.listing.images[0]} style={styles.productImage} contentFit="cover" transition={140} cachePolicy="memory-disk" /> : <Ionicons name={transaction.listing.type === 'SERVICE' ? 'construct-outline' : 'cube-outline'} size={26} color={colors.primary} />}
                  </View>
                  <View style={styles.itemBody}>
                    <View style={styles.itemTopLine}><Text style={styles.role}>{buyer ? 'PEMBELIAN' : 'PENJUALAN'}</Text><Text style={styles.orderDate}>{date(transaction.createdAt)}</Text></View>
                    <Text numberOfLines={2} style={styles.itemTitle}>{transaction.listing.title}</Text>
                    <Text style={styles.counterpart}>{buyer ? 'Penjual' : 'Pembeli'}: {counterpart || 'Binusian'} · {transaction.quantity} item · {transaction.fulfillmentMethod === 'INSTANT_COURIER' ? 'Kurir instan' : 'Meetup kampus'}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: meta.tint }]}><Ionicons name={meta.icon} size={14} color={meta.color} /><Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text></View>
                  </View>
                  <View style={[styles.itemEnd, mobile && styles.itemEndMobile]}>
                    <Text style={styles.totalLabel}>{buyer ? 'TOTAL BAYAR' : 'SUBTOTAL'}</Text><Text style={styles.price}>{money(buyer ? (transaction.grandTotal || transaction.totalPrice) : transaction.totalPrice)}</Text>
                    <View style={[styles.detailAction, action && styles.detailActionUrgent]}><Text style={[styles.detailActionText, action && styles.detailActionTextUrgent]}>{actionLabel(transaction, user?.id)}</Text><Ionicons name="arrow-forward" size={14} color={action ? colors.white : colors.primary} /></View>
                  </View>
                </Card>
              </Pressable>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  roleTabs: { alignSelf: 'flex-start', padding: 5, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  roleTab: { minHeight: 42, paddingHorizontal: 15, borderRadius: 9, flexDirection: 'row', alignItems: 'center', gap: 7 },
  roleTabActive: { backgroundColor: colors.primarySoft },
  roleTabText: { fontFamily: 'PoppinsMedium', fontSize: 12, color: colors.textSoft },
  roleTabTextActive: { fontFamily: 'PoppinsSemiBold', color: colors.primary },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  statPressable: { minWidth: 230, flex: 1 },
  stat: { minHeight: 98, flexDirection: 'row', alignItems: 'center', gap: 13, padding: 17 },
  statActive: { borderColor: '#A8C8EF', backgroundColor: '#FBFDFF' },
  statIcon: { width: 48, height: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  statBody: { flex: 1 },
  statValue: { fontFamily: 'PoppinsBold', fontSize: 25, color: colors.text },
  statLabel: { fontFamily: 'PoppinsRegular', fontSize: 11, color: colors.muted },
  toolbar: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' },
  heading: { fontFamily: 'PoppinsBold', fontSize: 21, color: colors.text },
  copy: { fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 19, color: colors.muted },
  filters: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' },
  filter: { minHeight: 38, paddingHorizontal: 13, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, justifyContent: 'center' },
  filterActive: { borderColor: '#B7D3F3', backgroundColor: colors.primarySoft },
  filterText: { fontFamily: 'PoppinsMedium', fontSize: 11, color: colors.textSoft },
  filterActiveText: { fontFamily: 'PoppinsSemiBold', color: colors.primary },
  list: { gap: 12 },
  item: { minHeight: 132, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16 },
  itemMobile: { flexWrap: 'wrap', alignItems: 'flex-start' },
  itemAction: { borderColor: '#B7D3F3' },
  product: { width: 98, height: 96, borderRadius: 13, overflow: 'hidden', backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  productImage: { width: '100%', height: '100%' },
  itemBody: { minWidth: 210, flex: 1, gap: 5 },
  itemTopLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  role: { fontFamily: 'PoppinsBold', fontSize: 10, letterSpacing: 0.65, color: colors.primary },
  orderDate: { fontFamily: 'PoppinsRegular', fontSize: 10, color: colors.muted },
  itemTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 16, lineHeight: 22, color: colors.text },
  counterpart: { fontFamily: 'PoppinsRegular', fontSize: 11, color: colors.muted },
  statusBadge: { alignSelf: 'flex-start', minHeight: 29, paddingHorizontal: 9, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusText: { fontFamily: 'PoppinsSemiBold', fontSize: 10 },
  itemEnd: { minWidth: 180, alignItems: 'flex-end', gap: 4 },
  itemEndMobile: { width: '100%', minWidth: 0, paddingTop: 11, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' },
  totalLabel: { fontFamily: 'PoppinsBold', fontSize: 9, letterSpacing: 0.6, color: colors.muted },
  price: { fontFamily: 'PoppinsBold', fontSize: 18, color: colors.text },
  detailAction: { minHeight: 37, marginTop: 8, paddingHorizontal: 12, borderRadius: 9, backgroundColor: colors.primarySoft, flexDirection: 'row', alignItems: 'center', gap: 7 },
  detailActionUrgent: { backgroundColor: colors.primary },
  detailActionText: { fontFamily: 'PoppinsSemiBold', fontSize: 10, color: colors.primary },
  detailActionTextUrgent: { color: colors.white },
  pressed: { opacity: 0.7, transform: [{ scale: 0.992 }] },
});
