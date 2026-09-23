import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { Button, Card, ErrorState, FeedbackDialog, Field, InlineAlert, Loader, money, Screen } from '@/components/ui';
import { colors, radius, makeStyles } from '@/constants/theme';
import { endpoints, errorMessage } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { CATEGORY_LABELS, CONDITION_LABELS, LISTING_MODE_LABELS } from '@/lib/domain-metadata';
import { ListingImageFallback } from '@/components/listing-image-fallback';
import { UserAvatar } from '@/components/user-avatar';

const categoryLabels = CATEGORY_LABELS;
const conditionLabels = CONDITION_LABELS;

const modeLabels = LISTING_MODE_LABELS;

function fullDate(value?: string | null) {
  if (!value) return '—';
  try { return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); } catch { return value; }
}

export default function ListingDetailScreen() {
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuth(state => state.user);
  const width = useWindowDimensions().width;
  const wide = width >= 760;
  const mobile = width < 600;
  const client = useQueryClient();
  const [quantity, setQuantity] = useState('1');
  const [note, setNote] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'warning' | 'danger'; title: string; message: string } | null>(null);

  const query = useQuery({ queryKey: ['listing', id], queryFn: () => endpoints.listing(id) });
  const sellerTrust = useQuery({
    queryKey: ['seller-profile', query.data?.sellerId],
    queryFn: () => endpoints.userProfile(query.data!.sellerId),
    enabled: Boolean(query.data?.sellerId),
  });
  const savedStatus = useQuery({ queryKey: ['saved-status', id], queryFn: () => endpoints.savedStatus(id) });
  const saveMutation = useMutation({
    mutationFn: () => savedStatus.data?.saved ? endpoints.unsaveListing(id) : endpoints.saveListing(id),
    onSuccess: () => { client.invalidateQueries({ queryKey: ['saved-status', id] }); client.invalidateQueries({ queryKey: ['wishlist'] }); },
    onError: error => setFeedback({ tone: 'danger', title: 'Tersimpan belum diperbarui', message: errorMessage(error) }),
  });
  useEffect(() => { if (id) endpoints.recordRecent(id).catch(() => undefined); }, [id]);

  const buy = useMutation({
    mutationFn: () => {
      const amount = Number(quantity);
      if (!Number.isInteger(amount) || amount < 1) throw new Error('Jumlah pembelian minimal 1.');
      return endpoints.buy({
        listingId: id,
        quantity: amount,
        note: note.trim() || undefined,
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
    onError: () => undefined,
  });

  const chat = async () => {
    if (!query.data) return;
    try {
      const room = await endpoints.createRoom(query.data.sellerId);
      router.push({ pathname: '/(student)/chat/[id]', params: { id: room.id, name: query.data.seller?.name || 'Seller' } });
    } catch (error) {
      setFeedback({ tone: 'danger', title: 'Chat belum dapat dibuka', message: errorMessage(error) });
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
  const preorderOpen = item.mode !== 'PREORDER' || Boolean(item.preorderAccepting);
  const availableUnits = item.mode === 'ONE_OFF'
    ? (item.status === 'SOLD' ? 0 : 1)
    : item.mode === 'SERVICE'
      ? 99
      : Math.max(0, Number(item.stockLeft ?? 0));
  const buyerLimit = item.mode === 'PREORDER' && item.preorderMaxPerBuyer
    ? Math.min(availableUnits, item.preorderMaxPerBuyer)
    : availableUnits;
  const preorderQuota = item.mode === 'PREORDER' ? Number(item.preorderQuota ?? item.stock ?? 0) : 0;
  const preorderOrdered = item.mode === 'PREORDER' ? Math.max(0, preorderQuota - Number(item.stockLeft ?? 0)) : 0;
  const preorderProgress = preorderQuota > 0 ? Math.min(100, Math.round((preorderOrdered / preorderQuota) * 100)) : 0;
  const canOrder = item.status === 'ACTIVE'
    && preorderOpen
    && (item.mode === 'SERVICE' || buyerLimit > 0);
  const quantityValid = Number.isInteger(orderQuantity)
    && orderQuantity >= 1
    && (item.mode === 'SERVICE' || orderQuantity <= buyerLimit);
  const orderTotal = Number(item.price) * (quantityValid ? orderQuantity : 0);
  const orderGrandTotal = orderTotal;

  const changeImage = (direction: -1 | 1) => {
    if (images.length < 2) return;
    setActiveIndex(current => (current + direction + images.length) % images.length);
  };

  const adjustQuantity = (delta: number) => {
    const current = Number(quantity) || 1;
    const max = item.mode === 'SERVICE' ? 99 : Math.max(1, buyerLimit);
    setQuantity(String(Math.min(max, Math.max(1, current + delta))));
  };

  const openCheckout = () => {
    if (!canOrder) {
      setFeedback({ tone: 'warning', title: item.mode === 'PREORDER' ? 'Pre-order tidak menerima pesanan' : 'Produk belum tersedia', message: item.mode === 'PREORDER' ? 'Deadline sudah lewat, PO ditutup seller, atau kuotanya sudah penuh.' : 'Stok produk sedang habis.' });
      return;
    }
    if (!quantityValid) {
      setFeedback({ tone: 'warning', title: 'Jumlah belum valid', message: item.mode === 'SERVICE' ? 'Jumlah minimal 1.' : `Jumlah harus 1–${Math.max(1, buyerLimit)}.` });
      return;
    }
    buy.reset();
    setCheckoutOpen(true);
  };

  const closeCheckout = () => {
    if (buy.isPending) return;
    buy.reset();
    setCheckoutOpen(false);
  };

  return (
    <Screen style={styles.page}>
      <View style={styles.breadcrumb}>
        <Pressable onPress={() => router.replace('/(student)/(tabs)')}><Text style={styles.breadcrumbLink}>Beranda</Text></Pressable>
        <Ionicons name="chevron-forward" size={13} color={colors.muted} />
        <Text style={styles.breadcrumbText}>{categoryLabels[item.category] || item.category}</Text>
        <Ionicons name="chevron-forward" size={13} color={colors.muted} />
        <Text numberOfLines={1} style={[styles.breadcrumbText, styles.breadcrumbCurrent]}>{item.title}</Text>
      </View>

      <View style={[styles.columns, !wide &&styles.columnsMobile]}>
        <View style={[styles.gallery, !wide &&styles.galleryMobile]}>
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
                <View style={styles.placeholderIcon}><ListingImageFallback type={item.type} category={item.category} size={52} /></View>
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

        <Card style={[styles.purchaseCard, !wide &&styles.purchaseCardMobile]}>
          <View style={styles.topRow}>
            <View style={styles.badgeRow}>
              <View style={styles.typeBadge}><Ionicons name={item.mode === 'PREORDER' ? 'calendar-outline' : item.mode === 'SERVICE' ? 'construct-outline' : item.mode === 'STOCKED' ? 'layers-outline' : 'cube-outline'} size={14} color={colors.primary} /><Text style={styles.typeBadgeText}>{modeLabels[item.mode] || (item.type === 'SERVICE' ? 'JASA' : 'BARANG')}</Text></View>
              {item.seller?.isVerified ? <View style={styles.verified}><Ionicons name="checkmark-circle" size={14} color={colors.success} /><Text style={styles.verifiedText}>SELLER TERVERIFIKASI</Text></View> : null}
            </View>
            {!mine ? <Pressable accessibilityLabel={savedStatus.data?.saved ? 'Hapus dari tersimpan' : 'Simpan listing'} disabled={savedStatus.isLoading || saveMutation.isPending} onPress={() => saveMutation.mutate()} style={[styles.save, (savedStatus.isLoading || saveMutation.isPending) && { opacity: 0.55 }]}><Ionicons name={savedStatus.data?.saved ? 'heart' : 'heart-outline'} size={21} color={savedStatus.data?.saved ? colors.heart : colors.textSoft} /></Pressable> : null}
          </View>

          <View style={styles.productHeading}>
            <Text style={[styles.title, mobile && styles.titleMobile]}>{item.title}</Text>
            <Text style={styles.meta}>{item.condition ? `${conditionLabels[item.condition] || item.condition} · ` : item.type === 'SERVICE' ? 'Jasa mahasiswa · ' : ''}{categoryLabels[item.category] || item.category}</Text>
            <Text style={[styles.price, mobile && styles.priceMobile]}>{money(item.price)}</Text>
          </View>

          <View style={[styles.factGrid, mobile && styles.factGridMobile]}>
            <View style={styles.factItem}>
              <View style={styles.factIcon}><Ionicons name={item.mode === 'PREORDER' ? 'calendar-outline' : item.mode === 'STOCKED' ? 'layers-outline' : item.mode === 'SERVICE' ? 'construct-outline' : 'cube-outline'} size={18} color={colors.primary} /></View>
              <View style={styles.flex}><Text style={styles.factLabel}>{item.mode === 'PREORDER' ? 'Kuota tersisa' : item.mode === 'STOCKED' ? 'Stok tersedia' : item.mode === 'ONE_OFF' ? 'Ketersediaan' : 'Jenis penawaran'}</Text><Text style={styles.factValue}>{item.mode === 'PREORDER' ? `${item.stockLeft ?? 0} / ${item.preorderQuota ?? item.stock ?? 0} unit` : item.mode === 'STOCKED' ? `${item.stockLeft ?? 0} unit` : item.mode === 'ONE_OFF' ? (item.status === 'SOLD' ? 'Sudah terjual' : '1 unit') : 'Jasa mahasiswa'}</Text></View>
            </View>
            {item.mode !== 'SERVICE' ? <View style={styles.factItem}>
              <View style={styles.factIcon}><Ionicons name="swap-horizontal-outline" size={18} color={colors.primary} /></View>
              <View style={styles.flex}><Text style={styles.factLabel}>Penyerahan</Text><Text style={styles.factValue}>Meetup langsung</Text></View>
            </View> : null}
          </View>

          {item.mode === 'PREORDER' ? (
            <View style={[styles.preorderPanel, !preorderOpen && styles.preorderPanelClosed]}>
              <View style={styles.preorderPanelHeader}><View style={styles.preorderPanelIcon}><Ionicons name="calendar-outline" size={19} color={colors.primary} /></View><View style={styles.flex}><Text style={styles.preorderPanelTitle}>{preorderOpen ? 'Pre-order sedang dibuka' : item.preorderStatus === 'READY' ? 'Pesanan siap diambil' : 'Pre-order sudah ditutup'}</Text><Text style={styles.preorderPanelCopy}>Deadline {fullDate(item.preorderDeadline)}</Text></View></View>
              <View style={styles.preorderProgressRow}><Text style={styles.preorderProgressText}>{preorderOrdered} / {preorderQuota} unit dipesan</Text><Text style={styles.preorderProgressText}>{preorderProgress}%</Text></View>
              <View style={styles.preorderProgressTrack}><View style={[styles.preorderProgressFill, { width: `${preorderProgress}%` as `${number}%` }]} /></View>
              <View style={styles.preorderFacts}>
                <View style={styles.preorderFact}><Text style={styles.preorderFactLabel}>Estimasi siap</Text><Text style={styles.preorderFactValue}>{fullDate(item.preorderReadyAt)}</Text></View>
                <View style={styles.preorderFact}><Text style={styles.preorderFactLabel}>Minimum</Text><Text style={styles.preorderFactValue}>{item.preorderMinOrder ? `${item.preorderMinOrder} unit` : 'Tidak ada'}</Text></View>
                <View style={styles.preorderFact}><Text style={styles.preorderFactLabel}>Maks. / buyer</Text><Text style={styles.preorderFactValue}>{item.preorderMaxPerBuyer ? `${item.preorderMaxPerBuyer} unit` : 'Tidak dibatasi'}</Text></View>
              </View>
              {item.preorderPickupLocation ? <View style={styles.preorderPickup}><Ionicons name="location-outline" size={16} color={colors.primary} /><Text style={styles.preorderPickupText}>{item.preorderPickupLocation}</Text></View> : null}
            </View>
          ) : null}

          <Pressable onPress={() => router.push({ pathname: '/(student)/seller/[id]', params: { id: item.sellerId } })} style={styles.seller}>
            <UserAvatar name={item.seller?.name} avatarUrl={item.seller?.avatarUrl} style={styles.avatar} textStyle={styles.avatarText} />
            <View style={styles.sellerBody}>
              <Text style={styles.sellerEyebrow}>DIJUAL OLEH</Text>
              <Text style={styles.sellerName}>{item.seller?.name || 'Binusian'}</Text>
              <View style={styles.sellerTrustRow}><Ionicons name="star" size={13} color="#F4A928" /><Text style={styles.sellerRating}>{sellerTrust.data?.totalReviews ? sellerTrust.data.avgRating.toFixed(1) : 'Baru'}</Text><Text style={styles.sellerMeta}>{sellerTrust.data?.totalReviews ? `(${sellerTrust.data.totalReviews}) · ${sellerTrust.data.completedSales} transaksi selesai` : 'Belum ada review'}</Text></View>
            </View>
            {!mine ? <Pressable onPress={event => { event.stopPropagation(); chat(); }} style={styles.chat}><Ionicons name="chatbubble-outline" size={17} color={colors.primary} /><Text style={styles.chatText}>Chat</Text></Pressable> : <Ionicons name="chevron-forward" size={18} color={colors.muted} />}
          </Pressable>

          {!mine ? (
            <View style={styles.purchaseSection}>
              <View style={styles.quantityRow}>
                <View style={styles.quantityCopy}><Text style={styles.quantityLabel}>Jumlah</Text><Text style={styles.quantityHint}>{item.mode === 'SERVICE' ? 'Minimal 1' : item.mode === 'ONE_OFF' ? 'Barang satuan · maks. 1' : `Maks. ${Math.max(0, buyerLimit)} unit`}</Text></View>
                <View style={styles.stepper}>
                  <Pressable accessibilityLabel="Kurangi jumlah" onPress={() => adjustQuantity(-1)} style={styles.stepperButton}><Ionicons name="remove" size={18} color={colors.textSoft} /></Pressable>
                  <View style={styles.stepperValue}><Text style={styles.stepperValueText}>{quantity || '1'}</Text></View>
                  <Pressable accessibilityLabel="Tambah jumlah" onPress={() => adjustQuantity(1)} style={styles.stepperButton}><Ionicons name="add" size={18} color={colors.primary} /></Pressable>
                </View>
              </View>
              <Field label="Catatan untuk seller (opsional)" value={note} onChangeText={setNote} placeholder="Contoh: warna tas biru, hubungi saat tiba" />
              <View style={styles.orderPreview}>
                <View><Text style={styles.orderPreviewLabel}>Estimasi subtotal</Text><Text style={styles.orderPreviewHint}>{quantityValid ? `${orderQuantity} × ${money(item.price)}` : 'Periksa jumlah pembelian'}</Text></View>
                <Text style={styles.orderPreviewTotal}>{quantityValid ? money(orderTotal) : '—'}</Text>
              </View>
              {canOrder ? <Button title={item.mode === 'PREORDER' ? 'Ikut pre-order' : 'Lanjut ke checkout'} icon={item.mode === 'PREORDER' ? 'calendar-outline' : 'bag-check-outline'} onPress={openCheckout} /> : <View style={styles.unavailable}><Ionicons name={item.mode === 'PREORDER' ? 'time-outline' : 'cube-outline'} size={18} color={colors.warning} /><View style={styles.flex}><Text style={styles.unavailableTitle}>{item.mode === 'PREORDER' ? 'Pre-order tidak menerima pesanan baru' : 'Stok sedang habis'}</Text><Text style={styles.unavailableText}>{item.mode === 'PREORDER' ? 'PO mungkin sudah ditutup, deadline terlewati, atau kuota penuh.' : 'Seller dapat menambahkan stok kembali pada katalog yang sama.'}</Text></View></View>}
              <Pressable onPress={() => router.push({ pathname: '/(student)/report', params: { targetType: 'LISTING', targetId: id, title: item.title } })} style={styles.reportAction}><Ionicons name="flag-outline" size={15} color={colors.muted} /><Text style={styles.reportActionText}>Laporkan listing</Text></Pressable>
            </View>
          ) : (
            <Button title="Edit listing" variant="secondary" icon="create-outline" onPress={() => router.push({ pathname: '/(student)/listing/form', params: { id } })} />
          )}
        </Card>
      </View>

      <Card style={styles.descriptionCard}>
        <View style={styles.descriptionHeader}>
          <View style={styles.descriptionIcon}><Ionicons name="document-text-outline" size={19} color={colors.primary} /></View>
          <View><Text style={styles.descriptionTitle}>Deskripsi listing</Text><Text style={styles.descriptionSubtitle}>Detail yang ditulis oleh seller</Text></View>
        </View>
        <View style={styles.descriptionDivider} />
        <Text style={styles.description}>{item.description}</Text>
        {item.mode === 'PREORDER' && item.preorderPickupNote ? <View style={styles.preorderNote}><Ionicons name="information-circle-outline" size={18} color={colors.primary} /><View style={styles.flex}><Text style={styles.preorderNoteLabel}>CATATAN PRE-ORDER</Text><Text style={styles.preorderNoteText}>{item.preorderPickupNote}</Text></View></View> : null}
        {item.mode !== 'SERVICE' ? <View style={styles.deliverySummary}>
          <Text style={styles.detailLabel}>METODE PENYERAHAN</Text>
          <View style={styles.availableDeliveryRow}>
            <View style={styles.availableDeliveryChip}><Ionicons name="people-outline" size={15} color={colors.primary} /><Text style={styles.availableDeliveryText}>Meetup langsung · koordinasi lewat chat</Text></View>
          </View>
        </View> : null}
      </Card>

      <Modal visible={checkoutOpen} transparent animationType="fade" onRequestClose={closeCheckout}>
        <View style={[styles.modalBackdrop, mobile && styles.modalBackdropMobile]}>
          <View style={[styles.checkoutModal, mobile && styles.checkoutModalMobile]}>
            <View style={styles.modalHeader}>
              <View><Text style={styles.modalEyebrow}>CHECKOUT BMARKET</Text><Text style={styles.modalTitle}>Periksa pesananmu</Text><Text style={styles.modalSubtitle}>{item.mode === 'PREORDER' ? 'Pesanan akan tercatat sebagai pre-order dan pembayaran ditahan di escrow.' : item.mode === 'SERVICE' ? 'Pastikan jumlah pesanan jasa sudah sesuai.' : 'Meetup dikoordinasikan lewat chat setelah pembayaran.'}</Text></View>
              <Pressable accessibilityLabel="Tutup checkout" onPress={closeCheckout} style={styles.modalClose}><Ionicons name="close" size={21} color={colors.textSoft} /></Pressable>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.checkoutProduct}>
              <View style={styles.checkoutMedia}>
                {item.images?.[0] ? <Image source={item.images[0]} style={styles.checkoutImage} contentFit="cover" /> : <ListingImageFallback type={item.type} category={item.category} size={28} color={colors.primary} />}
              </View>
              <View style={styles.checkoutProductBody}><Text numberOfLines={2} style={styles.checkoutTitle}>{item.title}</Text><Text style={styles.checkoutSeller}>Dijual oleh {item.seller?.name || 'Binusian'}</Text><Text style={styles.checkoutPrice}>{money(item.price)}</Text></View>
            </View>

            {item.mode === 'SERVICE' ? (
              <View style={styles.meetupChatInfo}>
                <View style={styles.meetupChatIcon}><Ionicons name="chatbubbles-outline" size={21} color={colors.primary} /></View>
                <View style={styles.flex}>
                  <Text style={styles.meetupChatTitle}>Detail jasa diatur lewat chat</Text>
                  <Text style={styles.meetupChatText}>Setelah checkout, hubungi seller untuk menyepakati jadwal dan detail pengerjaan jasa. Pembayaran tetap aman melalui escrow BMarket.</Text>
                </View>
              </View>
            ) : <View style={styles.fulfillmentSection}>
              <View><Text style={styles.sectionLabel}>MEETUP LANGSUNG</Text><Text style={styles.sectionHelp}>Tidak ada ongkir. Jadwal dan lokasi disepakati dengan seller lewat chat.</Text></View>
              <View style={styles.meetupChatInfo}>
                <View style={styles.meetupChatIcon}><Ionicons name="chatbubbles-outline" size={21} color={colors.primary} /></View>
                <View style={styles.flex}>
                  <Text style={styles.meetupChatTitle}>Koordinasikan meetup setelah checkout</Text>
                  <Text style={styles.meetupChatText}>Saat barang sudah kamu terima, buat kode serah-terima dan berikan 6 angka tersebut kepada seller.</Text>
                </View>
              </View>
            </View>}

            <View style={styles.checkoutRows}>
              <View style={styles.checkoutRow}><Text style={styles.checkoutLabel}>Harga satuan</Text><Text style={styles.checkoutValue}>{money(item.price)}</Text></View>
              <View style={styles.checkoutRow}><Text style={styles.checkoutLabel}>Jumlah</Text><Text style={styles.checkoutValue}>{orderQuantity}</Text></View>
              <View style={styles.checkoutRow}><Text style={styles.checkoutLabel}>Subtotal</Text><Text style={styles.checkoutValue}>{money(orderTotal)}</Text></View>
              <View style={styles.checkoutDivider} />
              <View style={styles.checkoutRow}><Text style={styles.checkoutTotalLabel}>Total pembayaran</Text><Text style={styles.checkoutTotal}>{money(orderGrandTotal)}</Text></View>
            </View>

            {note.trim() ? <View style={styles.checkoutNote}><Ionicons name="document-text-outline" size={17} color={colors.primary} /><View style={styles.flex}><Text style={styles.checkoutNoteLabel}>Catatan untuk seller</Text><Text style={styles.checkoutNoteText}>{note.trim()}</Text></View></View> : null}
            <View style={styles.escrowInfo}><Ionicons name="shield-checkmark-outline" size={21} color={colors.success} /><Text style={styles.escrowText}>Setelah checkout, stok direservasi. Dana pembayaran disimpan di escrow dan baru dilepas setelah serah-terima berhasil diverifikasi.</Text></View>
            </ScrollView>

            {buy.isError ? (
              <InlineAlert message={errorMessage(buy.error)} />
            ) : null}

            <View style={[styles.modalActions, mobile && styles.modalActionsMobile]}>
              <Button title="Kembali" variant="ghost" disabled={buy.isPending} onPress={closeCheckout} style={styles.modalButton} />
              <Button title="Buat pesanan" icon="arrow-forward" loading={buy.isPending} onPress={() => buy.mutate()} style={styles.modalButtonPrimary} />
            </View>
          </View>
        </View>
      </Modal>
      <FeedbackDialog visible={Boolean(feedback)} tone={feedback?.tone || 'danger'} title={feedback?.title || ''} message={feedback?.message || ''} onClose={() => setFeedback(null)} />
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  page: { maxWidth: 1180, gap: 20 },
  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: 0, minHeight: 28 },
  breadcrumbLink: { fontFamily: 'PoppinsMedium', fontSize: 12, color: colors.primary },
  breadcrumbText: { fontFamily: 'PoppinsRegular', fontSize: 12, color: colors.muted },
  breadcrumbCurrent: { flex: 1 },
  columns: { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
  columnsMobile: { flexDirection: 'column', gap: 16 },
  gallery: { flex: 1.28, width: '100%', minWidth: 320, gap: 11 },
  galleryMobile: { minWidth: 0, flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  mainMedia: { position: 'relative', width: '100%', aspectRatio: 1.22, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted },
  mainImage: { width: '100%', height: '100%', backgroundColor: colors.surface },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  placeholderIcon: { width: 86, height: 86, borderRadius: 24, backgroundColor: colors.glassSoft, alignItems: 'center', justifyContent: 'center' },
  placeholderText: { fontFamily: 'PoppinsMedium', fontSize: 13, color: colors.muted },
  galleryArrow: { position: 'absolute', top: '45%', width: 40, height: 40, borderRadius: 12, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', shadowColor: '#18324A', shadowOpacity: .10, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  galleryArrowLeft: { left: 12 },
  galleryArrowRight: { right: 12 },
  imageCounter: { position: 'absolute', right: 12, bottom: 12, minHeight: 30, paddingHorizontal: 10, borderRadius: 9, backgroundColor: 'rgba(16,42,67,.84)', flexDirection: 'row', alignItems: 'center', gap: 6 },
  imageCounterText: { fontFamily: 'PoppinsSemiBold', fontSize: 11.5, color: colors.white },
  thumbScroll: { flexGrow: 0 },
  thumbs: { gap: 9, paddingVertical: 1 },
  thumbWrap: { position: 'relative', width: 82, height: 70, borderRadius: 11, padding: 3, borderWidth: 2, borderColor: 'transparent', backgroundColor: colors.surface },
  thumbActive: { borderColor: colors.primary },
  thumb: { width: '100%', height: '100%', borderRadius: 7 },
  thumbNumber: { position: 'absolute', right: 5, bottom: 5, width: 19, height: 19, borderRadius: 7, backgroundColor: 'rgba(16,42,67,.76)', alignItems: 'center', justifyContent: 'center' },
  thumbNumberText: { fontFamily: 'PoppinsSemiBold', fontSize: 10.5, color: colors.white },
  galleryHint: { fontFamily: 'PoppinsRegular', fontSize: 11.5, lineHeight: 17, color: colors.muted },
  purchaseCard: { flex: .92, width: '100%', minWidth: 350, padding: 20, gap: 16, borderRadius: 16, shadowOpacity: .06, ...(Platform.OS === 'web' ? { position: 'sticky', top: 20 } as any : {}) },
  purchaseCardMobile: { minWidth: 0, flexGrow: 0, flexShrink: 0, flexBasis: 'auto', padding: 15 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  badgeRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  typeBadge: { minHeight: 29, paddingHorizontal: 9, borderRadius: 8, backgroundColor: colors.primarySoft, flexDirection: 'row', alignItems: 'center', gap: 5 },
  typeBadgeText: { fontFamily: 'PoppinsBold', fontSize: 10.5, letterSpacing: .45, color: colors.primary },
  verified: { minHeight: 29, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, borderRadius: 8, backgroundColor: colors.successSoft },
  verifiedText: { fontFamily: 'PoppinsBold', fontSize: 10.5, letterSpacing: .35, color: colors.success },
  save: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  productHeading: { gap: 5 },
  title: { fontFamily: 'PoppinsBold', fontSize: 27, lineHeight: 35, color: colors.text },
  titleMobile: { fontSize: 22, lineHeight: 29 },
  meta: { fontFamily: 'PoppinsRegular', fontSize: 12.5, color: colors.muted },
  price: { fontFamily: 'PoppinsBold', fontSize: 29, lineHeight: 37, color: colors.primaryDark, marginTop: 5 },
  priceMobile: { fontSize: 24, lineHeight: 31 },
  factGrid: { flexDirection: 'row', gap: 8 },
  factGridMobile: { flexWrap: 'wrap' },
  factItem: { flex: 1, minWidth: 120, minHeight: 70, padding: 11, borderRadius: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, flexDirection: 'row', alignItems: 'center', gap: 9 },
  factIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  factLabel: { fontFamily: 'PoppinsRegular', fontSize: 10.5, color: colors.muted },
  factValue: { fontFamily: 'PoppinsSemiBold', fontSize: 12, lineHeight: 17, color: colors.text, marginTop: 1 },
  seller: { minHeight: 82, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.primaryMist, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatar: { width: 46, height: 46, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'PoppinsBold', fontSize: 16, color: colors.primary },
  sellerBody: { flex: 1 },
  sellerEyebrow: { fontFamily: 'PoppinsBold', fontSize: 9.5, letterSpacing: .55, color: colors.muted },
  sellerName: { fontFamily: 'PoppinsSemiBold', fontSize: 13.5, color: colors.text, marginTop: 1 },
  sellerMeta: { fontFamily: 'PoppinsRegular', fontSize: 10.5, color: colors.muted },
  sellerTrustRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginTop: 2 },
  sellerRating: { fontFamily: 'PoppinsSemiBold', fontSize: 11.5, color: colors.text },
  chat: { minHeight: 38, paddingHorizontal: 12, borderRadius: 9, borderWidth: 1, borderColor: colors.primaryBorder, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chatText: { fontFamily: 'PoppinsSemiBold', fontSize: 11.5, color: colors.primary },
  purchaseSection: { gap: 12, paddingTop: 2 },
  quantityRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  quantityCopy: { gap: 1 },
  quantityLabel: { fontFamily: 'PoppinsSemiBold', fontSize: 13, color: colors.text },
  quantityHint: { fontFamily: 'PoppinsRegular', fontSize: 10.5, color: colors.muted },
  stepper: { height: 40, flexDirection: 'row', borderRadius: 10, borderWidth: 1, borderColor: colors.borderStrong, overflow: 'hidden', backgroundColor: colors.surface },
  stepperButton: { width: 40, alignItems: 'center', justifyContent: 'center' },
  stepperValue: { width: 46, borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  stepperValueText: { fontFamily: 'PoppinsSemiBold', fontSize: 13, color: colors.text },
  orderPreview: { minHeight: 64, padding: 11, borderRadius: 11, backgroundColor: colors.primarySoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  orderPreviewLabel: { fontFamily: 'PoppinsMedium', fontSize: 11.5, color: colors.textSoft },
  orderPreviewHint: { fontFamily: 'PoppinsRegular', fontSize: 10.5, color: colors.muted, marginTop: 2 },
  orderPreviewTotal: { fontFamily: 'PoppinsBold', fontSize: 17, color: colors.primaryDark },
  reportAction: { alignSelf: 'center', minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8 },
  reportActionText: { fontFamily: 'PoppinsMedium', fontSize: 11.5, color: colors.muted },
  descriptionCard: { padding: 20, gap: 14, borderRadius: 15 },
  descriptionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  descriptionIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  descriptionTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 15, color: colors.text },
  descriptionSubtitle: { fontFamily: 'PoppinsRegular', fontSize: 11.5, color: colors.muted, marginTop: 1 },
  descriptionDivider: { height: 1, backgroundColor: colors.border },
  detailLabel: { fontFamily: 'PoppinsBold', fontSize: 10.5, letterSpacing: .65, color: colors.muted },
  description: { fontFamily: 'PoppinsRegular', fontSize: 13.5, lineHeight: 23, color: colors.textSoft },
  deliverySummary: { gap: 8, paddingTop: 2 },
  availableDeliveryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  availableDeliveryChip: { minHeight: 34, paddingHorizontal: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 6 },
  availableDeliveryText: { fontFamily: 'PoppinsMedium', fontSize: 11.5, color: colors.textSoft },
  preorderPanel: { padding: 13, borderRadius: 12, borderWidth: 1, borderColor: colors.primaryBorder, backgroundColor: colors.primaryMist, gap: 11 },
  preorderPanelClosed: { borderColor: colors.warningBorder, backgroundColor: colors.warningSoft },
  preorderPanelHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  preorderPanelIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  preorderPanelTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 12.5, color: colors.text },
  preorderPanelCopy: { fontFamily: 'PoppinsRegular', fontSize: 10.5, color: colors.muted, marginTop: 1 },
  preorderProgressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  preorderProgressText: { fontFamily: 'PoppinsMedium', fontSize: 10.5, color: colors.textSoft },
  preorderProgressTrack: { height: 7, borderRadius: 4, backgroundColor: colors.primarySoft, overflow: 'hidden' },
  preorderProgressFill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },
  preorderFacts: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  preorderFact: { minWidth: 116, flex: 1, padding: 9, borderRadius: 9, backgroundColor: colors.surface },
  preorderFactLabel: { fontFamily: 'PoppinsRegular', fontSize: 9.5, color: colors.muted },
  preorderFactValue: { fontFamily: 'PoppinsSemiBold', fontSize: 10.5, color: colors.text, marginTop: 2 },
  preorderPickup: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  preorderPickupText: { flex: 1, fontFamily: 'PoppinsMedium', fontSize: 10.5, color: colors.textSoft },
  preorderNote: { padding: 11, borderRadius: 10, backgroundColor: colors.primarySoft, flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  preorderNoteLabel: { fontFamily: 'PoppinsBold', fontSize: 9.5, letterSpacing: .55, color: colors.primary },
  preorderNoteText: { fontFamily: 'PoppinsRegular', fontSize: 11, lineHeight: 17, color: colors.textSoft, marginTop: 2 },
  unavailable: { padding: 12, borderRadius: 11, borderWidth: 1, borderColor: colors.warningBorder, backgroundColor: colors.warningSoft, flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  unavailableTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 11.5, color: colors.text },
  unavailableText: { fontFamily: 'PoppinsRegular', fontSize: 10.5, lineHeight: 16, color: colors.muted, marginTop: 1 },
  safety: { minHeight: 82, borderRadius: 13, backgroundColor: colors.successSoft, borderWidth: 1, borderColor: colors.successBorder, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  safetyIcon: { width: 42, height: 42, borderRadius: 11, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  safetyBody: { flex: 1 },
  safetyTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 13, color: colors.text },
  safetyCopy: { fontFamily: 'PoppinsRegular', fontSize: 11.5, lineHeight: 18, color: colors.muted, marginTop: 2 },
  modalBackdrop: { flex: 1, padding: 18, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center' },
  modalBackdropMobile: { padding: 10 },
  checkoutModal: { width: '100%', maxWidth: 680, maxHeight: '92%', padding: 22, borderRadius: 18, backgroundColor: colors.surface, gap: 16, shadowColor: '#071727', shadowOpacity: .22, shadowRadius: 26, shadowOffset: { width: 0, height: 12 } },
  modalScroll: { flexShrink: 1 },
  modalScrollContent: { gap: 16, paddingBottom: 2 },
  checkoutModalMobile: { maxHeight: '94%', borderRadius: 14, padding: 14 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  modalEyebrow: { fontFamily: 'PoppinsBold', fontSize: 10.5, letterSpacing: .8, color: colors.primary },
  modalTitle: { fontFamily: 'PoppinsBold', fontSize: 22, lineHeight: 29, color: colors.text },
  modalSubtitle: { fontFamily: 'PoppinsRegular', fontSize: 11.5, color: colors.muted, marginTop: 2 },
  modalClose: { width: 38, height: 38, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkoutProduct: { minHeight: 92, padding: 11, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.primaryMist, flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkoutMedia: { width: 76, height: 72, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  checkoutImage: { width: '100%', height: '100%' },
  checkoutProductBody: { flex: 1, gap: 2 },
  checkoutTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 13.5, lineHeight: 19, color: colors.text },
  checkoutSeller: { fontFamily: 'PoppinsRegular', fontSize: 10.5, color: colors.muted },
  checkoutPrice: { fontFamily: 'PoppinsBold', fontSize: 14, color: colors.primaryDark, marginTop: 2 },
  fulfillmentSection: { gap: 11 },
  sectionLabel: { fontFamily: 'PoppinsBold', fontSize: 10.5, letterSpacing: .7, color: colors.primary },
  sectionHelp: { fontFamily: 'PoppinsRegular', fontSize: 11.5, lineHeight: 17, color: colors.muted, marginTop: 2 },
  meetupChatInfo: { padding: 12, borderRadius: 11, borderWidth: 1, borderColor: colors.primaryBorder, backgroundColor: colors.primarySoft, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  meetupChatIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  meetupChatTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 11.5, color: colors.text },
  meetupChatText: { fontFamily: 'PoppinsRegular', fontSize: 10.5, lineHeight: 16, color: colors.textSoft, marginTop: 2 },
  fieldLabel: { fontFamily: 'PoppinsMedium', fontSize: 11.5, color: colors.textSoft },
  checkoutRows: { gap: 9, padding: 13, borderRadius: 11, backgroundColor: colors.background },
  checkoutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  checkoutLabel: { fontFamily: 'PoppinsRegular', fontSize: 11.5, color: colors.muted },
  checkoutValue: { fontFamily: 'PoppinsSemiBold', fontSize: 11.5, color: colors.text },
  checkoutDivider: { height: 1, backgroundColor: colors.border },
  checkoutTotalLabel: { fontFamily: 'PoppinsSemiBold', fontSize: 12.5, color: colors.text },
  checkoutTotal: { fontFamily: 'PoppinsBold', fontSize: 19, color: colors.primaryDark },
  checkoutNote: { padding: 11, borderRadius: 10, backgroundColor: colors.primarySoft, flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  checkoutNoteLabel: { fontFamily: 'PoppinsSemiBold', fontSize: 11.5, color: colors.text },
  checkoutNoteText: { fontFamily: 'PoppinsRegular', fontSize: 10.5, lineHeight: 16, color: colors.textSoft, marginTop: 2 },
  escrowInfo: { padding: 12, borderRadius: 11, borderWidth: 1, borderColor: colors.successBorder, backgroundColor: colors.successSoft, flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  escrowText: { flex: 1, fontFamily: 'PoppinsRegular', fontSize: 10.5, lineHeight: 17, color: colors.textSoft },
  modalActions: { flexDirection: 'row', gap: 9, paddingTop: 2 },
  modalActionsMobile: { flexDirection: 'column-reverse' },
  modalButton: { flex: 1 },
  modalButtonPrimary: { flex: 1.45 },
  flex: { flex: 1 },
}));
