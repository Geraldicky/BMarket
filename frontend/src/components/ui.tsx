import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import {
  ActivityIndicator,
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

export function Screen({ children, scroll = true, style }: ViewProps & { scroll?: boolean }) {
  const desktop = useWindowDimensions().width >= 960;
  const content = <View style={[styles.content, desktop && styles.contentDesktop, style]}>{children}</View>;
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {content}
        </ScrollView>
      ) : content}
    </SafeAreaView>
  );
}

export function Title({ children, subtitle, eyebrow, action }: { children: React.ReactNode; subtitle?: string; eyebrow?: string; action?: React.ReactNode }) {
  return <View style={styles.titleRow}><View style={styles.titleWrap}>{eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}<Text style={styles.title}>{children}</Text>{subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}</View>{action ? <View style={styles.titleAction}>{action}</View> : null}</View>;
}

export function Card(props: ViewProps) { return <View {...props} style={[styles.card, props.style]} />; }

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

export function InlineAlert({ message, tone = 'danger' }: { message: string; tone?: 'danger' | 'success' }) {
  return <View style={[styles.alert, tone === 'success' ? styles.alertSuccess : styles.alertDanger]}><Ionicons name={tone === 'success' ? 'checkmark-circle-outline' : 'alert-circle-outline'} size={19} color={tone === 'success' ? colors.success : colors.danger} /><Text style={[styles.alertText, { color: tone === 'success' ? colors.success : colors.danger }]}>{message}</Text></View>;
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
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1 },
  content: { width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center', padding: spacing.md, gap: spacing.lg, flexGrow: 1 },
  contentDesktop: { paddingHorizontal: 48, paddingVertical: 38 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.lg, marginBottom: spacing.xs },
  titleWrap: { flex: 1, gap: 4 },
  titleAction: { alignSelf: 'center' },
  eyebrow: { fontFamily: 'PoppinsBold', fontSize: 11, letterSpacing: .85, color: colors.primary },
  title: { fontFamily: 'PoppinsBold', fontSize: 32, lineHeight: 41, color: colors.text },
  subtitle: { fontFamily: 'PoppinsRegular', fontSize: 14, color: colors.muted, lineHeight: 22, textAlign: 'left' },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: colors.border, ...shadowSoft },
  fieldWrap: { gap: 7 },
  label: { fontFamily: 'PoppinsMedium', color: colors.textSoft, fontSize: 14 },
  inputShell: { minHeight: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, gap: 11, backgroundColor: colors.surface, borderColor: colors.borderStrong, borderWidth: 1, borderRadius: radius.sm },
  inputFocused: { borderColor: colors.primary, backgroundColor: '#FBFDFF' },
  inputError: { borderColor: colors.danger },
  input: { minWidth: 0, flex: 1, minHeight: 54, paddingVertical: 11, color: colors.text, fontFamily: 'PoppinsRegular', fontSize: 15 },
  multiline: { minHeight: 110, paddingTop: 14, textAlignVertical: 'top' },
  inputAction: { width: 28, height: 36, alignItems: 'center', justifyContent: 'center' },
  hint: { color: colors.muted, fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 18 },
  fieldError: { color: colors.danger, fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 18 },
  button: { minHeight: 50, borderRadius: radius.sm, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
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
  alertText: { flex: 1, fontFamily: 'PoppinsRegular', fontSize: 13, lineHeight: 20 },
  empty: { alignItems: 'center', justifyContent: 'center', minHeight: 260, paddingVertical: spacing.xxl, gap: spacing.sm },
  emptyIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  emptyMessage: { textAlign: 'center', maxWidth: 440 },
  emptyTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 19, color: colors.text },
  errorTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 19, color: colors.danger },
  center: { flex: 1, minHeight: 240, gap: 12, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: colors.muted, fontFamily: 'PoppinsRegular', fontSize: 13 },
});
