import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { KFButton, KFInput, Wordmark } from '@/components/kf';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

export default function LoginScreen() {
  const colors = useColors();
  const { login } = useAuth();
  const [mobile, setMobile] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleSubmit = async () => {
    setError('');
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      setError('Enter a valid 10-digit Indian mobile number');
      return;
    }
    if (!password) {
      setError('Enter your password');
      return;
    }
    setSubmitting(true);
    try {
      await login(mobile, password);
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/applications');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      bottomOffset={40}
    >
      <View style={{ alignItems: 'center', marginBottom: 26 }}>
        <Wordmark size={28} />
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Sign in to track your loan applications
        </Text>
      </View>

      <View style={{ gap: 14 }}>
        <KFInput
          label="Mobile Number"
          value={mobile}
          onChangeText={(t) => setMobile(t.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          maxLength={10}
          placeholder="9876543210"
          autoComplete="tel"
          testID="input-mobile"
        />
        <KFInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Your password"
          testID="input-password"
        />
        {error ? (
          <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>
        ) : null}
        <KFButton
          title="Sign In"
          icon="log-in"
          loading={submitting}
          onPress={handleSubmit}
          testID="button-login-submit"
        />
        <KFButton
          title="New to Krediflo? Create an account"
          variant="ghost"
          onPress={() => router.replace('/register')}
          testID="button-goto-register"
        />
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingTop: 36, paddingBottom: 60 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 8 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, textAlign: 'center' },
});
