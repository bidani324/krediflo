import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCalculateEmi } from '@workspace/api-client-react';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { KFButton, KFCard, KFInput, formatINR } from '@/components/kf';
import { PRODUCT_RATE, type LoanType } from '@/constants/products';
import { useColors } from '@/hooks/useColors';

/**
 * Eligibility check: computes the EMI for the requested loan via the shared
 * calculator API, then applies a standard 50% FOIR (fixed-obligation-to-income
 * ratio) rule to estimate eligibility and the maximum affordable amount.
 */
export default function EligibilityScreen() {
  const colors = useColors();
  const params = useLocalSearchParams<{ type?: string }>();
  const initialType = (['home', 'lap', 'business', 'personal'].includes(params.type ?? '')
    ? params.type
    : 'home') as LoanType;

  const [amount, setAmount] = useState<string>('5000000');
  const [tenure, setTenure] = useState<string>('240');
  const [income, setIncome] = useState<string>('100000');
  const [obligations, setObligations] = useState<string>('0');
  const [error, setError] = useState<string>('');

  const calcEmi = useCalculateEmi();
  const rate = PRODUCT_RATE[initialType];

  const handleCheck = () => {
    setError('');
    const principal = Number(amount);
    const tenureMonths = Number(tenure);
    const monthlyIncome = Number(income);
    if (!principal || principal < 10000) {
      setError('Enter a loan amount of at least ₹10,000');
      return;
    }
    if (!tenureMonths || tenureMonths < 12) {
      setError('Tenure must be at least 12 months');
      return;
    }
    if (!monthlyIncome || monthlyIncome <= 0) {
      setError('Enter your monthly income');
      return;
    }
    calcEmi.mutate({ data: { principal, interestRate: rate, tenureMonths } });
  };

  const result = calcEmi.data;
  const monthlyIncome = Number(income) || 0;
  const monthlyObligations = Number(obligations) || 0;
  const disposable = Math.max(monthlyIncome * 0.5 - monthlyObligations, 0);
  const eligible = result ? result.emi <= disposable : false;
  const maxEmi = disposable;
  const maxAmount =
    result && result.emi > 0 ? (maxEmi / result.emi) * Number(amount) : 0;

  return (
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      bottomOffset={40}
    >
      <Text style={[styles.caption, { color: colors.mutedForeground }]}>
        Instant estimate at {rate}% p.a. — based on the standard 50% FOIR rule
        used by lenders.
      </Text>

      <View style={{ gap: 14, marginTop: 18 }}>
        <KFInput
          label="Loan Amount (₹)"
          value={amount}
          onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          testID="input-elig-amount"
        />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <KFInput
              label="Tenure (months)"
              value={tenure}
              onChangeText={(t) => setTenure(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              testID="input-elig-tenure"
            />
          </View>
          <View style={{ flex: 1 }}>
            <KFInput
              label="Monthly Income (₹)"
              value={income}
              onChangeText={(t) => setIncome(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              testID="input-elig-income"
            />
          </View>
        </View>
        <KFInput
          label="Existing EMIs / month (₹)"
          value={obligations}
          onChangeText={(t) => setObligations(t.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          testID="input-elig-obligations"
        />
        {error ? (
          <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>
        ) : null}
        <KFButton
          title={calcEmi.isPending ? 'Checking…' : 'Check Eligibility'}
          icon="zap"
          loading={calcEmi.isPending}
          onPress={handleCheck}
          testID="button-run-eligibility"
        />
      </View>

      {result ? (
        <KFCard style={{ marginTop: 20, gap: 12 }}>
          <View style={styles.resultRow}>
            <Text style={[styles.resultLabel, { color: colors.mutedForeground }]}>
              Monthly EMI
            </Text>
            <Text style={[styles.resultValue, { color: colors.foreground }]}>
              {formatINR(result.emi)}
            </Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={[styles.resultLabel, { color: colors.mutedForeground }]}>
              Total Interest
            </Text>
            <Text style={[styles.resultValue, { color: colors.foreground }]}>
              {formatINR(result.totalInterest)}
            </Text>
          </View>
          <View
            style={[
              styles.verdict,
              {
                backgroundColor: eligible
                  ? `${colors.primary}14`
                  : `${colors.destructive}14`,
                borderColor: eligible
                  ? `${colors.primary}44`
                  : `${colors.destructive}44`,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Text
              style={[
                styles.verdictTitle,
                { color: eligible ? colors.primary : colors.destructive },
              ]}
            >
              {eligible
                ? 'You look eligible for this loan'
                : 'EMI exceeds the comfortable limit'}
            </Text>
            <Text style={[styles.verdictSub, { color: colors.mutedForeground }]}>
              {eligible
                ? `EMI ${formatINR(result.emi)} fits within your ${formatINR(maxEmi)} monthly capacity. Apply now to confirm with partner banks.`
                : maxAmount > 0
                  ? `Based on your income, an amount up to ~${formatINR(maxAmount)} would be comfortable.`
                  : 'Your current obligations use up your EMI capacity. Consider a longer tenure or lower amount.'}
            </Text>
          </View>
          <KFButton
            title="Continue to Apply"
            icon="arrow-right"
            onPress={() =>
              router.push({ pathname: '/apply', params: { type: initialType, amount, tenure } })
            }
            testID="button-eligibility-apply"
          />
        </KFCard>
      ) : null}
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 60 },
  caption: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, textAlign: 'center' },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between' },
  resultLabel: { fontFamily: 'Inter_400Regular', fontSize: 13 },
  resultValue: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  verdict: { borderWidth: 1, padding: 14 },
  verdictTitle: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  verdictSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },
});
