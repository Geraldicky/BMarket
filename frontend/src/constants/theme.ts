import { Appearance, Platform, StyleSheet } from 'react-native';
import { create } from 'zustand';
import { getStoredValue, setStoredValue } from '@/lib/token-storage';

// ---------------------------------------------------------------------------
// Palettes
// ---------------------------------------------------------------------------

const light = {
  primary: '#1167D8',
  primaryHover: '#0F5FC9',
  primaryDark: '#0C4FA8',
  primaryDeep: '#102A43',
  primarySoft: '#EAF3FF',
  primarySoftHover: '#DDEEFF',
  primaryMist: '#F5F9FE',
  primaryBorder: '#C8E0FA',
  primaryBorderStrong: '#A9CFF4',
  accent: '#12805C',
  accentSoft: '#E8F8F2',
  background: '#FBFCFE',
  surface: '#FFFFFF',
  surfaceMuted: '#F6F8FB',
  surfaceRaised: '#FFFFFF',
  text: '#172B3A',
  textSoft: '#4A6072',
  muted: '#728496',
  border: '#E2E8EF',
  borderStrong: '#C9D5DF',
  hoverBorder: '#B7D1EC',
  success: '#159568',
  successSoft: '#E9F8F2',
  successBorder: '#C9EDDE',
  danger: '#E05252',
  dangerHover: '#D94848',
  dangerSoft: '#FFF1F1',
  dangerBorder: '#FFD5D5',
  warning: '#E88918',
  warningSoft: '#FFF6E8',
  warningBorder: '#F2D6A8',
  purple: '#7442C3',
  purpleSoft: '#F3EDFF',
  purpleBorder: '#DFC9F5',
  white: '#FFFFFF',
  ink: '#102233',
  // Blue app header / navbar and the content drawn on top of it.
  brand: '#0B57B7',
  brandDeep: '#073B7C',
  brandRaised: '#1676E8',
  onBrand: '#FFFFFF',
  onBrandMuted: '#BFD4EE',
  overlay: 'rgba(10,26,41,.55)',
  skeleton: '#EDF2F7',
  inputFocus: '#FBFDFF',
  heart: '#E5485D',
  badge: '#F04E5E',
  // Translucent chips/buttons drawn over photos.
  glass: 'rgba(255,255,255,.94)',
  glassSoft: 'rgba(255,255,255,.66)',
};

export type Palette = typeof light;

const dark: Palette = {
  // Mid blue: readable as text on dark surfaces and as a fill behind white button labels.
  primary: '#3A88F0',
  primaryHover: '#5598F2',
  primaryDark: '#8CC0FF',
  primaryDeep: '#0E2238',
  primarySoft: '#172D48',
  primarySoftHover: '#1D3858',
  primaryMist: '#111F31',
  primaryBorder: '#27486F',
  primaryBorderStrong: '#34608F',
  accent: '#3FCB96',
  accentSoft: '#13362B',
  background: '#0B1320',
  surface: '#121C2A',
  surfaceMuted: '#0F1824',
  surfaceRaised: '#182434',
  text: '#E7EEF6',
  textSoft: '#B7C4D2',
  muted: '#8797A8',
  border: '#223244',
  borderStrong: '#32465C',
  hoverBorder: '#35577D',
  success: '#3FCB96',
  successSoft: '#12342A',
  successBorder: '#1F5642',
  danger: '#FF6B6B',
  dangerHover: '#FF8080',
  dangerSoft: '#3A1C22',
  dangerBorder: '#5E2A31',
  warning: '#FFAE4C',
  warningSoft: '#3A2912',
  warningBorder: '#5E4420',
  purple: '#B892F5',
  purpleSoft: '#2A2143',
  purpleBorder: '#443569',
  white: '#FFFFFF',
  ink: '#E7EEF6',
  brand: '#0F2E52',
  brandDeep: '#0A2140',
  brandRaised: '#1E63C4',
  onBrand: '#FFFFFF',
  onBrandMuted: '#A9BFD8',
  overlay: 'rgba(0,0,0,.62)',
  skeleton: '#1B293A',
  inputFocus: '#141F2E',
  heart: '#FF5C72',
  badge: '#FF5C6C',
  glass: 'rgba(18,28,42,.92)',
  glassSoft: 'rgba(18,28,42,.6)',
};

export type ColorScheme = 'light' | 'dark';
export type ThemeMode = ColorScheme | 'system';

