import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AuthShell } from '@/components/auth-shell';
import { Button, Field, InlineAlert } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { endpoints, errorMessage } from '@/lib/api';

const CODE_LENGTH = 6;
type Stage = 'code' | 'password' | 'done';

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string; maskedEmail?: string; cooldown?: string }>();
  const router = useRouter();
  const inputs = useRef<(TextInput | null)[]>([]);
  const email = firstParam(params.email).trim().toLowerCase();
  const displayedEmail = firstParam(params.maskedEmail) || maskEmail(email);
  const initialCooldown = Number(firstParam(params.cooldown));
  const [stage, setStage] = useState<Stage>('code');
  const [digits, setDigits] = useState(() => Array(CODE_LENGTH).fill(''));
  const [seconds, setSeconds] = useState(
    Number.isFinite(initialCooldown) && initialCooldown >= 0 ? initialCooldown : 60,
  );
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<{ password?: string; confirm?: string }>({});
  const code = useMemo(() => digits.join(''), [digits]);

  useEffect(() => {
    if (!email) router.replace('/(auth)/forgot-password');
  }, [email, router]);

  useEffect(() => {
    if (seconds <= 0 || stage !== 'code') return;
    const timer = setInterval(() => setSeconds(value => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [seconds, stage]);

  const verifyCode = async (value = code) => {
    if (value.length !== CODE_LENGTH || loading) {
      if (value.length !== CODE_LENGTH) setMessage('Masukkan seluruh 6 digit kode reset.');
      return;
    }
    setLoading(true);
    setMessage('');
    setSuccess('');
    try {
      const result = await endpoints.verifyResetCode({ email, code: value });
      setResetToken(result.resetToken);
      setStage('password');
      setDigits(Array(CODE_LENGTH).fill(''));
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
      if (pasted.length === CODE_LENGTH) void verifyCode(pasted.join(''));
      return;
    }

    const next = [...digits];
    next[index] = numeric;
    setDigits(next);
    if (numeric && index < CODE_LENGTH - 1) inputs.current[index + 1]?.focus();
    if (numeric && index === CODE_LENGTH - 1 && next.every(Boolean)) {
      void verifyCode(next.join(''));
    }
  };

  const resend = async () => {
    if (seconds > 0 || resending) return;
    setResending(true);
    setMessage('');
    setSuccess('');
    try {
      const result = await endpoints.forgotPassword({ email });
      setSeconds(result.resendAfterSeconds);
      setDigits(Array(CODE_LENGTH).fill(''));
      setSuccess(`Jika akun tersedia, kode baru dikirim ke ${result.maskedEmail}.`);
      inputs.current[0]?.focus();
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setResending(false);
    }
  };

  const savePassword = async () => {
    const nextErrors: typeof passwordErrors = {};
    if (password.length < 8) nextErrors.password = 'Gunakan minimal 8 karakter.';
    if (!confirmPassword) nextErrors.confirm = 'Konfirmasi password wajib diisi.';
    else if (password !== confirmPassword) nextErrors.confirm = 'Konfirmasi password belum sama.';
    setPasswordErrors(nextErrors);
    setMessage('');
    if (Object.keys(nextErrors).length || !resetToken) return;

    setLoading(true);
    try {
      await endpoints.resetPassword({ email, resetToken, password, confirmPassword });
      setResetToken('');
      setPassword('');
      setConfirmPassword('');
      setStage('done');
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const title = stage === 'code' ? 'Cek kode reset' : stage === 'password' ? 'Buat password baru' : 'Password diperbarui';
  const subtitle = stage === 'code'
    ? `Jika akun tersedia, kode 6 digit dikirim ke ${displayedEmail}.`
    : stage === 'password'
      ? 'Gunakan password baru yang berbeda dari password sebelumnya.'
      : 'Semua sesi lama sudah dikeluarkan untuk menjaga keamanan akunmu.';

  return (
    <AuthShell eyebrow="PEMULIHAN AKUN" title={title} subtitle={subtitle}>
      <View style={styles.form}>
        {stage !== 'done' ? (
          <View style={styles.progress}>
            <View style={styles.progressItem}>
              <View style={[styles.progressDot, styles.progressDotActive]}><Text style={styles.progressNumber}>1</Text></View>
              <Text style={styles.progressLabel}>Verifikasi kode</Text>
            </View>
            <View style={[styles.progressLine, stage !== 'code' && styles.progressLineActive]} />
            <View style={styles.progressItem}>
              <View style={[styles.progressDot, stage !== 'code' && styles.progressDotActive]}><Text style={[styles.progressNumber, stage === 'code' && styles.progressNumberMuted]}>2</Text></View>
              <Text style={[styles.progressLabel, stage === 'code' && styles.progressLabelMuted]}>Password baru</Text>
            </View>
          </View>
        ) : null}

        {message ? <InlineAlert message={message} /> : null}
        {success ? <InlineAlert message={success} tone="success" /> : null}

        {stage === 'code' ? (
          <>
            <View accessibilityLabel="Kode reset 6 digit" style={styles.codeRow}>
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
              title="Periksa kode"
              icon="shield-checkmark-outline"
              loading={loading}
              disabled={code.length !== CODE_LENGTH}
              onPress={() => void verifyCode()}
            />
            <View style={styles.resendRow}>
              <Text style={styles.resendCopy}>Belum menerima kode?</Text>
              <Pressable disabled={seconds > 0 || resending} onPress={() => void resend()}>
                <Text style={[styles.resendAction, seconds > 0 && styles.resendDisabled]}>
                  {resending ? 'Mengirim...' : seconds > 0 ? `Kirim ulang dalam ${seconds} dtk` : 'Kirim ulang kode'}
                </Text>
              </Pressable>
            </View>
            <Pressable style={styles.back} onPress={() => router.replace('/(auth)/forgot-password')}>
              <Ionicons name="arrow-back-outline" size={17} color={colors.textSoft} />
              <Text style={styles.backText}>Gunakan email lain</Text>
            </Pressable>
          </>
        ) : null}

        {stage === 'password' ? (
          <>
            <View style={styles.secureNotice}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.success} />
              <Text style={styles.secureNoticeText}>Kode benar. Sesi reset ini berlaku 10 menit dan hanya dapat dipakai sekali.</Text>
            </View>
            <Field
              label="Password baru"
              value={password}
              onChangeText={value => { setPassword(value); setPasswordErrors(current => ({ ...current, password: undefined })); }}
              secureTextEntry={!showPassword}
              autoComplete="new-password"
              icon="lock-closed-outline"
              rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
              onRightPress={() => setShowPassword(value => !value)}
              placeholder="Minimal 8 karakter"
              hint="Gunakan password yang berbeda dari sebelumnya."
              error={passwordErrors.password}
            />
            <Field
              label="Ulangi password baru"
              value={confirmPassword}
              onChangeText={value => { setConfirmPassword(value); setPasswordErrors(current => ({ ...current, confirm: undefined })); }}
              secureTextEntry={!showConfirmPassword}
              autoComplete="new-password"
              icon="shield-checkmark-outline"
              rightIcon={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
              onRightPress={() => setShowConfirmPassword(value => !value)}
              placeholder="Ketik ulang password"
              error={passwordErrors.confirm}
              onSubmitEditing={() => void savePassword()}
            />
            <Button
              title="Simpan password baru"
              icon="checkmark-circle-outline"
              loading={loading}
              onPress={() => void savePassword()}
            />
          </>
        ) : null}

        {stage === 'done' ? (
          <View style={styles.doneCard}>
            <View style={styles.doneIcon}><Ionicons name="checkmark" size={32} color={colors.white} /></View>
            <Text style={styles.doneTitle}>Akunmu sudah aman</Text>
            <Text style={styles.doneCopy}>Masuk kembali menggunakan password baru. Token reset sudah dihapus dan tidak dapat digunakan lagi.</Text>
            <Button title="Kembali ke halaman masuk" icon="log-in-outline" onPress={() => router.replace('/(auth)/login')} style={styles.doneButton} />
          </View>
        ) : null}
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  progress: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', paddingHorizontal: 10 },
  progressItem: { width: 112, alignItems: 'center', gap: 7 },
  progressDot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E7EDF4' },
  progressDotActive: { backgroundColor: colors.primary },
  progressNumber: { fontFamily: 'PoppinsBold', fontSize: 12, color: colors.white },
  progressNumberMuted: { color: colors.muted },
  progressLabel: { fontFamily: 'PoppinsMedium', fontSize: 11, color: colors.textSoft, textAlign: 'center' },
  progressLabelMuted: { color: colors.muted },
  progressLine: { width: 70, height: 2, marginHorizontal: -30, marginTop: 14, backgroundColor: '#E7EDF4' },
  progressLineActive: { backgroundColor: colors.primary },
  codeRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  codeInput: { flex: 1, minWidth: 0, maxWidth: 64, height: 64, borderWidth: 1.5, borderColor: colors.borderStrong, borderRadius: 12, backgroundColor: colors.surface, textAlign: 'center', fontFamily: 'PoppinsBold', fontSize: 24, color: colors.text },
  codeInputFilled: { borderColor: colors.primary, backgroundColor: '#F7FBFF' },
  resendRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 5 },
  resendCopy: { fontFamily: 'PoppinsRegular', fontSize: 13, color: colors.muted },
  resendAction: { fontFamily: 'PoppinsSemiBold', fontSize: 13, color: colors.primary },
  resendDisabled: { color: colors.muted },
  back: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  backText: { fontFamily: 'PoppinsMedium', fontSize: 13, color: colors.textSoft },
  secureNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: radius.sm, backgroundColor: colors.successSoft, borderWidth: 1, borderColor: '#C9EDDE' },
  secureNoticeText: { flex: 1, fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 18, color: colors.textSoft },
  doneCard: { alignItems: 'center', paddingVertical: spacing.md, gap: spacing.sm },
  doneIcon: { width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.success, marginBottom: spacing.sm },
  doneTitle: { fontFamily: 'PoppinsBold', fontSize: 22, color: colors.text },
  doneCopy: { maxWidth: 420, textAlign: 'center', fontFamily: 'PoppinsRegular', fontSize: 13, lineHeight: 21, color: colors.muted },
  doneButton: { alignSelf: 'stretch', marginTop: spacing.md },
});
