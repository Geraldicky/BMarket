import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { Button, Card, date, Empty, ErrorState, Field, Loader, money, Screen, Title } from '@/components/ui';
import { BackButton } from '@/components/back-button';
import { colors, radius, makeStyles } from '@/constants/theme';
import { endpoints, errorMessage } from '@/lib/api';
import { useAuth } from '@/store/auth';
import type { Transaction, TransactionStatus } from '@/types';
import { ListingImageFallback } from '@/components/listing-image-fallback';

type RoleFilter = 'ALL' | 'BUYER' | 'SELLER';
type StatusFilter = 'ALL' | 'ACTION' | 'PROCESS' | 'COMPLETED' | 'CANCELLED';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// A function (not a constant) so the colors follow the active theme at render time.
const statusMeta = (): Record<TransactionStatus, { label: string; color: string; tint: string; icon: IconName }> => ({
  PENDING: { label: 'Menunggu pembayaran', color: colors.warning, tint: colors.warningSoft, icon: 'time-outline' },
  PAID: { label: 'Dana di escrow', color: colors.primary, tint: colors.primarySoft, icon: 'shield-checkmark-outline' },
  CONFIRMED: { label: 'Sedang diproses', color: colors.purple, tint: colors.purpleSoft, icon: 'cube-outline' },
  COMPLETED: { label: 'Selesai', color: colors.success, tint: colors.successSoft, icon: 'checkmark-circle-outline' },
  CANCELLED: { label: 'Dibatalkan', color: colors.danger, tint: colors.dangerSoft, icon: 'close-circle-outline' },
});

function isBuyer(transaction: Transaction, userId?: string) {
  return transaction.buyerId === userId || transaction.buyer?.id === userId;
}

function needsAction(transaction: Transaction, userId?: string) {
  const buyer = isBuyer(transaction, userId);
  const meetup = transaction.fulfillmentMethod === 'CAMPUS_MEETUP';
  const preorderWaiting = transaction.listing.mode === 'PREORDER' && !['READY', 'COMPLETED'].includes(transaction.listing.preorderStatus || '');
  if (buyer && transaction.status === 'PENDING') return true;
  if (preorderWaiting && ['PAID', 'CONFIRMED'].includes(transaction.status)) return false;
  if (buyer && meetup && transaction.status === 'PAID') return true;
  if (buyer && !meetup && transaction.status === 'CONFIRMED') return true;
  if (!buyer && transaction.status === 'PAID') return true;
  return false;
}

function actionLabel(transaction: Transaction, userId?: string) {
  const buyer = isBuyer(transaction, userId);
  const meetup = transaction.fulfillmentMethod === 'CAMPUS_MEETUP';
  if (!needsAction(transaction, userId)) return 'Lihat detail';
  if (buyer && transaction.status === 'PENDING') return 'Bayar sekarang';
  if (buyer && meetup && transaction.status === 'PAID') return transaction.listing.mode === 'SERVICE' ? 'Koordinasi jasa' : 'Koordinasi meetup';
  if (!buyer && meetup && transaction.status === 'PAID') return 'Koordinasi & kode';
  if (!buyer && transaction.status === 'PAID') return 'Lanjutkan transaksi';
  return 'Konfirmasi selesai';
}

function Metric({ label, value, icon, color, tint, active, compact, onPress }: { label: string; value: number; icon: IconName; color: string; tint: string; active?: boolean; compact?: boolean; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.metric, compact && styles.metricMobile, active && styles.metricActive, pressed && styles.pressed]}>
      <View style={[styles.metricIcon, { backgroundColor: tint }]}><Ionicons name={icon} size={20} color={color} /></View>
      <View style={styles.metricCopy}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>
      <Ionicons name={active ? 'checkmark-circle' : 'chevron-forward'} size={17} color={active ? colors.primary : colors.borderStrong} />
    </Pressable>
  );
}

