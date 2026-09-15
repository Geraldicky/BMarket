import { useState } from 'react';
import { Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminSectionTitle } from '@/components/admin-ui';
import { Button, Card, FeedbackDialog, Field, Screen, Title } from '@/components/ui';
import { endpoints, errorMessage } from '@/lib/api';
import { colors, makeStyles } from '@/constants/theme';

export default function AdminSettings() {
  const styles = useStyles();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['commission'], queryFn: endpoints.commission });
  const [editedRate, setEditedRate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'warning' | 'danger'; title: string; message: string } | null>(null);
  const rate = editedRate ?? String(query.data?.rate ?? 5);

  const save = async () => {
    const value = Number(rate);
    if (!Number.isFinite(value) || value < 0 || value > 100) { setFeedback({ tone: 'warning', title: 'Nilai komisi belum valid', message: 'Masukkan angka antara 0 sampai 100 persen.' }); return; }
    setSaving(true);
    try { await endpoints.setCommission(value); setEditedRate(null); await client.invalidateQueries({ queryKey: ['commission'] }); setFeedback({ tone: 'success', title: 'Komisi diperbarui', message: `Komisi ${value}% akan digunakan untuk transaksi baru. Transaksi lama tetap memakai rate saat dibuat.` }); }
    catch (error) { setFeedback({ tone: 'danger', title: 'Komisi belum tersimpan', message: errorMessage(error) }); }
    finally { setSaving(false); }
  };

  return (
    <Screen backgroundColor={colors.surfaceMuted}>
      <View style={styles.center}>
        <Title subtitle="Konfigurasi yang memengaruhi transaksi baru di marketplace.">Pengaturan</Title>
        <Card style={styles.card}>
          <AdminSectionTitle title="Komisi platform" subtitle="Persentase dipotong saat transaksi selesai." icon="server-outline" />
          <Text style={styles.help}>Transaksi lama tetap memakai rate yang tersimpan saat transaksi dibuat.</Text>
          <Field label="Persentase (%)" value={rate} onChangeText={setEditedRate} keyboardType="decimal-pad" hint="Contoh: 5 berarti seller menerima 95% dari nilai transaksi sebelum biaya lain." />
          <Button title="Simpan komisi" icon="save-outline" loading={saving} onPress={save} />
        </Card>
      </View>
      <FeedbackDialog visible={Boolean(feedback)} tone={feedback?.tone || 'success'} title={feedback?.title || ''} message={feedback?.message || ''} onClose={() => setFeedback(null)} />
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  center: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: 16 },
  card: { width: '100%', gap: 16 },
  help: { color: colors.muted, fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 19 },
}));
