import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { AuthShell } from '@/components/auth-shell';
import { Button, Field, InlineAlert } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
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
    <AuthShell eyebrow="AKUN BINUS" title="Masuk ke BMarket" subtitle="Gunakan akun BINUS-mu untuk melanjutkan ke marketplace kampus.">
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

        <View style={styles.passwordBlock}>
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
          <Pressable onPress={() => router.push('/(auth)/forgot-password')} style={({ pressed }) => [styles.forgotButton, pressed && { opacity: .65 }]}>
            <Text style={styles.forgotLink}>Lupa password?</Text>
          </Pressable>
        </View>

        <Button title="Masuk" icon="log-in-outline" loading={loading} onPress={submit} style={styles.primaryButton} />

        <View style={styles.switchCard}>
          <View style={styles.switchIcon}><Ionicons name="person-add-outline" size={18} color={colors.primary} /></View>
          <View style={styles.switchCopy}>
            <Text style={styles.switchTitle}>Belum punya akun?</Text>
            <Text style={styles.switchText}>Daftar menggunakan email dan identitas BINUS.</Text>
          </View>
          <Link href="/(auth)/register" style={styles.switchAction}>Daftar</Link>
        </View>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  passwordBlock: { gap: 5 },
  forgotButton: { alignSelf: 'flex-end', minHeight: 30, justifyContent: 'center', paddingHorizontal: 2 },
  forgotLink: { color: colors.primary, fontFamily: 'PoppinsSemiBold', fontSize: 12.5 },
  primaryButton: { marginTop: 2 },
  switchCard: { marginTop: 2, padding: 13, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: '#FBFDFF', flexDirection: 'row', alignItems: 'center', gap: 11 },
  switchIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  switchCopy: { flex: 1, gap: 1 },
  switchTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 12.5, color: colors.text },
  switchText: { fontFamily: 'PoppinsRegular', fontSize: 10.5, lineHeight: 16, color: colors.muted },
  switchAction: { color: colors.primary, fontFamily: 'PoppinsSemiBold', fontSize: 12.5 },
});
