import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Empty, ErrorState, FeedbackDialog, Field, Loader, money, Screen, Title } from '@/components/ui';
import { colors, radius } from '@/constants/theme';
import { endpoints, errorMessage } from '@/lib/api';
import type { Dispute } from '@/types';

const reasonLabel: Record<string, string> = {
  ITEM_NOT_AS_DESCRIBED: 'Barang tidak sesuai',
  ITEM_DAMAGED: 'Barang rusak',
  NOT_RECEIVED: 'Tidak diterima',
  SELLER_NO_SHOW: 'Seller tidak hadir',
  BUYER_NO_SHOW: 'Buyer tidak hadir',
  OTHER: 'Lainnya',
};

type ResolveAction = 'START_REVIEW' | 'REFUND_BUYER' | 'RELEASE_SELLER' | 'REJECT';

const actionCopy: Record<Exclude<ResolveAction, 'START_REVIEW'>, { title: string; message: string; label: string; tone: 'warning' | 'danger' }> = {
  REFUND_BUYER: { title: 'Refund dana ke buyer?', message: 'Dana escrow akan dikembalikan ke buyer dan keputusan ini menutup sengketa.', label: 'Refund buyer', tone: 'warning' },
  RELEASE_SELLER: { title: 'Lepaskan dana ke seller?', message: 'Transaksi akan diselesaikan dan dana escrow akan diteruskan ke seller.', label: 'Release seller', tone: 'warning' },
  REJECT: { title: 'Tolak sengketa ini?', message: 'Sengketa akan ditutup dan flow transaksi dibuka kembali sesuai status terakhir.', label: 'Tolak sengketa', tone: 'danger' },
};

