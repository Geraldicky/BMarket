import { Platform } from 'react-native';

export const colors = {
  primary: '#1167D8',
  primaryHover: '#0F5FC9',
  primaryDark: '#0C4FA8',
  primaryDeep: '#102A43',
  primarySoft: '#EAF3FF',
  primaryMist: '#F5F9FE',
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
  success: '#159568',
  successSoft: '#E9F8F2',
  danger: '#E05252',
  dangerSoft: '#FFF1F1',
  warning: '#E88918',
  warningSoft: '#FFF6E8',
  white: '#FFFFFF',
  ink: '#102233',
};

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
