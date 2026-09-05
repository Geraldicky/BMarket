import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { AdminEmptyState, AdminSectionTitle, AdminStatCard } from '@/components/admin-ui';
import { Card, ErrorState, Loader, money, Screen, Title } from '@/components/ui';
import { colors } from '@/constants/theme';
import { endpoints, errorMessage } from '@/lib/api';

const stats = [
  { key: 'totalUsers', label: 'Mahasiswa', caption: 'Total mahasiswa terdaftar', icon: 'school-outline' as const, color: colors.primary, bg: colors.primarySoft },
  { key: 'totalListings', label: 'Listing aktif', caption: 'Listing yang sedang aktif', icon: 'bag-handle-outline' as const, color: colors.success, bg: colors.successSoft },
  { key: 'reportedListings', label: 'Listing dilaporkan', caption: 'Listing yang menunggu pemeriksaan', icon: 'flag-outline' as const, color: colors.danger, bg: colors.dangerSoft },
  { key: 'totalTransactions', label: 'Transaksi', caption: 'Total transaksi marketplace', icon: 'wallet-outline' as const, color: '#7357E7', bg: '#F1EDFF' },
  { key: 'openComplaints', label: 'Laporan perlu ditangani', caption: 'Kasus yang masih terbuka', icon: 'alert-circle-outline' as const, color: colors.warning, bg: colors.warningSoft },
  { key: 'totalRevenue', label: 'Komisi terkumpul', caption: 'Total komisi platform', icon: 'server-outline' as const, color: colors.primary, bg: '#EEF5FF' },
];

const actions = [
  { label: 'Pantau semua listing', icon: 'storefront-outline' as const, route: '/(admin)/(tabs)/products' },
  { label: 'Tinjau laporan', icon: 'flag-outline' as const, route: '/(admin)/(tabs)/moderation' },
  { label: 'Lihat sengketa', icon: 'warning-outline' as const, route: '/(admin)/(tabs)/disputes' },
  { label: 'Kelola pengguna', icon: 'people-outline' as const, route: '/(admin)/(tabs)/users' },
  { label: 'Riwayat laporan', icon: 'time-outline' as const, route: '/(admin)/(tabs)/complaints' },
  { label: 'Pengaturan komisi', icon: 'settings-outline' as const, route: '/(admin)/(tabs)/settings' },
];

