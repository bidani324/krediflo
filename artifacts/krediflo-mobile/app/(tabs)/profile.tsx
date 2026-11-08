import React, { useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { EmptyState, KFButton, KFCard, Wordmark } from '@/components/kf';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [loggingOut, setLoggingOut] = useState<boolean>(false);

  const topPad = Platform.OS === 'web' ? 67 + 12 : insets.top + 12;

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      queryClient.clear();
    } finally {
      setLoggingOut(false);
    }
  };

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Account</Text>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon="user"
            title="You're not signed in"
            subtitle="Sign in to view your profile, applications and verification status."
          />
          <KFButton
            title="Sign In"
            icon="log-in"
            onPress={() => router.push('/login')}
            style={{ marginHorizontal: 24 }}
            testID="button-profile-signin"
          />
          <KFButton
            title="Create Account"
            variant="outline"
            onPress={() => router.push('/register')}
            style={{ margin: 24, marginTop: 10 }}
            testID="button-profile-register"
          />
        </View>
      </View>
    );
  }

  const rows: { icon: keyof typeof Feather.glyphMap; label: string; value: string }[] = [
    { icon: 'phone', label: 'Mobile', value: user.mobile },
    { icon: 'credit-card', label: 'PAN', value: user.pan },
    ...(user.address
      ? [{ icon: 'map-pin' as const, label: 'Address', value: user.address }]
      : []),
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: topPad, paddingHorizontal: 18, paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>Account</Text>

      <KFCard style={{ alignItems: 'center', paddingVertical: 26, marginTop: 14 }}>
        <View
          style={[
            styles.avatar,
            { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}44` },
          ]}
        >
          <Text style={[styles.avatarText, { color: colors.primary }]}>
            {user.firstName.charAt(0)}
            {user.lastName.charAt(0)}
          </Text>
        </View>
        <Text style={[styles.name, { color: colors.foreground }]}>
          {user.firstName} {user.lastName}
        </Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          Krediflo applicant
        </Text>
      </KFCard>

      <KFCard style={{ marginTop: 14, gap: 16 }}>
        {rows.map((r) => (
          <View key={r.label} style={styles.row}>
            <Feather name={r.icon} size={16} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>
                {r.label}
              </Text>
              <Text style={[styles.rowValue, { color: colors.foreground }]}>
                {r.value}
              </Text>
            </View>
          </View>
        ))}
      </KFCard>

      <KFButton
        title="View My Applications"
        icon="activity"
        variant="outline"
        onPress={() => router.push('/(tabs)/applications')}
        style={{ marginTop: 18 }}
        testID="button-view-applications"
      />
      <KFButton
        title="Sign Out"
        icon="log-out"
        variant="destructive"
        loading={loggingOut}
        onPress={handleLogout}
        style={{ marginTop: 10 }}
        testID="button-logout"
      />

      <View style={{ alignItems: 'center', marginTop: 30, gap: 6 }}>
        <Wordmark size={16} />
        <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
          Seamless Credit & Data Flow · RBI-Compliant AA
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 18 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 22 },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { fontFamily: 'Inter_700Bold', fontSize: 22 },
  name: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  sub: { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowLabel: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  rowValue: { fontFamily: 'Inter_500Medium', fontSize: 14, marginTop: 1 },
  footerText: { fontFamily: 'Inter_400Regular', fontSize: 11 },
});
