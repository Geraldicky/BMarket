import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, Text, useWindowDimensions } from 'react-native';
import { colors, webTransition, makeStyles } from '@/constants/theme';

/**
 * Returns to the page the user came from. Falls back to Beranda when there is no history
 * (e.g. the page was opened directly from a URL).
 * Use `desktopOnly` on stack screens whose mobile native header already has a back arrow.
 */
export function BackButton({ desktopOnly = false, fallback = '/(student)/(tabs)' }: { desktopOnly?: boolean; fallback?: string }) {
  const styles = useStyles();
  const desktop = useWindowDimensions().width >= 960;
  if (desktopOnly && !desktop) return null;

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback as never);
  };

  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Kembali ke halaman sebelumnya" hitSlop={6} onPress={goBack} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <Ionicons name="arrow-back" size={18} color={colors.primary} />
      <Text style={styles.text}>Kembali</Text>
    </Pressable>
  );
}

const useStyles = makeStyles(() => ({
  button: { alignSelf: 'flex-start', minHeight: 38, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 6, ...webTransition },
  pressed: { opacity: .7 },
  text: { fontFamily: 'PoppinsSemiBold', fontSize: 13, color: colors.primary },
}));
