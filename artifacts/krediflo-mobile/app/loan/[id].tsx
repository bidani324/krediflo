import React, { useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import {
  getGetApplicantDocumentsQueryKey,
  getGetLoanQueryKey,
  useFetchApplicantDocs,
  useGetApplicantDocuments,
  useGetLoan,
} from '@workspace/api-client-react';
import {
  DocStatusPill,
  ErrorState,
  KFButton,
  KFCard,
  LOAN_STATUS_META,
  LoadingView,
  StatusBadge,
  formatINR,
} from '@/components/kf';
import { PRODUCT_LABEL } from '@/constants/products';
import { useColors } from '@/hooks/useColors';

const STATUS_ORDER = [
  'submitted',
  'docs_procured',
  'under_review',
  'sent_to_bank',
  'approved',
] as const;

const DOC_LABELS: Record<string, string> = {
  cibil_report: 'CIBIL Report',
  pan_verification: 'PAN Verification',
  mca_data: 'MCA Data',
  bank_statement: 'Bank Statements',
  form_16: 'Form 16',
  itr: 'ITR',
};

export default function LoanDetailScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const loanId = Number(id);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const loanQuery = useGetLoan(loanId, {
    query: {
      queryKey: getGetLoanQueryKey(loanId),
      enabled: Number.isFinite(loanId),
      refetchInterval: 6000,
    },
  });

  const loan = loanQuery.data;
  const primary = loan?.applicants?.find((a) => a.applicantType === 'primary');

  const docsQuery = useGetApplicantDocuments(primary?.id ?? 0, {
    query: {
      queryKey: getGetApplicantDocumentsQueryKey(primary?.id ?? 0),
      enabled: !!primary,
      refetchInterval: 6000,
    },
  });

  const fetchDocs = useFetchApplicantDocs();

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loanQuery.refetch(), docsQuery.refetch()]);
    setRefreshing(false);
  };

  if (loanQuery.isLoading) return <LoadingView />;
  if (loanQuery.isError || !loan) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ErrorState
          message={(loanQuery.error as Error)?.message ?? 'Failed to load application'}
          onRetry={() => loanQuery.refetch()}
        />
      </View>
    );
  }

  const documents = docsQuery.data ?? [];
  const anyFetching = documents.some((d) => d.status === 'fetching');
  const isRejected = loan.status === 'rejected';
  const progressIndex = STATUS_ORDER.indexOf(
    loan.status as (typeof STATUS_ORDER)[number],
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
    >
      {/* Summary */}
      <KFCard>
        <View style={styles.topRow}>
          <View>
            <Text style={[styles.refNo, { color: colors.mutedForeground }]}>
              KF-{String(loan.id).padStart(5, '0')}
            </Text>
            <Text style={[styles.loanType, { color: colors.foreground }]}>
              {PRODUCT_LABEL[loan.loanType as keyof typeof PRODUCT_LABEL] ?? loan.loanType}
            </Text>
          </View>
          <StatusBadge status={loan.status} />
        </View>
        <Text style={[styles.amount, { color: colors.primary }]}>
          {formatINR(loan.loanAmount)}
        </Text>
        <View style={styles.metaRow}>
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
            {loan.tenure} months
          </Text>
          {loan.interestRate != null ? (
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {loan.interestRate}% p.a.
            </Text>
          ) : null}
          {loan.purpose ? (
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {loan.purpose}
            </Text>
          ) : null}
        </View>
      </KFCard>

      {/* Progress timeline */}
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        Application Progress
      </Text>
      <KFCard style={{ gap: 0 }}>
        {isRejected ? (
          <View style={styles.timelineRow}>
            <Feather name="x-circle" size={18} color={colors.destructive} />
            <Text style={[styles.timelineLabel, { color: colors.destructive }]}>
              Application rejected
            </Text>
          </View>
        ) : (
          STATUS_ORDER.map((s, i) => {
            const done = progressIndex >= i;
            const isCurrent = progressIndex === i;
            return (
              <View key={s} style={styles.timelineRow}>
                <View style={styles.timelineLeft}>
                  <View
                    style={[
                      styles.timelineDot,
                      {
                        backgroundColor: done ? colors.primary : colors.secondary,
                        borderColor: done ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    {done ? (
                      <Feather name="check" size={11} color={colors.primaryForeground} />
                    ) : null}
                  </View>
                  {i < STATUS_ORDER.length - 1 ? (
                    <View
                      style={[
                        styles.timelineLine,
                        { backgroundColor: done ? `${colors.primary}66` : colors.border },
                      ]}
                    />
                  ) : null}
                </View>
                <Text
                  style={[
                    styles.timelineLabel,
                    {
                      color: done ? colors.foreground : colors.mutedForeground,
                      fontFamily: isCurrent ? 'Inter_700Bold' : 'Inter_500Medium',
                    },
                  ]}
                >
                  {LOAN_STATUS_META[s]?.label ?? s}
                </Text>
              </View>
            );
          })
        )}
      </KFCard>

      {/* Applicants */}
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        Applicants
      </Text>
      <View style={{ gap: 10 }}>
        {(loan.applicants ?? []).map((a) => (
          <KFCard key={a.id}>
            <View style={styles.topRow}>
              <Text style={[styles.applicantName, { color: colors.foreground }]}>
                {a.firstName} {a.lastName}
              </Text>
              <Text style={[styles.applicantType, { color: colors.mutedForeground }]}>
                {a.applicantType === 'primary' ? 'Primary' : 'Co-applicant'}
              </Text>
            </View>
            <View style={styles.checkRow}>
              <View style={styles.checkItem}>
                <Feather
                  name={a.cibilScore != null ? 'check-circle' : 'clock'}
                  size={13}
                  color={a.cibilScore != null ? colors.primary : colors.mutedForeground}
                />
                <Text style={[styles.checkText, { color: colors.mutedForeground }]}>
                  {a.cibilScore != null ? `CIBIL ${a.cibilScore}` : 'CIBIL pending'}
                </Text>
              </View>
              <View style={styles.checkItem}>
                <Feather
                  name={a.panVerified ? 'check-circle' : 'clock'}
                  size={13}
                  color={a.panVerified ? colors.primary : colors.mutedForeground}
                />
                <Text style={[styles.checkText, { color: colors.mutedForeground }]}>
                  PAN {a.panVerified ? 'verified' : 'pending'}
                </Text>
              </View>
              <View style={styles.checkItem}>
                <Feather
                  name={a.mcaVerified ? 'check-circle' : 'clock'}
                  size={13}
                  color={a.mcaVerified ? colors.primary : colors.mutedForeground}
                />
                <Text style={[styles.checkText, { color: colors.mutedForeground }]}>
                  MCA {a.mcaVerified ? 'verified' : 'pending'}
                </Text>
              </View>
            </View>
          </KFCard>
        ))}
      </View>

      {/* Documents */}
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        Documents
      </Text>
      <KFCard style={{ gap: 14 }}>
        {documents.length === 0 ? (
          <View style={{ alignItems: 'center', gap: 8, paddingVertical: 8 }}>
            <Feather name="file-text" size={22} color={colors.mutedForeground} />
            <Text style={[styles.emptyDocs, { color: colors.mutedForeground }]}>
              No documents fetched yet. Trigger a fetch to pull CIBIL, PAN, MCA
              and bank statements via API.
            </Text>
          </View>
        ) : (
          documents.map((d) => (
            <View key={d.id} style={styles.docRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.docName, { color: colors.foreground }]}>
                  {DOC_LABELS[d.docType] ?? d.docType}
                </Text>
                {d.fetchedAt ? (
                  <Text style={[styles.docTime, { color: colors.mutedForeground }]}>
                    Fetched {new Date(d.fetchedAt).toLocaleDateString('en-IN')}
                  </Text>
                ) : null}
              </View>
              <DocStatusPill status={d.status} />
            </View>
          ))
        )}
        {primary ? (
          <KFButton
            title={anyFetching ? 'Fetching documents…' : 'Fetch Documents'}
            icon="download-cloud"
            variant={documents.length === 0 ? 'gradient' : 'outline'}
            loading={fetchDocs.isPending || anyFetching}
            onPress={() =>
              fetchDocs.mutate(
                { id: primary.id },
                { onSettled: () => docsQuery.refetch() },
              )
            }
            testID="button-fetch-docs"
          />
        ) : null}
      </KFCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 80 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  refNo: { fontFamily: 'Inter_500Medium', fontSize: 11, letterSpacing: 1 },
  loanType: { fontFamily: 'Inter_700Bold', fontSize: 17, marginTop: 2 },
  amount: { fontFamily: 'Inter_700Bold', fontSize: 26, marginTop: 10 },
  metaRow: { flexDirection: 'row', gap: 14, marginTop: 6, flexWrap: 'wrap' },
  metaText: { fontFamily: 'Inter_400Regular', fontSize: 13 },
  sectionTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    marginTop: 22,
    marginBottom: 10,
  },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  timelineLeft: { alignItems: 'center', width: 22 },
  timelineDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineLine: { width: 2, height: 22, marginVertical: 2 },
  timelineLabel: { fontSize: 14, paddingTop: 1, paddingBottom: 14 },
  applicantName: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  applicantType: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  checkRow: { flexDirection: 'row', gap: 14, marginTop: 10, flexWrap: 'wrap' },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  checkText: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  docName: { fontFamily: 'Inter_500Medium', fontSize: 14 },
  docTime: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 1 },
  emptyDocs: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
