import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Button, Card, Empty, ErrorState, FeedbackDialog, Field, Loader, money, Screen, Title } from '@/components/ui';
import { endpoints, errorMessage } from '@/lib/api';
import { colors, radius } from '@/constants/theme';
import type { Listing, PreorderStatus, Transaction } from '@/types';

const statusLabel: Record<string, string> = {
  ACTIVE: 'Aktif',
  PENDING: 'Aktif',
  REJECTED: 'Ditolak',
  SOLD: 'Terjual',
  INACTIVE: 'Nonaktif',
  HIDDEN: 'Disembunyikan',
  REMOVED: 'Dihapus admin',
};

const moderatedStatuses = new Set(['REJECTED', 'HIDDEN', 'REMOVED']);

type FilterKey = 'ALL' | 'ACTIVE' | 'OUT_OF_STOCK' | 'PREORDER' | 'SOLD' | 'MODERATED' | 'INACTIVE';
type Target = { id: string; title: string; action: 'deactivate' | 'archive' } | null;
type Feedback = { tone: 'success' | 'danger'; title: string; message: string } | null;
type RestockTarget = { id: string; title: string } | null;

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateLabel(value: string) {
  try {
    return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
  } catch {
    return '';
  }
}

const modeLabel: Record<string, string> = {
  ONE_OFF: 'BARANG SATUAN', STOCKED: 'PRODUK STOK', PREORDER: 'PRE-ORDER', SERVICE: 'JASA',
};

function derivedLabel(item: Listing) {
  if (moderatedStatuses.has(item.status)) return statusLabel[item.status] || item.status;
  if (item.status === 'INACTIVE') return 'Nonaktif';
  if (item.mode === 'PREORDER') {
    if (item.preorderStatus === 'PROCESSING') return 'Diproses';
    if (item.preorderStatus === 'READY') return 'Siap diambil';
    if (item.preorderStatus === 'COMPLETED') return 'PO selesai';
    if (!item.preorderAccepting) return 'PO ditutup';
    return 'PO aktif';
  }
  if (item.mode === 'STOCKED' && item.stockLeft === 0) return 'Stok habis';
  if (item.status === 'SOLD') return 'Terjual';
  return 'Aktif';
}

function preorderNext(status?: PreorderStatus | null): { status: PreorderStatus; label: string } | null {
  if (!status || status === 'OPEN') return { status: 'CLOSED', label: 'Tutup PO' };
  if (status === 'CLOSED') return { status: 'PROCESSING', label: 'Mulai proses' };
  if (status === 'PROCESSING') return { status: 'READY', label: 'Tandai siap' };
  if (status === 'READY') return { status: 'COMPLETED', label: 'Selesaikan PO' };
  return null;
}

function matchesFilter(item: Listing, filter: FilterKey) {
  if (filter === 'ALL') return true;
  if (filter === 'ACTIVE') return (item.status === 'ACTIVE' || item.status === 'PENDING') && !(item.mode === 'STOCKED' && item.stockLeft === 0);
  if (filter === 'OUT_OF_STOCK') return item.mode === 'STOCKED' && item.stockLeft === 0;
  if (filter === 'PREORDER') return item.mode === 'PREORDER';
  if (filter === 'SOLD') return item.status === 'SOLD';
  if (filter === 'MODERATED') return moderatedStatuses.has(item.status);
  return item.status === 'INACTIVE';
}

