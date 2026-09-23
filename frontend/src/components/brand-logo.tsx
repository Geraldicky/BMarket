import { Image } from 'expo-image';
import type { ImageStyle, StyleProp } from 'react-native';
import { BrandAssets } from '@/lib/assets';

export function BrandLogo({ style }: { style?: StyleProp<ImageStyle> }) {
  return <Image accessibilityLabel="BMarket" source={BrandAssets.wordmark} contentFit="contain" style={[{ width: 150, height: 48 }, style]} />;
}
