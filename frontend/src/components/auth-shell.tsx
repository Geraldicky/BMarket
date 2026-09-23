import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, useWindowDimensions, View, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Animated, { FadeInDown, FadeInLeft, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthBackdrop } from '@/components/auth-backdrop';
import { TypewriterLoop } from '@/components/typewriter';
import { colors, makeStyles, useThemeStore, type ThemeMode } from '@/constants/theme';
import { BrandLogo } from '@/components/brand-logo';

const themeOptions: { mode: ThemeMode; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { mode: 'light', label: 'Terang', icon: 'sunny-outline' },
  { mode: 'dark', label: 'Gelap', icon: 'moon-outline' },
  { mode: 'system', label: 'Sistem', icon: 'phone-portrait-outline' },
];

// Same preference as the profile page, so the choice made before signing in carries over to the app.
// `onDark` styles the switcher for the navy mobile header instead of the themed form card.
function AuthThemeSwitcher({ compact, onDark = false }: { compact: boolean; onDark?: boolean }) {
  const s = useStyles();
  const mode = useThemeStore(state => state.mode);
  const setMode = useThemeStore(state => state.setMode);
  return (
    <View style={[s.themeOptions, onDark && s.themeOptionsOnDark]} accessibilityRole="radiogroup" accessibilityLabel="Tema tampilan">
      {themeOptions.map(option => {
        const active = mode === option.mode;
        const iconColor = onDark ? (active ? '#0C4FA8' : '#D6E2EE') : (active ? colors.primary : colors.muted);
        return (
          <Pressable key={option.mode} accessibilityRole="radio" accessibilityState={{ checked: active }} accessibilityLabel={`Tema ${option.label}`} onPress={() => setMode(option.mode)} style={({ pressed }) => [s.themeOption, active && s.themeOptionActive, active && onDark && s.themeOptionActiveOnDark, pressed && { opacity: .7 }]}>
            <Ionicons name={option.icon} size={14} color={iconColor} />
            {compact ? null : <Text style={[s.themeOptionText, active && s.themeOptionTextActive]}>{option.label}</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

const headlinePhrases = [
  'Tempat transaksi kampus terasa lebih dekat.',
  'Jual barang bekas ke sesama Binusian.',
  'Ikut pre-order bareng tanpa ribet.',
  'Temukan jasa dari teman satu kampus.',
  'Dana aman sampai pesanan diterima.',
];
// Reserves room for the longest phrase so the content below does not jump while typing.
const longestHeadline = headlinePhrases.reduce((longest, phrase) => phrase.length > longest.length ? phrase : longest, '');

const assurances = [
  { icon: 'shield-checkmark-outline' as const, title: 'Identitas kampus', copy: 'Akun diverifikasi dengan email BINUS.' },
  { icon: 'chatbubble-ellipses-outline' as const, title: 'Koordinasi jelas', copy: 'Chat dan konteks transaksi berada di satu tempat.' },
  { icon: 'wallet-outline' as const, title: 'Serah-terima terstruktur', copy: 'Dana ditahan sampai transaksi benar-benar selesai.' },
];

export function AuthShell({ eyebrow, title, subtitle, children }: { eyebrow: string; title: string; subtitle: string; children: React.ReactNode }) {
  const s = useStyles();
  const { width, height } = useWindowDimensions();
  const desktop = width >= 900;
  const compactMobile = width < 480;

  return (
    <SafeAreaView style={[s.page, !desktop && s.pageMobile]} edges={['top', 'bottom']}>
      {/* Mobile: the moving backdrop stays fixed behind the scrolling content, like the desktop hero panel. */}
      {!desktop ? <><StatusBar style="light" /><View style={s.gridGlow} /><AuthBackdrop /></> : null}
      {/* Mobile: brand and theme switcher live in a fixed header bar; only the card area scrolls. */}
      {!desktop ? (
        <View style={[s.mobileHeader, compactMobile && s.mobileHeaderCompact]}>
          <View style={s.mobileBrand}><View style={s.mobileBrandRow}><BrandLogo style={s.mobileLogo} /></View><Text style={s.mobileCaption}>Marketplace komunitas BINUS</Text></View>
          <AuthThemeSwitcher compact onDark />
        </View>
      ) : null}
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[s.scroll, desktop && s.scrollDesktop, !desktop && s.scrollMobile, compactMobile && s.scrollCompact]}>
        <View style={[s.shell, desktop && s.shellDesktop, !desktop && s.shellMobile, desktop && { minHeight: height }]}>
          {desktop ? (
            <View style={s.visual}>
              <View style={s.gridGlow} />
              <AuthBackdrop />
              <View style={s.brandWrap}><BrandLogo style={s.authLogo} /><Text style={s.brandCaption}>Marketplace komunitas BINUS</Text></View>

              <Animated.View entering={FadeInLeft.duration(260)} style={s.visualContent}>
                <Text style={s.kicker}>DARI BINUSIAN, UNTUK BINUSIAN</Text>
                <View>
                  <Text style={[s.visualTitle, s.headlineSizer]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{`${longestHeadline}|`}</Text>
                  <TypewriterLoop phrases={headlinePhrases} style={[s.visualTitle, s.headlineTyping]} />
                </View>
                <Text style={s.visualCopy}>Cari barang, ikut pre-order, atau jual kebutuhan kampus tanpa menenggelamkan group chat.</Text>

                <View style={s.assuranceList}>
                  {assurances.map((item, index) => (
                    <Animated.View entering={FadeInDown.delay(70 + index * 45).duration(220)} key={item.title} style={s.assuranceItem}>
                      <View style={s.assuranceLine}><View style={s.assuranceDot} />{index < assurances.length - 1 ? <View style={s.assuranceStem} /> : null}</View>
                      <View style={s.assuranceIcon}><Ionicons name={item.icon} size={18} color="#DCEEFF" /></View>
                      <View style={s.assuranceCopy}><Text style={s.assuranceTitle}>{item.title}</Text><Text style={s.assuranceText}>{item.copy}</Text></View>
                    </Animated.View>
                  ))}
                </View>
              </Animated.View>

              <View style={s.visualFoot}><View style={s.communityDot} /><Text style={s.footText}>Dibuat untuk ritme jual-beli mahasiswa</Text></View>
            </View>
          ) : null}

          <Animated.View entering={desktop ? undefined : ZoomIn.springify().damping(18)} style={[s.formPanel, !desktop && s.formPanelMobile, compactMobile && s.formPanelCompact]}>
            <View style={[s.formContent, !desktop && s.formContentMobile]}>
              {desktop ? <View style={s.themeRow}><AuthThemeSwitcher compact={false} /></View> : null}
              <Animated.View entering={FadeInDown.duration(180)} style={s.formHeader}>
                {desktop ? <View style={s.eyebrowPill}><Text style={s.eyebrow}>{eyebrow}</Text></View> : null}
                <Text style={[s.formTitle, !desktop && s.formTitleMobile, compactMobile && s.formTitleCompact]}>{title}</Text>
                <Text style={[s.formSubtitle, !desktop && s.formSubtitleMobile]}>{subtitle}</Text>
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(45).duration(210)}>{children}</Animated.View>

              <View style={s.securityNote}><Ionicons name="shield-checkmark-outline" size={desktop ? 18 : 16} color={colors.success} /><Text style={[s.securityText, !desktop && s.securityTextMobile]}>Gunakan email BINUS dan jangan bagikan password atau kode OTP kepada siapa pun.</Text></View>
              <Text style={s.copyright}>© 2026 BMarket</Text>
            </View>
          </Animated.View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(() => ({
  page: { flex: 1, backgroundColor: colors.surface },
  pageMobile: { backgroundColor: '#0E2942', overflow: 'hidden' },
  scroll: { flexGrow: 1, justifyContent: 'center' },
  scrollDesktop: { padding: 0 },
  // Centers the brand + card as a group; when taller than the screen, the ScrollView still scrolls.
  scrollMobile: { justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  scrollCompact: { paddingHorizontal: 12, paddingVertical: 10 },
  shell: { width: '100%' },
  shellDesktop: { flexDirection: 'row' },
  shellMobile: { maxWidth: 520, alignSelf: 'center' },

  visual: { width: '42%', minHeight: 700, position: 'relative', overflow: 'hidden', backgroundColor: '#0E2942', paddingHorizontal: 66, paddingVertical: 46, justifyContent: 'space-between' },
  gridGlow: { position: 'absolute', width: 520, height: 520, right: -220, bottom: -240, borderRadius: 260, backgroundColor: '#113E6C', opacity: .72 },
  brandWrap: { zIndex: 1, alignItems: 'flex-start', gap: 2 },
  authLogo: { width: 174, height: 56 },
  brandCaption: { fontFamily: 'PoppinsRegular', fontSize: 10.5, color: '#9EB6CB' },

  visualContent: { zIndex: 1, maxWidth: 500, gap: 10 },
  kicker: { fontFamily: 'PoppinsBold', fontSize: 10.5, letterSpacing: 1, color: '#73B8FF' },
  visualTitle: { fontFamily: 'PoppinsBold', fontSize: 39, lineHeight: 49, color: '#FFFFFF', letterSpacing: -.45, maxWidth: 500 },
  headlineSizer: { opacity: 0 },
  headlineTyping: { position: 'absolute', top: 0, left: 0, right: 0 },
  visualCopy: { fontFamily: 'PoppinsRegular', fontSize: 14, lineHeight: 23, color: '#BCD0E0', maxWidth: 470 },
  assuranceList: { gap: 0, marginTop: 22 },
  assuranceItem: { minHeight: 66, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  assuranceLine: { width: 12, alignItems: 'center', alignSelf: 'stretch', paddingTop: 17 },
  assuranceDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#69D0A7', zIndex: 2 },
  assuranceStem: { position: 'absolute', top: 23, bottom: -5, width: 1, backgroundColor: 'rgba(153,189,219,.26)' },
  assuranceIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: 'rgba(34,121,210,.22)', borderWidth: 1, borderColor: 'rgba(115,184,255,.17)', alignItems: 'center', justifyContent: 'center' },
  assuranceCopy: { flex: 1, gap: 2, paddingTop: 1 },
  assuranceTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 12.5, color: '#FFFFFF' },
  assuranceText: { fontFamily: 'PoppinsRegular', fontSize: 10.75, lineHeight: 17, color: '#9FB7CA' },
  visualFoot: { zIndex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  communityDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#69D0A7' },
  footText: { fontFamily: 'PoppinsMedium', fontSize: 10.75, color: '#A8BECE' },

  formPanel: { flex: 1, minHeight: 700, backgroundColor: colors.surface, paddingHorizontal: 58, paddingVertical: 46, alignItems: 'center', justifyContent: 'center' },
  // Mobile: the form floats as a highlighted card above the moving backdrop.
  // flexBasis 'auto' (not `flex: 0`, which becomes flex-basis 0 on web) lets the card grow to fit the form.
  formPanelMobile: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', minHeight: 0, paddingHorizontal: 20, paddingVertical: 20, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(115,184,255,.22)', shadowColor: '#020B14', shadowOpacity: .45, shadowRadius: 28, shadowOffset: { width: 0, height: 14 }, elevation: 14 },
  formPanelCompact: { paddingHorizontal: 16, paddingVertical: 16, borderRadius: 18 },
  formContent: { width: '100%', maxWidth: 500, gap: 22 },
  formContentMobile: { gap: 12 },
  themeRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: -8 },
  themeOptions: { flexDirection: 'row', gap: 3, padding: 3, borderRadius: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted },
  themeOption: { minHeight: 32, paddingHorizontal: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  themeOptionActive: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primaryBorder },
  themeOptionsOnDark: { borderColor: 'rgba(255,255,255,.16)', backgroundColor: 'rgba(255,255,255,.08)' },
  themeOptionActiveOnDark: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  themeOptionText: { fontFamily: 'PoppinsSemiBold', fontSize: 11.5, color: colors.muted },
  themeOptionTextActive: { color: colors.primary },
  formHeader: { gap: 6, marginBottom: 2 },
  eyebrowPill: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.primarySoft },
  eyebrow: { fontFamily: 'PoppinsBold', fontSize: 10.5, letterSpacing: .75, color: colors.primary },
  formTitle: { fontFamily: 'PoppinsBold', fontSize: 32, lineHeight: 40, letterSpacing: -.35, color: colors.text },
  formTitleMobile: { fontSize: 26, lineHeight: 33, letterSpacing: -.25 },
  formTitleCompact: { fontSize: 22, lineHeight: 29 },
  formSubtitle: { fontFamily: 'PoppinsRegular', fontSize: 13.5, lineHeight: 21, color: colors.muted, maxWidth: 470 },
  formSubtitleMobile: { fontSize: 12.5, lineHeight: 19 },
  securityNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border },
  securityText: { flex: 1, fontFamily: 'PoppinsRegular', fontSize: 11.5, lineHeight: 18, color: colors.muted },
  securityTextMobile: { fontSize: 10.75, lineHeight: 16 },
  copyright: { fontFamily: 'PoppinsRegular', fontSize: 10, color: colors.muted, textAlign: 'center' },

  mobileHeader: { zIndex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: 'rgba(14,41,66,.78)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,.08)' },
  mobileHeaderCompact: { paddingHorizontal: 12 },
  mobileBrand: { alignItems: 'flex-start', gap: 1, paddingHorizontal: 2, flexShrink: 1 },
  mobileBrandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mobileLogo: { width: 132, height: 42 },
  mobileCaption: { fontFamily: 'PoppinsRegular', fontSize: 10.5, color: '#9EB6CB', marginLeft: 35 },
}));
