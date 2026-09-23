import Ionicons from '@expo/vector-icons/Ionicons';
import type { ColorValue } from 'react-native';
import { colors } from '@/constants/theme';
import { CATEGORY_METADATA } from '@/lib/domain-metadata';
import type { Listing } from '@/types';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function listingFallbackIcon(type?: Listing['type'], category?: string): IconName {
  if (type === 'SERVICE') return 'construct-outline';
  return (CATEGORY_METADATA[category as keyof typeof CATEGORY_METADATA]?.icon || 'cube-outline') as IconName;
}

export function ListingImageFallback({ type, category, size = 30, color = colors.muted }: {
  type?: Listing['type'];
  category?: string;
  size?: number;
  color?: ColorValue;
}) {
  return <Ionicons name={listingFallbackIcon(type, category)} size={size} color={color} />;
}