export default function TransactionsScreen() {
  const styles = useStyles();
  const user = useAuth(state => state.user);
  const { width } = useWindowDimensions();
  const mobile = width < 720;
  const compactMobile = width < 480;
  const twoColumnMetrics = width < 900;
  const [role, setRole] = useState<RoleFilter>('ALL');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [keyword, setKeyword] = useState('');
  const query = useQuery({ queryKey: ['transactions'], queryFn: () => endpoints.transactions() });
  const items = useMemo(() => query.data || [], [query.data]);

  const roleCounts = useMemo(() => ({
    ALL: items.length,
    BUYER: items.filter(item => isBuyer(item, user?.id)).length,
    SELLER: items.filter(item => !isBuyer(item, user?.id)).length,
  }), [items, user?.id]);

  const roleItems = useMemo(() => items.filter(transaction => {
    if (role === 'ALL') return true;
    const buyer = isBuyer(transaction, user?.id);
    return role === 'BUYER' ? buyer : !buyer;
  }), [items, role, user?.id]);

  const visibleItems = useMemo(() => roleItems.filter(transaction => {
    if (status === 'ACTION' && !needsAction(transaction, user?.id)) return false;
    if (status === 'PROCESS' && !['PAID', 'CONFIRMED'].includes(transaction.status)) return false;
    if (status === 'COMPLETED' && transaction.status !== 'COMPLETED') return false;
    if (status === 'CANCELLED' && transaction.status !== 'CANCELLED') return false;
    const q = keyword.trim().toLowerCase();
    if (!q) return true;
    const buyer = isBuyer(transaction, user?.id);
    const counterpart = buyer ? transaction.seller?.name : transaction.buyer?.name;
    return [transaction.listing.title, counterpart, transaction.id].some(value => String(value || '').toLowerCase().includes(q));
  }), [roleItems, status, keyword, user?.id]);

  const stats = [
    { label: 'Perlu tindakan', value: roleItems.filter(item => needsAction(item, user?.id)).length, icon: 'alert-circle-outline' as IconName, tint: colors.warningSoft, color: colors.warning, filter: 'ACTION' as const },
    { label: 'Dalam proses', value: roleItems.filter(item => ['PAID', 'CONFIRMED'].includes(item.status)).length, icon: 'sync-outline' as IconName, tint: colors.primarySoft, color: colors.primary, filter: 'PROCESS' as const },
    { label: 'Selesai', value: roleItems.filter(item => item.status === 'COMPLETED').length, icon: 'checkmark-circle-outline' as IconName, tint: colors.successSoft, color: colors.success, filter: 'COMPLETED' as const },
    { label: 'Dibatalkan', value: roleItems.filter(item => item.status === 'CANCELLED').length, icon: 'close-circle-outline' as IconName, tint: colors.dangerSoft, color: colors.danger, filter: 'CANCELLED' as const },
  ];

  const browse = <Button title="Cari barang" icon="search-outline" onPress={() => router.replace('/(student)/(tabs)')} />;

  return (
    <Screen style={styles.page}>
      <BackButton />
      <Title eyebrow="TRANSAKSI BMARKET" subtitle="Semua pembelian dan penjualanmu, dengan status dan tindakan yang jelas.">Transaksi</Title>

      <Card style={styles.controlPanel}>
        <View style={styles.roleTabs}>
          {([['ALL', 'Semua', 'swap-horizontal-outline'], ['BUYER', 'Pembelian', 'bag-handle-outline'], ['SELLER', 'Penjualan', 'storefront-outline']] as const).map(([value, label, icon]) => (
            <Pressable key={value} onPress={() => { setRole(value); setStatus('ALL'); }} style={[styles.roleTab, role === value && styles.roleTabActive]}>
              <Ionicons name={icon} size={17} color={role === value ? colors.primary : colors.muted} />
              <Text style={[styles.roleTabText, role === value && styles.roleTabTextActive]}>{label}</Text>
              <View style={[styles.roleCount, role === value && styles.roleCountActive]}><Text style={[styles.roleCountText, role === value && styles.roleCountTextActive]}>{roleCounts[value]}</Text></View>
            </Pressable>
          ))}
        </View>
        <View style={styles.metrics}>
          {stats.map(stat => <Metric key={stat.label} {...stat} compact={twoColumnMetrics} active={status === stat.filter} onPress={() => setStatus(current => current === stat.filter ? 'ALL' : stat.filter)} />)}
        </View>
      </Card>

      <View style={[styles.sectionHead, mobile && styles.sectionHeadMobile]}>
        <View><Text style={styles.heading}>{status === 'ALL' ? 'Daftar transaksi' : stats.find(item => item.filter === status)?.label}</Text><Text style={styles.copy}>{visibleItems.length} dari {roleItems.length} transaksi ditampilkan</Text></View>
        <View style={[styles.sectionActions, mobile && styles.sectionActionsMobile]}>
          <View style={[styles.searchWrap, mobile && styles.searchWrapMobile]}><Field value={keyword} onChangeText={setKeyword} icon="search-outline" placeholder="Cari produk atau pengguna..." /></View>
          <View style={[styles.filters, mobile && styles.filtersMobile]}>
            {([['ALL', 'Semua'], ['ACTION', 'Perlu tindakan'], ['PROCESS', 'Diproses'], ['COMPLETED', 'Selesai'], ['CANCELLED', 'Dibatalkan']] as const).map(([value, label]) => (
              <Pressable key={value} onPress={() => setStatus(value)} style={[styles.filter, status === value && styles.filterActive]}><Text style={[styles.filterText, status === value && styles.filterActiveText]}>{label}</Text></Pressable>
            ))}
          </View>
        </View>
      </View>

      {query.isLoading ? <Loader /> : query.isError ? <ErrorState message={errorMessage(query.error)} retry={() => query.refetch()} /> : !visibleItems.length ? (
        <Empty title={items.length ? 'Tidak ada transaksi yang cocok' : 'Belum ada transaksi'} message={items.length ? 'Coba ubah filter atau kata pencarian.' : 'Barang yang kamu beli atau jual akan tercatat di halaman ini.'} icon="receipt-outline" action={items.length ? <Button title="Reset filter" variant="secondary" icon="refresh-outline" onPress={() => { setRole('ALL'); setStatus('ALL'); setKeyword(''); }} /> : browse} />
      ) : (
        <View style={styles.list}>
          {visibleItems.map(transaction => {
            const buyer = isBuyer(transaction, user?.id);
            const meta = statusMeta()[transaction.status];
            const action = needsAction(transaction, user?.id);
            const counterpart = buyer ? transaction.seller?.name : transaction.buyer?.name;
            const meetup = transaction.fulfillmentMethod === 'CAMPUS_MEETUP';
            return (
              <Pressable key={transaction.id} onPress={() => router.push({ pathname: '/(student)/transaction/[id]', params: { id: transaction.id } })} style={({ pressed }) => [pressed && styles.pressed]}>
                <Card style={[styles.item, mobile && styles.itemMobile, action && styles.itemAction]}>
                  <View style={[styles.product, compactMobile && styles.productCompact]}>
                    {transaction.listing.images?.[0] ? <Image source={transaction.listing.images[0]} style={styles.productImage} contentFit="cover" transition={140} cachePolicy="memory-disk" /> : <ListingImageFallback type={transaction.listing.type} size={26} color={colors.primary} />}
                  </View>
                  <View style={[styles.itemBody, mobile && styles.itemBodyMobile]}>
                    <View style={styles.itemEyebrowRow}>
                      <Text style={styles.role}>{buyer ? 'PEMBELIAN' : 'PENJUALAN'}</Text>
                      <Text style={styles.dot}>•</Text><Text style={styles.orderId}>#{transaction.id.slice(0, 8).toUpperCase()}</Text>
                    </View>
                    <Text numberOfLines={2} style={styles.itemTitle}>{transaction.listing.title}</Text>
                    <View style={styles.metaRow}><Ionicons name="person-outline" size={13} color={colors.muted} /><Text numberOfLines={1} style={styles.metaText}>{buyer ? 'Penjual' : 'Pembeli'}: {counterpart || 'Binusian'}</Text><Text style={styles.metaDot}>·</Text><Text style={styles.metaText}>{transaction.quantity} item</Text><Text style={styles.metaDot}>·</Text><Ionicons name={transaction.listing.mode === 'SERVICE' ? 'construct-outline' : meetup ? 'people-outline' : 'archive-outline'} size={13} color={colors.muted} /><Text style={styles.metaText}>{transaction.listing.mode === 'SERVICE' ? 'Jasa' : meetup ? 'Meetup' : 'Riwayat lama'}</Text></View>
                    <View style={styles.badgeRow}><View style={[styles.statusBadge, { backgroundColor: meta.tint }]}><Ionicons name={meta.icon} size={14} color={meta.color} /><Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text></View><Text style={styles.orderDate}>{date(transaction.createdAt)}</Text></View>
                  </View>
                  <View style={[styles.itemEnd, mobile && styles.itemEndMobile]}>
                    <View style={[styles.priceBlock, mobile && styles.priceBlockMobile]}><Text style={styles.totalLabel}>{buyer ? 'TOTAL BAYAR' : 'NILAI PESANAN'}</Text><Text style={styles.price}>{money(buyer ? (transaction.grandTotal || transaction.totalPrice) : transaction.totalPrice)}</Text></View>
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

const useStyles = makeStyles(() => ({
  page: { maxWidth: 1180, gap: 20 },
  controlPanel: { padding: 0, overflow: 'hidden', gap: 0 },
  roleTabs: { padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  roleTab: { minHeight: 42, paddingHorizontal: 13, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 7 },
  roleTabActive: { backgroundColor: colors.primarySoft },
  roleTabText: { fontFamily: 'PoppinsMedium', fontSize: 12.5, color: colors.textSoft },
  roleTabTextActive: { fontFamily: 'PoppinsSemiBold', color: colors.primary },
  roleCount: { minWidth: 24, height: 24, paddingHorizontal: 6, borderRadius: 12, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  roleCountActive: { backgroundColor: colors.surface },
  roleCountText: { fontFamily: 'PoppinsSemiBold', fontSize: 11, color: colors.muted },
  roleCountTextActive: { color: colors.primary },
  metrics: { flexDirection: 'row', flexWrap: 'wrap' },
  metric: { minWidth: 210, minHeight: 82, flex: 1, paddingHorizontal: 16, paddingVertical: 13, borderRightWidth: 1, borderRightColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 11 },
  metricMobile: { minWidth: 0, flexGrow: 0, flexShrink: 0, flexBasis: '50%', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  metricActive: { backgroundColor: colors.primaryMist },
  metricIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  metricCopy: { flex: 1 },
  metricValue: { fontFamily: 'PoppinsBold', fontSize: 21, lineHeight: 25, color: colors.text },
  metricLabel: { marginTop: 2, fontFamily: 'PoppinsRegular', fontSize: 12, color: colors.muted },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 },
  heading: { fontFamily: 'PoppinsBold', fontSize: 20, color: colors.text },
  copy: { marginTop: 2, fontFamily: 'PoppinsRegular', fontSize: 12.5, lineHeight: 19, color: colors.muted },
  sectionActions: { flex: 1, minWidth: 320, alignItems: 'flex-end', gap: 9 },
  sectionHeadMobile: { flexDirection: 'column', alignItems: 'stretch', gap: 12 },
  sectionActionsMobile: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%', minWidth: 0, alignItems: 'stretch' },
  searchWrap: { width: '100%', maxWidth: 360 },
  searchWrapMobile: { maxWidth: '100%' },
  filters: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' },
  filtersMobile: { justifyContent: 'flex-start' },
  filter: { minHeight: 40, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, justifyContent: 'center' },
  filterActive: { borderColor: colors.primaryBorder, backgroundColor: colors.primarySoft },
  filterText: { fontFamily: 'PoppinsMedium', fontSize: 11.5, color: colors.textSoft },
  filterActiveText: { fontFamily: 'PoppinsSemiBold', color: colors.primary },
  list: { gap: 10 },
  item: { minHeight: 122, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14 },
  itemMobile: { flexWrap: 'wrap', alignItems: 'flex-start' },
  itemAction: { borderColor: colors.primaryBorder, backgroundColor: colors.primaryMist },
  product: { width: 88, height: 88, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  productCompact: { width: 72, height: 72 },
  productImage: { width: '100%', height: '100%' },
  itemBody: { minWidth: 220, flex: 1, gap: 5 },
  itemBodyMobile: { minWidth: 0, flexBasis: 180 },
  itemEyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  role: { fontFamily: 'PoppinsBold', fontSize: 10.5, letterSpacing: .65, color: colors.primary },
  dot: { color: colors.borderStrong },
  orderId: { fontFamily: 'PoppinsMedium', fontSize: 10.5, color: colors.muted },
  itemTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 15.5, lineHeight: 21, color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  metaText: { fontFamily: 'PoppinsRegular', fontSize: 11.5, color: colors.muted },
  metaDot: { fontFamily: 'PoppinsRegular', fontSize: 11, color: colors.borderStrong },
  badgeRow: { marginTop: 2, flexDirection: 'row', alignItems: 'center', gap: 9 },
  statusBadge: { minHeight: 27, paddingHorizontal: 9, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusText: { fontFamily: 'PoppinsSemiBold', fontSize: 11.5 },
  orderDate: { fontFamily: 'PoppinsRegular', fontSize: 11, color: colors.muted },
  itemEnd: { minWidth: 190, alignItems: 'flex-end', justifyContent: 'center', gap: 9 },
  itemEndMobile: { width: '100%', minWidth: 0, paddingTop: 11, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' },
  priceBlock: { alignItems: 'flex-end' },
  priceBlockMobile: { alignItems: 'flex-start' },
  totalLabel: { fontFamily: 'PoppinsBold', fontSize: 10.5, letterSpacing: .55, color: colors.muted },
  price: { marginTop: 1, fontFamily: 'PoppinsBold', fontSize: 18, color: colors.text },
  detailAction: { minHeight: 37, paddingHorizontal: 12, borderRadius: 9, backgroundColor: colors.primarySoft, flexDirection: 'row', alignItems: 'center', gap: 7 },
  detailActionUrgent: { backgroundColor: colors.primary },
  detailActionText: { fontFamily: 'PoppinsSemiBold', fontSize: 11.5, color: colors.primary },
  detailActionTextUrgent: { color: colors.white },
  pressed: { opacity: .7, transform: [{ scale: .994 }] },
}));
