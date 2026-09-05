import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { AdminEmptyState, AdminInfoRow, AdminStatCard, AdminStatusPill } from '@/components/admin-ui';
import { Button, Card, ErrorState, FeedbackDialog, Field, Loader, money, Screen, Title } from '@/components/ui';
import { colors, radius } from '@/constants/theme';
import { endpoints, errorMessage } from '@/lib/api';
import type { Dispute } from '@/types';

const reasonLabel: Record<string, string> = { ITEM_NOT_AS_DESCRIBED: 'Barang tidak sesuai', ITEM_DAMAGED: 'Barang rusak', NOT_RECEIVED: 'Tidak diterima', SELLER_NO_SHOW: 'Seller tidak hadir', BUYER_NO_SHOW: 'Buyer tidak hadir', OTHER: 'Lainnya' };
type ResolveAction = 'START_REVIEW' | 'REFUND_BUYER' | 'RELEASE_SELLER' | 'REJECT';
const actionCopy: Record<Exclude<ResolveAction, 'START_REVIEW'>, { title: string; message: string; label: string; tone: 'warning' | 'danger' }> = {
  REFUND_BUYER: { title: 'Refund dana ke buyer?', message: 'Dana escrow akan dikembalikan ke buyer dan keputusan ini menutup sengketa.', label: 'Refund buyer', tone: 'warning' },
  RELEASE_SELLER: { title: 'Lepaskan dana ke seller?', message: 'Transaksi akan diselesaikan dan dana escrow akan diteruskan ke seller.', label: 'Release seller', tone: 'warning' },
  REJECT: { title: 'Tolak sengketa ini?', message: 'Sengketa akan ditutup dan flow transaksi dibuka kembali sesuai status terakhir.', label: 'Tolak sengketa', tone: 'danger' },
};

