import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Image } from 'expo-image';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, radius } from '@/constants/theme';
import type { Listing } from '@/types';
import { money } from './ui';
import { useAuth } from '@/store/auth';

const categoryIcons: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  ELECTRONICS: 'phone-portrait-outline', BOOKS: 'book-outline', FASHION: 'shirt-outline', FOOD: 'fast-food-outline', SERVICES: 'construct-outline', SPORTS: 'basketball-outline', OTHER: 'cube-outline',
};
const categoryLabels: Record<string, string> = { ELECTRONICS: 'Elektronik', BOOKS: 'Buku', FASHION: 'Fashion', FOOD: 'Makanan', SERVICES: 'Jasa', SPORTS: 'Olahraga', OTHER: 'Lainnya' };
const conditionLabels: Record<string, string> = { NEW: 'Baru', LIKE_NEW: 'Seperti baru', GOOD: 'Kondisi baik', FAIR: 'Cukup baik' };
const placeholderColors: Record<string, string> = { ELECTRONICS: '#EAF3FF', BOOKS: '#FFF3E7', FASHION: '#F7EEFF', FOOD: '#FFF0EE', SERVICES: '#EAF8F4', SPORTS: '#FFF7DF', OTHER: '#F0F3F6' };

export function ListingCard({ item, onPress, style, compact = false, saved = false, onToggleSaved, storefront = false }: { item: Listing; onPress: () => void; style?: StyleProp<ViewStyle>; compact?: boolean; saved?: boolean; onToggleSaved?: () => void; storefront?: boolean }) {
  const currentUserId = useAuth(state => state.user?.id);
  const [hovered, setHovered] = useState(false);
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const cover = item.images?.[0];
  const showImage = Boolean(cover && failedUri !== cover);
  const isOwnListing = Boolean(currentUserId && item.sellerId === currentUserId);
  return (
    <View style={[styles.card, storefront && styles.cardStorefront, hovered && (storefront ? styles.hoveredStorefront : styles.hovered), style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Buka listing ${item.title}`}
        onPress={onPress}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        style={({ pressed }) => [styles.cardMain, pressed && styles.pressed]}
      >
        <View style={styles.media}>
          {showImage ? <Image source={cover} style={[styles.image, compact && styles.imageCompact, storefront && styles.imageStorefront]} contentFit="cover" transition={180} cachePolicy="memory-disk" onError={() => setFailedUri(cover!)} /> : <View style={[styles.image, compact && styles.imageCompact, storefront && styles.imageStorefront, styles.placeholder, { backgroundColor: storefront ? (placeholderColors[item.category] || '#F0F3F6') : '#E8EEF5' }]}><View style={[styles.placeholderRing, compact && styles.placeholderRingCompact, storefront && styles.placeholderRingStorefront]}><Ionicons name={categoryIcons[item.category] || 'storefront-outline'} size={compact ? 29 : 40} color={storefront ? '#607A96' : '#637F99'} /></View></View>}
          <View style={[styles.typeBadge, compact && styles.typeBadgeCompact, storefront && styles.typeBadgeStorefront]}><Ionicons name={item.type === 'SERVICE' ? 'sparkles-outline' : 'bag-handle-outline'} size={11} color={storefront ? '#1769C2' : colors.primaryDark} /><Text style={[styles.typeText, storefront && styles.typeTextStorefront]}>{item.type === 'SERVICE' ? 'Jasa' : 'Barang'}</Text></View>
        </View>
        <View style={[styles.body, compact && styles.bodyCompact, storefront && styles.bodyStorefront]}>
          <Text numberOfLines={2} style={[styles.title, compact && styles.titleCompact, storefront && styles.titleStorefront]}>{item.title}</Text>
          <Text numberOfLines={1} style={[styles.price, compact && styles.priceCompact, storefront && styles.priceStorefront]}>{money(item.price)}</Text>
          <Text numberOfLines={1} style={[styles.meta, storefront && styles.metaStorefront]}>{categoryLabels[item.category] || item.category}{item.condition ? ' · ' + (conditionLabels[item.condition] || item.condition) : ''}</Text>
          <View style={[styles.sellerRow, compact && styles.sellerRowCompact, storefront && styles.sellerRowStorefront]}><View style={[styles.avatar, storefront && styles.avatarStorefront]}><Text style={[styles.avatarText, storefront && styles.avatarTextStorefront]}>{item.seller?.name?.[0]?.toUpperCase() || 'B'}</Text></View><Text numberOfLines={1} style={[styles.seller, storefront && styles.sellerStorefront]}>{item.seller?.name || 'Binusian'}</Text><Ionicons name="checkmark-circle" size={13} color={storefront ? '#1769C2' : colors.primary} /></View>
        </View>
      </Pressable>
      {onToggleSaved && !isOwnListing ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Hapus dari favorit' : 'Tambahkan ke favorit'}
          hitSlop={10}
          onPress={onToggleSaved}
          style={({ pressed }) => [styles.save, storefront && styles.saveStorefront, pressed && styles.savePressed]}
        >
          <Ionicons name={saved ? 'heart' : 'heart-outline'} size={17} color={saved ? '#E5485D' : storefront ? '#67788A' : colors.textSoft} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden', borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  cardStorefront: { borderRadius: 10, backgroundColor: '#FFFFFF', borderColor: '#E1E7EE' },
  cardMain: { flex: 1 },
  hovered: { borderColor: '#AFC5E2', transform: [{ translateY: -3 }], shadowColor: '#24415D', shadowOpacity: .10, shadowRadius: 16, shadowOffset: { width: 0, height: 7 } },
  hoveredStorefront: { borderColor: '#9FC5EC', transform: [{ translateY: -2 }], shadowColor: '#29435C', shadowOpacity: .12, shadowRadius: 14, shadowOffset: { width: 0, height: 7 } },
  pressed: { opacity: .78, transform: [{ scale: .985 }] },
  media: { position: 'relative' },
  image: { width: '100%', height: 190 }, imageCompact: { height: 160 }, imageStorefront: { height: 142 },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  placeholderRing: { width: 84, height: 84, borderRadius: 42, backgroundColor: 'rgba(255,255,255,.58)', alignItems: 'center', justifyContent: 'center' },
  placeholderRingCompact: { width: 70, height: 70, borderRadius: 35 }, placeholderRingStorefront: { backgroundColor: 'rgba(255,255,255,.72)' },
  typeBadge: { position: 'absolute', left: 10, top: 10, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,.96)', paddingHorizontal: 8, paddingVertical: 5, borderRadius: radius.xs },
  typeBadgeCompact: { left: 8, top: 8, paddingHorizontal: 7, paddingVertical: 4 }, typeBadgeStorefront: { backgroundColor: 'rgba(238,246,255,.96)', borderWidth: 1, borderColor: '#CFE1F5' },
  typeText: { color: colors.primaryDark, fontFamily: 'PoppinsSemiBold', fontSize: 10 }, typeTextStorefront: { color: '#1769C2', fontSize: 10.5 },
  save: { position: 'absolute', zIndex: 20, elevation: 8, right: 10, top: 10, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,.96)', alignItems: 'center', justifyContent: 'center' }, saveStorefront: { right: 9, top: 9, width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(255,255,255,.96)', borderWidth: 1, borderColor: '#DDE5ED' },
  savePressed: { opacity: .72, transform: [{ scale: .92 }] },
  body: { padding: 14, gap: 5 }, bodyCompact: { padding: 13, gap: 5 }, bodyStorefront: { padding: 10, gap: 4 },
  title: { color: colors.text, fontFamily: 'PoppinsMedium', fontSize: 12, lineHeight: 18, minHeight: 36 }, titleCompact: { fontSize: 12.5, lineHeight: 18, minHeight: 36 }, titleStorefront: { color: '#243246', fontSize: 12, lineHeight: 17, minHeight: 34 },
  price: { color: colors.primaryDark, fontFamily: 'PoppinsBold', fontSize: 17 }, priceCompact: { fontSize: 16 }, priceStorefront: { color: '#1769C2', fontSize: 14.5 },
  meta: { color: colors.muted, fontFamily: 'PoppinsRegular', fontSize: 11, lineHeight: 17, textTransform: 'capitalize' }, metaStorefront: { color: '#7B8998', fontSize: 11, lineHeight: 16 },
  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 9, marginTop: 3, borderTopWidth: 1, borderTopColor: colors.border }, sellerRowCompact: { paddingTop: 9, marginTop: 3 }, sellerRowStorefront: { paddingTop: 6, marginTop: 1, borderTopColor: '#E6EBF0' },
  avatar: { width: 27, height: 27, borderRadius: 9, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, avatarStorefront: { width: 24, height: 24, borderRadius: 7, backgroundColor: '#EAF3FF' },
  avatarText: { color: colors.primaryDark, fontFamily: 'PoppinsBold', fontSize: 10 }, avatarTextStorefront: { color: '#1769C2', fontSize: 10 },
  seller: { flex: 1, color: colors.textSoft, fontFamily: 'PoppinsMedium', fontSize: 11 }, sellerStorefront: { color: '#657487', fontSize: 11 },
});
