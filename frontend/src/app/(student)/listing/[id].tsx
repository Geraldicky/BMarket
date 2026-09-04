import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Button, Card, ErrorState, Field, Loader, money, Screen } from '@/components/ui';
import { colors, radius } from '@/constants/theme';
import { endpoints, errorMessage } from '@/lib/api';
import { useAuth } from '@/store/auth';
import type { CourierProvider, FulfillmentMethod } from '@/types';

const categoryLabels: Record<string, string> = {
  ELECTRONICS: 'Elektronik', BOOKS: 'Buku', FASHION: 'Fashion', FOOD: 'Makanan',
  SERVICES: 'Jasa', SPORTS: 'Olahraga', OTHER: 'Lainnya',
};
const conditionLabels: Record<string, string> = {
  NEW: 'Baru', LIKE_NEW: 'Seperti baru', GOOD: 'Kondisi baik', FAIR: 'Cukup baik',
};

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuth(state => state.user);
  const desktop = useWindowDimensions().width >= 960;
  const client = useQueryClient();
  const [quantity, setQuantity] = useState('1');
  const [note, setNote] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [fulfillmentMethod, setFulfillmentMethod] = useState<FulfillmentMethod>('CAMPUS_MEETUP');
  const [meetupCampus, setMeetupCampus] = useState('');
  const [meetupLocation, setMeetupLocation] = useState('');
  const [meetupSchedule, setMeetupSchedule] = useState('');
  const [courierProvider, setCourierProvider] = useState<CourierProvider>('GOSEND');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [recipientPhone, setRecipientPhone] = useState(user?.phone || '');

  const query = useQuery({ queryKey: ['listing', id], queryFn: () => endpoints.listing(id) });
  const checkoutOptions = useQuery({
    queryKey: ['checkout-options', id],
    queryFn: () => endpoints.checkoutOptions(id),
    enabled: checkoutOpen,
  });
  const buy = useMutation({
    mutationFn: () => {
      const amount = Number(quantity);
      if (!Number.isInteger(amount) || amount < 1) throw new Error('Jumlah pembelian minimal 1.');
      if (fulfillmentMethod === 'CAMPUS_MEETUP' && (!meetupCampus || !meetupLocation.trim() || !meetupSchedule.trim())) {
        throw new Error('Lengkapi kampus, titik temu, dan jadwal meetup.');
      }
      if (fulfillmentMethod === 'INSTANT_COURIER' && (!deliveryAddress.trim() || !recipientPhone.trim())) {
        throw new Error('Lengkapi alamat penerima dan nomor telepon.');
      }
      return endpoints.buy({
        listingId: id,
        quantity: amount,
        note: note.trim() || undefined,
        fulfillmentMethod,
        meetupCampus: fulfillmentMethod === 'CAMPUS_MEETUP' ? meetupCampus : undefined,
        meetupLocation: fulfillmentMethod === 'CAMPUS_MEETUP' ? meetupLocation.trim() : undefined,
        meetupSchedule: fulfillmentMethod === 'CAMPUS_MEETUP' ? meetupSchedule.trim() : undefined,
        courierProvider: fulfillmentMethod === 'INSTANT_COURIER' ? courierProvider : undefined,
        deliveryAddress: fulfillmentMethod === 'INSTANT_COURIER' ? deliveryAddress.trim() : undefined,
        recipientPhone: fulfillmentMethod === 'INSTANT_COURIER' ? recipientPhone.trim() : undefined,
      });
    },
    onSuccess: transaction => {
      setCheckoutOpen(false);
      client.setQueryData(['transaction', transaction.id], transaction);
      client.invalidateQueries({ queryKey: ['transactions'] });
      client.invalidateQueries({ queryKey: ['listings'] });
      client.invalidateQueries({ queryKey: ['listing', id] });
      router.push({ pathname: '/(student)/transaction/[id]', params: { id: transaction.id } });
    },
    onError: error => Alert.alert('Pembelian gagal', errorMessage(error)),
  });

  const chat = async () => {
    if (!query.data) return;
    try {
      const room = await endpoints.createRoom(query.data.sellerId);
      router.push({ pathname: '/(student)/chat/[id]', params: { id: room.id, name: query.data.seller?.name || 'Seller' } });
    } catch (error) {
      Alert.alert('Gagal membuka chat', errorMessage(error));
    }
  };

  if (query.isLoading) return <Screen><Loader /></Screen>;
  if (query.isError || !query.data) return <Screen><ErrorState message={errorMessage(query.error)} retry={() => query.refetch()} /></Screen>;

  const item = query.data;
  const mine = item.sellerId === user?.id;
  const images = item.images || [];
  const safeIndex = Math.min(activeIndex, Math.max(0, images.length - 1));
  const activeImage = images[safeIndex];
  const imageFailed = activeImage ? failedImages.includes(activeImage) : false;
  const orderQuantity = Number(quantity);
  const quantityValid = Number.isInteger(orderQuantity)
    && orderQuantity >= 1
    && (item.type === 'SERVICE' || item.stockLeft === null || item.stockLeft === undefined || orderQuantity <= item.stockLeft);
  const orderTotal = Number(item.price) * (quantityValid ? orderQuantity : 0);
  const availableMethods = item.fulfillmentMethods?.length ? item.fulfillmentMethods : ['CAMPUS_MEETUP'] as FulfillmentMethod[];
  const selectedCourier = checkoutOptions.data?.couriers.find(option => option.provider === courierProvider);
  const shippingFee = fulfillmentMethod === 'INSTANT_COURIER' ? Number(selectedCourier?.fee || 0) : 0;
  const orderGrandTotal = orderTotal + shippingFee;

  const changeImage = (direction: -1 | 1) => {
    if (images.length < 2) return;
    setActiveIndex(current => (current + direction + images.length) % images.length);
  };

  const openCheckout = () => {
    if (!quantityValid) {
      Alert.alert('Jumlah belum valid', item.type === 'PRODUCT' ? `Jumlah harus 1–${item.stockLeft || 1}.` : 'Jumlah minimal 1.');
      return;
    }
    const initialMethod = availableMethods.includes(fulfillmentMethod) ? fulfillmentMethod : availableMethods[0];
    setFulfillmentMethod(initialMethod);
    setRecipientPhone(current => current || user?.phone || '');
    setCheckoutOpen(true);
  };

  return (
    <Screen>
      <View style={styles.breadcrumb}>
        <Pressable onPress={() => router.replace('/(student)/(tabs)')}><Text style={styles.breadcrumbLink}>Beranda</Text></Pressable>
        <Ionicons name="chevron-forward" size={13} color={colors.muted} />
        <Text style={styles.breadcrumbText}>{categoryLabels[item.category] || item.category}</Text>
        <Ionicons name="chevron-forward" size={13} color={colors.muted} />
        <Text numberOfLines={1} style={[styles.breadcrumbText, styles.breadcrumbCurrent]}>{item.title}</Text>
      </View>

      <View style={[styles.columns, !desktop && styles.columnsMobile]}>
        <View style={styles.gallery}>
          <View style={styles.mainMedia}>
            {activeImage && !imageFailed ? (
              <Image
                source={activeImage}
                style={styles.mainImage}
                contentFit="contain"
                transition={180}
                cachePolicy="memory-disk"
                onError={() => setFailedImages(current => current.includes(activeImage) ? current : [...current, activeImage])}
              />
            ) : (
              <View style={styles.placeholder}>
                <View style={styles.placeholderIcon}><Ionicons name={item.type === 'SERVICE' ? 'construct-outline' : 'cube-outline'} size={52} color="#64809A" /></View>
                <Text style={styles.placeholderText}>{imageFailed ? 'Foto tidak dapat dimuat' : 'Foto belum tersedia'}</Text>
              </View>
            )}
            {images.length > 1 ? (
              <>
                <Pressable accessibilityLabel="Foto sebelumnya" onPress={() => changeImage(-1)} style={[styles.galleryArrow, styles.galleryArrowLeft]}><Ionicons name="chevron-back" size={22} color={colors.text} /></Pressable>
                <Pressable accessibilityLabel="Foto berikutnya" onPress={() => changeImage(1)} style={[styles.galleryArrow, styles.galleryArrowRight]}><Ionicons name="chevron-forward" size={22} color={colors.text} /></Pressable>
              </>
            ) : null}
            {images.length ? <View style={styles.imageCounter}><Ionicons name="images-outline" size={13} color={colors.white} /><Text style={styles.imageCounterText}>{safeIndex + 1}/{images.length}</Text></View> : null}
          </View>

          {images.length ? (
            <ScrollView horizontal style={styles.thumbScroll} contentContainerStyle={styles.thumbs} showsHorizontalScrollIndicator={false}>
              {images.map((url, index) => (
                <Pressable key={`${url}-${index}`} accessibilityLabel={`Buka foto ${index + 1}`} onPress={() => setActiveIndex(index)} style={[styles.thumbWrap, index === safeIndex && styles.thumbActive]}>
                  <Image source={url} style={styles.thumb} contentFit="cover" transition={100} cachePolicy="memory-disk" />
                  <View style={styles.thumbNumber}><Text style={styles.thumbNumberText}>{index + 1}</Text></View>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
          <Text style={styles.galleryHint}>{images.length > 1 ? 'Pilih thumbnail atau gunakan tombol panah untuk melihat foto lain.' : 'Foto ditampilkan dengan rasio asli agar detail produk tidak terpotong.'}</Text>
        </View>

        <Card style={styles.info}>
          <View style={styles.topRow}>
            <View style={styles.verified}><Ionicons name="checkmark-circle" size={14} color={colors.success} /><Text style={styles.verifiedText}>PENJUAL TERVERIFIKASI</Text></View>
            <Pressable accessibilityLabel={saved ? 'Hapus dari tersimpan' : 'Simpan listing'} onPress={() => setSaved(value => !value)} style={styles.save}><Ionicons name={saved ? 'heart' : 'heart-outline'} size={21} color={saved ? '#E5485D' : colors.textSoft} /></Pressable>
          </View>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.meta}>{conditionLabels[item.condition || ''] || (item.type === 'SERVICE' ? 'Jasa' : item.condition)} · {categoryLabels[item.category] || item.category}</Text>
          <Text style={styles.price}>{money(item.price)}</Text>

          <View style={styles.divider} />
          <Text style={styles.detailLabel}>DETAIL LISTING</Text>
          <Text style={styles.description}>{item.description}</Text>
          {item.type === 'PRODUCT' ? (
            <View style={styles.stock}><View style={styles.stockIcon}><Ionicons name="cube-outline" size={17} color={colors.primary} /></View><View><Text style={styles.stockLabel}>Stok tersedia</Text><Text style={styles.stockText}>{item.stockLeft ?? 'Tidak dibatasi'} unit</Text></View></View>
          ) : (
            <View style={styles.stock}><View style={styles.stockIcon}><Ionicons name="calendar-outline" size={17} color={colors.primary} /></View><View><Text style={styles.stockLabel}>Jenis penawaran</Text><Text style={styles.stockText}>Jasa mahasiswa</Text></View></View>
          )}

          <View style={styles.availableDelivery}>
            <Text style={styles.detailLabel}>PENYERAHAN TERSEDIA</Text>
            <View style={styles.availableDeliveryRow}>
              {availableMethods.includes('CAMPUS_MEETUP') ? <View style={styles.availableDeliveryChip}><Ionicons name="people-outline" size={15} color={colors.primary} /><Text style={styles.availableDeliveryText}>Meetup Kampus</Text></View> : null}
              {availableMethods.includes('INSTANT_COURIER') ? <View style={styles.availableDeliveryChip}><Ionicons name="bicycle-outline" size={15} color={colors.primary} /><Text style={styles.availableDeliveryText}>Kurir Instan</Text></View> : null}
            </View>
          </View>

          <View style={styles.seller}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{item.seller?.name?.[0]?.toUpperCase() || 'B'}</Text></View>
            <View style={styles.sellerBody}><Text style={styles.sellerName}>{item.seller?.name || 'Binusian'}</Text><Text style={styles.sellerMeta}>Anggota komunitas BINUS</Text></View>
            {!mine ? <Pressable onPress={chat} style={styles.chat}><Ionicons name="chatbubble-outline" size={17} color={colors.primary} /><Text style={styles.chatText}>Chat</Text></Pressable> : null}
          </View>

          {!mine ? (
            <>
              <View style={[styles.orderFields, !desktop && styles.orderFieldsMobile]}>
                <View style={styles.quantity}><Field label="Jumlah" value={quantity} onChangeText={value => setQuantity(value.replace(/[^0-9]/g, ''))} keyboardType="number-pad" /></View>
                <View style={styles.note}><Field label="Catatan (opsional)" value={note} onChangeText={setNote} placeholder="Contoh: warna tas biru, hubungi saat tiba" /></View>
              </View>
              <Button title="Lanjut ke checkout" icon="bag-check-outline" onPress={openCheckout} />
              <Button title="Laporkan listing" icon="flag-outline" variant="ghost" onPress={() => router.push({ pathname: '/(student)/report', params: { targetType: 'LISTING', targetId: id, title: item.title } })} />
            </>
          ) : (
            <Button title="Edit listing" variant="secondary" icon="create-outline" onPress={() => router.push({ pathname: '/(student)/listing/form', params: { id } })} />
          )}
        </Card>
      </View>

      <View style={styles.safety}>
        <View style={styles.safetyIcon}><Ionicons name="shield-checkmark-outline" size={22} color={colors.success} /></View>
        <View style={styles.safetyBody}><Text style={styles.safetyTitle}>Simpan kesepakatan di BMarket</Text><Text style={styles.safetyCopy}>Gunakan chat dan catat status transaksi agar detail mudah ditemukan kembali. Laporkan listing jika informasinya mencurigakan.</Text></View>
      </View>

      <Modal visible={checkoutOpen} transparent animationType="fade" onRequestClose={() => setCheckoutOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.checkoutModal}>
            <View style={styles.modalHeader}>
              <View><Text style={styles.modalEyebrow}>KONFIRMASI CHECKOUT</Text><Text style={styles.modalTitle}>Periksa pesananmu</Text></View>
              <Pressable accessibilityLabel="Tutup checkout" onPress={() => setCheckoutOpen(false)} style={styles.modalClose}><Ionicons name="close" size={21} color={colors.textSoft} /></Pressable>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.checkoutProduct}>
              <View style={styles.checkoutMedia}>
                {item.images?.[0] ? <Image source={item.images[0]} style={styles.checkoutImage} contentFit="cover" /> : <Ionicons name={item.type === 'SERVICE' ? 'construct-outline' : 'cube-outline'} size={28} color={colors.primary} />}
              </View>
              <View style={styles.checkoutProductBody}><Text numberOfLines={2} style={styles.checkoutTitle}>{item.title}</Text><Text style={styles.checkoutSeller}>Dijual oleh {item.seller?.name || 'Binusian'}</Text><Text style={styles.checkoutPrice}>{money(item.price)}</Text></View>
            </View>

            <View style={styles.fulfillmentSection}>
              <View><Text style={styles.sectionLabel}>METODE PENYERAHAN</Text><Text style={styles.sectionHelp}>Pembayaran tetap melalui BMarket agar transaksi dan biaya layanan tercatat.</Text></View>
              {checkoutOptions.isError ? <View style={styles.optionsError}><Text style={styles.optionsErrorText}>Pilihan penyerahan belum dapat dimuat.</Text><Button title="Coba lagi" variant="secondary" icon="refresh-outline" onPress={() => checkoutOptions.refetch()} /></View> : null}
              <View style={styles.fulfillmentOptions}>
                {availableMethods.includes('CAMPUS_MEETUP') ? (
                  <Pressable onPress={() => setFulfillmentMethod('CAMPUS_MEETUP')} style={[styles.fulfillmentOption, fulfillmentMethod === 'CAMPUS_MEETUP' && styles.fulfillmentOptionActive]}>
                    <View style={styles.fulfillmentIcon}><Ionicons name="people-outline" size={21} color={colors.primary} /></View>
                    <View style={styles.flex}><Text style={styles.fulfillmentTitle}>Meetup Kampus</Text><Text style={styles.fulfillmentCaption}>Gratis · dilindungi kode serah-terima</Text></View>
                    <Ionicons name={fulfillmentMethod === 'CAMPUS_MEETUP' ? 'checkmark-circle' : 'ellipse-outline'} size={21} color={fulfillmentMethod === 'CAMPUS_MEETUP' ? colors.primary : colors.borderStrong} />
                  </Pressable>
                ) : null}
                {availableMethods.includes('INSTANT_COURIER') ? (
                  <Pressable onPress={() => setFulfillmentMethod('INSTANT_COURIER')} style={[styles.fulfillmentOption, fulfillmentMethod === 'INSTANT_COURIER' && styles.fulfillmentOptionActive]}>
                    <View style={styles.fulfillmentIcon}><Ionicons name="bicycle-outline" size={21} color={colors.primary} /></View>
                    <View style={styles.flex}><Text style={styles.fulfillmentTitle}>Kurir Instan</Text><Text style={styles.fulfillmentCaption}>Ongkir simulasi · estimasi 1–3 jam</Text></View>
                    <Ionicons name={fulfillmentMethod === 'INSTANT_COURIER' ? 'checkmark-circle' : 'ellipse-outline'} size={21} color={fulfillmentMethod === 'INSTANT_COURIER' ? colors.primary : colors.borderStrong} />
                  </Pressable>
                ) : null}
              </View>

              {fulfillmentMethod === 'CAMPUS_MEETUP' ? (
                <View style={styles.deliveryFields}>
                  <Text style={styles.fieldLabel}>Pilih kampus</Text>
                  <View style={styles.campusChips}>
                    {(checkoutOptions.data?.campuses || []).map(campus => (
                      <Pressable key={campus} onPress={() => setMeetupCampus(campus)} style={[styles.campusChip, meetupCampus === campus && styles.campusChipActive]}><Text style={[styles.campusChipText, meetupCampus === campus && styles.campusChipTextActive]}>{campus.replace('BINUS @', '')}</Text></Pressable>
                    ))}
                  </View>
                  {checkoutOptions.isLoading ? <Text style={styles.loadingOptions}>Memuat pilihan kampus…</Text> : null}
                  <Field label="Titik temu" value={meetupLocation} onChangeText={setMeetupLocation} placeholder="Contoh: Lobby Anggrek, dekat resepsionis" />
                  <Field label="Jadwal meetup" value={meetupSchedule} onChangeText={setMeetupSchedule} placeholder="Contoh: Jumat, 6 September · 13.00 WIB" />
                </View>
              ) : (
                <View style={styles.deliveryFields}>
                  <Text style={styles.fieldLabel}>Pilih layanan kurir</Text>
                  <View style={styles.courierOptions}>
                    {(checkoutOptions.data?.couriers || []).map(courier => (
                      <Pressable key={courier.provider} onPress={() => setCourierProvider(courier.provider)} style={[styles.courierOption, courierProvider === courier.provider && styles.courierOptionActive]}>
                        <View><Text style={styles.courierName}>{courier.label}</Text><Text style={styles.courierEta}>{courier.eta}</Text></View><Text style={styles.courierFee}>{money(courier.fee)}</Text>
                      </Pressable>
                    ))}
                  </View>
                  {checkoutOptions.isLoading ? <Text style={styles.loadingOptions}>Menghitung ongkir simulasi…</Text> : null}
                  <Field label="Alamat penerima" multiline value={deliveryAddress} onChangeText={setDeliveryAddress} placeholder="Tulis alamat lengkap dan petunjuk lokasi" />
                  <Field label="Nomor telepon penerima" value={recipientPhone} onChangeText={setRecipientPhone} keyboardType="phone-pad" placeholder="08xxxxxxxxxx" />
                </View>
              )}
            </View>

            <View style={styles.checkoutRows}>
              <View style={styles.checkoutRow}><Text style={styles.checkoutLabel}>Harga satuan</Text><Text style={styles.checkoutValue}>{money(item.price)}</Text></View>
              <View style={styles.checkoutRow}><Text style={styles.checkoutLabel}>Jumlah</Text><Text style={styles.checkoutValue}>{orderQuantity}</Text></View>
              <View style={styles.checkoutRow}><Text style={styles.checkoutLabel}>Subtotal</Text><Text style={styles.checkoutValue}>{money(orderTotal)}</Text></View>
              <View style={styles.checkoutRow}><Text style={styles.checkoutLabel}>Ongkir</Text><Text style={styles.checkoutValue}>{shippingFee ? money(shippingFee) : 'Gratis'}</Text></View>
              <View style={styles.checkoutDivider} />
              <View style={styles.checkoutRow}><Text style={styles.checkoutTotalLabel}>Total pembayaran</Text><Text style={styles.checkoutTotal}>{money(orderGrandTotal)}</Text></View>
            </View>

            {note.trim() ? <View style={styles.checkoutNote}><Ionicons name="document-text-outline" size={17} color={colors.primary} /><View style={styles.flex}><Text style={styles.checkoutNoteLabel}>Catatan untuk seller</Text><Text style={styles.checkoutNoteText}>{note.trim()}</Text></View></View> : null}
            <View style={styles.escrowInfo}><Ionicons name="shield-checkmark-outline" size={21} color={colors.success} /><Text style={styles.escrowText}>Setelah checkout, stok akan direservasi. Pembayaran dilakukan dari saldo BMarket dan disimpan di escrow hingga pesanan selesai.</Text></View>
            </ScrollView>

            <View style={styles.modalActions}>
              <Button title="Kembali" variant="ghost" disabled={buy.isPending} onPress={() => setCheckoutOpen(false)} style={styles.modalButton} />
              <Button title="Buat pesanan" icon="arrow-forward" loading={buy.isPending} disabled={checkoutOptions.isLoading || checkoutOptions.isError} onPress={() => buy.mutate()} style={styles.modalButtonPrimary} />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  breadcrumbLink: { fontFamily: 'PoppinsMedium', fontSize: 12, color: colors.primary },
  breadcrumbText: { fontFamily: 'PoppinsRegular', fontSize: 12, color: colors.muted },
  breadcrumbCurrent: { flex: 1 },
  columns: { flexDirection: 'row', gap: 24, alignItems: 'flex-start' },
  columnsMobile: { flexDirection: 'column' },
  gallery: { flex: 1.15, width: '100%', minWidth: 320, gap: 13 },
  mainMedia: { position: 'relative', width: '100%', aspectRatio: 1.15, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: '#E7EEF5' },
  mainImage: { width: '100%', height: '100%', backgroundColor: colors.surface },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  placeholderIcon: { width: 92, height: 92, borderRadius: 46, backgroundColor: 'rgba(255,255,255,.58)', alignItems: 'center', justifyContent: 'center' },
  placeholderText: { fontFamily: 'PoppinsMedium', fontSize: 13, color: colors.muted },
  galleryArrow: { position: 'absolute', top: '45%', width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,.94)', alignItems: 'center', justifyContent: 'center', shadowColor: '#18324A', shadowOpacity: 0.14, shadowRadius: 9, shadowOffset: { width: 0, height: 3 } },
  galleryArrowLeft: { left: 14 },
  galleryArrowRight: { right: 14 },
  imageCounter: { position: 'absolute', right: 14, bottom: 14, minHeight: 32, paddingHorizontal: 11, borderRadius: 16, backgroundColor: 'rgba(16,42,67,.84)', flexDirection: 'row', alignItems: 'center', gap: 6 },
  imageCounterText: { fontFamily: 'PoppinsSemiBold', fontSize: 11, color: colors.white },
  thumbScroll: { flexGrow: 0 },
  thumbs: { gap: 10, paddingVertical: 1 },
  thumbWrap: { position: 'relative', width: 92, height: 78, borderRadius: 12, padding: 3, borderWidth: 2, borderColor: 'transparent', backgroundColor: colors.surface },
  thumbActive: { borderColor: colors.primary },
  thumb: { width: '100%', height: '100%', borderRadius: 8 },
  thumbNumber: { position: 'absolute', right: 6, bottom: 6, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(16,42,67,.76)', alignItems: 'center', justifyContent: 'center' },
  thumbNumberText: { fontFamily: 'PoppinsSemiBold', fontSize: 9, color: colors.white },
  galleryHint: { fontFamily: 'PoppinsRegular', fontSize: 11, lineHeight: 17, color: colors.muted },
  info: { flex: 1, width: '100%', minWidth: 340, gap: 16 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.successSoft },
  verifiedText: { fontFamily: 'PoppinsBold', fontSize: 10, color: colors.success },
  save: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'PoppinsBold', fontSize: 29, lineHeight: 38, color: colors.text },
  meta: { fontFamily: 'PoppinsRegular', fontSize: 12, color: colors.muted },
  price: { fontFamily: 'PoppinsBold', fontSize: 31, color: colors.primaryDark },
  divider: { height: 1, backgroundColor: colors.border },
  detailLabel: { fontFamily: 'PoppinsBold', fontSize: 10, letterSpacing: 0.65, color: colors.muted },
  description: { fontFamily: 'PoppinsRegular', fontSize: 14, lineHeight: 24, color: colors.textSoft },
  stock: { minHeight: 70, padding: 12, borderRadius: 12, backgroundColor: colors.primarySoft, flexDirection: 'row', alignItems: 'center', gap: 11 },
  stockIcon: { width: 42, height: 42, borderRadius: 11, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  stockLabel: { fontFamily: 'PoppinsRegular', fontSize: 10, color: colors.muted },
  stockText: { fontFamily: 'PoppinsSemiBold', fontSize: 13, color: colors.text },
  availableDelivery: { gap: 8 },
  availableDeliveryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  availableDeliveryChip: { minHeight: 36, paddingHorizontal: 11, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 6 },
  availableDeliveryText: { fontFamily: 'PoppinsMedium', fontSize: 10, color: colors.textSoft },
  seller: { minHeight: 86, borderRadius: 13, backgroundColor: colors.background, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'PoppinsBold', fontSize: 16, color: colors.primary },
  sellerBody: { flex: 1 },
  sellerName: { fontFamily: 'PoppinsSemiBold', fontSize: 14, color: colors.text },
  sellerMeta: { fontFamily: 'PoppinsRegular', fontSize: 10, color: colors.muted },
  chat: { minHeight: 42, paddingHorizontal: 14, borderRadius: 10, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 7 },
  chatText: { fontFamily: 'PoppinsSemiBold', fontSize: 11, color: colors.primary },
  orderFields: { flexDirection: 'row', gap: 12 },
  orderFieldsMobile: { flexDirection: 'column' },
  quantity: { width: 108 },
  note: { flex: 1 },
  safety: { minHeight: 96, borderRadius: 14, backgroundColor: colors.successSoft, borderWidth: 1, borderColor: '#CDEBDD', padding: 20, flexDirection: 'row', alignItems: 'center', gap: 14 },
  safetyIcon: { width: 48, height: 48, borderRadius: 13, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  safetyBody: { flex: 1 },
  safetyTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 14, color: colors.text },
  safetyCopy: { fontFamily: 'PoppinsRegular', fontSize: 11, lineHeight: 18, color: colors.muted, marginTop: 3 },
  modalBackdrop: { flex: 1, padding: 18, backgroundColor: 'rgba(10,26,41,.58)', alignItems: 'center', justifyContent: 'center' },
  checkoutModal: { width: '100%', maxWidth: 560, maxHeight: '92%', padding: 24, borderRadius: 18, backgroundColor: colors.surface, gap: 18, shadowColor: '#071727', shadowOpacity: 0.22, shadowRadius: 26, shadowOffset: { width: 0, height: 12 } },
  modalScroll: { flexShrink: 1 },
  modalScrollContent: { gap: 18, paddingBottom: 2 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  modalEyebrow: { fontFamily: 'PoppinsBold', fontSize: 10, letterSpacing: 0.8, color: colors.primary },
  modalTitle: { fontFamily: 'PoppinsBold', fontSize: 24, lineHeight: 32, color: colors.text },
  modalClose: { width: 40, height: 40, borderRadius: 11, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkoutProduct: { minHeight: 104, padding: 12, borderRadius: 13, backgroundColor: colors.background, flexDirection: 'row', alignItems: 'center', gap: 13 },
  checkoutMedia: { width: 86, height: 80, borderRadius: 11, overflow: 'hidden', backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  checkoutImage: { width: '100%', height: '100%' },
  checkoutProductBody: { flex: 1, gap: 3 },
  checkoutTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 14, lineHeight: 20, color: colors.text },
  checkoutSeller: { fontFamily: 'PoppinsRegular', fontSize: 10, color: colors.muted },
  checkoutPrice: { fontFamily: 'PoppinsBold', fontSize: 15, color: colors.primaryDark, marginTop: 2 },
  fulfillmentSection: { gap: 12 },
  sectionLabel: { fontFamily: 'PoppinsBold', fontSize: 10, letterSpacing: 0.7, color: colors.primary },
  sectionHelp: { fontFamily: 'PoppinsRegular', fontSize: 10, lineHeight: 16, color: colors.muted, marginTop: 2 },
  optionsError: { padding: 12, borderRadius: 11, backgroundColor: colors.dangerSoft, gap: 9 },
  optionsErrorText: { fontFamily: 'PoppinsMedium', fontSize: 10, color: colors.danger },
  fulfillmentOptions: { gap: 8 },
  fulfillmentOption: { minHeight: 68, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 10 },
  fulfillmentOptionActive: { borderColor: '#A8C8EF', backgroundColor: colors.primarySoft },
  fulfillmentIcon: { width: 42, height: 42, borderRadius: 11, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  fulfillmentTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 12, color: colors.text },
  fulfillmentCaption: { fontFamily: 'PoppinsRegular', fontSize: 9, lineHeight: 14, color: colors.muted, marginTop: 1 },
  deliveryFields: { gap: 10, padding: 13, borderRadius: 12, backgroundColor: colors.background },
  fieldLabel: { fontFamily: 'PoppinsMedium', fontSize: 12, color: colors.textSoft },
  campusChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  campusChip: { minHeight: 34, paddingHorizontal: 11, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, justifyContent: 'center' },
  campusChipActive: { borderColor: '#A8C8EF', backgroundColor: colors.primarySoft },
  campusChipText: { fontFamily: 'PoppinsMedium', fontSize: 10, color: colors.textSoft },
  campusChipTextActive: { fontFamily: 'PoppinsSemiBold', color: colors.primary },
  loadingOptions: { fontFamily: 'PoppinsRegular', fontSize: 10, color: colors.muted },
  courierOptions: { gap: 7 },
  courierOption: { minHeight: 56, padding: 11, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  courierOptionActive: { borderColor: '#A8C8EF', backgroundColor: colors.primarySoft },
  courierName: { fontFamily: 'PoppinsSemiBold', fontSize: 11, color: colors.text },
  courierEta: { fontFamily: 'PoppinsRegular', fontSize: 9, color: colors.muted, marginTop: 1 },
  courierFee: { fontFamily: 'PoppinsBold', fontSize: 12, color: colors.primaryDark },
  checkoutRows: { gap: 11 },
  checkoutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  checkoutLabel: { fontFamily: 'PoppinsRegular', fontSize: 13, color: colors.muted },
  checkoutValue: { fontFamily: 'PoppinsSemiBold', fontSize: 13, color: colors.text },
  checkoutDivider: { height: 1, backgroundColor: colors.border },
  checkoutTotalLabel: { fontFamily: 'PoppinsSemiBold', fontSize: 14, color: colors.text },
  checkoutTotal: { fontFamily: 'PoppinsBold', fontSize: 21, color: colors.primaryDark },
  checkoutNote: { padding: 13, borderRadius: 11, backgroundColor: colors.primarySoft, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkoutNoteLabel: { fontFamily: 'PoppinsSemiBold', fontSize: 11, color: colors.text },
  checkoutNoteText: { fontFamily: 'PoppinsRegular', fontSize: 11, lineHeight: 17, color: colors.textSoft, marginTop: 2 },
  escrowInfo: { padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#CDEBDD', backgroundColor: colors.successSoft, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  escrowText: { flex: 1, fontFamily: 'PoppinsRegular', fontSize: 11, lineHeight: 18, color: colors.textSoft },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalButton: { flex: 1 },
  modalButtonPrimary: { flex: 1.5 },
  flex: { flex: 1 },
});
