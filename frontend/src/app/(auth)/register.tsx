import { useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { AuthShell } from '@/components/auth-shell';
import { Button, Field, InlineAlert } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
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
    <AuthShell
      eyebrow="GABUNG DENGAN KOMUNITAS"
      title="Buat akun BMarket"
      subtitle="Daftar dengan identitas kampus untuk mulai jual-beli bersama Binusian."
    >
      <View style={styles.form}>
        {formError ? <InlineAlert message={formError} /> : null}
        <View style={[styles.doubleField, width < 440 && styles.doubleFieldMobile]}>
          <View style={styles.half}>
            <Field label="Nama lengkap" value={form.name} onChangeText={update('name')} icon="person-outline" placeholder="Nama kamu" error={errors.name} />
          </View>
          <View style={styles.half}>
            <Field label="NIM" value={form.studentId} onChangeText={update('studentId')} icon="id-card-outline" keyboardType="number-pad" placeholder="Contoh: 2440001234" error={errors.studentId} />
          </View>
        </View>
        <Field label="Email BINUS" value={form.email} onChangeText={update('email')} autoCapitalize="none" autoComplete="email" keyboardType="email-address" icon="mail-outline" placeholder="nama@binus.ac.id" error={errors.email} />
        <Field label="Password" value={form.password} onChangeText={update('password')} secureTextEntry={!showPassword} autoComplete="new-password" icon="lock-closed-outline" rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'} onRightPress={() => setShowPassword(value => !value)} placeholder="Minimal 8 karakter" hint="Kombinasikan huruf dan angka agar lebih aman." error={errors.password} onSubmitEditing={submit} />
        <Button title="Buat akun" icon="person-add-outline" loading={loading} onPress={submit} />
      </View>
      <Text style={styles.switch}>Sudah punya akun? <Link href="/(auth)/login" style={styles.link}>Masuk di sini</Link></Text>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  doubleField: { flexDirection: 'row', gap: spacing.sm },
  doubleFieldMobile: { flexDirection: 'column' },
  half: { flex: 1, minWidth: 0 },
  switch: { textAlign: 'center', color: colors.muted, fontFamily: 'PoppinsRegular', fontSize: 13 },
  link: { color: colors.primary, fontFamily: 'PoppinsSemiBold' },
});
