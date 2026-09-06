import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { Platform, Pressable, StyleProp, StyleSheet, Text, useWindowDimensions, View, ViewStyle } from 'react-native';
import { colors, shadowHover, webTransition } from '@/constants/theme';
import type { Listing } from '@/types';
import { money } from './ui';
import { useAuth } from '@/store/auth';

const categoryIcons: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  ELECTRONICS: 'phone-portrait-outline', BOOKS: 'book-outline', FASHION: 'shirt-outline', FOOD: 'fast-food-outline', SERVICES: 'construct-outline', SPORTS: 'basketball-outline', OTHER: 'cube-outline',
};
const categoryLabels: Record<string, string> = { ELECTRONICS: 'Elektronik', BOOKS: 'Buku', FASHION: 'Fashion', FOOD: 'Makanan', SERVICES: 'Jasa', SPORTS: 'Olahraga', OTHER: 'Lainnya' };
const conditionLabels: Record<string, string> = { NEW: 'Baru', LIKE_NEW: 'Seperti baru', GOOD: 'Kondisi baik', FAIR: 'Cukup baik' };
const placeholderColors: Record<string, string> = { ELECTRONICS: '#EDF4FF', BOOKS: '#FFF5E9', FASHION: '#F7EEFF', FOOD: '#FFF1EE', SERVICES: '#EAF8F4', SPORTS: '#FFF7DF', OTHER: '#F0F3F6' };

function shortDeadline(value?: string | null) {
  if (!value) return null;
  const target = new Date(value).getTime();
  const hours = Math.ceil((target - Date.now()) / 3_600_000);
  if (hours <= 0) return 'PO ditutup';
  if (hours <= 24) return `Tutup ${hours} jam lagi`;
  const days = Math.ceil(hours / 24);
  if (days <= 7) return `Tutup ${days} hari lagi`;
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(value));
}

function listingState(item: Listing) {
  if (item.status === 'SOLD') return { label: 'Terjual', icon: 'checkmark-circle' as const, tone: 'neutral' as const };
  if (item.mode === 'STOCKED' && item.stockLeft === 0) return { label: 'Stok habis', icon: 'cube-outline' as const, tone: 'warning' as const };
  if (item.mode === 'PREORDER') {
    if (!item.preorderAccepting) return { label: 'PO ditutup', icon: 'time-outline' as const, tone: 'neutral' as const };
    return { label: shortDeadline(item.preorderDeadline) || 'Pre-order', icon: 'calendar-outline' as const, tone: 'preorder' as const };
  }
  if (item.mode === 'SERVICE') return { label: 'Jasa', icon: 'sparkles-outline' as const, tone: 'service' as const };
  return null;
}

