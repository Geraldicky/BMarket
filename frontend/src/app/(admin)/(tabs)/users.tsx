import { StyleSheet, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Card, Empty, ErrorState, FeedbackDialog, Loader, Screen, Title } from '@/components/ui';
import { endpoints, errorMessage } from '@/lib/api';
import { colors, radius } from '@/constants/theme';

type TargetUser = { id: string; name: string; isActive: boolean } | null;

export default function UsersScreen() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['admin-users'], queryFn: endpoints.adminUsers });
  const [target, setTarget] = useState<TargetUser>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'danger'; title: string; message: string } | null>(null);

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

  return <Screen>
    <Title eyebrow="USER MANAGEMENT" subtitle="Kelola akses akun yang melanggar kebijakan atau sudah dipulihkan.">Pengguna</Title>
    {query.isLoading ? <Loader /> : query.isError ? <ErrorState message={errorMessage(query.error)} retry={() => query.refetch()} /> : !query.data?.users.length ? <Empty title="Tidak ada pengguna" message="Data pengguna belum tersedia." /> : <View style={styles.list}>{query.data.users.map(user => <Card key={user.id} style={styles.card}>
      <View style={styles.row}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{user.name?.[0]?.toUpperCase() || 'B'}</Text></View>
        <View style={styles.body}><Text style={styles.name}>{user.name}</Text><Text style={styles.email}>{user.email}</Text><Text style={styles.nim}>NIM {user.studentId || '-'}</Text></View>
        <View style={[styles.badge, user.isActive ? styles.badgeActive : styles.badgeInactive]}><View style={[styles.dot, { backgroundColor: user.isActive ? colors.success : colors.danger }]} /><Text style={[styles.state, { color: user.isActive ? colors.success : colors.danger }]}>{user.isActive ? 'AKTIF' : 'NONAKTIF'}</Text></View>
      </View>
      <Button title={user.isActive ? 'Nonaktifkan akun' : 'Aktifkan kembali'} variant={user.isActive ? 'danger' : 'secondary'} loading={workingId === user.id} onPress={() => setTarget({ id: user.id, name: user.name, isActive: Boolean(user.isActive) })} />
    </Card>)}</View>}
    <FeedbackDialog visible={Boolean(target)} tone={target?.isActive ? 'danger' : 'warning'} title={target?.isActive ? 'Nonaktifkan akun ini?' : 'Aktifkan kembali akun?'} message={target?.isActive ? `${target?.name || 'Pengguna'} tidak akan dapat login atau menggunakan BMarket sampai diaktifkan kembali.` : `${target?.name || 'Pengguna'} akan mendapatkan kembali akses ke BMarket.`} primaryLabel={target?.isActive ? 'Nonaktifkan' : 'Aktifkan'} secondaryLabel="Batal" loading={Boolean(target && workingId === target.id)} onClose={() => setTarget(null)} onSecondary={() => setTarget(null)} onPrimary={toggle} />
    <FeedbackDialog visible={Boolean(feedback)} tone={feedback?.tone || 'success'} title={feedback?.title || ''} message={feedback?.message || ''} onClose={() => setFeedback(null)} />
  </Screen>;
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  card: { gap: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primary, fontFamily: 'PoppinsBold', fontSize: 16 },
  body: { flex: 1 },
  name: { color: colors.text, fontFamily: 'PoppinsSemiBold', fontSize: 16 },
  email: { color: colors.muted, fontFamily: 'PoppinsRegular', fontSize: 13, marginTop: 2 },
  nim: { color: colors.primary, fontFamily: 'PoppinsMedium', fontSize: 12, marginTop: 3 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
  badgeActive: { backgroundColor: colors.successSoft },
  badgeInactive: { backgroundColor: colors.dangerSoft },
  dot: { width: 7, height: 7, borderRadius: 4 },
  state: { fontFamily: 'PoppinsBold', fontSize: 11 },
});
