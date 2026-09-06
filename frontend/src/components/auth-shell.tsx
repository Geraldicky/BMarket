import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, useWindowDimensions, View, ScrollView } from 'react-native';
import Animated, { FadeInDown, FadeInLeft } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/constants/theme';

const assurances = [
  { icon: 'shield-checkmark-outline' as const, title: 'Identitas kampus', copy: 'Akun diverifikasi dengan email BINUS.' },
  { icon: 'chatbubble-ellipses-outline' as const, title: 'Koordinasi jelas', copy: 'Chat dan konteks transaksi berada di satu tempat.' },
  { icon: 'wallet-outline' as const, title: 'Serah-terima terstruktur', copy: 'Dana ditahan sampai transaksi benar-benar selesai.' },
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
              <View style={s.gridGlow} />
              <View style={s.brandWrap}>
                <View style={s.brandMark}><Text style={s.brandMarkText}>B</Text></View>
                <View><Text style={s.brandName}>BMarket</Text><Text style={s.brandCaption}>Marketplace komunitas BINUS</Text></View>
              </View>

              <Animated.View entering={FadeInLeft.duration(260)} style={s.visualContent}>
                <Text style={s.kicker}>DARI BINUSIAN, UNTUK BINUSIAN</Text>
                <Text style={s.visualTitle}>Tempat transaksi kampus terasa lebih dekat.</Text>
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
          ) : (
            <View style={s.mobileBrand}><View style={s.mobileBrandRow}><View style={s.mobileMark}><Text style={s.mobileMarkText}>B</Text></View><Text style={s.mobileName}>BMarket</Text></View><Text style={s.mobileCaption}>Marketplace komunitas BINUS</Text></View>
          )}

          <View style={[s.formPanel, !desktop && s.formPanelMobile, compactMobile && s.formPanelCompact]}>
            <View style={s.formContent}>
              <Animated.View entering={FadeInDown.duration(180)} style={s.formHeader}>
                <View style={s.eyebrowPill}><Text style={s.eyebrow}>{eyebrow}</Text></View>
                <Text style={[s.formTitle, compactMobile && s.formTitleCompact]}>{title}</Text>
                <Text style={s.formSubtitle}>{subtitle}</Text>
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(45).duration(210)}>{children}</Animated.View>

              <View style={s.securityNote}><Ionicons name="shield-checkmark-outline" size={18} color={colors.success} /><Text style={s.securityText}>Gunakan email BINUS dan jangan bagikan password atau kode OTP kepada siapa pun.</Text></View>
              <Text style={s.copyright}>© 2026 BMarket</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { flexGrow: 1, justifyContent: 'center' },
  scrollDesktop: { padding: 0 },
  scrollMobile: { justifyContent: 'flex-start', paddingHorizontal: 18, paddingVertical: 16 },
  scrollCompact: { paddingHorizontal: 14, paddingVertical: 12 },
  shell: { width: '100%' },
  shellDesktop: { flexDirection: 'row' },

  visual: { width: '42%', minHeight: 700, position: 'relative', overflow: 'hidden', backgroundColor: '#0E2942', paddingHorizontal: 66, paddingVertical: 46, justifyContent: 'space-between' },
  gridGlow: { position: 'absolute', width: 520, height: 520, right: -220, bottom: -240, borderRadius: 260, backgroundColor: '#113E6C', opacity: .72 },
  brandWrap: { zIndex: 1, flexDirection: 'row', alignItems: 'center', gap: 11 },
  brandMark: { width: 39, height: 39, borderRadius: 12, backgroundColor: '#1769C2', alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { fontFamily: 'PoppinsBold', fontSize: 22, color: '#FFFFFF' },
  brandName: { fontFamily: 'PoppinsBold', fontSize: 24, lineHeight: 28, color: '#FFFFFF' },
  brandCaption: { fontFamily: 'PoppinsRegular', fontSize: 10.5, color: '#9EB6CB' },

  visualContent: { zIndex: 1, maxWidth: 500, gap: 10 },
  kicker: { fontFamily: 'PoppinsBold', fontSize: 10.5, letterSpacing: 1, color: '#73B8FF' },
  visualTitle: { fontFamily: 'PoppinsBold', fontSize: 39, lineHeight: 49, color: '#FFFFFF', letterSpacing: -.45, maxWidth: 500 },
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

  formPanel: { flex: 1, minHeight: 700, backgroundColor: '#FFFFFF', paddingHorizontal: 58, paddingVertical: 46, alignItems: 'center', justifyContent: 'center' },
  formPanelMobile: { minHeight: 0, paddingHorizontal: 0, paddingTop: 10, paddingBottom: 22 },
  formPanelCompact: { paddingTop: 5 },
  formContent: { width: '100%', maxWidth: 500, gap: 22 },
  formHeader: { gap: 6, marginBottom: 2 },
  eyebrowPill: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.primarySoft },
  eyebrow: { fontFamily: 'PoppinsBold', fontSize: 10.5, letterSpacing: .75, color: colors.primary },
  formTitle: { fontFamily: 'PoppinsBold', fontSize: 32, lineHeight: 40, letterSpacing: -.35, color: colors.text },
  formTitleCompact: { fontSize: 27, lineHeight: 34 },
  formSubtitle: { fontFamily: 'PoppinsRegular', fontSize: 13.5, lineHeight: 21, color: colors.muted, maxWidth: 470 },
  securityNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border },
  securityText: { flex: 1, fontFamily: 'PoppinsRegular', fontSize: 11.5, lineHeight: 18, color: colors.muted },
  copyright: { fontFamily: 'PoppinsRegular', fontSize: 10, color: '#9AA8B5', textAlign: 'center' },

  mobileBrand: { alignItems: 'flex-start', gap: 2, marginBottom: 16, paddingHorizontal: 2 },
  mobileBrandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mobileMark: { width: 31, height: 31, borderRadius: 9, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  mobileMarkText: { fontFamily: 'PoppinsBold', fontSize: 17, color: '#FFFFFF' },
  mobileName: { fontFamily: 'PoppinsBold', fontSize: 23, color: colors.primaryDeep },
  mobileCaption: { fontFamily: 'PoppinsRegular', fontSize: 10.75, color: colors.muted, marginLeft: 39 },
});
