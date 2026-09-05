import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewProps,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, layout, radius, shadowSoft, spacing } from '@/constants/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function Screen({ children, scroll = true, style, backgroundColor }: ViewProps & { scroll?: boolean; backgroundColor?: string }) {
  const width = useWindowDimensions().width;
  const desktop = width >= 960;
  const mobile = width < 600;
  const content = <View style={[styles.content, desktop && styles.contentDesktop, mobile && styles.contentMobile, style]}>{children}</View>;
  return (
    <SafeAreaView style={[styles.safe, backgroundColor ? { backgroundColor } : null]} edges={['top']}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {content}
        </ScrollView>
      ) : content}
    </SafeAreaView>
  );
}

export function Title({ children, subtitle, eyebrow, action }: { children: React.ReactNode; subtitle?: string; eyebrow?: string; action?: React.ReactNode }) {
  const mobile = useWindowDimensions().width < 600;
  return <View style={[styles.titleRow, mobile && styles.titleRowMobile]}><View style={styles.titleWrap}>{eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}<Text style={[styles.title, mobile && styles.titleMobile]}>{children}</Text>{subtitle ? <Text style={[styles.subtitle, mobile && styles.subtitleMobile]}>{subtitle}</Text> : null}</View>{action ? <View style={[styles.titleAction, mobile && styles.titleActionMobile]}>{action}</View> : null}</View>;
}

export function Card(props: ViewProps) {
  const mobile = useWindowDimensions().width < 600;
  return <View {...props} style={[styles.card, mobile && styles.cardMobile, props.style]} />;
}

