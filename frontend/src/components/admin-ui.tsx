import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle, useWindowDimensions } from 'react-native';
import { Card } from '@/components/ui';
import { colors, radius } from '@/constants/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export function AdminIconBadge({ icon, color = colors.primary, background = colors.primarySoft }: { icon: IconName; color?: string; background?: string }) {
  return <View style={[styles.iconBadge, { backgroundColor: background }]}><Ionicons name={icon} size={23} color={color} /></View>;
}

export function AdminStatCard({ label, value, caption, icon, color = colors.primary, background = colors.primarySoft, style }: {
  label: string;
  value: ReactNode;
  caption?: string;
  icon: IconName;
  color?: string;
  background?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const mobile = useWindowDimensions().width < 600;
  return (
    <Card style={[styles.statCard, mobile && styles.statCardMobile, style]}>
      <AdminIconBadge icon={icon} color={color} background={background} />
      <View style={styles.statCopy}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={[styles.statValue, { color }]}>{value}</Text>
        {caption ? <Text style={styles.statCaption}>{caption}</Text> : null}
      </View>
    </Card>
  );
}

export function AdminSectionTitle({ title, subtitle, icon, right }: { title: string; subtitle?: string; icon?: IconName; right?: ReactNode }) {
  const mobile = useWindowDimensions().width < 600;
  return (
    <View style={[styles.sectionHead, mobile && styles.sectionHeadMobile]}>
      <View style={styles.sectionHeadLeft}>
        {icon ? <View style={styles.sectionIcon}><Ionicons name={icon} size={18} color={colors.primary} /></View> : null}
        <View style={styles.sectionCopy}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {right ? <View style={mobile ? styles.sectionRightMobile : undefined}>{right}</View> : null}
    </View>
  );
}

export function AdminEmptyState({ icon = 'shield-checkmark-outline', title, message, compact = false }: { icon?: IconName; title: string; message: string; compact?: boolean }) {
  return (
    <View style={[styles.empty, compact && styles.emptyCompact]}>
      <View style={styles.emptyGlow}>
        <View style={styles.emptyIcon}><Ionicons name={icon} size={30} color={colors.primary} /></View>
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
    </View>
  );
}

export function AdminStatusPill({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'primary' }) {
  const meta = {
    neutral: { color: colors.textSoft, background: colors.surfaceMuted, dot: colors.muted },
    success: { color: colors.success, background: colors.successSoft, dot: colors.success },
    warning: { color: colors.warning, background: colors.warningSoft, dot: colors.warning },
    danger: { color: colors.danger, background: colors.dangerSoft, dot: colors.danger },
    primary: { color: colors.primary, background: colors.primarySoft, dot: colors.primary },
  }[tone];
  return <View style={[styles.pill, { backgroundColor: meta.background }]}><View style={[styles.pillDot, { backgroundColor: meta.dot }]} /><Text style={[styles.pillText, { color: meta.color }]}>{label}</Text></View>;
}

export function AdminInfoRow({ icon, title, message, color = colors.primary, background = colors.primarySoft }: { icon: IconName; title: string; message: string; color?: string; background?: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: background }]}><Ionicons name={icon} size={18} color={color} /></View>
      <View style={styles.infoCopy}><Text style={styles.infoTitle}>{title}</Text><Text style={styles.infoMessage}>{message}</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  iconBadge: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  statCard: { minWidth: 230, flex: 1, minHeight: 132, flexDirection: 'row', alignItems: 'center', gap: 16, padding: 18 },
  statCardMobile: { minWidth: 0, flexBasis: '100%', minHeight: 108, padding: 14, gap: 13 },
  statCopy: { flex: 1, gap: 1 },
  statLabel: { color: colors.muted, fontFamily: 'PoppinsMedium', fontSize: 13 },
  statValue: { fontFamily: 'PoppinsBold', fontSize: 28, lineHeight: 35 },
  statCaption: { color: colors.muted, fontFamily: 'PoppinsRegular', fontSize: 11.5, lineHeight: 17, marginTop: 2 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  sectionHeadMobile: { alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 },
  sectionRightMobile: { width: '100%', alignItems: 'stretch' },
  sectionHeadLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11 },
  sectionIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  sectionCopy: { flex: 1 },
  sectionTitle: { color: colors.text, fontFamily: 'PoppinsSemiBold', fontSize: 16 },
  sectionSubtitle: { color: colors.muted, fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 18, marginTop: 1 },
  empty: { minHeight: 310, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 36 },
  emptyCompact: { minHeight: 210, paddingVertical: 28 },
  emptyGlow: { width: 86, height: 86, borderRadius: 30, backgroundColor: '#F3F8FF', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  emptyIcon: { width: 58, height: 58, borderRadius: 18, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: '#D4E7FF', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: colors.text, fontFamily: 'PoppinsSemiBold', fontSize: 20, textAlign: 'center' },
  emptyMessage: { maxWidth: 500, marginTop: 5, color: colors.muted, fontFamily: 'PoppinsRegular', fontSize: 13, lineHeight: 21, textAlign: 'center' },
  pill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontFamily: 'PoppinsSemiBold', fontSize: 11.5 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, paddingVertical: 12 },
  infoIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  infoCopy: { flex: 1, gap: 2 },
  infoTitle: { color: colors.text, fontFamily: 'PoppinsSemiBold', fontSize: 13.5 },
  infoMessage: { color: colors.muted, fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 18 },
});
