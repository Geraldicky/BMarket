import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Field, Screen, Title } from '@/components/ui';
import { endpoints, errorMessage } from '@/lib/api';
import { colors, radius } from '@/constants/theme';

const reportReasons = [
  { label: 'Penipuan atau harga mencurigakan', icon: 'warning-outline' },
  { label: 'Barang atau jasa terlarang', icon: 'ban-outline' },
  { label: 'Informasi menyesatkan', icon: 'document-text-outline' },
  { label: 'Konten tidak pantas', icon: 'eye-off-outline' },
  { label: 'Duplikat atau spam', icon: 'copy-outline' },
  { label: 'Sudah tidak tersedia', icon: 'archive-outline' },
  { label: 'Alasan lainnya', icon: 'ellipsis-horizontal-circle-outline' },
] as const;

export default function ReportScreen() {
  const params = useLocalSearchParams<{ targetType?: string; targetId?: string; title?: string }>();
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!params.targetId) return Alert.alert('Target tidak ditemukan', 'Kembali dan coba buka listing lagi.');
    if (!reason) return Alert.alert('Pilih alasan', 'Pilih alasan yang paling sesuai dengan masalahnya.');
    if (reason === 'Alasan lainnya' && description.trim().length < 10) {
      return Alert.alert('Tambahkan detail', 'Jelaskan masalah minimal 10 karakter.');
    }
    setLoading(true);
    try {
      await endpoints.report({
        targetType: params.targetType === 'USER' ? 'USER' : 'LISTING',
        targetId: params.targetId,
        reason,
        description: description.trim() || undefined,
      });
      Alert.alert('Laporan terkirim', 'Terima kasih. Admin akan memeriksa laporan tanpa memberitahukan identitasmu kepada seller.', [
        { text: 'Kembali', onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert('Laporan belum terkirim', errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Title eyebrow="KEAMANAN KOMUNITAS" subtitle="Laporanmu akan masuk ke antrean admin untuk diperiksa.">Laporkan listing</Title>
      <Card style={styles.targetCard}>
        <View style={styles.targetIcon}><Ionicons name="flag-outline" size={21} color={colors.danger} /></View>
        <View style={styles.targetBody}>
          <Text style={styles.targetLabel}>LISTING YANG DILAPORKAN</Text>
          <Text numberOfLines={2} style={styles.targetTitle}>{params.title || 'Listing BMarket'}</Text>
        </View>
      </Card>

      <Card style={styles.formCard}>
        <View>
          <Text style={styles.sectionTitle}>Apa masalahnya?</Text>
          <Text style={styles.sectionCopy}>Pilih satu alasan yang paling menggambarkan masalah.</Text>
        </View>
        <View style={styles.reasons}>
          {reportReasons.map(item => {
            const selected = reason === item.label;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                key={item.label}
                onPress={() => setReason(item.label)}
                style={({ pressed }) => [styles.reason, selected && styles.reasonSelected, pressed && styles.pressed]}
              >
                <View style={[styles.reasonIcon, selected && styles.reasonIconSelected]}>
                  <Ionicons name={item.icon} size={18} color={selected ? colors.primary : colors.textSoft} />
                </View>
                <Text style={[styles.reasonText, selected && styles.reasonTextSelected]}>{item.label}</Text>
                <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={19} color={selected ? colors.primary : colors.borderStrong} />
              </Pressable>
            );
          })}
        </View>
        <Field
          label="Detail tambahan (opsional)"
          hint="Jangan masukkan nomor telepon, alamat, atau data pribadi lainnya."
          multiline
          value={description}
          onChangeText={setDescription}
          placeholder="Ceritakan hal yang perlu diperiksa admin..."
          maxLength={1000}
        />
        <View style={styles.privacy}>
          <Ionicons name="shield-checkmark-outline" size={20} color={colors.success} />
          <Text style={styles.privacyText}>Identitas pelapor tidak ditampilkan kepada pemilik listing.</Text>
        </View>
        <View style={styles.actions}>
          <Button title="Batal" variant="ghost" onPress={() => router.back()} style={styles.action} />
          <Button title="Kirim laporan" icon="flag-outline" loading={loading} disabled={!reason} onPress={submit} style={styles.action} />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  targetCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 17 },
  targetIcon: { width: 48, height: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dangerSoft },
  targetBody: { flex: 1, gap: 2 },
  targetLabel: { fontFamily: 'PoppinsBold', fontSize: 10, letterSpacing: .65, color: colors.muted },
  targetTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 15, color: colors.text },
  formCard: { maxWidth: 760, width: '100%', alignSelf: 'center', gap: 20 },
  sectionTitle: { fontFamily: 'PoppinsBold', fontSize: 21, color: colors.text },
  sectionCopy: { fontFamily: 'PoppinsRegular', fontSize: 13, lineHeight: 20, color: colors.muted, marginTop: 4 },
  reasons: { gap: 8 },
  reason: { minHeight: 62, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  reasonSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  reasonIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  reasonIconSelected: { backgroundColor: colors.surface },
  reasonText: { flex: 1, fontFamily: 'PoppinsMedium', fontSize: 13, color: colors.textSoft },
  reasonTextSelected: { fontFamily: 'PoppinsSemiBold', color: colors.primaryDark },
  pressed: { opacity: .7 },
  privacy: { minHeight: 54, borderRadius: radius.sm, backgroundColor: colors.successSoft, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 10 },
  privacyText: { flex: 1, fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 19, color: colors.textSoft },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1 },
});