export default function AdminDashboard() {
  const mobile = useWindowDimensions().width < 700;
  const query = useQuery({ queryKey: ['admin-stats'], queryFn: endpoints.adminStats });
  const data = query.data as Record<string, number | string> | undefined;
  const priority = Number(data?.reportedListings || 0) + Number(data?.openComplaints || 0);

  return (
    <Screen backgroundColor={colors.surfaceMuted}>
      <Title subtitle="Ringkasan kesehatan marketplace">Admin BMarket</Title>
      {query.isLoading ? <Loader /> : query.isError ? <ErrorState message={errorMessage(query.error)} retry={() => query.refetch()} /> : <>
        <View style={styles.grid}>
          {stats.map(item => <AdminStatCard key={item.key} label={item.label} caption={item.caption} icon={item.icon} color={item.color} background={item.bg} value={item.key === 'totalRevenue' ? money(data?.[item.key]) : Number(data?.[item.key] || 0)} />)}
        </View>
        <Card style={styles.monitorCard}>
          <AdminSectionTitle
            title="Pemantauan listing"
            subtitle="Periksa seluruh barang dan jasa secara proaktif, tanpa menunggu laporan dari pengguna."
            icon="storefront-outline"
            right={<Pressable onPress={() => router.push('/(admin)/(tabs)/products' as any)} style={({ pressed }) => [styles.monitorButton, pressed && { opacity: .65 }]}><Text style={styles.monitorButtonText}>Buka semua listing</Text><Ionicons name="arrow-forward" size={16} color={colors.primary} /></Pressable>}
          />
          <View style={styles.monitorMetrics}>
            <View style={styles.monitorMetric}><Text style={styles.monitorMetricValue}>{Number(data?.allListings || 0)}</Text><Text style={styles.monitorMetricLabel}>Semua listing</Text></View>
            <View style={styles.monitorDivider} />
            <View style={styles.monitorMetric}><Text style={[styles.monitorMetricValue, { color: colors.success }]}>{Number(data?.totalListings || 0)}</Text><Text style={styles.monitorMetricLabel}>Aktif</Text></View>
            <View style={styles.monitorDivider} />
            <View style={styles.monitorMetric}><Text style={[styles.monitorMetricValue, { color: colors.warning }]}>{Number(data?.hiddenListings || 0)}</Text><Text style={styles.monitorMetricLabel}>Disembunyikan</Text></View>
            <View style={styles.monitorDivider} />
            <View style={styles.monitorMetric}><Text style={[styles.monitorMetricValue, { color: colors.danger }]}>{Number(data?.removedListings || 0)}</Text><Text style={styles.monitorMetricLabel}>Dihapus admin</Text></View>
          </View>
        </Card>
        <View style={styles.lowerGrid}>
          <Card style={[styles.healthCard, mobile && styles.healthCardMobile]}>
            <AdminSectionTitle title="Status operasional" subtitle="Ringkasan area yang perlu dipantau admin." icon="pulse-outline" />
            <View style={styles.healthRows}>
              <View style={styles.healthRow}><View style={[styles.healthIcon, { backgroundColor: colors.successSoft }]}><Ionicons name="storefront-outline" size={18} color={colors.success} /></View><View style={styles.healthCopy}><Text style={styles.healthTitle}>Marketplace aktif</Text><Text style={styles.healthText}>{Number(data?.totalListings || 0)} listing tersedia untuk komunitas.</Text></View><Text style={styles.healthValue}>{Number(data?.totalListings || 0)}</Text></View>
              <View style={styles.divider} />
              <View style={styles.healthRow}><View style={[styles.healthIcon, { backgroundColor: priority ? colors.warningSoft : colors.primarySoft }]}><Ionicons name={priority ? 'warning-outline' : 'shield-checkmark-outline'} size={18} color={priority ? colors.warning : colors.primary} /></View><View style={styles.healthCopy}><Text style={styles.healthTitle}>Antrian prioritas</Text><Text style={styles.healthText}>{priority ? 'Ada laporan atau listing yang menunggu tindakan.' : 'Tidak ada laporan atau listing yang membutuhkan tindakan.'}</Text></View><Text style={styles.healthValue}>{priority}</Text></View>
              <View style={styles.divider} />
              <View style={styles.healthRow}><View style={[styles.healthIcon, { backgroundColor: '#F1EDFF' }]}><Ionicons name="swap-horizontal-outline" size={18} color="#7357E7" /></View><View style={styles.healthCopy}><Text style={styles.healthTitle}>Transaksi tercatat</Text><Text style={styles.healthText}>Aktivitas transaksi yang tersimpan di BMarket.</Text></View><Text style={styles.healthValue}>{Number(data?.totalTransactions || 0)}</Text></View>
            </View>
          </Card>
          <Card style={[styles.priorityCard, mobile && styles.priorityCardMobile]}>
            <AdminSectionTitle title="Antrian prioritas" subtitle="Kasus yang perlu respons admin." icon="shield-checkmark-outline" />
            {priority === 0 ? <AdminEmptyState compact title="Tidak ada hal prioritas" message="Semua laporan dan sengketa yang terlihat saat ini dalam kondisi aman." /> : <View style={styles.priorityList}>
              {Number(data?.reportedListings || 0) > 0 ? <Pressable onPress={() => router.push('/(admin)/(tabs)/moderation' as any)} style={styles.priorityRow}><View><Text style={styles.priorityTitle}>Listing dilaporkan</Text><Text style={styles.priorityText}>Periksa listing yang dilaporkan komunitas.</Text></View><Text style={styles.priorityCount}>{Number(data?.reportedListings || 0)}</Text></Pressable> : null}
              {Number(data?.openComplaints || 0) > 0 ? <Pressable onPress={() => router.push('/(admin)/(tabs)/complaints' as any)} style={styles.priorityRow}><View><Text style={styles.priorityTitle}>Laporan terbuka</Text><Text style={styles.priorityText}>Laporan yang belum selesai ditangani.</Text></View><Text style={styles.priorityCount}>{Number(data?.openComplaints || 0)}</Text></Pressable> : null}
            </View>}
          </Card>
        </View>
        <Card style={styles.quickCard}>
          <AdminSectionTitle title="Aksi cepat" icon="flash-outline" />
          <View style={styles.actions}>
            {actions.map(action => <Pressable key={action.label} onPress={() => router.push(action.route as any)} style={({ pressed }) => [styles.action, mobile && styles.actionMobile, pressed && { opacity: .65 }]}><Ionicons name={action.icon} size={19} color={colors.primary} /><Text style={styles.actionText}>{action.label}</Text></Pressable>)}
          </View>
        </Card>
      </>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  monitorCard: { gap: 16 },
  monitorButton: { minHeight: 40, paddingHorizontal: 13, borderRadius: 10, borderWidth: 1, borderColor: '#CFE0F4', backgroundColor: colors.primarySoft, flexDirection: 'row', alignItems: 'center', gap: 7 },
  monitorButtonText: { color: colors.primary, fontFamily: 'PoppinsSemiBold', fontSize: 12 },
  monitorMetrics: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', padding: 14, borderRadius: 12, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  monitorMetric: { minWidth: 130, flex: 1, paddingHorizontal: 14, paddingVertical: 5 },
  monitorMetricValue: { color: colors.primary, fontFamily: 'PoppinsBold', fontSize: 24, lineHeight: 30 },
  monitorMetricLabel: { color: colors.muted, fontFamily: 'PoppinsMedium', fontSize: 11.5, marginTop: 1 },
  monitorDivider: { width: 1, alignSelf: 'stretch', minHeight: 44, backgroundColor: colors.border },
  lowerGrid: { flexDirection: 'row', alignItems: 'stretch', flexWrap: 'wrap', gap: 14 },
  healthCard: { flex: 1.25, minWidth: 420, gap: 13 },
  healthCardMobile: { minWidth: 0, width: '100%', flexBasis: '100%' },
  priorityCard: { flex: .9, minWidth: 320, gap: 8 },
  priorityCardMobile: { minWidth: 0, width: '100%', flexBasis: '100%' },
  healthRows: { gap: 0 },
  healthRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  healthIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  healthCopy: { flex: 1 },
  healthTitle: { color: colors.text, fontFamily: 'PoppinsSemiBold', fontSize: 13 },
  healthText: { color: colors.muted, fontFamily: 'PoppinsRegular', fontSize: 11.5, lineHeight: 17 },
  healthValue: { color: colors.text, fontFamily: 'PoppinsBold', fontSize: 20 },
  divider: { height: 1, backgroundColor: colors.border },
  priorityList: { gap: 9, marginTop: 10 },
  priorityRow: { minHeight: 72, padding: 13, borderRadius: 12, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  priorityTitle: { color: colors.text, fontFamily: 'PoppinsSemiBold', fontSize: 13 },
  priorityText: { color: colors.muted, fontFamily: 'PoppinsRegular', fontSize: 11.5, marginTop: 2 },
  priorityCount: { color: colors.primary, fontFamily: 'PoppinsBold', fontSize: 21 },
  quickCard: { gap: 14 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  action: { minWidth: 180, flex: 1, minHeight: 48, paddingHorizontal: 14, borderRadius: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionMobile: { minWidth: 0, flexBasis: '100%' },
  actionText: { color: colors.textSoft, fontFamily: 'PoppinsMedium', fontSize: 12.5 },
});