export default function SellScreen() {
  const client = useQueryClient();
  const { width } = useWindowDimensions();
  const desktop = width >= 860;
  const query = useQuery({ queryKey: ['my-listings'], queryFn: endpoints.myListings });
  const sellerTransactions = useQuery({ queryKey: ['transactions', 'seller'], queryFn: () => endpoints.transactions('seller') });
  const items = query.data || [];
  const [target, setTarget] = useState<Target>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [filter, setFilter] = useState<FilterKey>('ALL');
  const [keyword, setKeyword] = useState('');
  const [restockTarget, setRestockTarget] = useState<RestockTarget>(null);
  const [restockQty, setRestockQty] = useState('10');
  const [ordersTarget, setOrdersTarget] = useState<Listing | null>(null);

  const counts = useMemo(() => ({
    total: items.length,
    active: items.filter(item => (item.status === 'ACTIVE' || item.status === 'PENDING') && !(item.mode === 'STOCKED' && item.stockLeft === 0)).length,
    outOfStock: items.filter(item => item.mode === 'STOCKED' && item.stockLeft === 0).length,
    preorder: items.filter(item => item.mode === 'PREORDER').length,
    sold: items.filter(item => item.status === 'SOLD').length,
    moderated: items.filter(item => moderatedStatuses.has(item.status)).length,
    inactive: items.filter(item => item.status === 'INACTIVE').length,
  }), [items]);

  const completedTransactions = (sellerTransactions.data || []).filter(transaction => transaction.status === 'COMPLETED');
  const sellerRevenue = completedTransactions.reduce((total, transaction) => total + toNumber(transaction.sellerReceives), 0);

  const filteredItems = useMemo(() => {
    const search = keyword.trim().toLowerCase();
    return items
      .filter(item => matchesFilter(item, filter))
      .filter(item => !search || `${item.title} ${item.category} ${item.type}`.toLowerCase().includes(search))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [filter, items, keyword]);

  const remove = async () => {
    if (!target) return;
    setWorkingId(target.id);
    try {
      if (target.action === 'archive') await endpoints.archiveInactiveListing(target.id);
      else await endpoints.deleteListing(target.id);

      await Promise.all([
        client.invalidateQueries({ queryKey: ['my-listings'] }),
        client.invalidateQueries({ queryKey: ['listings'] }),
      ]);
      const { title, action } = target;
      setTarget(null);
      setFeedback(action === 'archive'
        ? { tone: 'success', title: 'Listing diarsipkan', message: `${title} sudah dipindahkan dari daftar listing aktifmu. Histori transaksi dan penjualan tetap tersimpan.` }
        : { tone: 'success', title: 'Listing dinonaktifkan', message: `${title} tidak lagi tampil di marketplace. Kamu bisa menghapusnya dari etalase setelah dinonaktifkan.` });
    } catch (error) {
      setFeedback({
        tone: 'danger',
        title: target.action === 'archive' ? 'Listing belum dapat diarsipkan' : 'Listing belum dinonaktifkan',
        message: errorMessage(error),
      });
      setTarget(null);
    } finally {
      setWorkingId(null);
    }
  };

  const restock = async () => {
    if (!restockTarget) return;
    const qty = Number(restockQty);
    if (!Number.isInteger(qty) || qty < 1) {
      setFeedback({ tone: 'danger', title: 'Jumlah stok belum valid', message: 'Masukkan jumlah stok minimal 1.' });
      return;
    }
    setWorkingId(restockTarget.id);
    try {
      await endpoints.restockListing(restockTarget.id, qty);
      await Promise.all([client.invalidateQueries({ queryKey: ['my-listings'] }), client.invalidateQueries({ queryKey: ['listings'] })]);
      setFeedback({ tone: 'success', title: 'Stok berhasil ditambahkan', message: `${restockTarget.title} mendapat tambahan ${qty} unit tanpa membuat katalog baru.` });
      setRestockTarget(null);
      setRestockQty('10');
    } catch (error) {
      setFeedback({ tone: 'danger', title: 'Stok belum diperbarui', message: errorMessage(error) });
    } finally { setWorkingId(null); }
  };

  const advancePreorder = async (item: Listing) => {
    const next = preorderNext(item.preorderStatus);
    if (!next) return;
    setWorkingId(item.id);
    try {
      await endpoints.updatePreorderStatus(item.id, next.status);
      await Promise.all([client.invalidateQueries({ queryKey: ['my-listings'] }), client.invalidateQueries({ queryKey: ['listings'] }), client.invalidateQueries({ queryKey: ['listing', item.id] })]);
      setFeedback({ tone: 'success', title: 'Status pre-order diperbarui', message: `${item.title} sekarang berada di tahap ${next.status}.` });
    } catch (error) {
      setFeedback({ tone: 'danger', title: 'Status PO belum berubah', message: errorMessage(error) });
    } finally { setWorkingId(null); }
  };

  const preorderOrders = useMemo(() => {
    if (!ordersTarget) return [] as Transaction[];
    return (sellerTransactions.data || [])
      .filter(transaction => transaction.listing.id === ordersTarget.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [ordersTarget, sellerTransactions.data]);
  const preorderActiveOrders = preorderOrders.filter(order => order.status !== 'CANCELLED');
  const preorderUnits = preorderActiveOrders.reduce((total, order) => total + order.quantity, 0);
  const preorderValue = preorderActiveOrders.reduce((total, order) => total + toNumber(order.totalPrice), 0);
  const preorderCompleted = preorderActiveOrders.filter(order => order.status === 'COMPLETED').length;

  const create = <Button title="Buat listing" icon="add" onPress={() => router.push('/(student)/listing/form')} />;
  const filterOptions: { key: FilterKey; label: string; count: number }[] = [
    { key: 'ALL', label: 'Semua', count: counts.total },
    { key: 'ACTIVE', label: 'Aktif', count: counts.active },
    { key: 'OUT_OF_STOCK', label: 'Stok habis', count: counts.outOfStock },
    { key: 'PREORDER', label: 'Pre-order', count: counts.preorder },
    { key: 'SOLD', label: 'Terjual', count: counts.sold },
    { key: 'MODERATED', label: 'Dimoderasi', count: counts.moderated },
    { key: 'INACTIVE', label: 'Nonaktif', count: counts.inactive },
  ];

  return <Screen>
    <Title eyebrow="ETALASE PENJUAL" subtitle="Kelola listing, pantau status, dan lihat performa penjualanmu." action={create}>Etalase saya</Title>

    <View style={styles.statsGrid}>
      <View style={[styles.statCard, !desktop && styles.statCardMobile]}>
        <View style={[styles.statIcon, { backgroundColor: colors.primarySoft }]}><Ionicons name="albums-outline" size={20} color={colors.primary} /></View>
        <View style={styles.statCopy}><Text style={styles.statValue}>{counts.total}</Text><Text style={styles.statLabel}>Total listing</Text></View>
      </View>
      <View style={[styles.statCard, !desktop && styles.statCardMobile]}>
        <View style={[styles.statIcon, { backgroundColor: colors.successSoft }]}><Ionicons name="checkmark-circle-outline" size={20} color={colors.success} /></View>
        <View style={styles.statCopy}><Text style={styles.statValue}>{counts.active}</Text><Text style={styles.statLabel}>Sedang aktif</Text></View>
      </View>
      <View style={[styles.statCard, !desktop && styles.statCardMobile]}>
        <View style={[styles.statIcon, { backgroundColor: colors.warningSoft }]}><Ionicons name="bag-check-outline" size={20} color={colors.warning} /></View>
        <View style={styles.statCopy}><Text style={styles.statValue}>{counts.outOfStock}</Text><Text style={styles.statLabel}>Stok habis</Text></View>
      </View>
      <View style={[styles.statCard, !desktop && styles.statCardMobile]}>
        <View style={[styles.statIcon, { backgroundColor: colors.dangerSoft }]}><Ionicons name="shield-outline" size={20} color={colors.danger} /></View>
        <View style={styles.statCopy}><Text style={styles.statValue}>{counts.preorder}</Text><Text style={styles.statLabel}>Pre-order</Text></View>
      </View>
    </View>

    <View style={[styles.performance, !desktop && styles.performanceMobile]}>
      <View style={styles.performanceLead}>
        <View style={styles.performanceIcon}><Ionicons name="trending-up-outline" size={21} color={colors.primary} /></View>
        <View><Text style={styles.performanceEyebrow}>PERFORMA PENJUALAN</Text><Text style={styles.performanceTitle}>Ringkasan transaksi selesai</Text></View>
      </View>
      <View style={styles.performanceMetric}><Text style={styles.performanceValue}>{completedTransactions.length}</Text><Text style={styles.performanceLabel}>Transaksi selesai</Text></View>
      <View style={styles.performanceDivider} />
      <View style={styles.performanceMetric}><Text style={styles.performanceRevenue}>{money(sellerRevenue)}</Text><Text style={styles.performanceLabel}>Pendapatan diterima</Text></View>
    </View>

    <View style={styles.sectionHeading}>
      <View><Text style={styles.listTitle}>Daftar listing</Text><Text style={styles.listCopy}>Cari, filter, dan kelola semua listing dari satu tempat.</Text></View>
      <Text style={styles.resultCount}>{filteredItems.length} ditampilkan</Text>
    </View>

    <View style={[styles.controls, !desktop && styles.controlsMobile]}>
      <View style={styles.searchWrap}>
        <Field value={keyword} onChangeText={setKeyword} icon="search-outline" placeholder="Cari judul atau kategori..." returnKeyType="search" />
      </View>
      <View style={styles.filters}>
        {filterOptions.map(option => {
          const active = filter === option.key;
          return <Pressable key={option.key} onPress={() => setFilter(option.key)} style={({ pressed }) => [styles.filter, active && styles.filterActive, pressed && styles.pressed]}>
            <Text style={[styles.filterText, active && styles.filterTextActive]}>{option.label}</Text>
            <View style={[styles.filterCount, active && styles.filterCountActive]}><Text style={[styles.filterCountText, active && styles.filterCountTextActive]}>{option.count}</Text></View>
          </Pressable>;
        })}
      </View>
    </View>

    {query.isLoading ? <Loader /> : query.isError ? <ErrorState message={errorMessage(query.error)} retry={() => query.refetch()} /> : !items.length ? <Empty title="Etalase kamu masih kosong" message="Pasang barang pertama dan mulai berjualan ke sesama Binusian." icon="storefront-outline" action={create} /> : !filteredItems.length ? <Empty title="Tidak ada listing yang cocok" message="Coba ganti kata kunci atau pilih filter lain." icon="search-outline" /> : <View style={styles.list}>{filteredItems.map(item => {
      const moderated = moderatedStatuses.has(item.status);
      const canEdit = item.status !== 'SOLD' && item.status !== 'REMOVED' && item.preorderStatus !== 'COMPLETED';
      const canDeactivate = item.status === 'ACTIVE' || item.status === 'PENDING';
      const canArchive = item.status === 'INACTIVE' || item.status === 'SOLD' || (item.mode === 'PREORDER' && item.preorderStatus === 'COMPLETED');
      const stockText = item.mode === 'SERVICE' ? 'Tanpa stok' : item.mode === 'ONE_OFF' ? (item.status === 'SOLD' ? 'Sudah terjual' : '1 unit') : item.mode === 'PREORDER' ? `Sisa kuota ${item.stockLeft ?? 0} / ${item.preorderQuota ?? item.stock ?? 0}` : `Stok ${item.stockLeft ?? 0}${item.stock != null ? ` / ${item.stock}` : ''}`;
      const nextPo = item.mode === 'PREORDER' ? preorderNext(item.preorderStatus) : null;
      const label = derivedLabel(item);
      return <Card key={item.id} style={[styles.item, !desktop && styles.itemMobile]}>
        <Pressable onPress={() => router.push({ pathname: '/(student)/listing/[id]', params: { id: item.id } })} style={({ pressed }) => [styles.media, !desktop && styles.mediaMobile, pressed && styles.pressed]}>
          {item.images?.[0] ? <Image source={item.images[0]} style={styles.image} contentFit="cover" transition={140} cachePolicy="memory-disk" /> : <Ionicons name={item.type === 'SERVICE' ? 'construct-outline' : 'cube-outline'} size={30} color="#6E879F" />}
          {(item.images?.length || 0) > 1 ? <View style={styles.imageCount}><Ionicons name="images-outline" size={11} color={colors.white} /><Text style={styles.imageCountText}>{item.images.length}</Text></View> : null}
        </Pressable>

        <View style={styles.itemBody}>
          <View style={styles.metaRow}>
            <Text style={styles.itemType}>{modeLabel[item.mode] || (item.type === 'SERVICE' ? 'JASA' : 'BARANG')}</Text>
            <View style={styles.metaDot} />
            <Text numberOfLines={1} style={styles.category}>{item.category}</Text>
          </View>
          <Pressable onPress={() => router.push({ pathname: '/(student)/listing/[id]', params: { id: item.id } })}><Text numberOfLines={1} style={styles.itemTitle}>{item.title}</Text></Pressable>
          <Text style={styles.price}>{money(item.price)}</Text>
          <View style={styles.itemMetaLine}>
            <View style={styles.metaInfo}><Ionicons name={item.type === 'SERVICE' ? 'construct-outline' : 'cube-outline'} size={13} color={colors.muted} /><Text style={styles.metaText}>{stockText}</Text></View>
            <View style={styles.metaInfo}><Ionicons name="calendar-outline" size={13} color={colors.muted} /><Text style={styles.metaText}>{item.mode === 'PREORDER' && item.preorderDeadline ? `Tutup ${dateLabel(item.preorderDeadline)}` : dateLabel(item.createdAt)}</Text></View>
          </View>
          {moderated ? <View style={styles.moderationNote}><Ionicons name="information-circle-outline" size={14} color={colors.danger} /><Text style={styles.moderationText}>Listing sedang ditinjau atau dibatasi admin.</Text></View> : null}
        </View>

        <View style={[styles.itemRight, !desktop && styles.itemRightMobile]}>
          <View style={[styles.badge, (item.status === 'ACTIVE' || item.status === 'PENDING') && styles.badgeActive, item.status === 'SOLD' && styles.badgeSold, moderated && styles.badgeDanger]}>
            <View style={[styles.badgeDot, (item.status === 'ACTIVE' || item.status === 'PENDING') && styles.badgeDotActive, item.status === 'SOLD' && styles.badgeDotSold, moderated && styles.badgeDotDanger]} />
            <Text style={styles.badgeText}>{label}</Text>
          </View>
          <View style={styles.actions}>
            <Pressable onPress={() => router.push({ pathname: '/(student)/listing/[id]', params: { id: item.id } })} style={({ pressed }) => [styles.actionGhost, pressed && styles.pressed]}><Ionicons name="eye-outline" size={17} color={colors.textSoft} /><Text style={styles.actionGhostText}>Lihat</Text></Pressable>
            {item.mode === 'PREORDER' ? <Pressable onPress={() => setOrdersTarget(item)} style={({ pressed }) => [styles.actionGhost, pressed && styles.pressed]}><Ionicons name="people-outline" size={17} color={colors.primary} /><Text style={[styles.actionGhostText, { color: colors.primary }]}>Pesanan PO</Text></Pressable> : null}
            {item.mode === 'STOCKED' && !moderated ? <Pressable onPress={() => { setRestockTarget({ id: item.id, title: item.title }); setRestockQty('10'); }} style={({ pressed }) => [styles.edit, pressed && styles.pressed]}><Ionicons name="add-circle-outline" size={17} color={colors.primary} /><Text style={styles.editText}>+ Stok</Text></Pressable> : null}
            {nextPo && item.status === 'ACTIVE' && !moderated ? <Pressable disabled={workingId === item.id} onPress={() => advancePreorder(item)} style={({ pressed }) => [styles.edit, pressed && styles.pressed]}><Ionicons name="arrow-forward-circle-outline" size={17} color={colors.primary} /><Text style={styles.editText}>{nextPo.label}</Text></Pressable> : null}
            {canEdit ? <Pressable onPress={() => router.push({ pathname: '/(student)/listing/form', params: { id: item.id } })} style={({ pressed }) => [styles.edit, pressed && styles.pressed]}><Ionicons name="create-outline" size={17} color={colors.primary} /><Text style={styles.editText}>Edit</Text></Pressable> : null}
            {canDeactivate ? <Pressable accessibilityLabel={`Nonaktifkan ${item.title}`} disabled={workingId === item.id} onPress={() => setTarget({ id: item.id, title: item.title, action: 'deactivate' })} style={({ pressed }) => [styles.power, pressed && styles.pressed]}><Ionicons name="power-outline" size={18} color={colors.textSoft} /></Pressable> : null}
            {canArchive ? <Pressable accessibilityLabel={`Arsipkan ${item.title}`} disabled={workingId === item.id} onPress={() => setTarget({ id: item.id, title: item.title, action: 'archive' })} style={({ pressed }) => [styles.archive, pressed && styles.pressed]}><Ionicons name="archive-outline" size={17} color={colors.danger} /><Text style={styles.archiveText}>Arsipkan</Text></Pressable> : null}
          </View>
        </View>
      </Card>;
    })}</View>}

    <Modal visible={Boolean(ordersTarget)} transparent animationType="fade" onRequestClose={() => setOrdersTarget(null)}>
      <View style={styles.modalBackdrop}>
        <Card style={styles.ordersModal}>
          <View style={styles.ordersHeader}>
            <View style={styles.restockIcon}><Ionicons name="people-outline" size={22} color={colors.primary} /></View>
            <View style={styles.flex}><Text style={styles.restockTitle}>Pesanan pre-order</Text><Text style={styles.restockCopy}>{ordersTarget?.title}</Text></View>
            <Pressable onPress={() => setOrdersTarget(null)} style={styles.modalClose}><Ionicons name="close" size={20} color={colors.textSoft} /></Pressable>
          </View>
          <View style={styles.ordersStats}>
            <View style={styles.orderStat}><Text style={styles.orderStatValue}>{preorderActiveOrders.length}</Text><Text style={styles.orderStatLabel}>Pesanan aktif</Text></View>
            <View style={styles.orderStat}><Text style={styles.orderStatValue}>{preorderUnits}</Text><Text style={styles.orderStatLabel}>Total unit</Text></View>
            <View style={styles.orderStat}><Text style={styles.orderStatValue}>{preorderCompleted}</Text><Text style={styles.orderStatLabel}>Sudah selesai</Text></View>
            <View style={[styles.orderStat, styles.orderStatWide]}><Text style={[styles.orderStatValue, { color: colors.primaryDark }]}>{money(preorderValue)}</Text><Text style={styles.orderStatLabel}>Nilai order</Text></View>
          </View>
          {ordersTarget?.preorderMinOrder ? <View style={styles.minimumBox}><Ionicons name={preorderUnits >= ordersTarget.preorderMinOrder ? 'checkmark-circle-outline' : 'time-outline'} size={18} color={preorderUnits >= ordersTarget.preorderMinOrder ? colors.success : colors.warning} /><Text style={styles.minimumText}>{preorderUnits >= ordersTarget.preorderMinOrder ? `Minimum ${ordersTarget.preorderMinOrder} unit sudah tercapai.` : `${preorderUnits} / ${ordersTarget.preorderMinOrder} unit menuju minimum PO.`}</Text></View> : null}
          <ScrollView style={styles.ordersScroll} contentContainerStyle={styles.ordersList} showsVerticalScrollIndicator={false}>
            {sellerTransactions.isLoading ? <Loader /> : !preorderOrders.length ? <View style={styles.ordersEmpty}><Ionicons name="receipt-outline" size={26} color={colors.muted} /><Text style={styles.ordersEmptyTitle}>Belum ada pesanan</Text><Text style={styles.ordersEmptyCopy}>Buyer yang ikut pre-order akan muncul di sini setelah checkout.</Text></View> : preorderOrders.map(order => {
              const status = ({ PENDING: 'Menunggu bayar', PAID: 'Sudah bayar', CONFIRMED: 'Diproses', COMPLETED: 'Selesai', CANCELLED: 'Dibatalkan' } as Record<string, string>)[order.status] || order.status;
              return <Pressable key={order.id} onPress={() => { setOrdersTarget(null); router.push({ pathname: '/(student)/transaction/[id]', params: { id: order.id } }); }} style={({ pressed }) => [styles.orderRow, pressed && styles.pressed]}>
                <View style={styles.orderAvatar}><Text style={styles.orderAvatarText}>{order.buyer?.name?.[0]?.toUpperCase() || 'B'}</Text></View>
                <View style={styles.flex}><Text style={styles.orderBuyer}>{order.buyer?.name || 'Buyer BMarket'}</Text><Text style={styles.orderMeta}>{order.quantity} item · {dateLabel(order.createdAt)}</Text></View>
                <View style={styles.orderEnd}><Text style={styles.orderAmount}>{money(order.totalPrice)}</Text><Text style={[styles.orderStatus, order.status === 'COMPLETED' && { color: colors.success }, order.status === 'CANCELLED' && { color: colors.danger }]}>{status}</Text></View>
                <Ionicons name="chevron-forward" size={16} color={colors.muted} />
              </Pressable>;
            })}
          </ScrollView>
          <Button title="Tutup" variant="secondary" onPress={() => setOrdersTarget(null)} />
        </Card>
      </View>
    </Modal>

    <Modal visible={Boolean(restockTarget)} transparent animationType="fade" onRequestClose={() => setRestockTarget(null)}>
      <View style={styles.modalBackdrop}>
        <Card style={styles.restockModal}>
          <View style={styles.restockHeader}><View style={styles.restockIcon}><Ionicons name="layers-outline" size={22} color={colors.primary} /></View><View style={styles.flex}><Text style={styles.restockTitle}>Tambah stok</Text><Text style={styles.restockCopy}>{restockTarget?.title}</Text></View></View>
          <Field label="Jumlah stok tambahan" value={restockQty} onChangeText={value => setRestockQty(value.replace(/[^0-9]/g, ''))} keyboardType="number-pad" placeholder="10" />
          <Text style={styles.restockHint}>Stok ditambahkan ke katalog yang sama. Kamu tidak perlu membuat listing baru.</Text>
          <View style={styles.restockActions}><View style={styles.flex}><Button title="Batal" variant="secondary" onPress={() => setRestockTarget(null)} /></View><View style={styles.flex}><Button title="Tambah stok" icon="add" loading={Boolean(restockTarget && workingId === restockTarget.id)} onPress={restock} /></View></View>
        </Card>
      </View>
    </Modal>

    <FeedbackDialog
      visible={Boolean(target)}
      tone={target?.action === 'archive' ? 'danger' : 'warning'}
      title={target?.action === 'archive' ? 'Arsipkan listing?' : 'Nonaktifkan listing?'}
      message={target ? (target.action === 'archive'
        ? `${target.title} akan dipindahkan dari Etalase saya tanpa menghapus histori transaksi. Data tetap tersedia untuk audit dan transaksi lama.`
        : `${target.title} akan berhenti tampil di marketplace. Setelah nonaktif, listing dapat kamu hapus dari etalase.`) : ''}
      primaryLabel={target?.action === 'archive' ? 'Arsipkan' : 'Nonaktifkan'}
      secondaryLabel="Batal"
      loading={Boolean(target && workingId === target.id)}
      onClose={() => setTarget(null)}
      onSecondary={() => setTarget(null)}
      onPrimary={remove}
    />
    <FeedbackDialog visible={Boolean(feedback)} tone={feedback?.tone || 'success'} title={feedback?.title || ''} message={feedback?.message || ''} onClose={() => setFeedback(null)} />
  </Screen>;
}

const styles = StyleSheet.create({
  pressed: { opacity: .67 },
  statsGrid: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  statCard: { flex: 1, minWidth: 190, minHeight: 96, paddingHorizontal: 18, paddingVertical: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 13 },
  statCardMobile: { flexBasis: '47%' },
  statIcon: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  statCopy: { gap: 1 },
  statValue: { fontFamily: 'PoppinsBold', fontSize: 23, lineHeight: 28, color: colors.text },
  statLabel: { fontFamily: 'PoppinsRegular', fontSize: 12, color: colors.muted },

  performance: { minHeight: 88, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: '#CFE1F6', backgroundColor: '#F7FAFE', flexDirection: 'row', alignItems: 'center', gap: 24 },
  performanceMobile: { flexWrap: 'wrap', alignItems: 'flex-start', gap: 14 },
  performanceLead: { flex: 1, minWidth: 270, flexDirection: 'row', alignItems: 'center', gap: 12 },
  performanceIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  performanceEyebrow: { fontFamily: 'PoppinsBold', fontSize: 10.5, letterSpacing: .65, color: colors.primary },
  performanceTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 13, color: colors.text, marginTop: 1 },
  performanceMetric: { minWidth: 132, alignItems: 'flex-end' },
  performanceValue: { fontFamily: 'PoppinsBold', fontSize: 20, color: colors.text },
  performanceRevenue: { fontFamily: 'PoppinsBold', fontSize: 18, color: colors.primaryDark },
  performanceLabel: { fontFamily: 'PoppinsRegular', fontSize: 11.5, color: colors.muted, marginTop: 2 },
  performanceDivider: { width: 1, height: 38, backgroundColor: colors.border },

  sectionHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' },
  listTitle: { fontFamily: 'PoppinsBold', fontSize: 21, color: colors.text },
  listCopy: { fontFamily: 'PoppinsRegular', fontSize: 12.5, lineHeight: 19, color: colors.muted, marginTop: 2 },
  resultCount: { fontFamily: 'PoppinsMedium', fontSize: 12, color: colors.muted },
  controls: { padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 12 },
  controlsMobile: { alignItems: 'stretch', flexDirection: 'column' },
  searchWrap: { minWidth: 250, maxWidth: 390, flex: 1 },
  filters: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 7, flexWrap: 'wrap' },
  filter: { minHeight: 36, paddingHorizontal: 11, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 7 },
  filterActive: { borderColor: '#B7D3F3', backgroundColor: colors.primarySoft },
  filterText: { fontFamily: 'PoppinsMedium', fontSize: 11.5, color: colors.textSoft },
  filterTextActive: { fontFamily: 'PoppinsSemiBold', color: colors.primary },
  filterCount: { minWidth: 21, height: 21, paddingHorizontal: 5, borderRadius: 11, backgroundColor: '#F0F3F6', alignItems: 'center', justifyContent: 'center' },
  filterCountActive: { backgroundColor: colors.surface },
  filterCountText: { fontFamily: 'PoppinsSemiBold', fontSize: 10, color: colors.muted },
  filterCountTextActive: { color: colors.primary },

  list: { gap: 10 },
  item: { minHeight: 126, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 14 },
  itemMobile: { flexWrap: 'wrap', alignItems: 'flex-start' },
  media: { position: 'relative', width: 96, height: 96, borderRadius: 12, backgroundColor: '#E8EEF4', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  mediaMobile: { width: 88, height: 88 },
  image: { width: '100%', height: '100%' },
  imageCount: { position: 'absolute', right: 5, bottom: 5, minHeight: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: 'rgba(16,42,67,.82)', flexDirection: 'row', alignItems: 'center', gap: 3 },
  imageCountText: { fontFamily: 'PoppinsSemiBold', fontSize: 10.5, color: colors.white },
  itemBody: { flex: 1, minWidth: 220, gap: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemType: { fontFamily: 'PoppinsBold', fontSize: 10.5, letterSpacing: .55, color: colors.primary },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.borderStrong },
  category: { maxWidth: 180, fontFamily: 'PoppinsSemiBold', fontSize: 10.5, color: colors.muted, textTransform: 'uppercase' },
  itemTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 16, lineHeight: 22, color: colors.text },
  price: { fontFamily: 'PoppinsBold', fontSize: 17, color: colors.primaryDark },
  itemMetaLine: { marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' },
  metaInfo: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontFamily: 'PoppinsRegular', fontSize: 11.5, color: colors.muted },
  moderationNote: { marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 5 },
  moderationText: { fontFamily: 'PoppinsRegular', fontSize: 11, color: colors.danger },

  itemRight: { minWidth: 235, alignSelf: 'stretch', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  itemRightMobile: { width: '100%', minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.warningSoft },
  badgeActive: { backgroundColor: colors.successSoft },
  badgeSold: { backgroundColor: '#FFF4E2' },
  badgeDanger: { backgroundColor: colors.dangerSoft },
  badgeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.warning },
  badgeDotActive: { backgroundColor: colors.success },
  badgeDotSold: { backgroundColor: '#E08A00' },
  badgeDotDanger: { backgroundColor: colors.danger },
  badgeText: { fontFamily: 'PoppinsSemiBold', fontSize: 11.5, color: colors.textSoft },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  actionGhost: { minHeight: 38, paddingHorizontal: 11, borderRadius: 9, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionGhostText: { fontFamily: 'PoppinsSemiBold', fontSize: 11.5, color: colors.textSoft },
  archive: { minHeight: 38, paddingHorizontal: 11, borderRadius: 9, borderWidth: 1, borderColor: '#F2C3C3', backgroundColor: colors.dangerSoft, flexDirection: 'row', alignItems: 'center', gap: 5 },
  archiveText: { fontFamily: 'PoppinsSemiBold', fontSize: 11.5, color: colors.danger },
  edit: { minHeight: 38, paddingHorizontal: 11, borderRadius: 9, backgroundColor: colors.primarySoft, flexDirection: 'row', alignItems: 'center', gap: 5 },
  editText: { fontFamily: 'PoppinsSemiBold', fontSize: 11.5, color: colors.primary },
  power: { width: 38, height: 38, borderRadius: 9, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  modalBackdrop: { flex: 1, padding: 18, backgroundColor: 'rgba(10,26,41,.55)', alignItems: 'center', justifyContent: 'center' },
  ordersModal: { width: '100%', maxWidth: 720, maxHeight: '86%', gap: 15, padding: 20 },
  ordersHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  modalClose: { width: 36, height: 36, borderRadius: 9, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  ordersStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  orderStat: { flex: 1, minWidth: 112, padding: 11, borderRadius: 11, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  orderStatWide: { minWidth: 165 },
  orderStatValue: { fontFamily: 'PoppinsBold', fontSize: 17, color: colors.text },
  orderStatLabel: { marginTop: 1, fontFamily: 'PoppinsRegular', fontSize: 10.5, color: colors.muted },
  minimumBox: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: '#F8FAFD', borderWidth: 1, borderColor: colors.border },
  minimumText: { flex: 1, fontFamily: 'PoppinsMedium', fontSize: 11.5, color: colors.textSoft },
  ordersScroll: { maxHeight: 380 },
  ordersList: { gap: 7, paddingVertical: 1 },
  ordersEmpty: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 5 },
  ordersEmptyTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 14, color: colors.text },
  ordersEmptyCopy: { maxWidth: 360, fontFamily: 'PoppinsRegular', fontSize: 11.5, color: colors.muted, textAlign: 'center' },
  orderRow: { minHeight: 66, padding: 10, borderRadius: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 10 },
  orderAvatar: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  orderAvatarText: { fontFamily: 'PoppinsBold', fontSize: 12, color: colors.primary },
  orderBuyer: { fontFamily: 'PoppinsSemiBold', fontSize: 12.5, color: colors.text },
  orderMeta: { marginTop: 1, fontFamily: 'PoppinsRegular', fontSize: 10.5, color: colors.muted },
  orderEnd: { alignItems: 'flex-end', gap: 1 },
  orderAmount: { fontFamily: 'PoppinsSemiBold', fontSize: 11.5, color: colors.text },
  orderStatus: { fontFamily: 'PoppinsMedium', fontSize: 10, color: colors.primary },
  restockModal: { width: '100%', maxWidth: 460, gap: 16, padding: 20 },
  restockHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  restockIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  restockTitle: { fontFamily: 'PoppinsBold', fontSize: 18, color: colors.text },
  restockCopy: { fontFamily: 'PoppinsRegular', fontSize: 11.5, color: colors.muted, marginTop: 1 },
  restockHint: { fontFamily: 'PoppinsRegular', fontSize: 11.5, lineHeight: 18, color: colors.muted },
  restockActions: { flexDirection: 'row', gap: 9 },
  flex: { flex: 1 },
});
