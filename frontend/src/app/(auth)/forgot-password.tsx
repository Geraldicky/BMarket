import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AuthShell } from '@/components/auth-shell';
import { Button, Field, InlineAlert } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { endpoints, errorMessage } from '@/lib/api';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const normalized = email.trim().toLowerCase();
    setError('');
    setFieldError('');
    if (!normalized) {
      setFieldError('Email BINUS wajib diisi.');
      return;
    }
    if (!normalized.includes('@')) {
      setFieldError('Format email belum benar.');
      return;
    }

    setLoading(true);
    try {
      const result = await endpoints.forgotPassword({ email: normalized });
      router.push({
        pathname: '/(auth)/reset-password',
        params: {
          email: result.email,
          maskedEmail: result.maskedEmail,
          cooldown: String(result.resendAfterSeconds),
        },
      });
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="PEMULIHAN AKUN"
      title="Lupa password?"
      subtitle="Masukkan email BINUS yang terhubung ke akunmu. Kami akan mengirim kode reset 6 digit."
    >
      <View style={styles.form}>
        {error ? <InlineAlert message={error} /> : null}
        <View style={styles.notice}>
          <View style={styles.noticeIcon}>
            <Ionicons name="key-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.noticeCopy}>
            <Text style={styles.noticeTitle}>Aman dan sekali pakai</Text>
            <Text style={styles.noticeText}>Kode berlaku 10 menit. Kami tidak pernah mengirim password melalui email.</Text>
          </View>
        </View>
        <Field
          label="Email BINUS"
          value={email}
          onChangeText={value => { setEmail(value); setFieldError(''); }}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          icon="mail-outline"
          placeholder="nama@binus.ac.id"
          error={fieldError}
          onSubmitEditing={() => void submit()}
        />
        <Button
          title="Kirim kode reset"
          icon="mail-unread-outline"
          loading={loading}
          onPress={() => void submit()}
        />
        <Pressable style={styles.back} onPress={() => router.replace('/(auth)/login')}>
          <Ionicons name="arrow-back-outline" size={17} color={colors.textSoft} />
          <Text style={styles.backText}>Kembali ke halaman masuk</Text>
        </Pressable>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 15, borderRadius: radius.sm, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: '#C8E0FA' },
  noticeIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  noticeCopy: { flex: 1, gap: 2 },
  noticeTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 14, color: colors.text },
  noticeText: { fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 18, color: colors.muted },
  back: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  backText: { fontFamily: 'PoppinsMedium', fontSize: 13, color: colors.textSoft },
});
