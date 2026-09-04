import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Button, Card, FeedbackDialog, Field, InlineAlert, Loader, Screen, Title } from '@/components/ui';
import { colors, radius } from '@/constants/theme';
import { endpoints, errorMessage } from '@/lib/api';
import type { FulfillmentMethod } from '@/types';

const categories = ['ELECTRONICS', 'BOOKS', 'FASHION', 'FOOD', 'SERVICES', 'SPORTS', 'OTHER'];
const categoryLabels: Record<string, string> = {
  ELECTRONICS: 'Elektronik', BOOKS: 'Buku', FASHION: 'Fashion', FOOD: 'Makanan',
  SERVICES: 'Jasa', SPORTS: 'Olahraga', OTHER: 'Lainnya',
};
const conditionLabels: Record<string, string> = {
  NEW: 'Baru', LIKE_NEW: 'Seperti baru', GOOD: 'Kondisi baik', FAIR: 'Cukup baik',
};

type ListingForm = {
  title: string;
  description: string;
  price: string;
  category: string;
  type: 'PRODUCT' | 'SERVICE';
  condition: string;
  stock: string;
};

type ListingPhoto = {
  key: string;
  uri: string;
  asset?: ImagePicker.ImagePickerAsset;
};

type FormErrors = Partial<Record<keyof ListingForm | 'photos' | 'fulfillmentMethods', string>>;

const initialForm: ListingForm = {
  title: '', description: '', price: '', category: 'OTHER',
  type: 'PRODUCT', condition: 'GOOD', stock: '1',
};

