import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Empty, ErrorState, Field, Loader, money, Screen, Title } from '@/components/ui';
import { colors } from '@/constants/theme';
import { endpoints, errorMessage } from '@/lib/api';
import type { Dispute } from '@/types';

const reasonLabel: Record<string, string> = { ITEM_NOT_RECEIVED: 'Belum diterima', NOT_AS_DESCRIBED: 'Tidak sesuai deskripsi', DAMAGED: 'Rusak', SERVICE_ISSUE: 'Masalah jasa', PAYMENT_ISSUE: 'Pembayaran', OTHER: 'Lainnya' };

export default function AdminDisputesScreen() {
  const client = useQueryClient();
  const [selected, setSelected] = useState<Dispute | null>(null);
  const [resolution, setResolution] = useState('');
  const query = useQuery({ queryKey: ['admin-disputes'], queryFn: endpoints.adminDisputes });
  const resolve = useMutation({ mutationFn: (action: 'START_REVIEW' | 'REFUND_BUYER' | 'RELEASE_SELLER' | 'REJECT') => endpoints.resolveDispute(selected!.id, action, resolution.trim() || undefined), onSuccess: () => { setSelected(null); setResolution(''); client.invalidateQueries({ queryKey: ['admin-disputes'] }); client.invalidateQueries({ queryKey: ['admin-analytics'] }); }, onError: error => Alert.alert('Keputusan belum tersimpan', errorMessage(error)) });
  const open = query.data?.filter(item => ['OPEN', 'IN_REVIEW'].includes(item.status)) || [];

  return <Screen><Title eyebrow="ESCROW & REFUND" subtitle="Tinjau bukti kedua pihak sebelum mengembalikan atau melepaskan dana.">Sengketa transaksi</Title>
    {query.isLoading ? <Loader /> : query.isError ? <ErrorState message={errorMessage(query.error)} retry={() => query.refetch()} /> : !open.length ? <Empty icon="shield-checkmark-outline" title="Tidak ada sengketa aktif" message="Semua transaksi berjalan tanpa sengketa yang perlu ditangani." /> : <View style={styles.list}>{open.map(item => <Pressable key={item.id} onPress={() => { setSelected(item); setResolution(''); }}><Card style={[styles.card, selected?.id === item.id && styles.cardActive]}><View style={styles.cardTop}><View style={styles.icon}><Ionicons name="warning-outline" size={21} color={colors.warning} /></View><View style={styles.flex}><Text style={styles.eyebrow}>{reasonLabel[item.reason] || item.reason}</Text><Text style={styles.title}>{item.transaction?.listing?.title || 'Transaksi BMarket'}</Text><Text style={styles.meta}>Pelapor: {item.openedBy?.name || 'Binusian'} · {item.status}</Text></View><Text style={styles.amount}>{money(item.transaction?.grandTotal)}</Text></View><Text numberOfLines={2} style={styles.description}>{item.description}</Text></Card></Pressable>)}</View>}
    {selected ? <Card style={styles.decision}><View style={styles.decisionHeader}><View><Text style={styles.decisionTitle}>Keputusan admin</Text><Text style={styles.decisionCopy}>Keputusan finansial langsung memperbarui escrow dan transaksi.</Text></View><Pressable onPress={() => setSelected(null)}><Ionicons name="close" size={21} color={colors.muted} /></Pressable></View>{selected.status === 'OPEN' ? <Button title="Mulai peninjauan" variant="secondary" onPress={() => resolve.mutate('START_REVIEW')} /> : null}<Field label="Catatan keputusan" value={resolution} onChangeText={setResolution} multiline placeholder="Tuliskan dasar keputusan untuk buyer dan seller" /><View style={styles.actions}><Button title="Tolak sengketa" variant="ghost" disabled={resolution.trim().length < 5} onPress={() => resolve.mutate('REJECT')} style={styles.flex} /><Button title="Refund buyer" variant="danger" disabled={resolution.trim().length < 5} onPress={() => resolve.mutate('REFUND_BUYER')} style={styles.flex} /><Button title="Bayar seller" disabled={resolution.trim().length < 5} onPress={() => resolve.mutate('RELEASE_SELLER')} style={styles.flex} /></View></Card> : null}
  </Screen>;
}

const styles = StyleSheet.create({ list: { gap: 12 }, card: { gap: 11 }, cardActive: { borderColor: '#9FC5F2', backgroundColor: '#FBFDFF' }, cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 }, icon: { width: 46, height: 46, borderRadius: 12, backgroundColor: colors.warningSoft, alignItems: 'center', justifyContent: 'center' }, flex: { flex: 1 }, eyebrow: { fontFamily: 'PoppinsBold', fontSize: 9, letterSpacing: .55, color: colors.warning }, title: { fontFamily: 'PoppinsSemiBold', fontSize: 15, color: colors.text }, meta: { fontFamily: 'PoppinsRegular', fontSize: 10, color: colors.muted }, amount: { fontFamily: 'PoppinsBold', fontSize: 16, color: colors.text }, description: { fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 19, color: colors.textSoft }, decision: { borderColor: '#B9D5F3' }, decisionHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 }, decisionTitle: { fontFamily: 'PoppinsBold', fontSize: 18, color: colors.text }, decisionCopy: { fontFamily: 'PoppinsRegular', fontSize: 11, color: colors.muted }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 } });
