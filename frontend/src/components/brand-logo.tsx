import { Image } from 'expo-image';
import type { ImageStyle, StyleProp } from 'react-native';

const wordmark = require('../../assets/branding/wordmark.png');

export function BrandLogo({ style }: { style?: StyleProp<ImageStyle> }) {
  return <Image accessibilityLabel="BMarket" source={wordmark} contentFit="contain" style={[{ width: 150, height: 48 }, style]} />;
}