export default function ListingFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { width } = useWindowDimensions();
  const desktop = width >= 960;
  const client = useQueryClient();
  const hydratedId = useRef<string | undefined>(undefined);
  const [form, setForm] = useState(initialForm);
  const [photos, setPhotos] = useState<ListingPhoto[]>([]);
  const [fulfillmentMethods, setFulfillmentMethods] = useState<FulfillmentMethod[]>(['CAMPUS_MEETUP', 'INSTANT_COURIER']);
  const [errors, setErrors] = useState<FormErrors>({});
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'danger'; title: string; message: string; listingId?: string } | null>(null);

  const existing = useQuery({
    queryKey: ['listing', id],
    queryFn: () => endpoints.listing(id!),
    enabled: Boolean(id),
  });

  useEffect(() => {
    if (!existing.data || hydratedId.current === id) return;
    const listing = existing.data;
    setForm({
      title: listing.title,
      description: listing.description,
      price: String(listing.price),
      category: listing.category,
      type: listing.type,
      condition: listing.condition || 'GOOD',
      stock: String(listing.stock || 1),
    });
    setPhotos((listing.images || []).map((uri, index) => ({ key: `remote-${index}-${uri}`, uri })));
    setFulfillmentMethods(listing.fulfillmentMethods?.length ? listing.fulfillmentMethods : ['CAMPUS_MEETUP']);
    hydratedId.current = id;
  }, [existing.data, id]);

  const setField = (key: keyof ListingForm) => (value: string) => {
    setForm(current => ({ ...current, [key]: value }));
    setErrors(current => ({ ...current, [key]: undefined }));
  };

  const setNumericField = (key: 'price' | 'stock') => (value: string) => {
    setField(key)(value.replace(/[^0-9]/g, ''));
  };

  const toggleFulfillment = (method: FulfillmentMethod) => {
    setFulfillmentMethods(current => current.includes(method)
      ? current.filter(value => value !== method)
      : [...current, method]);
    setErrors(current => ({ ...current, fulfillmentMethods: undefined }));
  };

  const pickPhotos = async () => {
    const remaining = 4 - photos.length;
    if (remaining <= 0) {
      Alert.alert('Maksimal 4 foto', 'Hapus salah satu foto jika ingin memilih foto lain.');
      return;
    }

    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Akses foto diperlukan', 'Izinkan akses galeri agar kamu dapat menambahkan foto listing.');
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.82,
    });
    if (result.canceled) return;

    const supportedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
    const oversized = result.assets.filter(asset => (asset.fileSize || 0) > 5 * 1024 * 1024);
    const unsupported = result.assets.filter(asset => asset.mimeType && !supportedTypes.has(asset.mimeType));
    const accepted = result.assets.filter(asset =>
      (asset.fileSize || 0) <= 5 * 1024 * 1024
      && (!asset.mimeType || supportedTypes.has(asset.mimeType)),
    );
    const knownUris = new Set(photos.map(photo => photo.uri));
    const additions = accepted
      .filter(asset => !knownUris.has(asset.uri))
      .map((asset, index) => ({
        key: `local-${Date.now()}-${index}-${asset.uri}`,
        uri: asset.uri,
        asset,
      }));

    setPhotos(current => [...current, ...additions].slice(0, 4));
    setErrors(current => ({ ...current, photos: undefined }));
    if (oversized.length || unsupported.length) {
      const reasons = [
        oversized.length ? `${oversized.length} foto lebih dari 5 MB` : '',
        unsupported.length ? `${unsupported.length} foto bukan JPG, PNG, atau WebP` : '',
      ].filter(Boolean).join(' dan ');
      Alert.alert('Sebagian foto dilewati', `${reasons}.`);
    }
  };

  const removePhoto = (key: string) => setPhotos(current => current.filter(photo => photo.key !== key));

  const movePhoto = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= photos.length) return;
    setPhotos(current => {
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const setAsCover = (index: number) => {
    if (index === 0) return;
    setPhotos(current => {
      const next = [...current];
      const [cover] = next.splice(index, 1);
      next.unshift(cover);
      return next;
    });
  };

  const validate = () => {
    const next: FormErrors = {};
    if (form.title.trim().length < 3) next.title = 'Judul minimal 3 karakter.';
    if (form.description.trim().length < 10) next.description = 'Deskripsi minimal 10 karakter.';
    if (!Number.isFinite(Number(form.price)) || Number(form.price) < 1) next.price = 'Masukkan harga yang valid.';
    if (!form.category) next.category = 'Pilih kategori listing.';
    if (!photos.length) next.photos = 'Tambahkan minimal satu foto.';
    if (!fulfillmentMethods.length) next.fulfillmentMethods = 'Pilih minimal satu metode penyerahan.';
    if (form.type === 'PRODUCT' && !form.condition) next.condition = 'Pilih kondisi barang.';
    if (form.type === 'PRODUCT' && (!Number.isInteger(Number(form.stock)) || Number(form.stock) < 1)) {
      next.stock = 'Stok minimal 1.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!validate()) throw new Error('Lengkapi bagian yang masih ditandai.');
      setUploadProgress(photos.some(photo => photo.asset) ? 0 : 88);

      const localPhotos = photos.filter(photo => photo.asset);
      const uploaded = localPhotos.length
        ? await endpoints.upload(localPhotos.map(photo => photo.asset!), setUploadProgress)
        : { urls: [] };
      let uploadedIndex = 0;
      const images = photos.map(photo => photo.asset ? uploaded.urls[uploadedIndex++] : photo.uri);
      setUploadProgress(94);

      const body = {
        title: form.title.trim(),
        description: form.description.trim(),
        price: Number(form.price),
        category: form.category,
        type: form.type,
        condition: form.type === 'PRODUCT' ? form.condition : undefined,
        stock: form.type === 'PRODUCT' ? Number(form.stock) : undefined,
        images,
        fulfillmentMethods,
      };
      return id ? endpoints.updateListing(id, body) : endpoints.createListing(body);
    },
    onSuccess: listing => {
      setUploadProgress(100);
      client.setQueryData(['listing', listing.id], listing);
      client.invalidateQueries({ queryKey: ['my-listings'] });
      client.invalidateQueries({ queryKey: ['listings'] });
      setFeedback({ tone: 'success', title: id ? 'Perubahan tersimpan' : 'Listing berhasil dipublikasikan', message: id ? 'Informasi listing sudah diperbarui.' : 'Listing langsung tayang di etalase BMarket dan dapat ditemukan oleh buyer.', listingId: listing.id });
    },
    onError: error => {
      setUploadProgress(null);
      if (error instanceof Error && error.message === 'Lengkapi bagian yang masih ditandai.') return;
      setFeedback({ tone: 'danger', title: 'Listing belum tersimpan', message: errorMessage(error) });
    },
  });

  if (id && existing.isLoading) return <Screen><Loader /></Screen>;

  const steps = [
    { label: 'Informasi', ready: form.title.trim().length >= 3 && form.description.trim().length >= 10 },
    { label: 'Foto', ready: photos.length > 0 },
    { label: 'Harga & stok', ready: Number(form.price) > 0 && (form.type === 'SERVICE' || Number(form.stock) > 0) },
    { label: 'Publikasikan', ready: false },
  ];

  return (
    <Screen>
      <Title eyebrow="MULAI BERJUALAN" subtitle="Foto yang jelas dan informasi yang lengkap membantu pembeli mengambil keputusan.">
        {id ? 'Edit listing' : 'Pasang listing baru'}
      </Title>

      <View style={styles.steps}>
        {steps.map((step, index) => (
          <View key={step.label} style={styles.step}>
            <View style={[styles.stepNumber, step.ready && styles.stepNumberReady]}>
              <Ionicons name={step.ready ? 'checkmark' : index === 3 ? 'send-outline' : `${index + 1}-circle-outline` as never} size={18} color={step.ready ? colors.white : colors.muted} />
            </View>
            {desktop ? <Text style={[styles.stepLabel, step.ready && styles.stepLabelReady]}>{step.label}</Text> : null}
            {index < steps.length - 1 ? <View style={[styles.stepLine, step.ready && styles.stepLineReady]} /> : null}
          </View>
        ))}
      </View>

      <View style={[styles.columns, !desktop && styles.columnsMobile]}>
        <Card style={styles.formCard}>
          <View>
            <Text style={styles.cardTitle}>Informasi listing</Text>
            <Text style={styles.cardCopy}>Tulis seperti kamu menjelaskan barang atau jasa ini kepada teman kampus.</Text>
          </View>

          <Text style={styles.label}>Jenis listing</Text>
          <View style={styles.segment}>
            <Pressable onPress={() => setForm(current => ({ ...current, type: 'PRODUCT' }))} style={[styles.segmentItem, form.type === 'PRODUCT' && styles.segmentActive]}>
              <Ionicons name="cube-outline" size={20} color={form.type === 'PRODUCT' ? colors.primary : colors.muted} />
              <View><Text style={[styles.segmentText, form.type === 'PRODUCT' && styles.segmentTextActive]}>Barang</Text><Text style={styles.segmentCaption}>Produk fisik dengan stok</Text></View>
            </Pressable>
            <Pressable onPress={() => setForm(current => ({ ...current, type: 'SERVICE' }))} style={[styles.segmentItem, form.type === 'SERVICE' && styles.segmentActive]}>
              <Ionicons name="construct-outline" size={20} color={form.type === 'SERVICE' ? colors.primary : colors.muted} />
              <View><Text style={[styles.segmentText, form.type === 'SERVICE' && styles.segmentTextActive]}>Jasa</Text><Text style={styles.segmentCaption}>Keahlian atau layanan</Text></View>
            </Pressable>
          </View>

          <Field label="Judul listing" value={form.title} onChangeText={setField('title')} maxLength={120} error={errors.title} placeholder="Contoh: ASUS VivoBook 14, RAM 8 GB" hint={`${form.title.length}/120 karakter`} />

          <View>
            <Text style={styles.label}>Kategori</Text>
            <View style={styles.chips}>
              {categories.map(category => (
                <Pressable key={category} onPress={() => setField('category')(category)} style={[styles.chip, form.category === category && styles.chipActive]}>
                  <Text style={[styles.chipText, form.category === category && styles.chipTextActive]}>{categoryLabels[category]}</Text>
                </Pressable>
              ))}
            </View>
            {errors.category ? <Text style={styles.errorText}>{errors.category}</Text> : null}
          </View>

          <Field label="Deskripsi" multiline value={form.description} onChangeText={setField('description')} maxLength={5000} error={errors.description} placeholder="Ceritakan kondisi, spesifikasi, kelengkapan, dan cara penyerahan" hint={`${form.description.length}/5000 karakter`} />

          <View style={[styles.fieldRow, !desktop && styles.fieldRowMobile]}>
            <View style={styles.flex}><Field label="Harga" icon="cash-outline" value={form.price} onChangeText={setNumericField('price')} keyboardType="number-pad" error={errors.price} placeholder="Contoh: 75000" /></View>
            {form.type === 'PRODUCT' ? <View style={styles.stock}><Field label="Stok" value={form.stock} onChangeText={setNumericField('stock')} keyboardType="number-pad" error={errors.stock} /></View> : null}
          </View>

          {form.type === 'PRODUCT' ? (
            <View>
              <Text style={styles.label}>Kondisi barang</Text>
              <View style={styles.chips}>
                {Object.entries(conditionLabels).map(([condition, label]) => (
                  <Pressable key={condition} onPress={() => setField('condition')(condition)} style={[styles.chip, form.condition === condition && styles.chipActive]}>
                    <Text style={[styles.chipText, form.condition === condition && styles.chipTextActive]}>{label}</Text>
                  </Pressable>
                ))}
              </View>
              {errors.condition ? <Text style={styles.errorText}>{errors.condition}</Text> : null}
            </View>
          ) : null}

          <View>
            <Text style={styles.label}>Metode penyerahan</Text>
            <Text style={styles.deliveryHelp}>Pilih metode yang dapat kamu layani. Buyer akan memilih salah satunya saat checkout.</Text>
            <View style={styles.deliveryGrid}>
              <Pressable onPress={() => toggleFulfillment('CAMPUS_MEETUP')} style={[styles.deliveryOption, fulfillmentMethods.includes('CAMPUS_MEETUP') && styles.deliveryOptionActive]}>
                <View style={styles.deliveryIcon}><Ionicons name="people-outline" size={22} color={colors.primary} /></View>
                <View style={styles.flex}><Text style={styles.deliveryTitle}>Meetup langsung</Text><Text style={styles.deliveryCaption}>Waktu dan lokasi disepakati lewat chat</Text></View>
                <Ionicons name={fulfillmentMethods.includes('CAMPUS_MEETUP') ? 'checkmark-circle' : 'ellipse-outline'} size={21} color={fulfillmentMethods.includes('CAMPUS_MEETUP') ? colors.primary : colors.borderStrong} />
              </Pressable>
              <Pressable onPress={() => toggleFulfillment('INSTANT_COURIER')} style={[styles.deliveryOption, fulfillmentMethods.includes('INSTANT_COURIER') && styles.deliveryOptionActive]}>
                <View style={styles.deliveryIcon}><Ionicons name="bicycle-outline" size={22} color={colors.primary} /></View>
                <View style={styles.flex}><Text style={styles.deliveryTitle}>Kurir Instan</Text><Text style={styles.deliveryCaption}>GoSend atau GrabExpress simulasi</Text></View>
                <Ionicons name={fulfillmentMethods.includes('INSTANT_COURIER') ? 'checkmark-circle' : 'ellipse-outline'} size={21} color={fulfillmentMethods.includes('INSTANT_COURIER') ? colors.primary : colors.borderStrong} />
              </Pressable>
            </View>
            {errors.fulfillmentMethods ? <Text style={styles.errorText}>{errors.fulfillmentMethods}</Text> : null}
          </View>
        </Card>

        <View style={styles.side}>
          <Card style={styles.photoCard}>
            <View style={styles.photoHeader}>
              <View style={styles.flex}><Text style={styles.cardTitle}>Foto listing</Text><Text style={styles.cardCopy}>Foto pertama menjadi sampul etalase.</Text></View>
              <View style={styles.photoCount}><Text style={styles.photoCountText}>{photos.length}/4</Text></View>
            </View>

            <Pressable accessibilityRole="button" onPress={pickPhotos} style={[styles.upload, errors.photos && styles.uploadError]}>
              <View style={styles.uploadIcon}><Ionicons name="images-outline" size={25} color={colors.primary} /></View>
              <Text style={styles.uploadTitle}>{photos.length ? 'Tambah foto lain' : 'Pilih foto dari galeri'}</Text>
              <Text style={styles.uploadCopy}>JPG, PNG, atau WebP · maksimal 5 MB per foto</Text>
            </Pressable>
            {errors.photos ? <Text style={styles.errorText}>{errors.photos}</Text> : null}

            <View style={styles.photos}>
              {photos.map((photo, index) => (
                <View key={photo.key} style={[styles.photoTile, index === 0 && styles.photoTileCover]}>
                  <Image source={photo.uri} style={styles.photo} contentFit="cover" transition={140} />
                  <View style={styles.photoTopRow}>
                    {index === 0 ? <View style={styles.coverBadge}><Ionicons name="star" size={11} color={colors.white} /><Text style={styles.coverBadgeText}>Sampul</Text></View> : <View />}
                    <Pressable accessibilityLabel="Hapus foto" hitSlop={7} onPress={() => removePhoto(photo.key)} style={styles.photoDelete}><Ionicons name="trash-outline" size={15} color={colors.white} /></Pressable>
                  </View>
                  <View style={styles.photoActions}>
                    <Pressable accessibilityLabel="Geser foto ke kiri" disabled={index === 0} onPress={() => movePhoto(index, -1)} style={[styles.photoAction, index === 0 && styles.photoActionDisabled]}><Ionicons name="chevron-back" size={15} color={colors.textSoft} /></Pressable>
                    {index > 0 ? <Pressable accessibilityLabel="Jadikan foto sampul" onPress={() => setAsCover(index)} style={styles.coverAction}><Text style={styles.coverActionText}>Jadi sampul</Text></Pressable> : <View style={styles.coverAction}><Text style={styles.coverActionText}>Foto utama</Text></View>}
                    <Pressable accessibilityLabel="Geser foto ke kanan" disabled={index === photos.length - 1} onPress={() => movePhoto(index, 1)} style={[styles.photoAction, index === photos.length - 1 && styles.photoActionDisabled]}><Ionicons name="chevron-forward" size={15} color={colors.textSoft} /></Pressable>
                  </View>
                </View>
              ))}
            </View>
          </Card>

          <Card style={styles.tips}>
            <View style={styles.tipHeader}><View style={styles.tipIcon}><Ionicons name="bulb-outline" size={22} color="#F8B13A" /></View><Text style={styles.tipTitle}>Foto yang lebih meyakinkan</Text></View>
            {['Gunakan cahaya yang terang', 'Tampilkan kondisi dari beberapa sisi', 'Hindari foto buram atau tangkapan layar', 'Jangan cantumkan kontak pribadi'].map(tip => (
              <View key={tip} style={styles.tip}><Ionicons name="checkmark-circle" size={17} color="#5BD1A3" /><Text style={styles.tipText}>{tip}</Text></View>
            ))}
          </Card>

          {uploadProgress !== null ? (
            <View style={styles.progressWrap}>
              <View style={styles.progressHeader}><Text style={styles.progressLabel}>{uploadProgress < 90 ? 'Mengunggah foto…' : 'Menyimpan listing…'}</Text><Text style={styles.progressValue}>{uploadProgress}%</Text></View>
              <View style={styles.progressTrack}><View style={[styles.progressBar, { width: `${uploadProgress}%` }]} /></View>
            </View>
          ) : null}
          {mutation.isError && Object.keys(errors).length > 0 ? <InlineAlert message="Lengkapi bagian yang masih ditandai." /> : null}
          <Button title={id ? 'Simpan perubahan' : 'Publikasikan listing'} icon={id ? 'save-outline' : 'send-outline'} loading={mutation.isPending} onPress={() => mutation.mutate()} />
          <Text style={styles.reviewNote}>Listing langsung tayang. Pengguna lain tetap dapat melaporkan konten yang melanggar aturan komunitas.</Text>
        </View>
      </View>
      <FeedbackDialog visible={Boolean(feedback)} tone={feedback?.tone || 'success'} title={feedback?.title || ''} message={feedback?.message || ''} primaryLabel={feedback?.listingId ? 'Lihat listing' : 'OK'} onClose={() => setFeedback(null)} onPrimary={() => { const listingId = feedback?.listingId; setFeedback(null); if (listingId) router.replace({ pathname: '/(student)/listing/[id]', params: { id: listingId } }); }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  steps: { minHeight: 84, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' },
  step: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  stepNumber: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  stepNumberReady: { backgroundColor: colors.primary },
  stepLabel: { fontFamily: 'PoppinsMedium', fontSize: 12, color: colors.muted },
  stepLabelReady: { fontFamily: 'PoppinsSemiBold', color: colors.text },
  stepLine: { height: 2, flex: 1, backgroundColor: colors.border, marginHorizontal: 10 },
  stepLineReady: { backgroundColor: '#BBD6F5' },
  columns: { flexDirection: 'row', gap: 22, alignItems: 'flex-start' },
  columnsMobile: { flexDirection: 'column' },
  formCard: { flex: 1.55, width: '100%', gap: 22 },
  side: { flex: 1, width: '100%', minWidth: 320, gap: 14 },
  cardTitle: { fontFamily: 'PoppinsBold', fontSize: 21, color: colors.text },
  cardCopy: { fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 19, color: colors.muted, marginTop: 3 },
  label: { fontFamily: 'PoppinsMedium', fontSize: 14, color: colors.textSoft, marginBottom: 8 },
  segment: { flexDirection: 'row', gap: 10 },
  segmentItem: { minHeight: 64, flex: 1, borderRadius: 11, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  segmentActive: { borderColor: '#A8C8EF', backgroundColor: colors.primarySoft },
  segmentText: { fontFamily: 'PoppinsSemiBold', fontSize: 13, color: colors.textSoft },
  segmentTextActive: { color: colors.primary },
  segmentCaption: { fontFamily: 'PoppinsRegular', fontSize: 12, color: colors.muted, marginTop: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 40, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, justifyContent: 'center' },
  chipActive: { borderColor: '#A8C8EF', backgroundColor: colors.primarySoft },
  chipText: { fontFamily: 'PoppinsMedium', fontSize: 12, color: colors.textSoft },
  chipTextActive: { fontFamily: 'PoppinsSemiBold', color: colors.primary },
  deliveryHelp: { fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 18, color: colors.muted, marginTop: -4, marginBottom: 10 },
  deliveryGrid: { gap: 9 },
  deliveryOption: { minHeight: 70, padding: 13, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 11 },
  deliveryOptionActive: { borderColor: '#A8C8EF', backgroundColor: colors.primarySoft },
  deliveryIcon: { width: 42, height: 42, borderRadius: 11, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  deliveryTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 13, color: colors.text },
  deliveryCaption: { fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 16, color: colors.muted, marginTop: 1 },
  errorText: { fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 18, color: colors.danger, marginTop: 6 },
  fieldRow: { flexDirection: 'row', gap: 14 },
  fieldRowMobile: { flexDirection: 'column' },
  flex: { flex: 1 },
  stock: { width: 150 },
  photoCard: { gap: 16 },
  photoHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  photoCount: { minWidth: 48, height: 34, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  photoCountText: { fontFamily: 'PoppinsSemiBold', fontSize: 12, color: colors.primary },
  upload: { minHeight: 144, borderRadius: 13, borderWidth: 1, borderStyle: 'dashed', borderColor: '#AFC8E3', backgroundColor: '#F8FBFE', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 18 },
  uploadError: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  uploadIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  uploadTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 14, color: colors.text, marginTop: 2 },
  uploadCopy: { fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 17, textAlign: 'center', color: colors.muted },
  photos: { gap: 12 },
  photoTile: { position: 'relative', height: 184, borderRadius: 14, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', backgroundColor: colors.surfaceMuted },
  photoTileCover: { borderColor: colors.primary },
  photo: { width: '100%', height: 142 },
  photoTopRow: { position: 'absolute', left: 9, right: 9, top: 9, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  coverBadge: { minHeight: 28, paddingHorizontal: 9, borderRadius: radius.pill, backgroundColor: 'rgba(12,79,168,.92)', flexDirection: 'row', alignItems: 'center', gap: 5 },
  coverBadgeText: { fontFamily: 'PoppinsSemiBold', fontSize: 12, color: colors.white },
  photoDelete: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(18,42,63,.78)', alignItems: 'center', justifyContent: 'center' },
  photoActions: { height: 40, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface },
  photoAction: { width: 32, height: 30, borderRadius: 8, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  photoActionDisabled: { opacity: 0.32 },
  coverAction: { flex: 1, alignItems: 'center' },
  coverActionText: { fontFamily: 'PoppinsMedium', fontSize: 12, color: colors.textSoft },
  tips: { backgroundColor: colors.primaryDeep, borderColor: colors.primaryDeep, gap: 13 },
  tipHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 2 },
  tipIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: 'rgba(255,255,255,.1)', alignItems: 'center', justifyContent: 'center' },
  tipTitle: { flex: 1, fontFamily: 'PoppinsBold', fontSize: 16, color: colors.white },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  tipText: { flex: 1, fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 18, color: '#CFDBE6' },
  progressWrap: { gap: 8, padding: 14, borderRadius: 12, backgroundColor: colors.primarySoft },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontFamily: 'PoppinsMedium', fontSize: 12, color: colors.primaryDark },
  progressValue: { fontFamily: 'PoppinsSemiBold', fontSize: 12, color: colors.primary },
  progressTrack: { height: 7, overflow: 'hidden', borderRadius: radius.pill, backgroundColor: '#CFE1F6' },
  progressBar: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.primary },
  reviewNote: { fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 18, textAlign: 'center', color: colors.muted },
});
