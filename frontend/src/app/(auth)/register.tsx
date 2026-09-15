import { useState } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AuthShell } from '@/components/auth-shell';
import { Button, Field, InlineAlert } from '@/components/ui';
import { colors, spacing, makeStyles } from '@/constants/theme';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/store/auth';

type FormErrors = Partial<Record<'name' | 'studentId' | 'email' | 'password', string>>;

export default function RegisterScreen() {
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const mobile = width < 900;
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
      {/* Mobile keeps the form compact so the whole card, including its footer, fits on a phone screen. */}
      <View style={[styles.form, mobile && styles.formMobile]}>
        {formError ? <InlineAlert message={formError} /> : null}

        <View style={[styles.doubleField, width < 340 && styles.doubleFieldMobile]}>
          <View style={styles.half}>
            <Field dense={mobile} label="Nama lengkap" value={form.name} onChangeText={update('name')} icon="person-outline" placeholder="Nama kamu" error={errors.name} />
          </View>
          <View style={styles.half}>
            <Field dense={mobile} label="NIM" value={form.studentId} onChangeText={update('studentId')} icon="id-card-outline" keyboardType="number-pad" placeholder="2440001234" error={errors.studentId} />
          </View>
        </View>

        <Field dense={mobile} label="Email BINUS" value={form.email} onChangeText={update('email')} autoCapitalize="none" autoComplete="email" keyboardType="email-address" icon="mail-outline" placeholder="nama@binus.ac.id" error={errors.email} />
        <Field dense={mobile} label="Password" value={form.password} onChangeText={update('password')} secureTextEntry={!showPassword} autoComplete="new-password" icon="lock-closed-outline" rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'} onRightPress={() => setShowPassword(value => !value)} placeholder="Minimal 8 karakter" hint={mobile ? undefined : 'Gunakan minimal 8 karakter dan kombinasikan huruf dengan angka.'} error={errors.password} onSubmitEditing={submit} />

        <Button title="Buat akun" icon="person-add-outline" loading={loading} onPress={submit} style={styles.primaryButton} />

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>atau</Text>
          <View style={styles.dividerLine} />
        </View>

        <Text style={styles.switchText}>
          Sudah punya akun?{' '}
          <Text accessibilityRole="link" onPress={() => router.push('/(auth)/login')} style={styles.switchLink}>masuk</Text>
        </Text>
      </View>
    </AuthShell>
  );
}

const useStyles = makeStyles(() => ({
  form: { gap: spacing.md },
  formMobile: { gap: 12 },
  doubleField: { flexDirection: 'row', gap: 10 },
  doubleFieldMobile: { flexDirection: 'column' },
  half: { flex: 1, minWidth: 0 },
  primaryButton: { marginTop: 2 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontFamily: 'PoppinsMedium', fontSize: 12, color: colors.muted },
  switchText: { textAlign: 'center', fontFamily: 'PoppinsRegular', fontSize: 13, color: colors.textSoft },
  switchLink: { fontFamily: 'PoppinsSemiBold', color: colors.primary, textDecorationLine: 'underline' },
}));
