import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCreateLoan } from '@workspace/api-client-react';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { KFButton, KFCard, KFInput, formatINR } from '@/components/kf';
import { LOAN_PRODUCTS, PRODUCT_LABEL, type LoanType } from '@/constants/products';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

const STEP_TITLES = ['Loan Details', 'Your Details', 'Review & Submit'];

export default function ApplyScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ type?: string; amount?: string; tenure?: string }>();

  const [step, setStep] = useState<number>(0);
  const [loanType, setLoanType] = useState<LoanType>(
    (['home', 'lap', 'business', 'personal'].includes(params.type ?? '')
      ? params.type
      : 'home') as LoanType,
  );
  const [amount, setAmount] = useState<string>(params.amount ?? '5000000');
  const [tenure, setTenure] = useState<string>(params.tenure ?? '240');
  const [purpose, setPurpose] = useState<string>('');

  const [firstName, setFirstName] = useState<string>(user?.firstName ?? '');
  const [lastName, setLastName] = useState<string>(user?.lastName ?? '');
  const [email, setEmail] = useState<string>('');
  const [mobile, setMobile] = useState<string>(user?.mobile ?? '');
  const [pan, setPan] = useState<string>('');
  const [address, setAddress] = useState<string>(user?.address ?? '');

  const [error, setError] = useState<string>('');
  const createLoan = useCreateLoan();

  // Prefill applicant fields once the user signs in (the gate below may have
  // been showing when this screen first mounted).
  useEffect(() => {
    if (!user) return;
    setFirstName((v) => v || user.firstName);
    setLastName((v) => v || user.lastName);
    setMobile((v) => v || user.mobile);
    setAddress((v) => v || (user.address ?? ''));
  }, [user]);

  // Applications are tied to the signed-in account so they appear in the
  // tracking dashboard — the API also requires a session for POST /api/loans.
  if (!user) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          padding: 24,
          justifyContent: 'center',
          gap: 14,
        }}
      >
        <Feather name="lock" size={30} color={colors.primary} style={{ alignSelf: 'center' }} />
        <Text
          style={{
            fontFamily: 'Inter_700Bold',
            fontSize: 18,
            color: colors.foreground,
            textAlign: 'center',
          }}
        >
          Sign in to apply
        </Text>
        <Text
          style={{
            fontFamily: 'Inter_400Regular',
            fontSize: 13,
            lineHeight: 19,
            color: colors.mutedForeground,
            textAlign: 'center',
          }}
        >
          Your application is linked to your account so you can track its status
          anytime.
        </Text>
        <KFButton
          title="Sign In"
          icon="log-in"
          onPress={() => router.push('/login')}
          testID="button-apply-signin"
        />
        <KFButton
          title="Create Account"
          variant="outline"
          onPress={() => router.push('/register')}
          testID="button-apply-register"
        />
      </View>
    );
  }

  const validateStep = (): boolean => {
    setError('');
    if (step === 0) {
      if (!Number(amount) || Number(amount) < 10000) {
        setError('Loan amount must be at least ₹10,000');
        return false;
      }
      if (!Number(tenure) || Number(tenure) < 12) {
        setError('Tenure must be at least 12 months');
        return false;
      }
    }
    if (step === 1) {
      if (firstName.trim().length < 2 || lastName.trim().length < 2) {
        setError('Enter your full name (min 2 characters each)');
        return false;
      }
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        setError('Enter a valid email address');
        return false;
      }
      if (!/^\d{10}$/.test(mobile)) {
        setError('Enter a 10-digit mobile number');
        return false;
      }
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
        setError('Enter a valid PAN (format: ABCDE1234F)');
        return false;
      }
    }
    return true;
  };

  const next = () => {
    if (!validateStep()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setStep((s) => Math.min(s + 1, 2));
  };

  const submit = () => {
    setError('');
    createLoan.mutate(
      {
        data: {
          loanType,
          loanAmount: Number(amount),
          tenure: Number(tenure),
          ...(purpose.trim() ? { purpose: purpose.trim() } : {}),
          primaryApplicant: {
            applicantType: 'primary',
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim(),
            mobile,
            pan,
            ...(address.trim() ? { address: address.trim() } : {}),
          },
        },
      },
      {
        onSuccess: (loan) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          router.replace({ pathname: '/loan/[id]', params: { id: String(loan.id) } });
        },
        onError: (e) => {
          setError(e instanceof Error ? e.message : 'Submission failed');
        },
      },
    );
  };

  return (
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      bottomOffset={40}
    >
      {/* Stepper */}
      <View style={styles.stepper}>
        {STEP_TITLES.map((t, i) => (
          <View key={t} style={styles.stepItem}>
            <View
              style={[
                styles.stepDot,
                {
                  backgroundColor: i <= step ? colors.primary : colors.secondary,
                  borderColor: i <= step ? colors.primary : colors.border,
                },
              ]}
            >
              {i < step ? (
                <Feather name="check" size={12} color={colors.primaryForeground} />
              ) : (
                <Text
                  style={[
                    styles.stepDotText,
                    { color: i <= step ? colors.primaryForeground : colors.mutedForeground },
                  ]}
                >
                  {i + 1}
                </Text>
              )}
            </View>
            <Text
              style={[
                styles.stepLabel,
                { color: i === step ? colors.foreground : colors.mutedForeground },
              ]}
            >
              {t}
            </Text>
          </View>
        ))}
      </View>

      {step === 0 ? (
        <View style={{ gap: 14 }}>
          <Text style={[styles.fieldGroupLabel, { color: colors.mutedForeground }]}>
            PRODUCT
          </Text>
          <View style={{ gap: 10 }}>
            {LOAN_PRODUCTS.map((p) => {
              const selected = p.type === loanType;
              return (
                <Pressable
                  key={p.type}
                  onPress={() => setLoanType(p.type)}
                  testID={`option-product-${p.type}`}
                  style={[
                    styles.productOption,
                    {
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? `${colors.primary}10` : colors.card,
                      borderRadius: colors.radius,
                    },
                  ]}
                >
                  <Feather
                    name={p.icon}
                    size={18}
                    color={selected ? colors.primary : colors.mutedForeground}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.productOptionLabel, { color: colors.foreground }]}>
                      {p.label}
                    </Text>
                    <Text style={[styles.productOptionRate, { color: colors.mutedForeground }]}>
                      Starting {p.rate}
                    </Text>
                  </View>
                  {selected ? (
                    <Feather name="check-circle" size={18} color={colors.primary} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          <KFInput
            label="Loan Amount (₹)"
            value={amount}
            onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            testID="input-apply-amount"
          />
          <KFInput
            label="Tenure (months)"
            value={tenure}
            onChangeText={(t) => setTenure(t.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            testID="input-apply-tenure"
          />
          <KFInput
            label="Purpose (optional)"
            value={purpose}
            onChangeText={setPurpose}
            placeholder="e.g. New home purchase"
            testID="input-apply-purpose"
          />
        </View>
      ) : null}

      {step === 1 ? (
        <View style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <KFInput
                label="First Name"
                value={firstName}
                onChangeText={setFirstName}
                testID="input-apply-first-name"
              />
            </View>
            <View style={{ flex: 1 }}>
              <KFInput
                label="Last Name"
                value={lastName}
                onChangeText={setLastName}
                testID="input-apply-last-name"
              />
            </View>
          </View>
          <KFInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="you@example.com"
            testID="input-apply-email"
          />
          <KFInput
            label="Mobile Number"
            value={mobile}
            onChangeText={(t) => setMobile(t.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            maxLength={10}
            testID="input-apply-mobile"
          />
          <KFInput
            label="PAN"
            value={pan}
            onChangeText={(t) => setPan(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            autoCapitalize="characters"
            maxLength={10}
            placeholder="ABCDE1234F"
            testID="input-apply-pan"
          />
          <KFInput
            label="Address (optional)"
            value={address}
            onChangeText={setAddress}
            testID="input-apply-address"
          />
        </View>
      ) : null}

      {step === 2 ? (
        <View style={{ gap: 14 }}>
          <KFCard style={{ gap: 12 }}>
            {[
              { label: 'Product', value: PRODUCT_LABEL[loanType] },
              { label: 'Amount', value: formatINR(Number(amount)) },
              { label: 'Tenure', value: `${tenure} months` },
              ...(purpose.trim() ? [{ label: 'Purpose', value: purpose.trim() }] : []),
              { label: 'Applicant', value: `${firstName} ${lastName}` },
              { label: 'Email', value: email },
              { label: 'Mobile', value: mobile },
              { label: 'PAN', value: pan },
            ].map((r) => (
              <View key={r.label} style={styles.reviewRow}>
                <Text style={[styles.reviewLabel, { color: colors.mutedForeground }]}>
                  {r.label}
                </Text>
                <Text
                  style={[styles.reviewValue, { color: colors.foreground }]}
                  numberOfLines={1}
                >
                  {r.value}
                </Text>
              </View>
            ))}
          </KFCard>
          <Text style={[styles.consent, { color: colors.mutedForeground }]}>
            By submitting, you consent to Krediflo fetching your CIBIL report and
            verification data via API to process this application.
          </Text>
        </View>
      ) : null}

      {error ? (
        <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 12, marginTop: 22 }}>
        {step > 0 ? (
          <KFButton
            title="Back"
            variant="outline"
            icon="arrow-left"
            onPress={() => setStep((s) => Math.max(s - 1, 0))}
            style={{ flex: 1 }}
            testID="button-apply-back"
          />
        ) : null}
        {step < 2 ? (
          <KFButton
            title="Continue"
            icon="arrow-right"
            onPress={next}
            style={{ flex: 2 }}
            testID="button-apply-next"
          />
        ) : (
          <KFButton
            title="Submit Application"
            icon="send"
            loading={createLoan.isPending}
            onPress={submit}
            style={{ flex: 2 }}
            testID="button-apply-submit"
          />
        )}
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 60 },
  stepper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  stepItem: { alignItems: 'center', gap: 6, flex: 1 },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  stepLabel: { fontFamily: 'Inter_500Medium', fontSize: 11, textAlign: 'center' },
  fieldGroupLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: 1,
  },
  productOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    padding: 14,
  },
  productOptionLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  productOptionRate: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 1 },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  reviewLabel: { fontFamily: 'Inter_400Regular', fontSize: 13 },
  reviewValue: { fontFamily: 'Inter_600SemiBold', fontSize: 13, flexShrink: 1 },
  consent: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  error: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 14,
  },
});