export default function AdminDisputes() {
  const mobile = useWindowDimensions().width < 700;
  const client = useQueryClient();
  const [selected, setSelected] = useState<Dispute | null>(null);
  const [note, setNote] = useState('');
  const [search, setSearch] = useState('');
  const [pendingAction, setPendingAction] = useState<Exclude<ResolveAction, 'START_REVIEW'> | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'danger'; title: string; message: string } | null>(null);
  const query = useQuery({ queryKey: ['admin-disputes'], queryFn: () => endpoints.adminDisputes() });
  const resolve = useMutation({
    mutationFn: (action: ResolveAction) => endpoints.resolveDispute(selected!.id, action, note.trim() || undefined),
    onSuccess: (_, action) => {
      const finished = action !== 'START_REVIEW'; setPendingAction(null); setNote(''); if (finished) setSelected(null);
      client.invalidateQueries({ queryKey: ['admin-disputes'] }); client.invalidateQueries({ queryKey: ['admin-stats'] });
      setFeedback({ tone: 'success', title: action === 'START_REVIEW' ? 'Sengketa masuk tahap review' : 'Keputusan sengketa tersimpan', message: action === 'START_REVIEW' ? 'Kasus ditandai sedang ditinjau. Periksa bukti dan catatan sebelum menentukan keputusan akhir.' : 'Buyer dan seller akan melihat hasil keputusan ini dari transaksi dan notifikasi mereka.' });
    },
    onError: error => { setPendingAction(null); setFeedback({ tone: 'danger', title: 'Keputusan belum tersimpan', message: errorMessage(error) }); },
  });
  const all = query.data || [];
  const active = all.filter(item => ['OPEN', 'IN_REVIEW'].includes(item.status));
  const q = search.trim().toLowerCase();
  const visible = active.filter(item => !q || [item.id, item.transactionId, item.openedBy?.name, item.description, item.transaction?.listingTitleSnapshot, item.transaction?.listing?.title].some(value => String(value || '').toLowerCase().includes(q)));

  return (
    <Screen backgroundColor={colors.surfaceMuted}>
      <Title subtitle="Tinjau bukti sebelum memutuskan ke mana dana escrow dilepas.">Sengketa transaksi</Title>
      <View style={styles.stats}>
        <AdminStatCard label="Semua sengketa" value={all.length} caption="Seluruh kasus tercatat" icon="file-tray-full-outline" />
        <AdminStatCard label="Menunggu tinjauan" value={all.filter(item => item.status === 'OPEN').length} caption="Belum diperiksa admin" icon="time-outline" color={colors.warning} background={colors.warningSoft} />
        <AdminStatCard label="Sedang ditinjau" value={all.filter(item => item.status === 'IN_REVIEW').length} caption="Kasus dalam review" icon="hourglass-outline" color="#7357E7" background="#F1EDFF" />
        <AdminStatCard label="Selesai" value={all.filter(item => ['RESOLVED', 'REJECTED'].includes(item.status)).length} caption="Keputusan sudah dibuat" icon="checkmark-circle-outline" color={colors.success} background={colors.successSoft} />
      </View>
      <Card style={styles.toolbar}><Field icon="search-outline" value={search} onChangeText={setSearch} placeholder="Cari ID transaksi, pengguna, atau listing..." /></Card>
      {query.isLoading ? <Loader /> : query.isError ? <ErrorState message={errorMessage(query.error)} retry={() => query.refetch()} /> : <View style={styles.workspace}>
        <Card style={[styles.caseArea, mobile && styles.caseAreaMobile]}>
          {!active.length ? <AdminEmptyState title="Tidak ada sengketa aktif" message="Semua transaksi berjalan tanpa sengketa yang perlu ditangani." /> : !visible.length ? <AdminEmptyState compact icon="search-outline" title="Sengketa tidak ditemukan" message="Coba gunakan kata kunci pencarian yang berbeda." /> : <View style={styles.list}>{visible.map(item => <Pressable key={item.id} onPress={() => { setSelected(item); setNote(''); }} style={({ pressed }) => pressed ? styles.pressed : undefined}><View style={[styles.caseCard, selected?.id === item.id && styles.active]}><View style={styles.head}><View style={styles.warn}><Ionicons name="warning-outline" size={20} color={colors.warning} /></View><View style={styles.flex}><Text style={styles.reason}>{reasonLabel[item.reason] || item.reason}</Text><Text style={styles.title}>{item.transaction?.listingTitleSnapshot || item.transaction?.listing?.title || 'Transaksi BMarket'}</Text><Text style={styles.meta}>{item.openedBy?.name || 'Binusian'} · {item.id.slice(0, 8)}</Text></View><AdminStatusPill label={item.status === 'OPEN' ? 'Menunggu tinjauan' : 'Sedang ditinjau'} tone={item.status === 'OPEN' ? 'warning' : 'primary'} /><Text style={styles.amount}>{money(item.transaction?.grandTotal)}</Text></View><Text numberOfLines={2} style={styles.desc}>{item.description}</Text></View></Pressable>)}</View>}
        </Card>
        <View style={[styles.side, mobile && styles.sideMobile]}>
          {selected ? <Card style={styles.panel}><Text style={styles.panelTitle}>Keputusan admin</Text><Text style={styles.panelCopy}>Tinjau bukti, tulis dasar keputusan, lalu pilih hasil yang sesuai.</Text>{selected.evidenceUrls?.length ? <View style={styles.evidenceWrap}><View style={styles.evidence}><Ionicons name="images-outline" size={18} color={colors.primary} /><Text style={styles.evidenceText}>{selected.evidenceUrls.length} bukti foto terlampir</Text></View><View style={styles.evidenceGrid}>{selected.evidenceUrls.map((url, index) => <Image key={`${url}-${index}`} source={{ uri: url }} style={styles.evidenceImage} />)}</View></View> : null}<Field label="Catatan keputusan" multiline value={note} onChangeText={setNote} placeholder="Jelaskan dasar keputusan..." hint="Catatan membantu buyer dan seller memahami hasil review." />{selected.status === 'OPEN' ? <Button title="Mulai review" variant="secondary" icon="eye-outline" loading={resolve.isPending} onPress={() => resolve.mutate('START_REVIEW')} /> : null}<Button title="Refund buyer" icon="return-down-back-outline" disabled={resolve.isPending} onPress={() => setPendingAction('REFUND_BUYER')} /><Button title="Release ke seller" icon="wallet-outline" disabled={resolve.isPending} onPress={() => setPendingAction('RELEASE_SELLER')} /><Button title="Tolak sengketa" variant="danger" icon="close-circle-outline" disabled={resolve.isPending} onPress={() => setPendingAction('REJECT')} /></Card> : <Card style={styles.rules}><Text style={styles.rulesTitle}>Aturan penyelesaian</Text><AdminInfoRow icon="documents-outline" title="1. Kumpulkan bukti" message="Tinjau bukti dari kedua pihak secara objektif dan menyeluruh." /><AdminInfoRow icon="analytics-outline" title="2. Analisis & evaluasi" message="Pastikan bukti sesuai dengan aturan dan kebijakan BMarket." /><AdminInfoRow icon="checkmark-done-outline" title="3. Ambil keputusan" message="Putuskan ke mana dana escrow dilepas berdasarkan evaluasi." /><AdminInfoRow icon="notifications-outline" title="4. Notifikasi hasil" message="Hasil keputusan akan terlihat oleh kedua pihak." /></Card>}
        </View>
      </View>}
      <FeedbackDialog visible={Boolean(pendingAction)} tone={pendingAction ? actionCopy[pendingAction].tone : 'warning'} title={pendingAction ? actionCopy[pendingAction].title : ''} message={pendingAction ? `${actionCopy[pendingAction].message}${note.trim() ? ' Catatan admin akan ikut disimpan.' : ''}` : ''} primaryLabel={pendingAction ? actionCopy[pendingAction].label : 'Lanjut'} secondaryLabel="Batal" loading={resolve.isPending} onClose={() => setPendingAction(null)} onSecondary={() => setPendingAction(null)} onPrimary={() => pendingAction && resolve.mutate(pendingAction)} />
      <FeedbackDialog visible={Boolean(feedback)} tone={feedback?.tone || 'success'} title={feedback?.title || ''} message={feedback?.message || ''} onClose={() => setFeedback(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  toolbar: { padding: 14 },
  workspace: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' },
  caseArea: { flex: 1, minWidth: 520, padding: 0, overflow: 'hidden' },
  caseAreaMobile: { minWidth: 0, width: '100%', flexBasis: '100%' },
  side: { width: 360, maxWidth: '100%' },
  sideMobile: { width: '100%', minWidth: 0 },
  list: { padding: 12, gap: 9 },
  pressed: { opacity: .72 },
  caseCard: { padding: 15, gap: 9, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  active: { borderColor: '#A7CDF6', backgroundColor: '#FBFDFF' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  warn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.warningSoft, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 180 },
  reason: { fontFamily: 'PoppinsBold', fontSize: 10.5, letterSpacing: .45, color: colors.warning },
  title: { fontFamily: 'PoppinsSemiBold', fontSize: 14, color: colors.text },
  meta: { fontFamily: 'PoppinsRegular', fontSize: 11.5, color: colors.muted },
  amount: { fontFamily: 'PoppinsBold', fontSize: 13, color: colors.primaryDark },
  desc: { fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 19, color: colors.textSoft },
  panel: { gap: 11 },
  panelTitle: { fontFamily: 'PoppinsBold', fontSize: 18, color: colors.text },
  panelCopy: { fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 19, color: colors.muted },
  evidenceWrap: { gap: 8 },
  evidence: { padding: 10, borderRadius: radius.md, backgroundColor: colors.primarySoft, flexDirection: 'row', alignItems: 'center', gap: 8 },
  evidenceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  evidenceImage: { width: 76, height: 76, borderRadius: 10, backgroundColor: colors.surfaceMuted },
  evidenceText: { fontFamily: 'PoppinsMedium', fontSize: 11.5, color: colors.primary },
  rules: { gap: 0 },
  rulesTitle: { color: colors.text, fontFamily: 'PoppinsSemiBold', fontSize: 16, marginBottom: 5 },
});
