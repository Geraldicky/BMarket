import { useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AuthShell } from '@/components/auth-shell';
import { Button, Field, InlineAlert } from '@/components/ui';
import { colors, spacing, makeStyles } from '@/constants/theme';
import { errorCode, errorMessage } from '@/lib/api';
import { useAuth } from '@/store/auth';

export default function LoginScreen() {
  const styles = useStyles();
  const router = useRouter();
  const login = useAuth(state => state.login);
  const mobile = useWindowDimensions().width < 900;
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
      <View style={[styles.form, mobile && styles.formMobile]}>
        {formError ? <InlineAlert message={formError} /> : null}

        <Field
          dense={mobile}
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
            dense={mobile}
            label="Password"
            value={password}
            onChangeText={value => { setPassword(value); setErrors(current => ({ ...current, password: undefined })); }}
            secureTextEntry={!showPassword}
            autoComplete="current-password"
            icon="lock-closed-outline"
            rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
            rightAccessibilityLabel={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
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

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>atau</Text>
          <View style={styles.dividerLine} />
        </View>

        <Text style={styles.switchText}>
          Belum punya akun?{' '}
          <Text accessibilityRole="link" onPress={() => router.push('/(auth)/register')} style={styles.switchLink}>daftar</Text>
        </Text>
      </View>
    </AuthShell>
  );
}

const useStyles = makeStyles(() => ({
  form: { gap: spacing.md },
  formMobile: { gap: 12 },
  passwordBlock: { gap: 5 },
  forgotButton: { alignSelf: 'flex-end', minHeight: 30, justifyContent: 'center', paddingHorizontal: 2 },
  forgotLink: { color: colors.primary, fontFamily: 'PoppinsSemiBold', fontSize: 12.5 },
  primaryButton: { marginTop: 2 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontFamily: 'PoppinsMedium', fontSize: 12, color: colors.muted },
  switchText: { textAlign: 'center', fontFamily: 'PoppinsRegular', fontSize: 13, color: colors.textSoft },
  switchLink: { fontFamily: 'PoppinsSemiBold', color: colors.primary, textDecorationLine: 'underline' },
}));
