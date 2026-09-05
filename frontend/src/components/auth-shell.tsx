import Ionicons from '@expo/vector-icons/Ionicons';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/constants/theme';

const assurances = [
  { icon: 'shield-checkmark-outline' as const, title: 'Akun BINUS', copy: 'Akses menggunakan identitas kampus.' },
  { icon: 'chatbubble-ellipses-outline' as const, title: 'Chat tercatat', copy: 'Koordinasi buyer dan seller lebih jelas.' },
  { icon: 'wallet-outline' as const, title: 'Transaksi aman', copy: 'Dana ditahan sampai serah-terima selesai.' },
];

export function AuthShell({ eyebrow, title, subtitle, children }: { eyebrow: string; title: string; subtitle: string; children: React.ReactNode }) {
  const { width, height } = useWindowDimensions();
  const desktop = width >= 900;
  const compactMobile = width < 480;

  return (
    <SafeAreaView style={s.page} edges={['top', 'bottom']}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[s.scroll, desktop && s.scrollDesktop, !desktop && s.scrollMobile, compactMobile && s.scrollCompact]}>
        <View style={[s.shell, desktop && s.shellDesktop, desktop && { minHeight: height }]}> 
          {desktop ? (
            <View style={s.visual}>
              <View style={s.orbTop} />
              <View style={s.orbBottom} />

              <View style={s.brandWrap}>
                <Text style={s.brandName}>BMarket</Text>
                <Text style={s.brandCaption}>Marketplace komunitas BINUS</Text>
              </View>

              <View style={s.visualContent}>
                <Text style={s.kicker}>DARI BINUSIAN, UNTUK BINUSIAN</Text>
                <Text style={s.visualTitle}>Jual-beli kampus yang terasa lebih dekat.</Text>
                <Text style={s.visualCopy}>Temukan barang dan jasa dari sesama mahasiswa, lalu koordinasikan transaksi langsung di BMarket.</Text>

                <View style={s.assuranceList}>
                  {assurances.map(item => (
                    <View key={item.title} style={s.assuranceItem}>
                      <View style={s.assuranceIcon}><Ionicons name={item.icon} size={18} color={colors.white} /></View>
                      <View style={s.assuranceCopy}>
                        <Text style={s.assuranceTitle}>{item.title}</Text>
                        <Text style={s.assuranceText}>{item.copy}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              <View style={s.visualFoot}>
                <View style={s.communityDot} />
                <Text style={s.footText}>Khusus komunitas BINUS</Text>
              </View>
            </View>
          ) : (
            <View style={s.mobileBrand}>
              <Text style={s.mobileName}>BMarket</Text>
              <Text style={s.mobileCaption}>Marketplace komunitas BINUS</Text>
            </View>
          )}

          <View style={[s.formPanel, !desktop && s.formPanelMobile, compactMobile && s.formPanelCompact]}>
            <View style={s.formContent}>
              <Animated.View entering={FadeInDown.duration(180)} style={s.formHeader}>
                <View style={s.eyebrowPill}><Text style={s.eyebrow}>{eyebrow}</Text></View>
                <Text style={[s.formTitle, compactMobile && s.formTitleCompact]}>{title}</Text>
                <Text style={s.formSubtitle}>{subtitle}</Text>
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(50).duration(210)}>{children}</Animated.View>

              <View style={s.securityNote}>
                <Ionicons name="shield-checkmark-outline" size={18} color={colors.success} />
                <Text style={s.securityText}>Gunakan email BINUS dan jangan bagikan password atau kode OTP kepada siapa pun.</Text>
              </View>

              <Text style={s.copyright}>© 2026 BMarket</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surface },
  scroll: { flexGrow: 1, padding: 16, justifyContent: 'center' },
  scrollDesktop: { padding: 0 },
  scrollMobile: { justifyContent: 'flex-start', padding: 14 },
  scrollCompact: { padding: 10 },
  shell: { width: '100%' },
  shellDesktop: { flexDirection: 'row' },

  visual: { width: '43%', minHeight: 700, backgroundColor: colors.primaryDeep, paddingHorizontal: 64, paddingVertical: 46, justifyContent: 'space-between', overflow: 'hidden' },
  orbTop: { position: 'absolute', width: 360, height: 360, borderRadius: 180, left: -190, top: -150, borderWidth: 1, borderColor: 'rgba(255,255,255,.07)' },
  orbBottom: { position: 'absolute', width: 430, height: 430, borderRadius: 215, right: -245, bottom: -250, backgroundColor: 'rgba(17,103,216,.24)' },

  brandWrap: { zIndex: 1, gap: 1 },
  brandName: { fontFamily: 'PoppinsBold', fontSize: 27, lineHeight: 32, color: colors.white },
  brandCaption: { fontFamily: 'PoppinsMedium', fontSize: 11, color: '#AFC3D5' },

  visualContent: { zIndex: 1, maxWidth: 520, gap: 11 },
  kicker: { fontFamily: 'PoppinsBold', fontSize: 11, letterSpacing: .95, color: '#78B8F7' },
  visualTitle: { fontFamily: 'PoppinsBold', fontSize: 38, lineHeight: 48, color: colors.white, maxWidth: 500 },
  visualCopy: { fontFamily: 'PoppinsRegular', fontSize: 14, lineHeight: 23, color: '#C4D4E2', maxWidth: 500 },

  assuranceList: { gap: 10, marginTop: 18 },
  assuranceItem: { minHeight: 58, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,.055)', borderWidth: 1, borderColor: 'rgba(255,255,255,.07)', flexDirection: 'row', alignItems: 'center', gap: 12 },
  assuranceIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(17,103,216,.72)', alignItems: 'center', justifyContent: 'center' },
  assuranceCopy: { flex: 1, gap: 1 },
  assuranceTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 12.5, color: colors.white },
  assuranceText: { fontFamily: 'PoppinsRegular', fontSize: 10.5, lineHeight: 16, color: '#AFC3D5' },

  visualFoot: { zIndex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  communityDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#69D0A7' },
  footText: { fontFamily: 'PoppinsMedium', fontSize: 11, color: '#A9BDCE' },

  formPanel: { flex: 1, minHeight: 700, backgroundColor: colors.surface, paddingHorizontal: 56, paddingVertical: 46, alignItems: 'center', justifyContent: 'center' },
  formPanelMobile: { minHeight: 0, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  formPanelCompact: { padding: 15, borderRadius: 14 },
  formContent: { width: '100%', maxWidth: 500, gap: 22 },
  formHeader: { gap: 5, marginBottom: 2 },
  eyebrowPill: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.primarySoft },
  eyebrow: { fontFamily: 'PoppinsBold', fontSize: 10.5, letterSpacing: .75, color: colors.primary },
  formTitle: { fontFamily: 'PoppinsBold', fontSize: 32, lineHeight: 40, color: colors.text },
  formTitleCompact: { fontSize: 26, lineHeight: 33 },
  formSubtitle: { fontFamily: 'PoppinsRegular', fontSize: 13.5, lineHeight: 21, color: colors.muted, maxWidth: 470 },

  securityNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border },
  securityText: { flex: 1, fontFamily: 'PoppinsRegular', fontSize: 11.5, lineHeight: 18, color: colors.muted },
  copyright: { fontFamily: 'PoppinsRegular', fontSize: 10, color: '#9AA8B5', textAlign: 'center' },

  mobileBrand: { alignItems: 'flex-start', marginBottom: 14, paddingHorizontal: 2 },
  mobileName: { fontFamily: 'PoppinsBold', fontSize: 25, color: colors.primary },
  mobileCaption: { fontFamily: 'PoppinsRegular', fontSize: 11, color: colors.muted },
});
