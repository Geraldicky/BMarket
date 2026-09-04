import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { AdminEmptyState, AdminStatusPill } from '@/components/admin-ui';
import { Button, Card, date, ErrorState, FeedbackDialog, Field, Loader, Screen, Title } from '@/components/ui';
import { endpoints, errorMessage } from '@/lib/api';
import { colors } from '@/constants/theme';

type ComplaintAction = { id: string; status: 'RESOLVED' | 'DISMISSED'; reason: string } | null;

export default function ComplaintsScreen() {
  const client = useQueryClient();
  const desktop = useWindowDimensions().width >= 1100;
  const query = useQuery({ queryKey: ['complaints'], queryFn: () => endpoints.complaints() });
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [pending, setPending] = useState<ComplaintAction>(null);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'danger'; title: string; message: string } | null>(null);
  const [search, setSearch] = useState('');
  const items = query.data || [];
  const visible = useMemo(() => items.filter(item => {
    const q = search.trim().toLowerCase();
    return !q || [item.id, item.reason, item.description, item.reporter?.name, item.targetListing?.title, item.targetUser?.name, item.status].some(value => String(value || '').toLowerCase().includes(q));
  }), [items, search]);

  const update = async (id: string, status: string) => {
    setWorkingId(id);
    try {
      await endpoints.complaintStatus(id, status);
      await Promise.all([client.invalidateQueries({ queryKey: ['complaints'] }), client.invalidateQueries({ queryKey: ['admin-stats'] })]);
      if (status === 'RESOLVED' || status === 'DISMISSED') setFeedback({ tone: 'success', title: status === 'RESOLVED' ? 'Laporan diselesaikan' : 'Laporan ditolak', message: status === 'RESOLVED' ? 'Status laporan sudah ditutup sebagai selesai.' : 'Laporan sudah ditutup tanpa tindakan lebih lanjut.' });
      setPending(null);
    } catch (error) { setPending(null); setFeedback({ tone: 'danger', title: 'Status laporan belum berubah', message: errorMessage(error) }); }
    finally { setWorkingId(null); }
  };

  const statusTone = (status: string) => status === 'OPEN' ? 'warning' as const : status === 'IN_REVIEW' ? 'primary' as const : status === 'RESOLVED' ? 'success' as const : 'neutral' as const;

  return (
    <Screen backgroundColor={colors.surfaceMuted}>
      <Title subtitle="Lihat seluruh laporan komunitas dan hasil penanganannya.">Riwayat laporan</Title>
      <Card style={styles.toolbar}><Field icon="search-outline" value={search} onChangeText={setSearch} placeholder="Cari laporan, pelapor, target, atau status..." /></Card>
      {query.isLoading ? <Loader /> : query.isError ? <ErrorState message={errorMessage(query.error)} retry={() => query.refetch()} /> : !items.length ? <Card><AdminEmptyState title="Belum ada laporan" message="Laporan dari komunitas akan tercatat di sini." /></Card> : !visible.length ? <Card><AdminEmptyState compact icon="search-outline" title="Laporan tidak ditemukan" message="Coba gunakan kata kunci pencarian yang berbeda." /></Card> : desktop ? <Card style={styles.table}>
        <View style={[styles.tableRow, styles.tableHead]}><Text style={[styles.headText, styles.idCol]}>ID LAPORAN</Text><Text style={[styles.headText, styles.typeCol]}>KATEGORI</Text><Text style={[styles.headText, styles.personCol]}>PELAPOR</Text><Text style={[styles.headText, styles.targetCol]}>TARGET</Text><Text style={[styles.headText, styles.statusCol]}>STATUS</Text><Text style={[styles.headText, styles.dateCol]}>TANGGAL</Text><Text style={[styles.headText, styles.actionCol]}>AKSI</Text></View>
        {visible.map(item => { const active = ['OPEN', 'IN_REVIEW'].includes(item.status); const target = item.targetType === 'LISTING' ? item.targetListing?.title || 'Listing' : item.targetUser?.name || 'Pengguna'; return <View key={item.id} style={styles.tableRow}><Text numberOfLines={1} style={[styles.cellText, styles.idCol]}>{item.id.slice(0, 8).toUpperCase()}</Text><Text style={[styles.cellText, styles.typeCol]}>{item.targetType === 'LISTING' ? 'Listing' : 'Pengguna'}</Text><Text numberOfLines={1} style={[styles.cellText, styles.personCol]}>{item.reporter?.name || 'Binusian'}</Text><Text numberOfLines={1} style={[styles.cellText, styles.targetCol]}>{target}</Text><View style={styles.statusCol}><AdminStatusPill label={item.status.replace('_', ' ')} tone={statusTone(item.status)} /></View><Text style={[styles.cellText, styles.dateCol]}>{date(item.createdAt)}</Text><View style={[styles.actionCol, styles.rowActions]}>{item.targetType === 'USER' && active ? <>{item.status === 'OPEN' ? <Button title="Tinjau" variant="secondary" loading={workingId === item.id} onPress={() => update(item.id, 'IN_REVIEW')} style={styles.smallButton} /> : null}<Button title="Selesai" loading={workingId === item.id} onPress={() => setPending({ id: item.id, status: 'RESOLVED', reason: item.reason })} style={styles.smallButton} /><Button title="Tolak" variant="ghost" disabled={workingId === item.id} onPress={() => setPending({ id: item.id, status: 'DISMISSED', reason: item.reason })} style={styles.smallButton} /></> : <Text style={styles.noAction}>—</Text>}</View></View>; })}
      </Card> : <View style={styles.cards}>{visible.map(item => { const active = ['OPEN', 'IN_REVIEW'].includes(item.status); return <Card key={item.id} style={styles.mobileCard}><View style={styles.mobileHead}><Text style={styles.mobileId}>#{item.id.slice(0, 8).toUpperCase()}</Text><AdminStatusPill label={item.status.replace('_', ' ')} tone={statusTone(item.status)} /></View><Text style={styles.mobileReason}>{item.reason}</Text><Text style={styles.mobileMeta}>{item.targetType === 'LISTING' ? 'Listing' : 'Pengguna'} · {item.reporter?.name || 'Binusian'} · {date(item.createdAt)}</Text>{item.description ? <Text style={styles.mobileDesc}>{item.description}</Text> : null}{item.targetType === 'USER' && active ? <View style={styles.mobileActions}>{item.status === 'OPEN' ? <Button title="Mulai tinjau" variant="secondary" loading={workingId === item.id} onPress={() => update(item.id, 'IN_REVIEW')} /> : null}<Button title="Selesaikan" loading={workingId === item.id} onPress={() => setPending({ id: item.id, status: 'RESOLVED', reason: item.reason })} /><Button title="Tolak" variant="ghost" disabled={workingId === item.id} onPress={() => setPending({ id: item.id, status: 'DISMISSED', reason: item.reason })} /></View> : null}</Card>; })}</View>}
      <FeedbackDialog visible={Boolean(pending)} tone={pending?.status === 'DISMISSED' ? 'warning' : 'info'} title={pending?.status === 'DISMISSED' ? 'Tolak laporan ini?' : 'Selesaikan laporan ini?'} message={pending ? `${pending.reason}. ${pending.status === 'DISMISSED' ? 'Laporan akan ditutup tanpa tindakan tambahan.' : 'Laporan akan ditandai selesai dan tidak lagi muncul sebagai kasus aktif.'}` : ''} primaryLabel={pending?.status === 'DISMISSED' ? 'Tolak laporan' : 'Selesaikan'} secondaryLabel="Batal" loading={Boolean(pending && workingId === pending.id)} onClose={() => setPending(null)} onSecondary={() => setPending(null)} onPrimary={() => pending && update(pending.id, pending.status)} />
      <FeedbackDialog visible={Boolean(feedback)} tone={feedback?.tone || 'success'} title={feedback?.title || ''} message={feedback?.message || ''} onClose={() => setFeedback(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  toolbar: { padding: 14 },
  table: { padding: 0, overflow: 'hidden', gap: 0 },
  tableRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 10 },
  tableHead: { minHeight: 50, backgroundColor: colors.surfaceMuted },
  headText: { color: colors.muted, fontFamily: 'PoppinsBold', fontSize: 10.5, letterSpacing: .35 },
  cellText: { color: colors.textSoft, fontFamily: 'PoppinsRegular', fontSize: 11.5 },
  idCol: { width: 90 }, typeCol: { width: 82 }, personCol: { flex: 1, minWidth: 110 }, targetCol: { flex: 1.2, minWidth: 130 }, statusCol: { width: 120 }, dateCol: { width: 110 }, actionCol: { width: 205 },
  rowActions: { flexDirection: 'row', gap: 5, justifyContent: 'flex-end' },
  smallButton: { minWidth: 0, minHeight: 36, paddingHorizontal: 9 },
  noAction: { color: colors.muted, fontFamily: 'PoppinsRegular', fontSize: 12, textAlign: 'center' },
  cards: { gap: 10 },
  mobileCard: { gap: 7 },
  mobileHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  mobileId: { color: colors.primary, fontFamily: 'PoppinsBold', fontSize: 11 },
  mobileReason: { color: colors.text, fontFamily: 'PoppinsSemiBold', fontSize: 14 },
  mobileMeta: { color: colors.muted, fontFamily: 'PoppinsRegular', fontSize: 11.5 },
  mobileDesc: { color: colors.textSoft, fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 19 },
  mobileActions: { gap: 7, marginTop: 4 },
});
