import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { DateTimePickerField, formatLocalDateTimeValue, parseLocalDateTimeValue } from '@/components/date-time-picker-field';
import { Button, Card, FeedbackDialog, Field, InlineAlert, Loader, Screen, Title } from '@/components/ui';
import { colors, radius, makeStyles } from '@/constants/theme';
import { endpoints, errorMessage } from '@/lib/api';
import type { FulfillmentMethod, ListingMode } from '@/types';

// SERVICES is not selectable: it is assigned automatically when the "Jasa" model is chosen.
const categories = ['ELECTRONICS', 'BOOKS', 'FASHION', 'FOOD', 'SPORTS', 'OTHER'];
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
  mode: ListingMode;
  condition: string;
  stock: string;
  preorderDeadline: string;
  preorderReadyAt: string;
  preorderQuota: string;
  preorderMinOrder: string;
  preorderMaxPerBuyer: string;
  preorderPickupLocation: string;
  preorderPickupNote: string;
};

type ListingPhoto = {
  key: string;
  uri: string;
  asset?: ImagePicker.ImagePickerAsset;
};

type FormErrors = Partial<Record<keyof ListingForm | 'photos' | 'fulfillmentMethods', string>>;

const initialForm: ListingForm = {
  title: '', description: '', price: '', category: 'OTHER',
  mode: 'ONE_OFF', condition: 'GOOD', stock: '5',
  preorderDeadline: '', preorderReadyAt: '', preorderQuota: '30',
  preorderMinOrder: '', preorderMaxPerBuyer: '5', preorderPickupLocation: '', preorderPickupNote: '',
};

