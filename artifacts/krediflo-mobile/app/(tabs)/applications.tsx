import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import {
  EmptyState,
  ErrorState,
  KFButton,
  KFCard,
  LoadingView,
  StatusBadge,
  formatINR,
} from '@/components/kf';
import { PRODUCT_LABEL } from '@/constants/products';
import { loansApi, type MyLoan } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

export default function ApplicationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, isLoading: authLoading } = useAuth();
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const topPad = Platform.OS === 'web' ? 67 + 12 : insets.top + 12;

  const query = useQuery({
    queryKey: ['my-loans'],
    queryFn: loansApi.myLoans,
    enabled: !!user,
  });

  useFocusEffect(
    useCallback(() => {
      if (user) query.refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await query.refetch();
    setRefreshing(false);
  };

  if (authLoading) return <LoadingView />;

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>My Applications</Text>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon="lock"
            title="Sign in to track your loans"
            subtitle="Log in with your registered mobile number to see live application status and documents."
          />
          <KFButton
            title="Sign In"
            icon="log-in"
            onPress={() => router.push('/login')}
            style={{ marginHorizontal: 24 }}
            testID="button-signin-prompt"
          />
          <KFButton
            title="Create Account"
            variant="outline"
            onPress={() => router.push('/register')}
            style={{ margin: 24, marginTop: 10 }}
            testID="button-register-prompt"
          />
        </View>
      </View>
    );
  }

  const loans = query.data?.loans ?? [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.foreground }]}>My Applications</Text>
        <KFButton
          title="New"
          icon="plus"
          variant="outline"
          onPress={() => router.push('/apply')}
          style={{ minWidth: 90 }}
          testID="button-new-application"
        />
      </View>

      {query.isLoading ? (
        <LoadingView />
      ) : query.isError ? (
        <ErrorState
          message={(query.error as Error)?.message ?? 'Failed to load applications'}
          onRetry={() => query.refetch()}
        />
      ) : loans.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon="file-text"
            title="No applications yet"
            subtitle="Start your first loan application — most users complete eligibility in under 3 minutes."
          />
          <KFButton
            title="Apply Now"
            icon="arrow-right"
            onPress={() => router.push('/apply')}
            style={{ marginHorizontal: 24, marginBottom: 24 }}
            testID="button-apply-empty"
          />
        </View>
      ) : (
        <FlatList
          data={loans}
          scrollEnabled={loans.length > 0}
          keyExtractor={(l) => String(l.id)}
          contentContainerStyle={{ paddingBottom: 120, gap: 12 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }: { item: MyLoan }) => {
            const primary = item.applicants.find((a) => a.applicantType === 'primary');
            const verified = [
              primary?.cibilScore != null,
              primary?.panVerified,
              primary?.mcaVerified,
            ].filter(Boolean).length;
            return (
              <KFCard
                onPress={() => router.push({ pathname: '/loan/[id]', params: { id: String(item.id) } })}
                testID={`card-loan-${item.id}`}
              >
                <View style={styles.loanTopRow}>
                  <Text style={[styles.loanType, { color: colors.foreground }]}>
                    {PRODUCT_LABEL[item.loanType] ?? item.loanType}
                  </Text>
                  <StatusBadge status={item.status} />
                </View>
                <Text style={[styles.loanAmount, { color: colors.primary }]}>
                  {formatINR(item.loanAmount)}
                </Text>
                <View style={styles.loanMetaRow}>
                  <View style={styles.metaItem}>
                    <Feather name="calendar" size={12} color={colors.mutedForeground} />
                    <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                      {item.tenure} months
                    </Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Feather name="hash" size={12} color={colors.mutedForeground} />
                    <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                      KF-{String(item.id).padStart(5, '0')}
                    </Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Feather name="check-circle" size={12} color={colors.mutedForeground} />
                    <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                      {verified}/3 checks
                    </Text>
                  </View>
                </View>
              </KFCard>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 18 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: { fontFamily: 'Inter_700Bold', fontSize: 22 },
  loanTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  loanType: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  loanAmount: { fontFamily: 'Inter_700Bold', fontSize: 22, marginTop: 8 },
  loanMetaRow: { flexDirection: 'row', gap: 14, marginTop: 10, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontFamily: 'Inter_400Regular', fontSize: 12 },
});
