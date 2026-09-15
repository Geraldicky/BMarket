import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, type ComponentProps } from 'react';
import { View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { makeStyles } from '@/constants/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

// One tile of the pattern. The strip renders two identical tiles side by side and slides left by exactly
// one tile width before restarting, so the loop is seamless.
const TILE_WIDTH = 560;
const TILE_HEIGHT = 1100;
const GRID_STEP = 56; // divides TILE_WIDTH evenly so grid lines line up across tiles
const SCROLL_DURATION_MS = 40_000;

const tileIcons: { name: IconName; x: number; y: number; size: number; rotate: number }[] = [
  { name: 'book-outline', x: 40, y: 60, size: 34, rotate: -12 },
  { name: 'bag-handle-outline', x: 250, y: 140, size: 40, rotate: 8 },
  { name: 'laptop-outline', x: 430, y: 70, size: 38, rotate: -6 },
  { name: 'shirt-outline', x: 120, y: 300, size: 36, rotate: 10 },
  { name: 'cafe-outline', x: 350, y: 330, size: 32, rotate: -10 },
  { name: 'calculator-outline', x: 500, y: 260, size: 30, rotate: 12 },
  { name: 'pricetag-outline', x: 60, y: 520, size: 34, rotate: 6 },
  { name: 'bicycle-outline', x: 260, y: 560, size: 42, rotate: -8 },
  { name: 'headset-outline', x: 450, y: 480, size: 34, rotate: 10 },
  { name: 'color-palette-outline', x: 150, y: 760, size: 36, rotate: -12 },
  { name: 'school-outline', x: 380, y: 760, size: 40, rotate: 6 },
  { name: 'gift-outline', x: 40, y: 960, size: 32, rotate: 10 },
  { name: 'camera-outline', x: 270, y: 980, size: 36, rotate: -6 },
  { name: 'game-controller-outline', x: 470, y: 930, size: 36, rotate: 8 },
];

function Tile() {
  const styles = useStyles();
  return (
    <View style={styles.tile}>
      {Array.from({ length: TILE_WIDTH / GRID_STEP }, (_, index) => <View key={`v-${index}`} style={[styles.gridLineVertical, { left: index * GRID_STEP }]} />)}
      {Array.from({ length: Math.ceil(TILE_HEIGHT / GRID_STEP) }, (_, index) => <View key={`h-${index}`} style={[styles.gridLineHorizontal, { top: index * GRID_STEP }]} />)}
      {tileIcons.map(icon => (
        <Ionicons key={icon.name} name={icon.name} size={icon.size} color="#73B8FF" style={[styles.icon, { left: icon.x, top: icon.y, transform: [{ rotate: `${icon.rotate}deg` }] }]} />
      ))}
    </View>
  );
}

/** Decorative campus-marketplace pattern that drifts slowly to the left behind the auth hero panel. */
export function AuthBackdrop() {
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  const offset = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    offset.value = 0;
    offset.value = withRepeat(withTiming(-TILE_WIDTH, { duration: SCROLL_DURATION_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(offset);
  }, [offset, reduceMotion]);

  const stripStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));

  return (
    <View style={styles.backdrop} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.strip, stripStyle]}>
        <Tile />
        <Tile />
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, overflow: 'hidden', pointerEvents: 'none' },
  strip: { flexDirection: 'row', width: TILE_WIDTH * 2, height: TILE_HEIGHT },
  tile: { width: TILE_WIDTH, height: TILE_HEIGHT },
  gridLineVertical: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(153, 189, 219, .06)' },
  gridLineHorizontal: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(153, 189, 219, .06)' },
  icon: { position: 'absolute', opacity: .1 },
}));
