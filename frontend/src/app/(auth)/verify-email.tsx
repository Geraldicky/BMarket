import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AuthShell } from '@/components/auth-shell';
import { Button, InlineAlert } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { endpoints, errorMessage, errorRetryAfter } from '@/lib/api';
import { useAuth } from '@/store/auth';

const CODE_LENGTH = 6;

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}

export default function VerifyEmailScreen() {
  const params = useLocalSearchParams<{ email?: string; maskedEmail?: string; cooldown?: string }>();
  const router = useRouter();
  const verifyEmail = useAuth(state => state.verifyEmail);
  const inputs = useRef<(TextInput | null)[]>([]);
  const email = firstParam(params.email).trim().toLowerCase();
  const displayedEmail = firstParam(params.maskedEmail) || maskEmail(email);
  const [digits, setDigits] = useState(() => Array(CODE_LENGTH).fill(''));
  const initialCooldown = Number(firstParam(params.cooldown));
  const [seconds, setSeconds] = useState(
    Number.isFinite(initialCooldown) && initialCooldown >= 0 ? initialCooldown : 60,
  );
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState('');
  const code = useMemo(() => digits.join(''), [digits]);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setInterval(() => setSeconds(value => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [seconds]);

  useEffect(() => {
    if (!email) router.replace('/(auth)/register');
  }, [email, router]);

  const submitCode = async (value = code) => {
    if (value.length !== CODE_LENGTH || loading) {
      if (value.length !== CODE_LENGTH) setMessage('Masukkan seluruh 6 digit kode OTP.');
      return;
    }
    setLoading(true);
    setMessage('');
    setSuccess('');
    try {
      await verifyEmail({ email, code: value });
      router.replace('/(student)/(tabs)');
    } catch (error) {
      setMessage(errorMessage(error));
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const changeDigit = (index: number, rawValue: string) => {
    const numeric = rawValue.replace(/\D/g, '');
    setMessage('');
    setSuccess('');

    if (numeric.length > 1) {
      const pasted = numeric.slice(0, CODE_LENGTH).split('');
      const next = Array(CODE_LENGTH).fill('');
      pasted.forEach((value, pastedIndex) => { next[pastedIndex] = value; });
      setDigits(next);
      inputs.current[Math.min(pasted.length, CODE_LENGTH) - 1]?.focus();
      if (pasted.length === CODE_LENGTH) void submitCode(pasted.join(''));
      return;
    }

    const next = [...digits];
    next[index] = numeric;
    setDigits(next);
    if (numeric && index < CODE_LENGTH - 1) inputs.current[index + 1]?.focus();
    if (numeric && index === CODE_LENGTH - 1 && next.every(Boolean)) {
      void submitCode(next.join(''));
    }
  };

  const resend = async () => {
    if (!email || seconds > 0 || resending) return;
    setResending(true);
    setMessage('');
    setSuccess('');
    try {
      const result = await endpoints.resendVerification({ email });
      setSeconds(result.resendAfterSeconds);
      setDigits(Array(CODE_LENGTH).fill(''));
      setSuccess(`Kode baru sudah dikirim ke ${result.maskedEmail}.`);
      inputs.current[0]?.focus();
    } catch (error) {
      const retryAfter = errorRetryAfter(error);
      if (retryAfter) setSeconds(retryAfter);
      setMessage(errorMessage(error));
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthShell
      eyebrow="VERIFIKASI EMAIL KAMPUS"
      title="Cek inbox kamu"
      subtitle={`Kami mengirim kode 6 digit ke ${displayedEmail}. Kode berlaku selama 10 menit.`}
    >
      <View style={styles.form}>
        {message ? <InlineAlert message={message} /> : null}
        {success ? <InlineAlert message={success} tone="success" /> : null}

        <View style={styles.mailNotice}>
          <View style={styles.mailIcon}>
            <Ionicons name="mail-unread-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.mailCopy}>
            <Text style={styles.mailTitle}>Masukkan kode verifikasi</Text>
            <Text style={styles.mailText}>Periksa folder spam jika email belum terlihat.</Text>
          </View>
        </View>

        <View accessibilityLabel="Kode OTP 6 digit" style={styles.codeRow}>
          {digits.map((digit, index) => (
            <TextInput
              key={index}
              ref={input => { inputs.current[index] = input; }}
              value={digit}
              onChangeText={value => changeDigit(index, value)}
              onKeyPress={({ nativeEvent }) => {
                if (nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
                  inputs.current[index - 1]?.focus();
                }
              }}
              autoFocus={index === 0}
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              keyboardType="number-pad"
              maxLength={CODE_LENGTH}
              selectTextOnFocus
              style={[styles.codeInput, digit && styles.codeInputFilled]}
              accessibilityLabel={`Digit ${index + 1}`}
            />
          ))}
        </View>

        <Button
          title="Verifikasi dan masuk"
          icon="shield-checkmark-outline"
          loading={loading}
          disabled={code.length !== CODE_LENGTH}
          onPress={() => void submitCode()}
        />

        <View style={styles.resendRow}>
          <Text style={styles.resendCopy}>Belum menerima kode?</Text>
          <Pressable disabled={seconds > 0 || resending} onPress={() => void resend()}>
            <Text style={[styles.resendAction, seconds > 0 && styles.resendDisabled]}>
              {resending ? 'Mengirim...' : seconds > 0 ? `Kirim ulang dalam ${seconds} dtk` : 'Kirim ulang kode'}
            </Text>
          </Pressable>
        </View>

        <Pressable style={styles.changeEmail} onPress={() => router.replace('/(auth)/register')}>
          <Ionicons name="arrow-back-outline" size={17} color={colors.textSoft} />
          <Text style={styles.changeEmailText}>Gunakan email lain</Text>
        </Pressable>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  mailNotice: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 15, borderRadius: radius.sm, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: '#C8E0FA' },
  mailIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  mailCopy: { flex: 1, gap: 2 },
  mailTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 14, color: colors.text },
  mailText: { fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 18, color: colors.muted },
  codeRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  codeInput: { flex: 1, minWidth: 0, maxWidth: 64, height: 64, borderWidth: 1.5, borderColor: colors.borderStrong, borderRadius: 12, backgroundColor: colors.surface, textAlign: 'center', fontFamily: 'PoppinsBold', fontSize: 24, color: colors.text },
  codeInputFilled: { borderColor: colors.primary, backgroundColor: '#F7FBFF' },
  resendRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 5 },
  resendCopy: { fontFamily: 'PoppinsRegular', fontSize: 13, color: colors.muted },
  resendAction: { fontFamily: 'PoppinsSemiBold', fontSize: 13, color: colors.primary },
  resendDisabled: { color: colors.muted },
  changeEmail: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  changeEmailText: { fontFamily: 'PoppinsMedium', fontSize: 13, color: colors.textSoft },
});
