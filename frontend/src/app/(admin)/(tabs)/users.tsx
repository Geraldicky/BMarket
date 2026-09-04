import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AdminEmptyState, AdminStatusPill } from '@/components/admin-ui';
import { Button, Card, ErrorState, FeedbackDialog, Field, Loader, Screen, Title } from '@/components/ui';
import { colors, radius } from '@/constants/theme';
import { endpoints, errorMessage } from '@/lib/api';

type TargetUser = { id: string; name: string; isActive: boolean } | null;
type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

export default function UsersScreen() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['admin-users'], queryFn: endpoints.adminUsers });
  const [target, setTarget] = useState<TargetUser>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'danger'; title: string; message: string } | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('ALL');

  const users = query.data?.users || [];
  const visible = useMemo(() => users.filter(user => {
    const q = search.trim().toLowerCase();
    const matchesText = !q || [user.name, user.email, user.studentId].some(value => String(value || '').toLowerCase().includes(q));
    const matchesStatus = status === 'ALL' || (status === 'ACTIVE' ? user.isActive : !user.isActive);
    return matchesText && matchesStatus;
  }), [users, search, status]);

  const toggle = async () => {
    if (!target) return;
    setWorkingId(target.id);
    try {
      await endpoints.toggleUser(target.id);
      await client.invalidateQueries({ queryKey: ['admin-users'] });
      const wasActive = target.isActive;
      const name = target.name;
      setTarget(null);
      setFeedback({ tone: 'success', title: wasActive ? 'Akun dinonaktifkan' : 'Akun diaktifkan kembali', message: wasActive ? `${name} tidak dapat menggunakan BMarket sampai akun diaktifkan kembali.` : `${name} kembali dapat menggunakan BMarket.` });
    } catch (error) {
      setFeedback({ tone: 'danger', title: 'Status akun belum berubah', message: errorMessage(error) });
      setTarget(null);
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <Screen backgroundColor={colors.surfaceMuted}>
      <Title subtitle="Kelola akses akun yang melanggar kebijakan atau sudah dipulihkan.">Pengguna</Title>
      <Card style={styles.toolbar}>
        <View style={styles.search}><Field icon="search-outline" value={search} onChangeText={setSearch} placeholder="Cari nama, email, atau NIM..." /></View>
        <View style={styles.filters}>
          {([['ALL', 'Semua'], ['ACTIVE', 'Aktif'], ['INACTIVE', 'Nonaktif']] as const).map(([key, label]) => <Pressable key={key} onPress={() => setStatus(key)} style={[styles.filter, status === key && styles.filterActive]}><Text style={[styles.filterText, status === key && styles.filterTextActive]}>{label}</Text></Pressable>)}
        </View>
        <View style={styles.count}><Ionicons name="people-outline" size={17} color={colors.muted} /><Text style={styles.countText}>{visible.length} pengguna</Text></View>
      </Card>
      {query.isLoading ? <Loader /> : query.isError ? <ErrorState message={errorMessage(query.error)} retry={() => query.refetch()} /> : !users.length ? <Card><AdminEmptyState title="Tidak ada pengguna" message="Data pengguna belum tersedia." /></Card> : !visible.length ? <Card><AdminEmptyState compact icon="search-outline" title="Pengguna tidak ditemukan" message="Coba ubah kata kunci atau filter status." /></Card> : <View style={styles.list}>{visible.map(user => <Card key={user.id} style={styles.card}>
        <View style={styles.row}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{user.name?.[0]?.toUpperCase() || 'B'}</Text></View>
          <View style={styles.body}><Text style={styles.name}>{user.name}</Text><Text style={styles.email}>{user.email}</Text><Text style={styles.nim}>NIM {user.studentId || '-'}</Text></View>
          <AdminStatusPill label={user.isActive ? 'Aktif' : 'Nonaktif'} tone={user.isActive ? 'success' : 'danger'} />
          <Button title={user.isActive ? 'Nonaktifkan' : 'Aktifkan'} variant={user.isActive ? 'danger' : 'secondary'} loading={workingId === user.id} onPress={() => setTarget({ id: user.id, name: user.name, isActive: Boolean(user.isActive) })} style={styles.action} />
        </View>
      </Card>)}</View>}
      <FeedbackDialog visible={Boolean(target)} tone={target?.isActive ? 'danger' : 'warning'} title={target?.isActive ? 'Nonaktifkan akun ini?' : 'Aktifkan kembali akun?'} message={target?.isActive ? `${target?.name || 'Pengguna'} tidak akan dapat login atau menggunakan BMarket sampai diaktifkan kembali.` : `${target?.name || 'Pengguna'} akan mendapatkan kembali akses ke BMarket.`} primaryLabel={target?.isActive ? 'Nonaktifkan' : 'Aktifkan'} secondaryLabel="Batal" loading={Boolean(target && workingId === target.id)} onClose={() => setTarget(null)} onSecondary={() => setTarget(null)} onPrimary={toggle} />
      <FeedbackDialog visible={Boolean(feedback)} tone={feedback?.tone || 'success'} title={feedback?.title || ''} message={feedback?.message || ''} onClose={() => setFeedback(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, flexWrap: 'wrap' },
  search: { flex: 1, minWidth: 280 },
  filters: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  filter: { minHeight: 38, paddingHorizontal: 13, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  filterActive: { borderColor: '#C5DDF8', backgroundColor: colors.primarySoft },
  filterText: { color: colors.textSoft, fontFamily: 'PoppinsMedium', fontSize: 11.5 },
  filterTextActive: { color: colors.primary, fontFamily: 'PoppinsSemiBold' },
  count: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 5 },
  countText: { color: colors.muted, fontFamily: 'PoppinsMedium', fontSize: 12 },
  list: { gap: 10 },
  card: { padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' },
  avatar: { width: 54, height: 54, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primary, fontFamily: 'PoppinsBold', fontSize: 17 },
  body: { flex: 1, minWidth: 220 },
  name: { color: colors.text, fontFamily: 'PoppinsSemiBold', fontSize: 16 },
  email: { color: colors.muted, fontFamily: 'PoppinsRegular', fontSize: 12.5, marginTop: 1 },
  nim: { color: colors.primary, fontFamily: 'PoppinsMedium', fontSize: 11.5, marginTop: 2 },
  action: { minWidth: 138, minHeight: 42 },
});
