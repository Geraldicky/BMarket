import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { AuthShell } from '@/components/auth-shell';
import { Button, Field, InlineAlert } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/store/auth';

type FormErrors = Partial<Record<'name' | 'studentId' | 'email' | 'password', string>>;

export default function RegisterScreen() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const register = useAuth(state => state.register);
  const [form, setForm] = useState({ name: '', studentId: '', email: '', password: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const update = (key: keyof typeof form) => (value: string) => {
    setForm(current => ({ ...current, [key]: value }));
    setErrors(current => ({ ...current, [key]: undefined }));
  };

  const submit = async () => {
    const nextErrors: FormErrors = {};
    if (!form.name.trim()) nextErrors.name = 'Nama lengkap wajib diisi.';
    if (!form.studentId.trim()) nextErrors.studentId = 'NIM wajib diisi.';
    if (!form.email.trim()) nextErrors.email = 'Email BINUS wajib diisi.';
    else if (!form.email.includes('@')) nextErrors.email = 'Format email belum benar.';
    if (form.password.length < 8) nextErrors.password = 'Gunakan minimal 8 karakter.';
    setErrors(nextErrors);
    setFormError('');
    if (Object.keys(nextErrors).length) return;

    setLoading(true);
    try {
      const pending = await register(form);
      router.replace({
        pathname: '/(auth)/verify-email',
        params: { email: pending.email, maskedEmail: pending.maskedEmail, cooldown: String(pending.resendAfterSeconds) },
      });
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell eyebrow="GABUNG KE BMARKET" title="Buat akun BMarket" subtitle="Daftar dengan identitas BINUS. Setelah itu, verifikasi email kampusmu untuk mulai bertransaksi.">
      <View style={styles.form}>
        {formError ? <InlineAlert message={formError} /> : null}

        <View style={[styles.doubleField, width < 480 && styles.doubleFieldMobile]}>
          <View style={styles.half}>
            <Field label="Nama lengkap" value={form.name} onChangeText={update('name')} icon="person-outline" placeholder="Nama kamu" error={errors.name} />
          </View>
          <View style={styles.half}>
            <Field label="NIM" value={form.studentId} onChangeText={update('studentId')} icon="id-card-outline" keyboardType="number-pad" placeholder="2440001234" error={errors.studentId} />
          </View>
        </View>

        <Field label="Email BINUS" value={form.email} onChangeText={update('email')} autoCapitalize="none" autoComplete="email" keyboardType="email-address" icon="mail-outline" placeholder="nama@binus.ac.id" error={errors.email} />
        <Field label="Password" value={form.password} onChangeText={update('password')} secureTextEntry={!showPassword} autoComplete="new-password" icon="lock-closed-outline" rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'} onRightPress={() => setShowPassword(value => !value)} placeholder="Minimal 8 karakter" hint="Gunakan minimal 8 karakter dan kombinasikan huruf dengan angka." error={errors.password} onSubmitEditing={submit} />

        <Button title="Buat akun" icon="person-add-outline" loading={loading} onPress={submit} style={styles.primaryButton} />

        <View style={styles.switchCard}>
          <View style={styles.switchIcon}><Ionicons name="log-in-outline" size={18} color={colors.primary} /></View>
          <View style={styles.switchCopy}>
            <Text style={styles.switchTitle}>Sudah punya akun?</Text>
            <Text style={styles.switchText}>Masuk menggunakan akun BMarket yang sudah terverifikasi.</Text>
          </View>
          <Link href="/(auth)/login" style={styles.switchAction}>Masuk</Link>
        </View>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  doubleField: { flexDirection: 'row', gap: 10 },
  doubleFieldMobile: { flexDirection: 'column' },
  half: { flex: 1, minWidth: 0 },
  primaryButton: { marginTop: 2 },
  switchCard: { marginTop: 2, padding: 13, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: '#FBFDFF', flexDirection: 'row', alignItems: 'center', gap: 11 },
  switchIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  switchCopy: { flex: 1, gap: 1 },
  switchTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 12.5, color: colors.text },
  switchText: { fontFamily: 'PoppinsRegular', fontSize: 10.5, lineHeight: 16, color: colors.muted },
  switchAction: { color: colors.primary, fontFamily: 'PoppinsSemiBold', fontSize: 12.5 },
});