export function Field({ label, hint, error, icon, rightIcon, onRightPress, ...props }: TextInputProps & {
  label?: string; hint?: string; error?: string; icon?: IconName; rightIcon?: IconName; onRightPress?: () => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.fieldWrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputShell, focused && styles.inputFocused, error && styles.inputError]}>
        {icon ? <Ionicons name={icon} size={19} color={focused ? colors.primary : colors.muted} /> : null}
        <TextInput
          placeholderTextColor={colors.muted}
          {...props}
          onFocus={event => { setFocused(true); props.onFocus?.(event); }}
          onBlur={event => { setFocused(false); props.onBlur?.(event); }}
          style={[styles.input, props.multiline && styles.multiline, props.style]}
        />
        {rightIcon ? <Pressable accessibilityRole="button" hitSlop={8} onPress={onRightPress} style={({ pressed }) => [styles.inputAction, pressed && { opacity: 0.55 }]}><Ionicons name={rightIcon} size={20} color={colors.muted} /></Pressable> : null}
      </View>
      {error ? <Text style={styles.fieldError}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Button({ title, onPress, variant = 'primary', loading, disabled, icon, style }: {
  title: string; onPress?: () => void; variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; loading?: boolean; disabled?: boolean; icon?: IconName; style?: StyleProp<ViewStyle>;
}) {
  const foreground = variant === 'primary' || variant === 'danger' ? colors.white : colors.primary;
  return (
    <Pressable accessibilityRole="button" disabled={disabled || loading} onPress={onPress} style={({ pressed }) => [styles.button, styles[`button_${variant}`], style, (pressed || disabled) && { opacity: 0.68 }]}>
      {loading ? <ActivityIndicator color={foreground} /> : <View style={styles.buttonContent}>{icon ? <Ionicons name={icon} color={foreground} size={19} /> : null}<Text style={[styles.buttonText, styles[`buttonText_${variant}`]]}>{title}</Text></View>}
    </Pressable>
  );
}

export function InlineAlert({ message, tone = 'danger' }: { message: string; tone?: 'danger' | 'success' | 'warning' }) {
  const color = tone === 'success' ? colors.success : tone === 'warning' ? colors.warning : colors.danger;
  const icon = tone === 'success' ? 'checkmark-circle-outline' : tone === 'warning' ? 'time-outline' : 'alert-circle-outline';
  const boxStyle = tone === 'success' ? styles.alertSuccess : tone === 'warning' ? styles.alertWarning : styles.alertDanger;
  return <View style={[styles.alert, boxStyle]}><Ionicons name={icon} size={19} color={color} /><Text style={[styles.alertText, { color }]}>{message}</Text></View>;
}


type FeedbackTone = 'info' | 'success' | 'warning' | 'danger';

export function FeedbackDialog({
  visible,
  tone = 'info',
  eyebrow,
  title,
  message,
  primaryLabel = 'OK',
  secondaryLabel,
  onPrimary,
  onSecondary,
  onClose,
  loading = false,
}: {
  visible: boolean;
  tone?: FeedbackTone;
  eyebrow?: string;
  title: string;
  message: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
  onClose?: () => void;
  loading?: boolean;
}) {
  const meta: Record<FeedbackTone, { icon: IconName; color: string; background: string; label: string }> = {
    info: { icon: 'information-circle-outline', color: colors.primary, background: colors.primarySoft, label: 'INFORMASI' },
    success: { icon: 'checkmark-circle-outline', color: colors.success, background: colors.successSoft, label: 'BERHASIL' },
    warning: { icon: 'warning-outline', color: colors.warning, background: colors.warningSoft, label: 'PERLU KONFIRMASI' },
    danger: { icon: 'alert-circle-outline', color: colors.danger, background: colors.dangerSoft, label: 'PERHATIAN' },
  };
  const mobile = useWindowDimensions().width < 420;
  const current = meta[tone];
  const close = () => { if (!loading) onClose?.(); };
  const primary = () => { if (!loading) (onPrimary || onClose)?.(); };
  const secondary = () => { if (!loading) (onSecondary || onClose)?.(); };
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
      <View style={[styles.feedbackBackdrop, mobile && styles.feedbackBackdropMobile]}>
        <View style={[styles.feedbackDialog, mobile && styles.feedbackDialogMobile]}>
          <View style={styles.feedbackHeader}>
            <View style={[styles.feedbackIcon, { backgroundColor: current.background }]}><Ionicons name={current.icon} size={25} color={current.color} /></View>
            {onClose ? <Pressable accessibilityLabel="Tutup dialog" disabled={loading} onPress={close} style={({ pressed }) => [styles.feedbackClose, pressed && { opacity: .6 }]}><Ionicons name="close" size={20} color={colors.textSoft} /></Pressable> : null}
          </View>
          <View style={styles.feedbackCopy}>
            <Text style={[styles.feedbackEyebrow, { color: current.color }]}>{eyebrow || current.label}</Text>
            <Text style={[styles.feedbackTitle, mobile && styles.feedbackTitleMobile]}>{title}</Text>
            <Text style={styles.feedbackMessage}>{message}</Text>
          </View>
          <View style={[styles.feedbackActions, mobile && styles.feedbackActionsMobile]}>
            {secondaryLabel ? <Button title={secondaryLabel} variant="ghost" disabled={loading} onPress={secondary} style={styles.feedbackSecondary} /> : null}
            <Button title={primaryLabel} variant={tone === 'danger' ? 'danger' : 'primary'} loading={loading} onPress={primary} style={styles.feedbackPrimary} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function Empty({ title, message, icon = 'storefront-outline', action }: { title: string; message: string; icon?: IconName; action?: React.ReactNode }) {
  return <Card style={styles.empty}><View style={styles.emptyIcon}><Ionicons name={icon} size={27} color={colors.primary} /></View><Text style={styles.emptyTitle}>{title}</Text><Text style={[styles.subtitle, styles.emptyMessage]}>{message}</Text>{action}</Card>;
}

export function Loader() {
  return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.loadingText}>Menyiapkan untukmu...</Text></View>;
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return <Card style={styles.empty}><View style={[styles.emptyIcon, { backgroundColor: colors.dangerSoft }]}><Ionicons name="cloud-offline-outline" size={28} color={colors.danger} /></View><Text style={styles.errorTitle}>Belum berhasil memuat</Text><Text style={styles.subtitle}>{message}</Text>{retry ? <Button title="Coba lagi" variant="secondary" icon="refresh-outline" onPress={retry} /> : null}</Card>;
}

export const money = (value: number | string | undefined) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
export const date = (value: string | undefined) => value ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(value)) : '-';

