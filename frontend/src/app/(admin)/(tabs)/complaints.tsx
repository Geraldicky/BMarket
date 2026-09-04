import { StyleSheet, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Card, Empty, ErrorState, FeedbackDialog, Loader, Screen, Title } from '@/components/ui';
import { endpoints, errorMessage } from '@/lib/api';
import { colors, radius } from '@/constants/theme';

type ComplaintAction = { id: string; status: 'RESOLVED' | 'DISMISSED'; reason: string } | null;

export default function ComplaintsScreen() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['complaints'], queryFn: () => endpoints.complaints() });
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [pending, setPending] = useState<ComplaintAction>(null);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'danger'; title: string; message: string } | null>(null);

  const update = async (id: string, status: string) => {
    setWorkingId(id);
    try {
      await endpoints.complaintStatus(id, status);
      await Promise.all([
        client.invalidateQueries({ queryKey: ['complaints'] }),
        client.invalidateQueries({ queryKey: ['admin-stats'] }),
      ]);
      if (status === 'RESOLVED' || status === 'DISMISSED') {
        setFeedback({ tone: 'success', title: status === 'RESOLVED' ? 'Laporan diselesaikan' : 'Laporan ditolak', message: status === 'RESOLVED' ? 'Status laporan sudah ditutup sebagai selesai.' : 'Laporan sudah ditutup tanpa tindakan lebih lanjut.' });
      }
      setPending(null);
    } catch (error) {
      setPending(null);
      setFeedback({ tone: 'danger', title: 'Status laporan belum berubah', message: errorMessage(error) });
    } finally {
      setWorkingId(null);
    }
  };

  return <Screen>
    <Title eyebrow="CASE HISTORY" subtitle="Lihat seluruh laporan komunitas dan hasil penanganannya.">Riwayat laporan</Title>
    {query.isLoading ? <Loader /> : query.isError ? <ErrorState message={errorMessage(query.error)} retry={() => query.refetch()} /> : !query.data?.length ? <Empty title="Belum ada laporan" message="Laporan dari komunitas akan tercatat di sini." /> : <View style={styles.list}>{query.data.map(item => {
      const active = ['OPEN', 'IN_REVIEW'].includes(item.status);
      return <Card key={item.id} style={styles.card}>
        <View style={styles.row}><View style={styles.typeBadge}><Text style={styles.type}>{item.targetType === 'LISTING' ? 'LISTING' : 'PENGGUNA'}</Text></View><View style={[styles.statusBadge, active ? styles.statusOpen : styles.statusClosed]}><Text style={styles.status}>{item.status}</Text></View></View>
        <View style={styles.meta}><Text style={styles.reporter}>Pelapor: {item.reporter?.name || 'Binusian'}</Text><Text style={styles.reason}>{item.reason}</Text>{item.description ? <Text style={styles.description}>{item.description}</Text> : null}</View>
        {item.targetType === 'USER' && active ? <View style={styles.actions}>{item.status === 'OPEN' ? <Button title="Mulai tinjau" variant="secondary" loading={workingId === item.id} onPress={() => update(item.id, 'IN_REVIEW')} /> : null}<Button title="Selesaikan" loading={workingId === item.id} onPress={() => setPending({ id: item.id, status: 'RESOLVED', reason: item.reason })} /><Button title="Tolak" variant="ghost" disabled={workingId === item.id} onPress={() => setPending({ id: item.id, status: 'DISMISSED', reason: item.reason })} /></View> : null}
      </Card>;
    })}</View>}
    <FeedbackDialog visible={Boolean(pending)} tone={pending?.status === 'DISMISSED' ? 'warning' : 'info'} title={pending?.status === 'DISMISSED' ? 'Tolak laporan ini?' : 'Selesaikan laporan ini?'} message={pending ? `${pending.reason}. ${pending.status === 'DISMISSED' ? 'Laporan akan ditutup tanpa tindakan tambahan.' : 'Laporan akan ditandai selesai dan tidak lagi muncul sebagai kasus aktif.'}` : ''} primaryLabel={pending?.status === 'DISMISSED' ? 'Tolak laporan' : 'Selesaikan'} secondaryLabel="Batal" loading={Boolean(pending && workingId === pending.id)} onClose={() => setPending(null)} onSecondary={() => setPending(null)} onPrimary={() => pending && update(pending.id, pending.status)} />
    <FeedbackDialog visible={Boolean(feedback)} tone={feedback?.tone || 'success'} title={feedback?.title || ''} message={feedback?.message || ''} onClose={() => setFeedback(null)} />
  </Screen>;
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  card: { gap: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, alignItems: 'center' },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
  type: { color: colors.primary, fontFamily: 'PoppinsBold', fontSize: 11 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
  statusOpen: { backgroundColor: colors.warningSoft },
  statusClosed: { backgroundColor: colors.successSoft },
  status: { color: colors.textSoft, fontFamily: 'PoppinsSemiBold', fontSize: 11 },
  meta: { gap: 4 },
  reporter: { color: colors.text, fontFamily: 'PoppinsMedium', fontSize: 14 },
  reason: { color: colors.textSoft, fontFamily: 'PoppinsSemiBold', fontSize: 13 },
  description: { color: colors.muted, fontFamily: 'PoppinsRegular', fontSize: 13, lineHeight: 21 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
