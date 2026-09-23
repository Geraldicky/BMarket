import { useWindowDimensions, View } from 'react-native';
import { Skeleton } from '@/components/ui';
import { layout, makeStyles, colors } from '@/constants/theme';

export function ListingGridSkeleton({ count = 8 }: { count?: number }) {
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const desktop = width >= 960;
  const contentWidth = Math.max(300, Math.min(width - (desktop ? 80 : 28), layout.contentMaxWidth - 80));
  const columns = contentWidth >= 1120 ? 5 : contentWidth >= 900 ? 4 : contentWidth >= 680 ? 3 : contentWidth >= 320 ? 2 : 1;
  const gap = desktop ? 14 : 10;
  const cardWidth = (contentWidth - gap * (columns - 1)) / columns;

  return <View accessibilityLabel="Memuat listing" style={[styles.grid, { gap }]}>{Array.from({ length: count }, (_, index) => <View key={index} style={[styles.card, { width: cardWidth }]}><Skeleton height={150} radius={12} /><View style={styles.body}><Skeleton width="55%" height={18} /><Skeleton width="88%" height={14} /><Skeleton width="68%" height={12} /><Skeleton width="48%" height={24} radius={8} /></View></View>)}</View>;
}

const useStyles = makeStyles(() => ({
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' },
  card: { overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  body: { minHeight: 140, padding: 12, gap: 9 },
}));