export default function AdminDisputes() {
  const client = useQueryClient();
  const [selected, setSelected] = useState<Dispute | null>(null);
  const [note, setNote] = useState('');
  const [pendingAction, setPendingAction] = useState<Exclude<ResolveAction, 'START_REVIEW'> | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'danger'; title: string; message: string } | null>(null);
  const query = useQuery({ queryKey: ['admin-disputes'], queryFn: () => endpoints.adminDisputes() });
  const resolve = useMutation({
    mutationFn: (action: ResolveAction) => endpoints.resolveDispute(selected!.id, action, note.trim() || undefined),
    onSuccess: (_, action) => {
      const finished = action !== 'START_REVIEW';
      setPendingAction(null);
      setNote('');
      if (finished) setSelected(null);
      client.invalidateQueries({ queryKey: ['admin-disputes'] });
      client.invalidateQueries({ queryKey: ['admin-stats'] });
      setFeedback({ tone: 'success', title: action === 'START_REVIEW' ? 'Sengketa masuk tahap review' : 'Keputusan sengketa tersimpan', message: action === 'START_REVIEW' ? 'Kasus ditandai sedang ditinjau. Periksa bukti dan catatan sebelum menentukan keputusan akhir.' : 'Buyer dan seller akan melihat hasil keputusan ini dari transaksi dan notifikasi mereka.' });
    },
    onError: error => {
      setPendingAction(null);
      setFeedback({ tone: 'danger', title: 'Keputusan belum tersimpan', message: errorMessage(error) });
    },
  });

  const active = (query.data || []).filter(item => ['OPEN', 'IN_REVIEW'].includes(item.status));

  return <Screen>
    <Title eyebrow="ESCROW SAFETY" subtitle="Tinjau bukti sebelum memutuskan ke mana dana escrow dilepas.">Sengketa transaksi</Title>
    {query.isLoading ? <Loader /> : query.isError ? <ErrorState message={errorMessage(query.error)} retry={() => query.refetch()} /> : !active.length ? <Empty icon="shield-checkmark-outline" title="Tidak ada sengketa aktif" message="Semua transaksi berjalan tanpa sengketa yang perlu ditangani." /> : <View style={styles.columns}>
      <View style={styles.list}>{active.map(item => <Pressable key={item.id} onPress={() => { setSelected(item); setNote(''); }} style={({ pressed }) => pressed ? styles.pressed : undefined}><Card style={[styles.card, selected?.id === item.id && styles.active]}><View style={styles.head}><View style={styles.warn}><Ionicons name="warning-outline" size={21} color={colors.warning} /></View><View style={styles.flex}><Text style={styles.reason}>{reasonLabel[item.reason] || item.reason}</Text><Text style={styles.title}>{item.transaction?.listingTitleSnapshot || item.transaction?.listing?.title || 'Transaksi BMarket'}</Text><Text style={styles.meta}>{item.openedBy?.name || 'Binusian'} · {item.status}</Text></View><Text style={styles.amount}>{money(item.transaction?.grandTotal)}</Text></View><Text numberOfLines={2} style={styles.desc}>{item.description}</Text></Card></Pressable>)}</View>
      {selected ? <Card style={styles.panel}><Text style={styles.panelTitle}>Keputusan admin</Text><Text style={styles.panelCopy}>Refund mengembalikan total pembayaran ke buyer. Release menyelesaikan transaksi dan membayar seller. Reject membuka kembali flow transaksi.</Text>{selected.evidenceUrls?.length ? <View style={styles.evidenceWrap}><View style={styles.evidence}><Ionicons name="images-outline" size={19} color={colors.primary} /><Text style={styles.evidenceText}>{selected.evidenceUrls.length} bukti foto terlampir</Text></View><View style={styles.evidenceGrid}>{selected.evidenceUrls.map((url, index) => <Image key={`${url}-${index}`} source={{ uri: url }} style={styles.evidenceImage} />)}</View></View> : null}<Field label="Catatan keputusan" multiline value={note} onChangeText={setNote} placeholder="Jelaskan dasar keputusan..." hint="Catatan ini membantu buyer dan seller memahami hasil review." /><Button title="Mulai review" variant="secondary" icon="eye-outline" loading={resolve.isPending} onPress={() => resolve.mutate('START_REVIEW')} /><Button title="Refund buyer" icon="return-down-back-outline" disabled={resolve.isPending} onPress={() => setPendingAction('REFUND_BUYER')} /><Button title="Release ke seller" icon="wallet-outline" disabled={resolve.isPending} onPress={() => setPendingAction('RELEASE_SELLER')} /><Button title="Tolak sengketa" variant="danger" icon="close-circle-outline" disabled={resolve.isPending} onPress={() => setPendingAction('REJECT')} /></Card> : null}
    </View>}
    <FeedbackDialog visible={Boolean(pendingAction)} tone={pendingAction ? actionCopy[pendingAction].tone : 'warning'} title={pendingAction ? actionCopy[pendingAction].title : ''} message={pendingAction ? `${actionCopy[pendingAction].message}${note.trim() ? ' Catatan admin akan ikut disimpan.' : ''}` : ''} primaryLabel={pendingAction ? actionCopy[pendingAction].label : 'Lanjut'} secondaryLabel="Batal" loading={resolve.isPending} onClose={() => setPendingAction(null)} onSecondary={() => setPendingAction(null)} onPrimary={() => pendingAction && resolve.mutate(pendingAction)} />
    <FeedbackDialog visible={Boolean(feedback)} tone={feedback?.tone || 'success'} title={feedback?.title || ''} message={feedback?.message || ''} onClose={() => setFeedback(null)} />
  </Screen>;
}

const styles = StyleSheet.create({
  pressed: { opacity: .7 },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' },
  list: { flex: 1, minWidth: 320, gap: 10 },
  card: { gap: 10 },
  active: { borderColor: '#9EC5F2', backgroundColor: '#FBFDFF' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  warn: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.warningSoft, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  reason: { fontFamily: 'PoppinsBold', fontSize: 11, letterSpacing: .5, color: colors.warning },
  title: { fontFamily: 'PoppinsSemiBold', fontSize: 14, color: colors.text },
  meta: { fontFamily: 'PoppinsRegular', fontSize: 12, color: colors.muted },
  amount: { fontFamily: 'PoppinsBold', fontSize: 14, color: colors.primaryDark },
  desc: { fontFamily: 'PoppinsRegular', fontSize: 13, lineHeight: 20, color: colors.textSoft },
  panel: { width: 400, maxWidth: '100%', gap: 11 },
  panelTitle: { fontFamily: 'PoppinsBold', fontSize: 18, color: colors.text },
  panelCopy: { fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 19, color: colors.muted },
  evidenceWrap: { gap: 8 },
  evidence: { padding: 11, borderRadius: radius.md, backgroundColor: colors.primarySoft, flexDirection: 'row', alignItems: 'center', gap: 8 },
  evidenceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  evidenceImage: { width: 82, height: 82, borderRadius: 10, backgroundColor: colors.background },
  evidenceText: { fontFamily: 'PoppinsMedium', fontSize: 12, color: colors.primary },
});
