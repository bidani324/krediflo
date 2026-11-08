import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { KFButton, KFInput, Wordmark } from '@/components/kf';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

export default function RegisterScreen() {
  const colors = useColors();
  const { register } = useAuth();
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [mobile, setMobile] = useState<string>('');
  const [pan, setPan] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirm, setConfirm] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleSubmit = async () => {
    setError('');
    if (!firstName.trim() || !lastName.trim()) {
      setError('Enter your first and last name');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      setError('Enter a valid 10-digit Indian mobile number');
      return;
    }
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
      setError('Enter a valid PAN (format: ABCDE1234F)');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    try {
      await register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        mobile,
        pan,
        address: address.trim() || undefined,
        password,
      });
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/applications');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registration failed');
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
      <View style={{ alignItems: 'center', marginBottom: 24 }}>
        <Wordmark size={28} />
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Create your account — verification takes seconds
        </Text>
      </View>

      <View style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <KFInput
              label="First Name"
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Priya"
              testID="input-first-name"
            />
          </View>
          <View style={{ flex: 1 }}>
            <KFInput
              label="Last Name"
              value={lastName}
              onChangeText={setLastName}
              placeholder="Sharma"
              testID="input-last-name"
            />
          </View>
        </View>
        <KFInput
          label="Mobile Number"
          value={mobile}
          onChangeText={(t) => setMobile(t.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          maxLength={10}
          placeholder="9876543210"
          testID="input-reg-mobile"
        />
        <KFInput
          label="PAN"
          value={pan}
          onChangeText={(t) => setPan(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          autoCapitalize="characters"
          maxLength={10}
          placeholder="ABCDE1234F"
          testID="input-pan"
        />
        <KFInput
          label="Address (optional)"
          value={address}
          onChangeText={setAddress}
          placeholder="Flat, street, city"
          testID="input-address"
        />
        <KFInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Minimum 8 characters"
          testID="input-reg-password"
        />
        <KFInput
          label="Confirm Password"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          placeholder="Re-enter password"
          testID="input-confirm-password"
        />
        {error ? (
          <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>
        ) : null}
        <KFButton
          title="Create Account"
          icon="user-plus"
          loading={submitting}
          onPress={handleSubmit}
          testID="button-register-submit"
        />
        <KFButton
          title="Already registered? Sign in"
          variant="ghost"
          onPress={() => router.replace('/login')}
          testID="button-goto-login"
        />
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingTop: 30, paddingBottom: 60 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 8 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, textAlign: 'center' },
});
