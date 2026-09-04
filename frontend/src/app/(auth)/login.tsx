import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { AuthShell } from '@/components/auth-shell';
import { Button, Field, InlineAlert } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { errorCode, errorMessage } from '@/lib/api';
import { useAuth } from '@/store/auth';

export default function LoginScreen() {
  const router = useRouter();
  const login = useAuth(state => state.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const submit = async () => {
    const nextErrors: typeof errors = {};
    if (!email.trim()) nextErrors.email = 'Email BINUS wajib diisi.';
    else if (!email.includes('@')) nextErrors.email = 'Format email belum benar.';
    if (!password) nextErrors.password = 'Password wajib diisi.';
    setErrors(nextErrors);
    setFormError('');
    if (Object.keys(nextErrors).length) return;

    setLoading(true);
    try {
      await login({ email, password });
    } catch (error) {
      if (errorCode(error) === 'EMAIL_NOT_VERIFIED') {
        router.push({ pathname: '/(auth)/verify-email', params: { email: email.trim().toLowerCase(), cooldown: '0' } });
      } else {
        setFormError(errorMessage(error));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="AKUN BINUS"
      title="Masuk"
      subtitle="Lanjutkan dengan email @binus.ac.id."
    >
      <View style={styles.form}>
        {formError ? <InlineAlert message={formError} /> : null}
        <Field
          label="Email BINUS"
          value={email}
          onChangeText={value => { setEmail(value); setErrors(current => ({ ...current, email: undefined })); }}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          icon="mail-outline"
          placeholder="nama@binus.ac.id"
          error={errors.email}
        />
        <Field
          label="Password"
          value={password}
          onChangeText={value => { setPassword(value); setErrors(current => ({ ...current, password: undefined })); }}
          secureTextEntry={!showPassword}
          autoComplete="current-password"
          icon="lock-closed-outline"
          rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
          onRightPress={() => setShowPassword(value => !value)}
          placeholder="Masukkan password"
          error={errors.password}
          onSubmitEditing={submit}
        />
        <View style={styles.forgotRow}>
          <Link href="/(auth)/forgot-password" style={styles.forgotLink}>Lupa password?</Link>
        </View>
        <Button title="Masuk" loading={loading} onPress={submit} />
      </View>
      <Text style={styles.switch}>Belum punya akun? <Link href="/(auth)/register" style={styles.link}>Daftar sekarang</Link></Text>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  forgotRow: { alignItems: 'flex-end', marginTop: -4 },
  forgotLink: { color: colors.primary, fontFamily: 'PoppinsSemiBold', fontSize: 13 },
  switch: { textAlign: 'center', color: colors.muted, fontFamily: 'PoppinsRegular', fontSize: 13 },
  link: { color: colors.primary, fontFamily: 'PoppinsSemiBold' },
});
