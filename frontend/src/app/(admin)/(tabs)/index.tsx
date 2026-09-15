import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { AdminEmptyState, AdminSectionTitle, AdminStatCard } from '@/components/admin-ui';
import { Card, ErrorState, Loader, money, Screen, Title } from '@/components/ui';
import { colors, makeStyles } from '@/constants/theme';
import { endpoints, errorMessage } from '@/lib/api';

// Built at render time so the colors follow the active theme.
const getStats = () => [
  { key: 'totalUsers', label: 'Mahasiswa', caption: 'Total mahasiswa terdaftar', icon: 'school-outline' as const, color: colors.primary, bg: colors.primarySoft },
  { key: 'totalListings', label: 'Listing aktif', caption: 'Listing yang sedang aktif', icon: 'bag-handle-outline' as const, color: colors.success, bg: colors.successSoft },
  { key: 'reportedListings', label: 'Listing dilaporkan', caption: 'Listing yang menunggu pemeriksaan', icon: 'flag-outline' as const, color: colors.danger, bg: colors.dangerSoft },
  { key: 'totalTransactions', label: 'Transaksi', caption: 'Total transaksi marketplace', icon: 'wallet-outline' as const, color: colors.purple, bg: colors.purpleSoft },
  { key: 'openComplaints', label: 'Laporan terbuka', caption: 'Kasus yang masih terbuka', icon: 'alert-circle-outline' as const, color: colors.warning, bg: colors.warningSoft },
  { key: 'totalRevenue', label: 'Komisi terkumpul', caption: 'Total komisi platform', icon: 'server-outline' as const, color: colors.primary, bg: colors.primarySoft },
];

export default function AdminDashboard() {
  const styles = useStyles();
  const query = useQuery({ queryKey: ['admin-stats'], queryFn: endpoints.adminStats });
  const data = query.data as Record<string, number | string> | undefined;
  const priority = Number(data?.reportedListings || 0) + Number(data?.openComplaints || 0);

  return (
    <Screen backgroundColor={colors.surfaceMuted}>
      <Title subtitle="Ringkasan kesehatan marketplace">Admin BMarket</Title>
      {query.isLoading ? <Loader /> : query.isError ? <ErrorState message={errorMessage(query.error)} retry={() => query.refetch()} /> : <>
        <View style={styles.grid}>
          {getStats().map(item => <AdminStatCard key={item.key} label={item.label} caption={item.caption} icon={item.icon} color={item.color} background={item.bg} value={item.key === 'totalRevenue' ? money(data?.[item.key]) : Number(data?.[item.key] || 0)} />)}
        </View>
        <Card style={styles.priorityCard}>
            <AdminSectionTitle title="Perlu ditangani" icon="shield-checkmark-outline" />
            {priority === 0 ? <AdminEmptyState compact title="Semua aman" message="Tidak ada laporan yang menunggu tindakan." /> : <View style={styles.priorityList}>
              {Number(data?.reportedListings || 0) > 0 ? <Pressable onPress={() => router.push('/(admin)/(tabs)/moderation' as any)} style={styles.priorityRow}><View><Text style={styles.priorityTitle}>Listing dilaporkan</Text><Text style={styles.priorityText}>Periksa listing yang dilaporkan komunitas.</Text></View><Text style={styles.priorityCount}>{Number(data?.reportedListings || 0)}</Text></Pressable> : null}
              {Number(data?.openComplaints || 0) > 0 ? <Pressable onPress={() => router.push('/(admin)/(tabs)/complaints' as any)} style={styles.priorityRow}><View><Text style={styles.priorityTitle}>Laporan terbuka</Text><Text style={styles.priorityText}>Laporan yang belum selesai ditangani.</Text></View><Text style={styles.priorityCount}>{Number(data?.openComplaints || 0)}</Text></Pressable> : null}
            </View>}
        </Card>
      </>}
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  priorityCard: { gap: 8 },
  priorityList: { gap: 12, marginTop: 10 },
  priorityRow: { minHeight: 72, padding: 13, borderRadius: 12, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  priorityTitle: { color: colors.text, fontFamily: 'PoppinsSemiBold', fontSize: 13 },
  priorityText: { color: colors.muted, fontFamily: 'PoppinsRegular', fontSize: 11.5, marginTop: 2 },
  priorityCount: { color: colors.primary, fontFamily: 'PoppinsBold', fontSize: 21 },}));
