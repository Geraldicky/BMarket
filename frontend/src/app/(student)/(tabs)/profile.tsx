import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Button, Card, FeedbackDialog, Field, money, Screen, Title } from '@/components/ui';
import { BackButton } from '@/components/back-button';
import { endpoints, errorMessage } from '@/lib/api';
import { colors, makeStyles, useThemeStore, type ThemeMode } from '@/constants/theme';
import { useAuth } from '@/store/auth';

type Feedback = { tone: 'success' | 'warning' | 'danger'; title: string; message: string } | null;

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const themeOptions: { mode: ThemeMode; label: string; icon: IconName }[] = [
  { mode: 'light', label: 'Terang', icon: 'sunny-outline' },
  { mode: 'dark', label: 'Gelap', icon: 'moon-outline' },
  { mode: 'system', label: 'Sistem', icon: 'phone-portrait-outline' },
];

// Light / Dark / follow-system switch shown on the right of the profile card. The card background is
// dark in both themes, so the control uses fixed light-on-dark colors.
function ThemeSwitcher({ mobile }: { mobile: boolean }) {
  const styles = useStyles();
  const mode = useThemeStore(state => state.mode);
  const setMode = useThemeStore(state => state.setMode);
  return (
    <View style={[styles.themeSwitch, mobile && styles.themeSwitchMobile]}>
      <Text style={styles.themeLabel}>Tema tampilan</Text>
      <View style={styles.themeOptions} accessibilityRole="radiogroup">
        {themeOptions.map(option => {
          const active = mode === option.mode;
          return (
            <Pressable key={option.mode} accessibilityRole="radio" accessibilityState={{ checked: active }} accessibilityLabel={`Tema ${option.label}`} onPress={() => setMode(option.mode)} style={({ pressed }) => [styles.themeOption, active && styles.themeOptionActive, pressed && styles.pressed]}>
              <Ionicons name={option.icon} size={15} color={active ? '#0C4FA8' : '#D6E2EE'} />
              <Text style={[styles.themeOptionText, active && styles.themeOptionTextActive]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// Marks account data that comes from the BINUS account and cannot be edited by the user.
function LockedBadge() {
  const styles = useStyles();
  return <View style={styles.lockedBadge}><Ionicons name="lock-closed" size={12} color={colors.muted} /><Text style={styles.lockedBadgeText}>Tidak dapat diubah</Text></View>;
}

export default function ProfileScreen() {
  const styles = useStyles();
  const width = useWindowDimensions().width;
  const desktop = width >= 960;
  const mobile = width < 600;
  const user = useAuth(state => state.user);
  const logout = useAuth(state => state.logout);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const refresh = useAuth(state => state.refresh);
  // Profile is edited inline in the "Informasi pribadi" card; there is no separate edit page.
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', bio: '' });
  const client = useQueryClient();

  const startEdit = () => {
    setForm({ name: user?.name || '', phone: user?.phone || '', bio: user?.bio || '' });
    setEditing(true);
  };
  const setField = (key: keyof typeof form) => (value: string) => setForm(current => ({ ...current, [key]: value }));
  const saveProfile = async () => {
    if (form.name.trim().length < 2) {
      setFeedback({ tone: 'warning', title: 'Nama belum valid', message: 'Nama lengkap minimal 2 karakter.' });
      return;
    }
    setSaving(true);
    try {
      await endpoints.updateProfile({ name: form.name.trim(), phone: form.phone.trim(), bio: form.bio.trim() });
      await refresh();
      setEditing(false);
      setFeedback({ tone: 'success', title: 'Profil tersimpan', message: 'Informasi profilmu sudah diperbarui dan akan dipakai pada profil seller serta transaksi berikutnya.' });
    } catch (error) {
      setFeedback({ tone: 'danger', title: 'Profil belum tersimpan', message: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  };
  const balance = useQuery({ queryKey: ['balance'], queryFn: endpoints.balance, enabled: Boolean(user) });

  const topup = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 1000) {
      setFeedback({ tone: 'warning', title: 'Nominal belum valid', message: 'Masukkan nominal minimal Rp 1.000 untuk menambah saldo BMarket.' });
      return;
    }
    setLoading(true);
    try {
      await endpoints.topup(value);
      setAmount('');
      await client.invalidateQueries({ queryKey: ['balance'] });
      setFeedback({ tone: 'success', title: 'Saldo berhasil ditambahkan', message: `${money(value)} sudah masuk ke saldo BMarket kamu.` });
    } catch (error) {
      setFeedback({ tone: 'danger', title: 'Top up belum berhasil', message: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  const initials = user?.name?.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'B';

  return <Screen>
    <BackButton />
    <Title eyebrow="PUSAT AKUN" subtitle="Kelola identitas, saldo, dan keamanan akun BMarket.">Profil</Title>
    <View style={[styles.hero, mobile && styles.heroMobile]}>
      <View style={[styles.avatar, mobile && styles.avatarMobile]}><Text style={styles.initial}>{initials}</Text></View>
      <View style={[styles.identity, mobile && styles.identityMobile]}>
        <View style={styles.nameRow}><Text style={[styles.name, mobile && styles.nameMobile]}>{user?.name || 'Binusian'}</Text><View style={styles.verified}><Ionicons name="checkmark-circle" size={14} color={colors.success} /><Text style={styles.verifiedText}>Terverifikasi</Text></View></View>
        <Text style={styles.email}>{user?.email || ''}</Text>
      </View>
      <View style={[styles.metrics, mobile && styles.metricsMobile]}>
        <View style={styles.metric}><Text style={styles.metricValue}>{user?._count?.listings || 0}</Text><Text style={styles.metricLabel}>Listing</Text></View>
        <View style={styles.metricDivider} />
        <View style={styles.metric}><Text style={styles.metricValue}>{(user?._count?.buyerTransactions || 0) + (user?._count?.sellerTransactions || 0)}</Text><Text style={styles.metricLabel}>Transaksi</Text></View>
      </View>
      <ThemeSwitcher mobile={mobile} />
    </View>

    <View style={[styles.columns, !desktop && styles.columnsMobile]}>
      <Card style={[styles.info, !desktop && styles.fullWidth]}>
        <View style={styles.cardHead}>
          <View style={styles.cardHeadCopy}><Text style={styles.section}>Informasi pribadi</Text><Text style={styles.sectionCopy}>{editing ? 'Ubah data profilmu, lalu simpan perubahan.' : 'Data yang terlihat pada profil penjualmu.'}</Text></View>
          {!editing ? <Pressable onPress={startEdit} style={({ pressed }) => [styles.edit, pressed && styles.pressed]}><Ionicons name="create-outline" size={17} color={colors.primary} /><Text style={styles.editText}>Edit profil</Text></Pressable> : null}
        </View>
        <View style={[styles.detailRow, mobile && styles.detailRowMobile]}>
          <Text style={styles.detailLabel}>Nama lengkap</Text>
          {editing ? <View style={styles.detailField}><Field value={form.name} onChangeText={setField('name')} placeholder="Nama lengkap" maxLength={80} /></View> : <Text style={styles.detailValue}>{user?.name || '-'}</Text>}
        </View>
        <View style={[styles.detailRow, mobile && styles.detailRowMobile]}><Text style={styles.detailLabel}>NIM</Text><Text style={[styles.detailValue, editing && styles.detailLocked]}>{user?.studentId || '-'}</Text>{editing ? <LockedBadge /> : null}</View>
        <View style={[styles.detailRow, mobile && styles.detailRowMobile]}><Text style={styles.detailLabel}>Email BINUS</Text><Text style={[styles.detailValue, editing && styles.detailLocked]}>{user?.email || '-'}</Text>{editing ? <LockedBadge /> : null}</View>
        <View style={[styles.detailRow, mobile && styles.detailRowMobile]}>
          <Text style={styles.detailLabel}>Nomor telepon</Text>
          {editing ? <View style={styles.detailField}><Field value={form.phone} onChangeText={setField('phone')} keyboardType="phone-pad" placeholder="08xxxxxxxxxx" maxLength={30} /></View> : <Text style={styles.detailValue}>{user?.phone || '-'}</Text>}
        </View>
        <View style={[styles.detailRow, mobile && styles.detailRowMobile, styles.detailLast]}>
          <Text style={styles.detailLabel}>Tentang kamu</Text>
          {editing ? <View style={styles.detailField}><Field value={form.bio} onChangeText={setField('bio')} multiline maxLength={500} placeholder="Ceritakan singkat tentang kamu sebagai buyer atau seller." hint={`${form.bio.length}/500 karakter`} /></View> : <Text style={[styles.detailValue, styles.bio, !user?.bio && styles.detailEmpty]}>{user?.bio || 'Belum ada bio.'}</Text>}
        </View>
        {editing ? <View style={[styles.editActions, mobile && styles.editActionsMobile]}>
          <Button title="Batal" variant="ghost" disabled={saving} onPress={() => setEditing(false)} style={styles.editAction} />
          <Button title="Simpan perubahan" icon="checkmark-outline" loading={saving} onPress={saveProfile} style={styles.editAction} />
        </View> : null}
      </Card>

      <View style={[styles.side, !desktop && styles.fullWidth]}>
        <Card style={styles.balanceCard}>
          <View style={styles.balanceHead}><View style={styles.wallet}><Ionicons name="wallet-outline" size={22} color={colors.primary} /></View><View><Text style={styles.section}>Saldo BMarket</Text><Text style={styles.sectionCopy}>Saldo simulasi untuk transaksi dan escrow.</Text></View></View>
          <Text style={styles.balance}>{money(balance.data?.balance)}</Text>
          <View style={styles.escrowRow}><Ionicons name="lock-closed-outline" size={14} color={colors.muted} /><Text style={styles.escrow}>Dalam escrow {money(balance.data?.escrow)}</Text></View>
          <View style={styles.quick}><Text style={styles.quickLabel}>Top up cepat</Text><View style={styles.quickRow}>{['50000', '100000', '250000'].map(value => <Pressable key={value} onPress={() => setAmount(value)} style={({ pressed }) => [styles.quickChip, amount === value && styles.quickChipActive, pressed && styles.pressed]}><Text style={[styles.quickText, amount === value && styles.quickTextActive]}>{Number(value) / 1000}K</Text></Pressable>)}</View></View>
          <Field value={amount} onChangeText={setAmount} keyboardType="number-pad" placeholder="Masukkan nominal" />
          <Button title="Tambah saldo" icon="add-circle-outline" loading={loading} onPress={topup} />
          <View style={styles.accountLinks}><Pressable onPress={() => router.push('/(student)/wallet')} style={({ pressed }) => [styles.accountLink, pressed && styles.pressed]}><Ionicons name="time-outline" size={18} color={colors.primary} /><Text style={styles.accountLinkText}>Riwayat saldo</Text></Pressable><Pressable onPress={() => router.push('/(student)/notifications')} style={({ pressed }) => [styles.accountLink, pressed && styles.pressed]}><Ionicons name="notifications-outline" size={18} color={colors.primary} /><Text style={styles.accountLinkText}>Notifikasi</Text></Pressable></View>
        </Card>
        {/* Desktop logs out from the profile menu in the header, so this button is mobile-only. */}
        {!desktop ? <Button title="Keluar" variant="danger" icon="log-out-outline" onPress={() => setLogoutOpen(true)} /> : null}
      </View>
    </View>

    <FeedbackDialog visible={Boolean(feedback)} tone={feedback?.tone || 'success'} title={feedback?.title || ''} message={feedback?.message || ''} onClose={() => setFeedback(null)} />
    <FeedbackDialog visible={logoutOpen} tone="warning" title="Keluar dari BMarket?" message="Sesi di perangkat ini akan diakhiri. Kamu bisa masuk kembali kapan saja dengan akun BINUS-mu." primaryLabel="Keluar" secondaryLabel="Batal" onClose={() => setLogoutOpen(false)} onSecondary={() => setLogoutOpen(false)} onPrimary={() => { setLogoutOpen(false); logout(); }} />
  </Screen>;
}

const useStyles = makeStyles(() => ({
  pressed: { opacity: .7 },
  hero: { minHeight: 168, borderRadius: 16, backgroundColor: colors.primaryDeep, padding: 26, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 24, overflow: 'hidden' },
  heroMobile: { padding: 18, gap: 14, alignItems: 'flex-start' },
  heroGlow: { position: 'absolute', right: -90, top: -130, width: 390, height: 390, borderRadius: 195, backgroundColor: '#173F64' },
  avatar: { width: 84, height: 84, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarMobile: { width: 68, height: 68, borderRadius: 18 },
  initial: { fontFamily: 'PoppinsBold', fontSize: 29, color: colors.primary },
  identity: { minWidth: 250, flex: 1 },
  identityMobile: { minWidth: 0, width: '100%' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 11, flexWrap: 'wrap' },
  name: { fontFamily: 'PoppinsBold', fontSize: 24, color: colors.white },
  nameMobile: { fontSize: 20, lineHeight: 27 },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.successSoft },
  verifiedText: { fontFamily: 'PoppinsSemiBold', fontSize: 12, color: colors.success },
  email: { fontFamily: 'PoppinsRegular', fontSize: 13, color: '#C2D1DF', marginTop: 3 },
  member: { fontFamily: 'PoppinsMedium', fontSize: 12, color: '#88A7C3', marginTop: 9 },
  metrics: { zIndex: 1, flexDirection: 'row', alignItems: 'center', gap: 20 },
  metricsMobile: { width: '100%', justifyContent: 'flex-start' },
  metric: { minWidth: 78 },
  metricValue: { fontFamily: 'PoppinsBold', fontSize: 24, color: colors.white },
  metricLabel: { fontFamily: 'PoppinsRegular', fontSize: 12, color: '#AFC1D2' },
  metricDivider: { width: 1, height: 42, backgroundColor: 'rgba(255,255,255,.18)' },
  themeSwitch: { marginLeft: 'auto', gap: 8, alignItems: 'flex-end' },
  themeSwitchMobile: { marginLeft: 0, width: '100%', alignItems: 'stretch' },
  themeLabel: { fontFamily: 'PoppinsMedium', fontSize: 12, color: '#AFC1D2' },
  themeOptions: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,.16)', backgroundColor: 'rgba(255,255,255,.08)' },
  themeOption: { flexGrow: 1, minHeight: 36, paddingHorizontal: 12, borderRadius: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  themeOptionActive: { backgroundColor: '#FFFFFF' },
  themeOptionText: { fontFamily: 'PoppinsSemiBold', fontSize: 12, color: '#D6E2EE' },
  themeOptionTextActive: { color: '#0C4FA8' },
  edit: { minHeight: 40, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.primaryBorder, backgroundColor: colors.primarySoft, flexDirection: 'row', alignItems: 'center', gap: 7 },
  editText: { fontFamily: 'PoppinsSemiBold', fontSize: 13, color: colors.primary },
  cardHeadCopy: { flex: 1, minWidth: 0 },
  detailField: { flex: 1, width: '100%', paddingVertical: 10 },
  detailLocked: { color: colors.muted },
  lockedBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  lockedBadgeText: { fontFamily: 'PoppinsMedium', fontSize: 11, color: colors.muted },
  detailEmpty: { color: colors.muted, fontFamily: 'PoppinsRegular' },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border },
  editActionsMobile: { flexDirection: 'column-reverse' },
  editAction: { minWidth: 140, minHeight: 44 },
  columns: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, alignItems: 'flex-start' },
  columnsMobile: { flexDirection: 'column' },
  fullWidth: { minWidth: 0, width: '100%' },
  info: { minWidth: 420, flex: 1.8, gap: 0 },
  side: { minWidth: 320, flex: 1, gap: 14 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingBottom: 17, borderBottomWidth: 1, borderBottomColor: colors.border },
  section: { fontFamily: 'PoppinsBold', fontSize: 19, color: colors.text },
  sectionCopy: { fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 19, color: colors.muted, marginTop: 3 },
  detailRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 22, borderBottomWidth: 1, borderBottomColor: colors.border },
  detailRowMobile: { flexDirection: 'column', alignItems: 'flex-start', gap: 4, paddingVertical: 12 },
  detailLast: { borderBottomWidth: 0 },
  detailLabel: { width: 130, fontFamily: 'PoppinsMedium', fontSize: 13, color: colors.muted },
  detailValue: { flex: 1, fontFamily: 'PoppinsMedium', fontSize: 14, color: colors.text },
  bio: { lineHeight: 21 },
  balanceCard: { gap: 13 },
  balanceHead: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  wallet: { width: 46, height: 46, borderRadius: 13, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  balance: { fontFamily: 'PoppinsBold', fontSize: 29, color: colors.text, marginTop: 5 },
  escrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  escrow: { fontFamily: 'PoppinsRegular', fontSize: 12, color: colors.muted },
  quick: { gap: 9, marginTop: 6 },
  quickLabel: { fontFamily: 'PoppinsMedium', fontSize: 12, color: colors.textSoft },
  quickRow: { flexDirection: 'row', gap: 10 },
  quickChip: { flex: 1, minHeight: 40, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  quickChipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primaryBorder },
  quickText: { fontFamily: 'PoppinsSemiBold', fontSize: 12, color: colors.textSoft },
  quickTextActive: { color: colors.primary },
  accountLinks: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', marginTop: 4 },
  accountLink: { flex: 1, minWidth: 130, minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  accountLinkText: { fontFamily: 'PoppinsSemiBold', fontSize: 12, color: colors.primary },
}));
