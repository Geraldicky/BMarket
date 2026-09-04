import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, FeedbackDialog, Field, Screen, Title } from '@/components/ui';
import { endpoints, errorMessage } from '@/lib/api';
import { colors } from '@/constants/theme';
import { useAuth } from '@/store/auth';

export default function AdminSettings() {
  const logout = useAuth(state => state.logout);
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['commission'], queryFn: endpoints.commission });
  const [editedRate, setEditedRate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'warning' | 'danger'; title: string; message: string } | null>(null);
  const rate = editedRate ?? String(query.data?.rate ?? 5);

  const save = async () => {
    const value = Number(rate);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      setFeedback({ tone: 'warning', title: 'Nilai komisi belum valid', message: 'Masukkan angka antara 0 sampai 100 persen.' });
      return;
    }
    setSaving(true);
    try {
      await endpoints.setCommission(value);
      setEditedRate(null);
      await client.invalidateQueries({ queryKey: ['commission'] });
      setFeedback({ tone: 'success', title: 'Komisi diperbarui', message: `Komisi ${value}% akan digunakan untuk transaksi baru. Transaksi lama tetap memakai rate saat dibuat.` });
    } catch (error) {
      setFeedback({ tone: 'danger', title: 'Komisi belum tersimpan', message: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  return <Screen>
    <Title eyebrow="OPERASIONAL" subtitle="Konfigurasi yang memengaruhi transaksi baru di marketplace.">Pengaturan</Title>
    <Card style={styles.card}>
      <Text style={styles.section}>Komisi platform</Text>
      <Text style={styles.help}>Persentase dipotong saat transaksi selesai. Transaksi lama tetap memakai rate saat dibuat.</Text>
      <Field label="Persentase (%)" value={rate} onChangeText={setEditedRate} keyboardType="decimal-pad" hint="Contoh: 5 berarti seller menerima 95% dari nilai transaksi sebelum biaya lain." />
      <Button title="Simpan komisi" icon="save-outline" loading={saving} onPress={save} />
    </Card>
    <Button title="Keluar dari admin" variant="ghost" icon="log-out-outline" onPress={() => setLogoutOpen(true)} />
    <FeedbackDialog visible={Boolean(feedback)} tone={feedback?.tone || 'success'} title={feedback?.title || ''} message={feedback?.message || ''} onClose={() => setFeedback(null)} />
    <FeedbackDialog visible={logoutOpen} tone="warning" title="Keluar dari admin?" message="Sesi admin di perangkat ini akan diakhiri. Kamu perlu login kembali untuk mengakses dashboard admin." primaryLabel="Keluar" secondaryLabel="Batal" onClose={() => setLogoutOpen(false)} onSecondary={() => setLogoutOpen(false)} onPrimary={() => { setLogoutOpen(false); logout(); }} />
  </Screen>;
}

const styles = StyleSheet.create({
  card: { maxWidth: 720, width: '100%', alignSelf: 'center', gap: 14 },
  section: { color: colors.text, fontFamily: 'PoppinsSemiBold', fontSize: 20 },
  help: { color: colors.muted, fontFamily: 'PoppinsRegular', fontSize: 14, lineHeight: 22 },
});