export default function ListingFormScreen() {
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { width } = useWindowDimensions();
  const desktop = width >= 960;
  const mobile = width < 600;
  const client = useQueryClient();
  const hydratedId = useRef<string | undefined>(undefined);
  // Remembers the last goods model so switching Jasa -> Barang restores it.
  const lastProductMode = useRef<ListingMode>('ONE_OFF');
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
    const mode: ListingMode = listing.mode || (listing.type === 'SERVICE' ? 'SERVICE' : Number(listing.stock || 1) > 1 ? 'STOCKED' : 'ONE_OFF');
    if (mode !== 'SERVICE') lastProductMode.current = mode;
    setForm({
      title: listing.title,
      description: listing.description,
      price: String(listing.price),
      category: mode === 'SERVICE' ? 'SERVICES' : listing.category === 'SERVICES' ? 'OTHER' : listing.category,
      mode,
      condition: listing.condition || 'GOOD',
      stock: String(listing.stock || 5),
      preorderDeadline: listing.preorderDeadline ? formatLocalDateTimeValue(new Date(listing.preorderDeadline)) : '',
      preorderReadyAt: listing.preorderReadyAt ? formatLocalDateTimeValue(new Date(listing.preorderReadyAt)) : '',
      preorderQuota: String(listing.preorderQuota || listing.stock || 30),
      preorderMinOrder: listing.preorderMinOrder ? String(listing.preorderMinOrder) : '',
      preorderMaxPerBuyer: listing.preorderMaxPerBuyer ? String(listing.preorderMaxPerBuyer) : '5',
      preorderPickupLocation: listing.preorderPickupLocation || '',
      preorderPickupNote: listing.preorderPickupNote || '',
    });
    setPhotos((listing.images || []).map((uri, index) => ({ key: `remote-${index}-${uri}`, uri })));
    setFulfillmentMethods(listing.fulfillmentMethods?.length ? listing.fulfillmentMethods : ['CAMPUS_MEETUP']);
    hydratedId.current = id;
  }, [existing.data, id]);

  const setField = (key: keyof ListingForm) => (value: string) => {
    setForm(current => ({ ...current, [key]: value }));
    setErrors(current => ({ ...current, [key]: undefined }));
  };

  const setNumericField = (key: 'price' | 'stock' | 'preorderQuota' | 'preorderMinOrder' | 'preorderMaxPerBuyer') => (value: string) => {
    setField(key)(value.replace(/[^0-9]/g, ''));
  };

  const selectCategory = (category: string) => {
    setForm(current => ({ ...current, category }));
    setErrors(current => ({ ...current, category: undefined, condition: undefined }));
  };

  const selectType = (type: 'PRODUCT' | 'SERVICE') => {
    if (type === 'SERVICE') selectMode('SERVICE');
    else if (form.mode === 'SERVICE') selectMode(lastProductMode.current);
  };

  const selectMode = (mode: ListingMode) => {
    if (mode !== 'SERVICE') lastProductMode.current = mode;
    setForm(current => ({
      ...current,
      mode,
      category: mode === 'SERVICE' ? 'SERVICES' : current.category === 'SERVICES' ? 'OTHER' : current.category,
    }));
    setErrors(current => ({ ...current, category: undefined, condition: undefined, stock: undefined, preorderDeadline: undefined, preorderReadyAt: undefined, fulfillmentMethods: undefined }));
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

  const listingType = form.mode === 'SERVICE' ? 'SERVICE' as const : 'PRODUCT' as const;
  const isProduct = listingType === 'PRODUCT';
  const isPreorder = form.mode === 'PREORDER';
  const conditionApplies = isProduct
    && !isPreorder
    && !['FOOD', 'SERVICES'].includes(form.category);
  const parseDate = (value: string) => parseLocalDateTimeValue(value);

  const validate = () => {
    const next: FormErrors = {};
    if (form.title.trim().length < 3) next.title = 'Judul minimal 3 karakter.';
    if (form.description.trim().length < 10) next.description = 'Deskripsi minimal 10 karakter.';
    if (!Number.isFinite(Number(form.price)) || Number(form.price) < 1) next.price = 'Masukkan harga yang valid.';
    if (!form.category) next.category = 'Pilih kategori listing.';
    if (!photos.length) next.photos = 'Tambahkan minimal satu foto.';
    if (isProduct && !fulfillmentMethods.length) next.fulfillmentMethods = 'Pilih minimal satu metode penyerahan.';
    if (conditionApplies && !form.condition) next.condition = 'Pilih kondisi barang.';
    if (form.mode === 'STOCKED' && (!Number.isInteger(Number(form.stock)) || Number(form.stock) < 1)) next.stock = 'Stok minimal 1.';
    if (isPreorder) {
      const deadline = parseDate(form.preorderDeadline);
      const readyAt = parseDate(form.preorderReadyAt);
      const quota = Number(form.preorderQuota);
      const minimum = form.preorderMinOrder ? Number(form.preorderMinOrder) : null;
      const maxPerBuyer = form.preorderMaxPerBuyer ? Number(form.preorderMaxPerBuyer) : null;
      if (!deadline || Number.isNaN(deadline.getTime()) || deadline.getTime() <= Date.now()) next.preorderDeadline = 'Deadline PO harus berada di masa mendatang.';
      if (readyAt && deadline && readyAt.getTime() <= deadline.getTime()) next.preorderReadyAt = 'Estimasi siap harus setelah deadline.';
      if (!Number.isInteger(quota) || quota < 1) next.preorderQuota = 'Kuota minimal 1.';
      if (minimum !== null && (!Number.isInteger(minimum) || minimum < 1 || minimum > quota)) next.preorderMinOrder = 'Minimum harus 1 sampai jumlah kuota.';
      if (maxPerBuyer !== null && (!Number.isInteger(maxPerBuyer) || maxPerBuyer < 1 || maxPerBuyer > quota)) next.preorderMaxPerBuyer = 'Batas buyer harus 1 sampai jumlah kuota.';
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
        category: isProduct ? form.category : 'SERVICES',
        type: listingType,
        mode: form.mode,
        condition: conditionApplies ? form.condition : undefined,
        stock: form.mode === 'ONE_OFF' ? 1 : form.mode === 'STOCKED' ? Number(form.stock) : undefined,
        images,
        // Jasa tidak memiliki metode penyerahan.
        fulfillmentMethods: isProduct ? fulfillmentMethods : [],
        preorderDeadline: isPreorder ? parseDate(form.preorderDeadline)?.toISOString() : undefined,
        preorderReadyAt: isPreorder ? (form.preorderReadyAt.trim() ? parseDate(form.preorderReadyAt)?.toISOString() : null) : undefined,
        preorderQuota: isPreorder ? Number(form.preorderQuota) : undefined,
        preorderMinOrder: isPreorder && form.preorderMinOrder ? Number(form.preorderMinOrder) : undefined,
        preorderMaxPerBuyer: isPreorder && form.preorderMaxPerBuyer ? Number(form.preorderMaxPerBuyer) : undefined,
        preorderPickupLocation: isPreorder ? form.preorderPickupLocation.trim() || undefined : undefined,
        preorderPickupNote: isPreorder ? form.preorderPickupNote.trim() || undefined : undefined,
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

  return (
    <Screen>
      <Title center eyebrow="MULAI BERJUALAN" subtitle="Foto yang jelas dan informasi yang lengkap membantu pembeli mengambil keputusan.">
        {id ? 'Edit listing' : 'Pasang listing baru'}
      </Title>

      <View style={styles.column}>
        <Card style={styles.formCard}>
          <View>
            <Text style={styles.cardTitle}>Informasi listing</Text>
            <Text style={styles.cardCopy}>Tulis seperti kamu menjelaskan barang atau jasa ini kepada teman kampus.</Text>
          </View>

          <View>
            <Text style={styles.label}>Tipe listing</Text>
            <View style={styles.modeGrid}>
              {([
                ['PRODUCT', 'cube-outline', 'Barang', 'Barang fisik: satuan, dengan stok, atau pre-order.'],
                ['SERVICE', 'construct-outline', 'Jasa', 'Layanan tanpa stok, kondisi, dan metode penyerahan.'],
              ] as const).map(([type, icon, title, caption]) => {
                const active = listingType === type;
                return <Pressable key={type} onPress={() => selectType(type)} style={[styles.modeItem, mobile && styles.modeItemMobile, active && styles.segmentActive]}>
                  <View style={[styles.modeIcon, active && styles.modeIconActive]}><Ionicons name={icon} size={20} color={active ? colors.primary : colors.muted} /></View>
                  <View style={styles.flex}><Text style={[styles.segmentText, active && styles.segmentTextActive]}>{title}</Text><Text style={styles.segmentCaption}>{caption}</Text></View>
                </Pressable>;
              })}
            </View>
          </View>

          {isProduct ? (
            <View>
              <Text style={styles.label}>Model penjualan</Text>
              <View style={styles.modeGrid}>
                {([
                  ['ONE_OFF', 'cube-outline', 'Barang satuan', 'Preloved atau barang unik, dijual sekali.'],
                  ['STOCKED', 'layers-outline', 'Produk dengan stok', 'Produk yang dapat direstock tanpa membuat katalog baru.'],
                  ['PREORDER', 'calendar-outline', 'Pre-order', 'Kumpulkan pesanan sampai deadline dan kuota tertentu.'],
                ] as const).map(([mode, icon, title, caption]) => {
                  const active = form.mode === mode;
                  return <Pressable key={mode} onPress={() => selectMode(mode)} style={[styles.modeItem, mobile && styles.modeItemMobile, active && styles.segmentActive]}>
                    <View style={[styles.modeIcon, active && styles.modeIconActive]}><Ionicons name={icon} size={20} color={active ? colors.primary : colors.muted} /></View>
                    <View style={styles.flex}><Text style={[styles.segmentText, active && styles.segmentTextActive]}>{title}</Text><Text style={styles.segmentCaption}>{caption}</Text></View>
                  </Pressable>;
                })}
              </View>
            </View>
          ) : null}

          <Field label="Judul listing" value={form.title} onChangeText={setField('title')} maxLength={120} error={errors.title} placeholder="Contoh: ASUS VivoBook 14, RAM 8 GB" hint={`${form.title.length}/120 karakter`} />

          <View>
            <Text style={styles.label}>Kategori</Text>
            {isProduct ? <>
              <View style={styles.chips}>
                {categories.map(category => (
                  <Pressable key={category} onPress={() => selectCategory(category)} style={[styles.chip, form.category === category && styles.chipActive]}>
                    <Text style={[styles.chipText, form.category === category && styles.chipTextActive]}>{categoryLabels[category]}</Text>
                  </Pressable>
                ))}
              </View>
              {errors.category ? <Text style={styles.errorText}>{errors.category}</Text> : null}
            </> : (
              <View style={[styles.chips, styles.serviceCategory]}>
                <View style={[styles.chip, styles.chipActive]}><Text style={[styles.chipText, styles.chipTextActive]}>Jasa</Text></View>
                <Text style={styles.serviceCategoryNote}>Otomatis mengikuti model penjualan Jasa.</Text>
              </View>
            )}
          </View>

          <Field label="Deskripsi" multiline value={form.description} onChangeText={setField('description')} maxLength={5000} error={errors.description} placeholder="Ceritakan kondisi, spesifikasi, kelengkapan, dan cara penyerahan" hint={`${form.description.length}/5000 karakter`} />

          <View style={[styles.fieldRow, !desktop && styles.fieldRowMobile]}>
            <View style={styles.flex}><Field label={isPreorder ? 'Harga per unit' : 'Harga'} icon="cash-outline" value={form.price} onChangeText={setNumericField('price')} keyboardType="number-pad" error={errors.price} placeholder="Contoh: 75000" /></View>
            {form.mode === 'STOCKED' ? <View style={styles.stock}><Field label="Stok awal" value={form.stock} onChangeText={setNumericField('stock')} keyboardType="number-pad" error={errors.stock} /></View> : null}
          </View>

          {conditionApplies ? (
            <View>
              <Text style={styles.label}>Kondisi</Text>
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

          {isPreorder ? (
            <View style={styles.preorderBox}>
              <View style={styles.preorderHeader}><View style={styles.preorderIcon}><Ionicons name="calendar-outline" size={20} color={colors.primary} /></View><View style={styles.flex}><Text style={styles.preorderTitle}>Pengaturan pre-order</Text><Text style={styles.preorderCopy}>Buyer membayar melalui escrow saat ikut PO. Kamu mendapat jumlah pesanan yang lebih pasti.</Text></View></View>
              <View style={[styles.fieldRow, !desktop && styles.fieldRowMobile]}>
                <View style={styles.flex}>
                  <DateTimePickerField
                    label="Deadline PO"
                    value={form.preorderDeadline}
                    onChange={setField('preorderDeadline')}
                    error={errors.preorderDeadline}
                    defaultTime="20:00"
                    minDate={new Date()}
                    hint="Pilih tanggal penutupan PO dan jam terakhir buyer dapat memesan."
                  />
                </View>
                <View style={styles.flex}>
                  <DateTimePickerField
                    label="Estimasi siap (opsional)"
                    value={form.preorderReadyAt}
                    onChange={setField('preorderReadyAt')}
                    error={errors.preorderReadyAt}
                    defaultTime="12:00"
                    minDate={parseDate(form.preorderDeadline) || new Date()}
                    optional
                    hint="Tanggal perkiraan produk mulai siap diambil atau dikirim."
                  />
                </View>
              </View>
              <View style={[styles.fieldRow, !desktop && styles.fieldRowMobile]}>
                <View style={styles.flex}><Field label="Kuota PO" value={form.preorderQuota} onChangeText={setNumericField('preorderQuota')} keyboardType="number-pad" error={errors.preorderQuota} /></View>
                <View style={styles.flex}><Field label="Minimum pesanan (opsional)" value={form.preorderMinOrder} onChangeText={setNumericField('preorderMinOrder')} keyboardType="number-pad" error={errors.preorderMinOrder} /></View>
                <View style={styles.flex}><Field label="Maks. per buyer" value={form.preorderMaxPerBuyer} onChangeText={setNumericField('preorderMaxPerBuyer')} keyboardType="number-pad" error={errors.preorderMaxPerBuyer} /></View>
              </View>
              <Field label="Lokasi pickup (opsional)" value={form.preorderPickupLocation} onChangeText={setField('preorderPickupLocation')} placeholder="Contoh: BINUS Anggrek, depan Admisi" />
              <Field label="Catatan pickup / produksi (opsional)" multiline value={form.preorderPickupNote} onChangeText={setField('preorderPickupNote')} placeholder="Contoh: pickup pukul 12:00–15:00. Bawa bukti transaksi BMarket." />
            </View>
          ) : null}

          {isProduct ? <View>
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
          </View> : null}
        </Card>

        <View style={styles.side}>
          <Card style={styles.photoCard}>
            <View style={styles.photoHeader}>
              <View style={styles.flex}><Text style={styles.cardTitle}>Foto listing</Text><Text style={styles.cardCopy}>Foto pertama menjadi sampul etalase.</Text></View>
              <View style={styles.photoCount}><Text style={styles.photoCountText}>{photos.length}/4</Text></View>
            </View>

            <View style={styles.photos}>
              {photos.map((photo, index) => (
                <View key={photo.key} style={[styles.photoTile, mobile && styles.photoTileMobile, index === 0 && styles.photoTileCover]}>
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
              {photos.length === 0 ? (
                <Pressable accessibilityRole="button" onPress={pickPhotos} style={({ pressed }) => [styles.photoTile, mobile && styles.photoTileMobile, styles.upload, errors.photos && styles.uploadError, pressed && { opacity: .75 }]}>
                  <View style={styles.uploadIcon}><Ionicons name="images-outline" size={25} color={colors.primary} /></View>
                  <Text style={styles.uploadTitle}>Pilih foto</Text>
                  <Text style={styles.uploadCopy}>JPG, PNG, WebP · maks. 5 MB</Text>
                </Pressable>
              ) : photos.length < 4 ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Tambah foto" onPress={pickPhotos} style={({ pressed }) => [styles.photoTile, mobile && styles.photoTileMobile, styles.upload, pressed && { opacity: .75 }]}>
                  <View style={styles.addIcon}><Ionicons name="add" size={30} color={colors.primary} /></View>
                  <Text style={styles.uploadCopy}>Tambah foto</Text>
                </Pressable>
              ) : null}
            </View>
            {errors.photos ? <Text style={styles.errorText}>{errors.photos}</Text> : null}
          </Card>

          {uploadProgress !== null ? (
            <View style={styles.progressWrap}>
              <View style={styles.progressHeader}><Text style={styles.progressLabel}>{uploadProgress < 90 ? 'Mengunggah foto…' : 'Menyimpan listing…'}</Text><Text style={styles.progressValue}>{uploadProgress}%</Text></View>
              <View style={styles.progressTrack}><View style={[styles.progressBar, { width: `${uploadProgress}%` }]} /></View>
            </View>
          ) : null}
          {mutation.isError && Object.keys(errors).length > 0 ? <InlineAlert message="Lengkapi bagian yang masih ditandai." /> : null}
          <Button title={id ? 'Simpan perubahan' : 'Publikasikan listing'} icon={id ? 'save-outline' : 'send-outline'} loading={mutation.isPending} onPress={() => mutation.mutate()} />
          <Text style={styles.reviewNote}>{isPreorder ? 'Pre-order langsung tayang dan menerima pesanan sampai deadline atau kuota habis.' : 'Listing langsung tayang. Pengguna lain tetap dapat melaporkan konten yang melanggar aturan komunitas.'}</Text>
        </View>
      </View>
      <FeedbackDialog visible={Boolean(feedback)} tone={feedback?.tone || 'success'} title={feedback?.title || ''} message={feedback?.message || ''} primaryLabel={feedback?.listingId ? 'Lihat listing' : 'OK'} onClose={() => setFeedback(null)} onPrimary={() => { const listingId = feedback?.listingId; setFeedback(null); if (listingId) router.replace({ pathname: '/(student)/listing/[id]', params: { id: listingId } }); }} />
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  column: { width: '100%', maxWidth: 860, alignSelf: 'center', gap: 18 },
  formCard: { width: '100%', gap: 22 },
  side: { width: '100%', gap: 14 },
  cardTitle: { fontFamily: 'PoppinsBold', fontSize: 21, color: colors.text },
  cardCopy: { fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 19, color: colors.muted, marginTop: 3 },
  label: { fontFamily: 'PoppinsMedium', fontSize: 14, color: colors.textSoft, marginBottom: 8 },
  segment: { flexDirection: 'row', gap: 10 },
  segmentItem: { minHeight: 64, flex: 1, borderRadius: 11, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  segmentActive: { borderColor: colors.primaryBorder, backgroundColor: colors.primarySoft },
  segmentText: { fontFamily: 'PoppinsSemiBold', fontSize: 13, color: colors.textSoft },
  segmentTextActive: { color: colors.primary },
  segmentCaption: { fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 17, color: colors.muted, marginTop: 1 },
  modeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  modeItem: { width: '48.8%', minWidth: 245, minHeight: 84, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11 },
  modeItemMobile: { width: '100%', minWidth: 0 },
  modeIcon: { width: 42, height: 42, borderRadius: 11, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  modeIconActive: { backgroundColor: colors.surface },
  preorderBox: { gap: 13, padding: 15, borderRadius: 13, borderWidth: 1, borderColor: colors.primaryBorder, backgroundColor: colors.primaryMist },
  preorderHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  preorderIcon: { width: 42, height: 42, borderRadius: 11, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  preorderTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 14, color: colors.text },
  preorderCopy: { fontFamily: 'PoppinsRegular', fontSize: 11.5, lineHeight: 17, color: colors.muted, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  serviceCategory: { alignItems: 'center', columnGap: 10 },
  serviceCategoryNote: { flexShrink: 1, fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 18, color: colors.muted },
  chip: { minHeight: 40, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, justifyContent: 'center' },
  chipActive: { borderColor: colors.primaryBorder, backgroundColor: colors.primarySoft },
  chipText: { fontFamily: 'PoppinsMedium', fontSize: 12, color: colors.textSoft },
  chipTextActive: { fontFamily: 'PoppinsSemiBold', color: colors.primary },
  deliveryHelp: { fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 18, color: colors.muted, marginTop: -4, marginBottom: 10 },
  deliveryGrid: { gap: 9 },
  deliveryOption: { minHeight: 70, padding: 13, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 11 },
  deliveryOptionActive: { borderColor: colors.primaryBorder, backgroundColor: colors.primarySoft },
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
  upload: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.primaryBorder, backgroundColor: colors.primaryMist, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12 },
  uploadError: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  uploadIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  addIcon: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  uploadTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 14, color: colors.text, marginTop: 2 },
  uploadCopy: { fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 17, textAlign: 'center', color: colors.muted },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  // Every tile (photo, placeholder, "+") shares the same size: a square photo plus the 40px action bar.
  photoTile: { position: 'relative', width: 180, height: 220, borderRadius: 14, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', backgroundColor: colors.surfaceMuted },
  photoTileMobile: { width: '47.5%', height: 210 },
  photoTileCover: { borderColor: colors.primary },
  photo: { width: '100%', flex: 1 },
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
  progressTrack: { height: 7, overflow: 'hidden', borderRadius: radius.pill, backgroundColor: colors.primarySoft },
  progressBar: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.primary },
  reviewNote: { fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 18, textAlign: 'center', color: colors.muted },
}));
