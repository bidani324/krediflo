import React from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KFButton, KFCard, Wordmark } from '@/components/kf';
import { LOAN_PRODUCTS } from '@/constants/products';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';

const STEPS = [
  { step: '01', title: 'Select your loan', desc: 'Home, LAP, Business, or Personal.' },
  { step: '02', title: 'Instant verification', desc: 'PAN → CIBIL & MCA fetched via API in seconds.' },
  { step: '03', title: 'AA consent', desc: 'Share bank statements digitally — no PDF uploads.' },
  { step: '04', title: 'Track live', desc: 'Follow your application from submitted to approved.' },
];

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const topPad = Platform.OS === 'web' ? 67 + 12 : insets.top + 12;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: topPad,
        paddingBottom: 120,
        paddingHorizontal: 18,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <Wordmark size={26} />
        {user ? (
          <Text style={[styles.hello, { color: colors.mutedForeground }]}>
            Hi, {user.firstName}
          </Text>
        ) : null}
      </View>

      {/* Hero */}
      <LinearGradient
        colors={['#0A1F3D', '#071527']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { borderRadius: colors.radius + 8, borderColor: colors.border }]}
      >
        <View style={[styles.heroBadge, { borderColor: `${colors.primary}44`, backgroundColor: `${colors.primary}14` }]}>
          <Feather name="zap" size={12} color={colors.primary} />
          <Text style={[styles.heroBadgeText, { color: colors.primary }]}>
            DSA Partner — 40+ Banks & NBFCs
          </Text>
        </View>
        <Text style={[styles.heroTitle, { color: colors.foreground }]}>
          Seamless Data.{'\n'}
          <Text style={{ color: colors.primary }}>Effortless Credit.</Text>
        </Text>
        <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
          Real-time CIBIL, Account Aggregator and MCA verification — no PDFs,
          no branch visits.
        </Text>
        <KFButton
          title="Check Eligibility"
          icon="arrow-right"
          onPress={() => router.push('/eligibility')}
          style={{ marginTop: 16 }}
          testID="button-check-eligibility"
        />
        <KFButton
          title="Track My Applications"
          variant="outline"
          icon="activity"
          onPress={() => router.push('/(tabs)/applications')}
          style={{ marginTop: 10 }}
          testID="button-track-applications"
        />
      </LinearGradient>

      {/* Products */}
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        Loan Products
      </Text>
      <View style={{ gap: 12 }}>
        {LOAN_PRODUCTS.map((p) => (
          <KFCard
            key={p.type}
            onPress={() => router.push({ pathname: '/apply', params: { type: p.type } })}
            testID={`card-product-${p.type}`}
          >
            <View style={styles.productRow}>
              <View
                style={[
                  styles.productIcon,
                  { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}33`, borderRadius: colors.radius },
                ]}
              >
                <Feather name={p.icon} size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.productHighlight, { color: colors.primary }]}>
                  {p.highlight.toUpperCase()}
                </Text>
                <Text style={[styles.productLabel, { color: colors.foreground }]}>
                  {p.label}
                </Text>
                <Text style={[styles.productDesc, { color: colors.mutedForeground }]}>
                  {p.description}
                </Text>
                <Text style={[styles.productRate, { color: colors.warning }]}>
                  Starting {p.rate}
                </Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
            </View>
          </KFCard>
        ))}
      </View>

      {/* How it works */}
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        How Krediflo Works
      </Text>
      <KFCard style={{ gap: 16 }}>
        {STEPS.map((s) => (
          <View key={s.step} style={styles.stepRow}>
            <View
              style={[
                styles.stepBubble,
                { borderColor: `${colors.primary}44`, backgroundColor: `${colors.primary}12` },
              ]}
            >
              <Text style={[styles.stepNum, { color: colors.primary }]}>{s.step}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.stepTitle, { color: colors.foreground }]}>
                {s.title}
              </Text>
              <Text style={[styles.stepDesc, { color: colors.mutedForeground }]}>
                {s.desc}
              </Text>
            </View>
          </View>
        ))}
      </KFCard>

      <View style={styles.trustRow}>
        {[
          { icon: 'shield' as const, label: 'SSL Encrypted' },
          { icon: 'check-circle' as const, label: 'RBI-Compliant AA' },
          { icon: 'trending-up' as const, label: 'Live Tracking' },
        ].map((t) => (
          <View key={t.label} style={styles.trustItem}>
            <Feather name={t.icon} size={13} color={colors.primary} />
            <Text style={[styles.trustText, { color: colors.mutedForeground }]}>
              {t.label}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  hello: { fontFamily: 'Inter_500Medium', fontSize: 14 },
  hero: { borderWidth: 1, padding: 20 },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 14,
  },
  heroBadgeText: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  heroTitle: { fontFamily: 'Inter_700Bold', fontSize: 30, lineHeight: 36 },
  heroSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
  sectionTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 19,
    marginTop: 28,
    marginBottom: 12,
  },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  productIcon: {
    width: 42,
    height: 42,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productHighlight: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    letterSpacing: 1,
    marginBottom: 2,
  },
  productLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  productDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  productRate: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginTop: 6 },
  stepRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  stepTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  stepDesc: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, marginTop: 2 },
  trustRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 24,
    flexWrap: 'wrap',
  },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  trustText: { fontFamily: 'Inter_400Regular', fontSize: 12 },
});
