import { useState } from 'react';
import { router } from 'expo-router';
import { Button, Card, FeedbackDialog, Field, Screen, Title } from '@/components/ui';
import { endpoints, errorMessage } from '@/lib/api';
import { useAuth } from '@/store/auth';

export default function EditProfileScreen() {
  const user = useAuth(state => state.user)!;
  const refresh = useAuth(state => state.refresh);
  const [form, setForm] = useState({ name: user.name, phone: user.phone || '', bio: user.bio || '' });
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'danger'; title: string; message: string } | null>(null);
  const set = (key: keyof typeof form) => (value: string) => setForm(current => ({ ...current, [key]: value }));

  const submit = async () => {
    setLoading(true);
    try {
      await endpoints.updateProfile(form);
      await refresh();
      setFeedback({ tone: 'success', title: 'Profil tersimpan', message: 'Informasi profilmu sudah diperbarui dan akan dipakai pada profil seller serta transaksi berikutnya.' });
    } catch (error) {
      setFeedback({ tone: 'danger', title: 'Profil belum tersimpan', message: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  return <Screen>
    <Title eyebrow="IDENTITAS" subtitle="Informasi ini membantu transaksi lebih terpercaya.">Edit profil</Title>
    <Card style={{ maxWidth: 760, width: '100%', alignSelf: 'center' }}>
      <Field label="Nama" value={form.name} onChangeText={set('name')} />
      <Field label="Nomor telepon" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
      <Field label="Bio" value={form.bio} onChangeText={set('bio')} multiline maxLength={500} hint="Ceritakan singkat tentang kamu sebagai buyer atau seller." />
      <Button title="Simpan perubahan" icon="checkmark-outline" loading={loading} onPress={submit} />
    </Card>
    <FeedbackDialog visible={Boolean(feedback)} tone={feedback?.tone || 'success'} title={feedback?.title || ''} message={feedback?.message || ''} primaryLabel={feedback?.tone === 'success' ? 'Selesai' : 'OK'} onClose={() => setFeedback(null)} onPrimary={() => { const success = feedback?.tone === 'success'; setFeedback(null); if (success) router.back(); }} />
  </Screen>;
}