export function ListingCard({ item, onPress, style, compact = false, saved = false, onToggleSaved, storefront = false }: { item: Listing; onPress: () => void; style?: StyleProp<ViewStyle>; compact?: boolean; saved?: boolean; onToggleSaved?: () => void; storefront?: boolean }) {
  const currentUserId = useAuth(state => state.user?.id);
  const { width } = useWindowDimensions();
  const mobile = width < 600;
  const [hovered, setHovered] = useState(false);
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const cover = item.images?.[0];
  const showImage = Boolean(cover && failedUri !== cover);
  const isOwnListing = Boolean(currentUserId && item.sellerId === currentUserId);
  const state = useMemo(() => listingState(item), [item]);
  const stockCaption = item.mode === 'STOCKED' && typeof item.stockLeft === 'number'
    ? `${item.stockLeft} stok`
    : item.mode === 'PREORDER' && typeof item.preorderQuota === 'number'
      ? `${Math.max(0, (item.preorderQuota || 0) - (item.stockLeft || 0))} / ${item.preorderQuota} pesanan`
      : null;

  return (
    <View style={[styles.card, storefront && styles.cardStorefront, mobile && styles.cardMobile, hovered && styles.hovered, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Buka listing ${item.title}`}
        onPress={onPress}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        style={({ pressed }) => [styles.cardMain, pressed && styles.pressed]}
      >
        <View style={styles.media}>
          {showImage ? (
            <Image source={cover} style={[styles.image, compact && styles.imageCompact, storefront && styles.imageStorefront, mobile && styles.imageMobile]} contentFit="cover" transition={180} cachePolicy="memory-disk" onError={() => setFailedUri(cover!)} />
          ) : (
            <View style={[styles.image, compact && styles.imageCompact, storefront && styles.imageStorefront, mobile && styles.imageMobile, styles.placeholder, { backgroundColor: placeholderColors[item.category] || '#F0F3F6' }]}>
              <View style={styles.placeholderRing}><Ionicons name={categoryIcons[item.category] || 'storefront-outline'} size={compact ? 28 : 36} color="#607A96" /></View>
            </View>
          )}

          <View style={styles.categoryTag}><Text style={styles.categoryTagText}>{categoryLabels[item.category] || item.category}</Text></View>
          {state ? <View style={[styles.stateBadge, styles[`state_${state.tone}`]]}><Ionicons name={state.icon} size={11} color={state.tone === 'warning' ? '#B86B00' : state.tone === 'preorder' ? '#7C4ACB' : state.tone === 'service' ? '#0D7B61' : '#607184'} /><Text style={[styles.stateText, styles[`stateText_${state.tone}`]]}>{state.label}</Text></View> : null}
        </View>

        <View style={[styles.body, compact && styles.bodyCompact, storefront && styles.bodyStorefront]}>
          <Text numberOfLines={2} style={[styles.title, compact && styles.titleCompact]}>{item.title}</Text>
          <Text numberOfLines={1} style={[styles.price, compact && styles.priceCompact]}>{money(item.price)}</Text>
          <View style={styles.metaRow}>
            {item.condition ? <Text numberOfLines={1} style={styles.meta}>{conditionLabels[item.condition] || item.condition}</Text> : null}
            {item.condition && stockCaption ? <View style={styles.dot} /> : null}
            {stockCaption ? <Text numberOfLines={1} style={styles.meta}>{stockCaption}</Text> : null}
          </View>
          <View style={styles.sellerRow}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{item.seller?.name?.[0]?.toUpperCase() || 'B'}</Text></View>
            <Text numberOfLines={1} style={styles.seller}>{item.seller?.name || 'Binusian'}</Text>
            <Ionicons name="checkmark-circle" size={13} color={colors.primary} />
          </View>
        </View>
      </Pressable>

      {onToggleSaved && !isOwnListing ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Hapus dari favorit' : 'Tambahkan ke favorit'}
          hitSlop={10}
          onPress={onToggleSaved}
          style={({ pressed }) => [styles.save, saved && styles.saveActive, pressed && styles.savePressed]}
        >
          <Ionicons name={saved ? 'heart' : 'heart-outline'} size={18} color={saved ? '#E5485D' : '#536578'} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden', borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: '#E5EAF0', ...webTransition },
  cardStorefront: { borderRadius: 12 },
  cardMobile: { borderRadius: 12 },
  cardMain: { flex: 1 },
  hovered: { borderColor: '#B7D1EC', transform: [{ translateY: -4 }], ...shadowHover },
  pressed: { opacity: .88, transform: [{ scale: .992 }] },
  media: { position: 'relative', overflow: 'hidden' },
  image: { width: '100%', height: 190 },
  imageCompact: { height: 162 },
  imageStorefront: { height: 150 },
  imageMobile: { minHeight: 138 },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  placeholderRing: { width: 66, height: 66, borderRadius: 33, backgroundColor: 'rgba(255,255,255,.64)', alignItems: 'center', justifyContent: 'center' },
  categoryTag: { position: 'absolute', left: 9, top: 9, minHeight: 25, paddingHorizontal: 8, borderRadius: 7, backgroundColor: 'rgba(255,255,255,.94)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(215,224,233,.85)' },
  categoryTagText: { fontFamily: 'PoppinsSemiBold', fontSize: 9.5, color: '#506276' },
  stateBadge: { position: 'absolute', left: 9, bottom: 9, minHeight: 26, paddingHorizontal: 8, borderRadius: 7, flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1 },
  state_neutral: { backgroundColor: 'rgba(247,249,252,.96)', borderColor: '#DDE5ED' },
  state_warning: { backgroundColor: 'rgba(255,247,228,.97)', borderColor: '#F1D8A5' },
  state_preorder: { backgroundColor: 'rgba(247,239,255,.97)', borderColor: '#DFC9F5' },
  state_service: { backgroundColor: 'rgba(235,249,244,.97)', borderColor: '#CBE9DE' },
  stateText_neutral: { color: '#607184' },
  stateText_warning: { color: '#A85F00' },
  stateText_preorder: { color: '#7442C3' },
  stateText_service: { color: '#0D765E' },
  stateText: { fontFamily: 'PoppinsSemiBold', fontSize: 9.5 },
  save: { position: 'absolute', zIndex: 20, elevation: 8, right: 9, top: 9, width: 35, height: 35, borderRadius: 11, backgroundColor: 'rgba(255,255,255,.94)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(215,224,233,.92)', ...webTransition, ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}) },
  saveActive: { backgroundColor: '#FFF3F5', borderColor: '#FFD2D9' },
  savePressed: { transform: [{ scale: .88 }] },
  body: { padding: 13, gap: 5 },
  bodyCompact: { padding: 11, gap: 4 },
  bodyStorefront: { padding: 11 },
  title: { color: '#223246', fontFamily: 'PoppinsSemiBold', fontSize: 12.5, lineHeight: 18, minHeight: 36 },
  titleCompact: { fontSize: 12.25, lineHeight: 18 },
  price: { color: colors.primaryDark, fontFamily: 'PoppinsBold', fontSize: 17.5, letterSpacing: -.2 },
  priceCompact: { fontSize: 16 },
  metaRow: { minHeight: 18, flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { color: '#7A8999', fontFamily: 'PoppinsRegular', fontSize: 10.5, lineHeight: 16, textTransform: 'capitalize' },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#BAC4CE' },
  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 7, marginTop: 2 },
  avatar: { width: 25, height: 25, borderRadius: 8, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primaryDark, fontFamily: 'PoppinsBold', fontSize: 9.5 },
  seller: { flex: 1, color: '#667789', fontFamily: 'PoppinsMedium', fontSize: 10.75 },
});
