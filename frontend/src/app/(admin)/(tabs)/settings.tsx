import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminInfoRow, AdminSectionTitle } from '@/components/admin-ui';
import { Button, Card, FeedbackDialog, Field, Screen, Title } from '@/components/ui';
import { endpoints, errorMessage } from '@/lib/api';
import { colors } from '@/constants/theme';
import { useAuth } from '@/store/auth';

export default function AdminSettings() {
  const logout = useAuth(state => state.logout);
  const user = useAuth(state => state.user);
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['commission'], queryFn: endpoints.commission });
  const [editedRate, setEditedRate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
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
      <Title subtitle="Konfigurasi yang memengaruhi transaksi baru di marketplace.">Pengaturan</Title>
      <View style={styles.grid}>
        <Card style={styles.card}>
          <AdminSectionTitle title="Komisi platform" subtitle="Persentase dipotong saat transaksi selesai." icon="server-outline" />
          <Text style={styles.help}>Transaksi lama tetap memakai rate yang tersimpan saat transaksi dibuat.</Text>
          <Field label="Persentase (%)" value={rate} onChangeText={setEditedRate} keyboardType="decimal-pad" hint="Contoh: 5 berarti seller menerima 95% dari nilai transaksi sebelum biaya lain." />
          <Button title="Simpan komisi" icon="save-outline" loading={saving} onPress={save} />
        </Card>
        <Card style={styles.card}>
          <AdminSectionTitle title="Prinsip perubahan" subtitle="Apa yang terjadi saat rate diperbarui." icon="git-compare-outline" />
          <View style={styles.infoList}><AdminInfoRow icon="add-circle-outline" title="Berlaku untuk transaksi baru" message="Rate terbaru digunakan saat transaksi berikutnya dibuat." /><View style={styles.divider} /><AdminInfoRow icon="lock-closed-outline" title="Snapshot tetap aman" message="Transaksi lama mempertahankan commissionRate yang sudah tersimpan." /><View style={styles.divider} /><AdminInfoRow icon="wallet-outline" title="Escrow tidak berubah" message="Perubahan rate tidak mengubah dana transaksi yang sudah berjalan." /></View>
        </Card>
        <Card style={styles.card}>
          <AdminSectionTitle title="Keamanan transaksi" subtitle="Kontrol yang sudah aktif pada flow BMarket." icon="shield-checkmark-outline" />
          <View style={styles.infoList}><AdminInfoRow icon="shield-outline" title="Escrow terlindungi" message="Dana seller ditahan sampai flow transaksi memenuhi syarat pelepasan." color={colors.success} background={colors.successSoft} /><View style={styles.divider} /><AdminInfoRow icon="document-lock-outline" title="Riwayat keputusan" message="Moderasi dan sengketa tersimpan sebagai bagian dari audit flow." color="#7357E7" background="#F1EDFF" /><View style={styles.divider} /><AdminInfoRow icon="people-outline" title="Akses berbasis role" message="Halaman ini hanya ditujukan untuk akun dengan role admin." color={colors.warning} background={colors.warningSoft} /></View>
        </Card>
        <Card style={styles.card}>
          <AdminSectionTitle title="Sesi & akses" subtitle="Akun admin yang sedang digunakan." icon="person-circle-outline" />
          <View style={styles.account}><View style={styles.avatar}><Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() || 'A'}</Text></View><View style={styles.accountCopy}><Text style={styles.accountName}>{user?.name || 'Admin BMarket'}</Text><Text style={styles.accountEmail}>{user?.email || 'Akun administrator'}</Text></View></View>
          <View style={styles.divider} />
          <Text style={styles.logoutHelp}>Keluar hanya mengakhiri sesi pada perangkat ini. Kamu perlu login kembali untuk mengakses Admin Console.</Text>
          <Pressable onPress={() => setLogoutOpen(true)} style={({ pressed }) => [styles.logout, pressed && { opacity: .65 }]}><Ionicons name="log-out-outline" size={18} color={colors.danger} /><Text style={styles.logoutText}>Keluar dari admin</Text></Pressable>
        </Card>
      </View>
      <FeedbackDialog visible={Boolean(feedback)} tone={feedback?.tone || 'success'} title={feedback?.title || ''} message={feedback?.message || ''} onClose={() => setFeedback(null)} />
      <FeedbackDialog visible={logoutOpen} tone="warning" title="Keluar dari admin?" message="Sesi admin di perangkat ini akan diakhiri. Kamu perlu login kembali untuk mengakses dashboard admin." primaryLabel="Keluar" secondaryLabel="Batal" onClose={() => setLogoutOpen(false)} onSecondary={() => setLogoutOpen(false)} onPrimary={() => { setLogoutOpen(false); logout(); }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, alignItems: 'stretch' },
  card: { flex: 1, minWidth: 430, gap: 13 },
  help: { color: colors.muted, fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 19 },
  infoList: { gap: 0 },
  divider: { height: 1, backgroundColor: colors.border },
  account: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  avatar: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primary, fontFamily: 'PoppinsBold', fontSize: 16 },
  accountCopy: { flex: 1 },
  accountName: { color: colors.text, fontFamily: 'PoppinsSemiBold', fontSize: 14 },
  accountEmail: { color: colors.muted, fontFamily: 'PoppinsRegular', fontSize: 12, marginTop: 1 },
  logoutHelp: { color: colors.muted, fontFamily: 'PoppinsRegular', fontSize: 11.5, lineHeight: 18 },
  logout: { minHeight: 44, paddingHorizontal: 14, borderRadius: 11, borderWidth: 1, borderColor: '#F0B8B8', backgroundColor: '#FFF9F9', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  logoutText: { color: colors.danger, fontFamily: 'PoppinsSemiBold', fontSize: 13 },
});