export const palettes: Record<ColorScheme, Palette> = { light, dark };

// ---------------------------------------------------------------------------
// Theme preference store (Light / Dark / follow system), saved on the device
// ---------------------------------------------------------------------------

const THEME_KEY = 'bmarket-theme-mode';

const isThemeMode = (value: unknown): value is ThemeMode => value === 'light' || value === 'dark' || value === 'system';
const systemScheme = (): ColorScheme => Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
const resolveScheme = (mode: ThemeMode): ColorScheme => mode === 'system' ? systemScheme() : mode;

// On web the saved preference is readable synchronously, which avoids a flash of the wrong theme.
function initialMode(): ThemeMode {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return 'system';
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    return isThemeMode(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

type ThemeState = {
  mode: ThemeMode;
  scheme: ColorScheme;
  setMode: (mode: ThemeMode) => void;
  hydrate: () => Promise<void>;
};

const startMode = initialMode();

export const useThemeStore = create<ThemeState>(set => ({
  mode: startMode,
  scheme: resolveScheme(startMode),
  setMode: mode => {
    set({ mode, scheme: resolveScheme(mode) });
    setStoredValue(THEME_KEY, mode).catch(() => undefined);
  },
  hydrate: async () => {
    try {
      const stored = await getStoredValue(THEME_KEY);
      if (isThemeMode(stored)) set({ mode: stored, scheme: resolveScheme(stored) });
    } catch {
      // Keep the current preference when storage is unavailable.
    }
  },
}));

Appearance.addChangeListener(() => {
  if (useThemeStore.getState().mode === 'system') useThemeStore.setState({ scheme: systemScheme() });
});

export const useColorScheme = () => useThemeStore(state => state.scheme);
export const useThemeColors = () => palettes[useColorScheme()];

// ---------------------------------------------------------------------------
// Theme-aware colors and styles
// ---------------------------------------------------------------------------

// Set only while makeStyles builds a sheet, so `colors` inside a style factory reads that sheet's palette.
let evaluatingScheme: ColorScheme | null = null;

/**
 * Live view of the active palette. Reading `colors.x` during render returns the current theme's value;
 * components re-render on theme change through `useStyles()` / `useColorScheme()`.
 * Do not capture `colors.x` in module-level constants — they would keep the first theme's value.
 */
export const colors: Palette = new Proxy({} as Palette, {
  get: (_target, key) => palettes[evaluatingScheme ?? useThemeStore.getState().scheme][key as keyof Palette],
});

/**
 * Theme-aware replacement for `StyleSheet.create`. The factory may read `colors.*`; a sheet is built
 * for each palette up front, and the returned hook picks the one for the active theme.
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(factory: () => T & StyleSheet.NamedStyles<any>) {
  const build = (scheme: ColorScheme): T => {
    evaluatingScheme = scheme;
    try {
      return StyleSheet.create(factory());
    } finally {
      evaluatingScheme = null;
    }
  };
  const sheets: Record<ColorScheme, T> = { light: build('light'), dark: build('dark') };
  return function useStyles(): T {
    return sheets[useThemeStore(state => state.scheme)];
  };
}

// ---------------------------------------------------------------------------
// Scale tokens (theme independent)
// ---------------------------------------------------------------------------

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};

export const motion = {
  fast: 120,
  normal: 180,
  slow: 260,
};

export const shadow = Platform.OS === 'web'
  ? { boxShadow: '0px 12px 30px rgba(30, 56, 84, 0.08)' }
  : {
      shadowColor: '#213044',
      shadowOpacity: 0.08,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 9 },
      elevation: 3,
    };

export const shadowSoft = Platform.OS === 'web'
  ? { boxShadow: '0px 5px 16px rgba(33, 48, 68, 0.055)' }
  : {
      shadowColor: '#213044',
      shadowOpacity: 0.055,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 5 },
      elevation: 1,
    };

export const shadowHover = Platform.OS === 'web'
  ? { boxShadow: '0px 16px 36px rgba(26, 58, 92, 0.12)' }
  : {
      shadowColor: '#213044',
      shadowOpacity: 0.12,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 10 },
      elevation: 4,
    };

export const webTransition = Platform.OS === 'web'
  ? ({ transitionProperty: 'transform, background-color, border-color, box-shadow, opacity', transitionDuration: '160ms', transitionTimingFunction: 'ease-out' } as any)
  : {};

export const layout = {
  contentMaxWidth: 1280,
  authMaxWidth: 1600,
};
