import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { Platform, Pressable, StyleProp, Text, useWindowDimensions, View, ViewStyle } from 'react-native';
import { colors, shadowHover, webTransition, makeStyles } from '@/constants/theme';
import type { Listing } from '@/types';
import { money } from './ui';
import { useAuth } from '@/store/auth';

const categoryIcons: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  ELECTRONICS: 'phone-portrait-outline', BOOKS: 'book-outline', FASHION: 'shirt-outline', FOOD: 'fast-food-outline', SERVICES: 'construct-outline', SPORTS: 'basketball-outline', OTHER: 'cube-outline',
};
const categoryLabels: Record<string, string> = { ELECTRONICS: 'Elektronik', BOOKS: 'Buku', FASHION: 'Fashion', FOOD: 'Makanan', SERVICES: 'Jasa', SPORTS: 'Olahraga', OTHER: 'Lainnya' };
const conditionLabels: Record<string, string> = { NEW: 'Baru', LIKE_NEW: 'Seperti baru', GOOD: 'Kondisi baik', FAIR: 'Cukup baik' };
// Category accents for the no-photo placeholder; drawn at low opacity so they suit light and dark themes.
const placeholderAccents: Record<string, string> = { ELECTRONICS: '#3D7BE0', BOOKS: '#E0801F', FASHION: '#A064D6', FOOD: '#DE6155', SERVICES: '#1F9C80', SPORTS: '#D0961E', OTHER: '#7C8EA2' };

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
  const styles = useStyles();
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
            <View style={[styles.image, compact && styles.imageCompact, storefront && styles.imageStorefront, mobile && styles.imageMobile, styles.placeholder, { backgroundColor: `${placeholderAccents[item.category] || placeholderAccents.OTHER}1F` }]}>
              <View style={styles.placeholderRing}><Ionicons name={categoryIcons[item.category] || 'storefront-outline'} size={compact ? 28 : 36} color={colors.muted} /></View>
            </View>
          )}

          <View style={styles.categoryTag}><Text style={styles.categoryTagText}>{categoryLabels[item.category] || item.category}</Text></View>
          {state ? <View style={[styles.stateBadge, styles[`state_${state.tone}`]]}><Ionicons name={state.icon} size={11} color={state.tone === 'warning' ? colors.warning : state.tone === 'preorder' ? colors.purple : state.tone === 'service' ? colors.success : colors.textSoft} /><Text style={[styles.stateText, styles[`stateText_${state.tone}`]]}>{state.label}</Text></View> : null}
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
          <Ionicons name={saved ? 'heart' : 'heart-outline'} size={18} color={saved ? colors.heart : colors.textSoft} />
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  card: { overflow: 'hidden', borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...webTransition },
  cardStorefront: { borderRadius: 12 },
  cardMobile: { borderRadius: 12 },
  cardMain: { flex: 1 },
  hovered: { borderColor: colors.hoverBorder, transform: [{ translateY: -4 }], ...shadowHover },
  pressed: { opacity: .88, transform: [{ scale: .992 }] },
  media: { position: 'relative', overflow: 'hidden' },
  image: { width: '100%', height: 190 },
  imageCompact: { height: 162 },
  imageStorefront: { height: 150 },
  imageMobile: { minHeight: 138 },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  placeholderRing: { width: 66, height: 66, borderRadius: 33, backgroundColor: colors.glassSoft, alignItems: 'center', justifyContent: 'center' },
  categoryTag: { position: 'absolute', left: 9, top: 9, minHeight: 25, paddingHorizontal: 8, borderRadius: 7, backgroundColor: colors.glass, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  categoryTagText: { fontFamily: 'PoppinsSemiBold', fontSize: 9.5, color: colors.textSoft },
  stateBadge: { position: 'absolute', left: 9, bottom: 9, minHeight: 26, paddingHorizontal: 8, borderRadius: 7, flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1 },
  state_neutral: { backgroundColor: colors.glass, borderColor: colors.border },
  state_warning: { backgroundColor: colors.warningSoft, borderColor: colors.warningBorder },
  state_preorder: { backgroundColor: colors.purpleSoft, borderColor: colors.purpleBorder },
  state_service: { backgroundColor: colors.successSoft, borderColor: colors.successBorder },
  stateText_neutral: { color: colors.textSoft },
  stateText_warning: { color: colors.warning },
  stateText_preorder: { color: colors.purple },
  stateText_service: { color: colors.success },
  stateText: { fontFamily: 'PoppinsSemiBold', fontSize: 9.5 },
  save: { position: 'absolute', zIndex: 20, elevation: 8, right: 9, top: 9, width: 35, height: 35, borderRadius: 11, backgroundColor: colors.glass, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, ...webTransition, ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}) },
  saveActive: { backgroundColor: colors.dangerSoft, borderColor: colors.dangerBorder },
  savePressed: { transform: [{ scale: .88 }] },
  body: { padding: 13, gap: 5 },
  bodyCompact: { padding: 11, gap: 4 },
  bodyStorefront: { padding: 11 },
  title: { color: colors.text, fontFamily: 'PoppinsSemiBold', fontSize: 12.5, lineHeight: 18, minHeight: 36 },
  titleCompact: { fontSize: 12.25, lineHeight: 18 },
  price: { color: colors.primaryDark, fontFamily: 'PoppinsBold', fontSize: 17.5, letterSpacing: -.2 },
  priceCompact: { fontSize: 16 },
  metaRow: { minHeight: 18, flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { color: colors.muted, fontFamily: 'PoppinsRegular', fontSize: 10.5, lineHeight: 16, textTransform: 'capitalize' },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.borderStrong },
  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 7, marginTop: 2 },
  avatar: { width: 25, height: 25, borderRadius: 8, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primaryDark, fontFamily: 'PoppinsBold', fontSize: 9.5 },
  seller: { flex: 1, color: colors.textSoft, fontFamily: 'PoppinsMedium', fontSize: 10.75 },
}));
