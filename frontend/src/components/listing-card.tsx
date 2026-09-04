import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Image } from 'expo-image';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, radius } from '@/constants/theme';
import type { Listing } from '@/types';
import { money } from './ui';

const categoryIcons: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  ELECTRONICS: 'phone-portrait-outline',
  BOOKS: 'book-outline',
  FASHION: 'shirt-outline',
  FOOD: 'fast-food-outline',
  SERVICES: 'construct-outline',
  SPORTS: 'basketball-outline',
  OTHER: 'cube-outline',
};

const categoryLabels: Record<string, string> = {
  ELECTRONICS: 'Elektronik',
  BOOKS: 'Buku',
  FASHION: 'Fashion',
  FOOD: 'Makanan',
  SERVICES: 'Jasa',
  SPORTS: 'Olahraga',
  OTHER: 'Lainnya',
};

const conditionLabels: Record<string, string> = {
  NEW: 'Baru',
  LIKE_NEW: 'Seperti baru',
  GOOD: 'Kondisi baik',
  FAIR: 'Cukup baik',
};

const placeholderColors: Record<string, string> = {
  ELECTRONICS: '#E6EEF7', BOOKS: '#F5ECE1', FASHION: '#F0EAF6', FOOD: '#F6EAE7', SERVICES: '#E6F1EF', SPORTS: '#F5EFDF', OTHER: '#EAEFF2',
};

export function ListingCard({
  item,
  onPress,
  style,
  compact = false,
}: {
  item: Listing;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}) {
  const [hovered,setHovered]=useState(false);
  const [saved,setSaved]=useState(false);
  const [failedUri,setFailedUri]=useState<string | null>(null);
  const cover = item.images?.[0];
  const showImage = Boolean(cover && failedUri !== cover);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onHoverIn={()=>setHovered(true)} onHoverOut={()=>setHovered(false)}
      style={({ pressed }) => [styles.card, hovered&&styles.hovered, style, pressed && styles.pressed]}
    >
      <View style={styles.media}>
        {showImage ? (
          <Image
            source={cover}
            style={[styles.image, compact && styles.imageCompact]}
            contentFit="cover"
            transition={180}
            cachePolicy="memory-disk"
            onError={()=>setFailedUri(cover!)}
          />
        ) : (
          <View style={[styles.image, compact && styles.imageCompact, styles.placeholder,{backgroundColor:placeholderColors[item.category]||'#EAEFF2'}]}><View style={[styles.placeholderRing, compact && styles.placeholderRingCompact]}><Ionicons name={categoryIcons[item.category] || 'storefront-outline'} size={compact ? 31 : 42} color="#637F99" /></View></View>
        )}
        <View style={[styles.typeBadge, compact && styles.typeBadgeCompact]}>
          <Ionicons name={item.type === 'SERVICE' ? 'sparkles-outline' : 'bag-handle-outline'} size={12} color={colors.primaryDark} />
          <Text style={styles.typeText}>{item.type === 'SERVICE' ? 'Jasa' : 'Barang'}</Text>
        </View>
        <Pressable hitSlop={8} onPress={event=>{event.stopPropagation();setSaved(value=>!value)}} style={styles.save}><Ionicons name={saved?'heart':'heart-outline'} size={18} color={saved?'#E5485D':colors.textSoft}/></Pressable>
        {(item.images?.length || 0) > 1 ? <View style={styles.photoCount}><Ionicons name="images-outline" size={12} color={colors.white}/><Text style={styles.photoCountText}>{item.images.length}</Text></View> : null}
      </View>

      <View style={[styles.body, compact && styles.bodyCompact]}>
        <Text numberOfLines={1} style={[styles.price, compact && styles.priceCompact]}>{money(item.price)}</Text>
        <Text numberOfLines={2} style={[styles.title, compact && styles.titleCompact]}>{item.title}</Text>
        <View style={styles.metaRow}>
          <Text numberOfLines={1} style={styles.meta}>
            {categoryLabels[item.category] || item.category}
            {item.condition ? ' · ' + (conditionLabels[item.condition] || item.condition) : ''}
          </Text>
        </View>
        <View style={[styles.sellerRow, compact && styles.sellerRowCompact]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.seller?.name?.[0]?.toUpperCase() || 'B'}</Text>
          </View>
          <Text numberOfLines={1} style={styles.seller}>{item.seller?.name || 'Binusian'}</Text>
          <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden', borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  hovered:{borderColor:'#AFC5E2',transform:[{translateY:-3}],shadowColor:'#24415D',shadowOpacity:.10,shadowRadius:16,shadowOffset:{width:0,height:7}},
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  media: { position: 'relative' },
  image: { width: '100%', height: 190 },
  imageCompact: { height: 160 },
  placeholder: { backgroundColor: '#E8EEF5', alignItems: 'center', justifyContent: 'center' },
  placeholderRing:{width:84,height:84,borderRadius:42,backgroundColor:'rgba(255,255,255,.58)',alignItems:'center',justifyContent:'center'},
  placeholderRingCompact:{width:70,height:70,borderRadius:35},
  typeBadge: { position: 'absolute', left: 10, top: 10, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.96)', paddingHorizontal: 8, paddingVertical: 5, borderRadius: radius.xs },
  typeBadgeCompact: { left: 9, top: 9, paddingHorizontal: 7, paddingVertical: 5 },
  typeText: { color: colors.primaryDark, fontFamily: 'PoppinsSemiBold', fontSize: 10 },
  save:{position:'absolute',right:10,top:10,width:34,height:34,borderRadius:17,backgroundColor:'rgba(255,255,255,.96)',alignItems:'center',justifyContent:'center'},
  photoCount:{position:'absolute',right:10,bottom:10,minHeight:28,paddingHorizontal:9,borderRadius:14,backgroundColor:'rgba(16,42,67,.82)',flexDirection:'row',alignItems:'center',gap:5},
  photoCountText:{fontFamily:'PoppinsSemiBold',fontSize:10,color:colors.white},
  body: { padding: 14, gap: 5 },
  bodyCompact: { padding: 13, gap: 5 },
  title: { color: colors.text, fontFamily: 'PoppinsMedium', fontSize: 12, lineHeight: 18, minHeight: 36 },
  titleCompact: { fontSize: 12.5, lineHeight: 18, minHeight: 36 },
  price: { color: colors.primaryDark, fontFamily: 'PoppinsBold', fontSize: 17 },
  priceCompact: { fontSize: 16 },
  metaRow: { minHeight: 17 },
  meta: { color: colors.muted, fontFamily: 'PoppinsRegular', fontSize: 11, lineHeight: 17, textTransform: 'capitalize' },
  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 9, marginTop: 3, borderTopWidth:1,borderTopColor:colors.border },
  sellerRowCompact: { paddingTop: 9, marginTop: 3 },
  avatar: { width: 27, height: 27, borderRadius: 9, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primaryDark, fontFamily: 'PoppinsBold', fontSize: 10 },
  seller: { flex: 1, color: colors.textSoft, fontFamily: 'PoppinsMedium', fontSize: 11 },
});