const styles = StyleSheet.create({

  feedbackBackdrop: { flex: 1, padding: 24, backgroundColor: 'rgba(10,26,41,.58)', alignItems: 'center', justifyContent: 'center' },
  feedbackBackdropMobile: { padding: 12 },
  feedbackDialog: { width: '100%', maxWidth: 440, borderRadius: 18, padding: 22, gap: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, shadowColor: '#071727', shadowOpacity: .18, shadowRadius: 28, shadowOffset: { width: 0, height: 14 }, elevation: 8 },
  feedbackDialogMobile: { borderRadius: 16, padding: 17, gap: 14 },
  feedbackHeader: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  feedbackIcon: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  feedbackClose: { width: 38, height: 38, borderRadius: 11, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  feedbackCopy: { gap: 5 },
  feedbackEyebrow: { fontFamily: 'PoppinsBold', fontSize: 11, letterSpacing: .75 },
  feedbackTitle: { fontFamily: 'PoppinsBold', fontSize: 22, lineHeight: 29, color: colors.text },
  feedbackTitleMobile: { fontSize: 20, lineHeight: 27 },
  feedbackMessage: { fontFamily: 'PoppinsRegular', fontSize: 13.5, lineHeight: 21, color: colors.textSoft },
  feedbackActions: { flexDirection: 'row', gap: 10, marginTop: 2 },
  feedbackActionsMobile: { flexDirection: 'column-reverse' },
  feedbackSecondary: { flex: 1 },
  feedbackPrimary: { flex: 1.25 },
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1 },
  content: { width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center', padding: spacing.md, gap: 22, flexGrow: 1 },
  contentDesktop: { paddingHorizontal: 28, paddingVertical: 30 },
  contentMobile: { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 28, gap: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.lg, marginBottom: spacing.xs },
  titleRowMobile: { alignItems: 'stretch', flexDirection: 'column', gap: 10 },
  titleWrap: { flex: 1, gap: 4 },
  titleAction: { alignSelf: 'center' },
  titleActionMobile: { alignSelf: 'stretch' },
  eyebrow: { fontFamily: 'PoppinsBold', fontSize: 11, letterSpacing: .85, color: colors.primary },
  title: { fontFamily: 'PoppinsBold', fontSize: 30, lineHeight: 38, color: colors.text },
  titleMobile: { fontSize: 24, lineHeight: 31 },
  subtitle: { fontFamily: 'PoppinsRegular', fontSize: 14, color: colors.muted, lineHeight: 22, textAlign: 'left' },
  subtitleMobile: { fontSize: 12.5, lineHeight: 19 },
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: 20, gap: 10, borderWidth: 1, borderColor: colors.border, ...shadowSoft },
  cardMobile: { borderRadius: 12, padding: 14 },
  fieldWrap: { gap: 7 },
  label: { fontFamily: 'PoppinsMedium', color: colors.textSoft, fontSize: 14 },
  inputShell: { minHeight: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, gap: 11, backgroundColor: colors.surface, borderColor: colors.borderStrong, borderWidth: 1, borderRadius: radius.md },
  inputFocused: { borderColor: colors.primary, backgroundColor: '#FBFDFF' },
  inputError: { borderColor: colors.danger },
  input: { minWidth: 0, flex: 1, minHeight: 50, paddingVertical: 10, borderWidth: 0, color: colors.text, fontFamily: 'PoppinsRegular', fontSize: 15, ...( { outlineStyle: 'none', outlineWidth: 0 } as any ) },
  multiline: { minHeight: 110, paddingTop: 14, textAlignVertical: 'top' },
  inputAction: { width: 28, height: 36, alignItems: 'center', justifyContent: 'center' },
  hint: { color: colors.muted, fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 18 },
  fieldError: { color: colors.danger, fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 18 },
  button: { minHeight: 48, borderRadius: 11, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  buttonContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  button_primary: { backgroundColor: colors.primary, borderColor: colors.primary },
  button_secondary: { backgroundColor: colors.primarySoft, borderColor: '#C8E0FA' },
  button_danger: { backgroundColor: colors.danger, borderColor: colors.danger },
  button_ghost: { backgroundColor: 'transparent', borderColor: colors.border },
  buttonText: { fontFamily: 'PoppinsSemiBold', fontSize: 15 },
  buttonText_primary: { color: colors.white }, buttonText_secondary: { color: colors.primary }, buttonText_danger: { color: colors.white }, buttonText_ghost: { color: colors.textSoft },
  alert: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radius.sm, padding: 12 },
  alertDanger: { backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: '#FFD5D5' },
  alertSuccess: { backgroundColor: colors.successSoft, borderWidth: 1, borderColor: '#C9EDDE' },
  alertWarning: { backgroundColor: colors.warningSoft, borderWidth: 1, borderColor: '#F2D6A8' },
  alertText: { flex: 1, fontFamily: 'PoppinsRegular', fontSize: 13, lineHeight: 20 },
  empty: { alignItems: 'center', justifyContent: 'center', minHeight: 230, paddingVertical: spacing.xxl, gap: spacing.sm },
  emptyIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  emptyMessage: { textAlign: 'center', maxWidth: 440 },
  emptyTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 19, color: colors.text },
  errorTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 19, color: colors.danger },
  center: { flex: 1, minHeight: 240, gap: 12, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: colors.muted, fontFamily: 'PoppinsRegular', fontSize: 13 },
});
