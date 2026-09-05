import { Platform } from 'react-native';

export const colors = {
  primary: '#1167D8',
  primaryDark: '#0C4FA8',
  primaryDeep: '#102A43',
  primarySoft: '#EAF3FF',
  accent: '#12805C',
  accentSoft: '#E8F8F2',
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceMuted: '#F7F9FC',
  text: '#172B3A',
  textSoft: '#4A6072',
  muted: '#728496',
  border: '#DFE6EC',
  borderStrong: '#C9D5DF',
  success: '#159568',
  successSoft: '#E9F8F2',
  danger: '#E05252',
  dangerSoft: '#FFF1F1',
  warning: '#E88918',
  warningSoft: '#FFF6E8',
  white: '#FFFFFF',
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
  xl: 18,
  pill: 999,
};

export const shadow = Platform.OS === 'web'
  ? { boxShadow: '0px 6px 16px rgba(33, 48, 68, 0.06)' }
  : {
      shadowColor: '#213044',
      shadowOpacity: 0.06,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    };

export const shadowSoft = Platform.OS === 'web'
  ? { boxShadow: '0px 3px 10px rgba(33, 48, 68, 0.045)' }
  : {
      shadowColor: '#213044',
      shadowOpacity: 0.045,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
      elevation: 1,
    };

export const layout = {
  contentMaxWidth: 1280,
  authMaxWidth: 1600,
};
