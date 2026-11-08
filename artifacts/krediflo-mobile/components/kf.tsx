import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

/* ── Formatting ──────────────────────────────────────────────── */

export function formatINR(value: number): string {
  try {
    return `₹${Math.round(value).toLocaleString('en-IN')}`;
  } catch {
    return `₹${Math.round(value)}`;
  }
}

/* ── Wordmark ────────────────────────────────────────────────── */

export function Wordmark({ size = 24 }: { size?: number }) {
  const colors = useColors();
  return (
    <Text
      style={{
        fontFamily: 'Inter_700Bold',
        fontSize: size,
        color: colors.foreground,
      }}
    >
      Kredi
      <Text style={{ color: colors.primary }}>flo</Text>
    </Text>
  );
}

/* ── Buttons ─────────────────────────────────────────────────── */

interface KFButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'gradient' | 'outline' | 'ghost' | 'destructive';
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Feather.glyphMap;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function KFButton({
  title,
  onPress,
  variant = 'gradient',
  disabled,
  loading,
  icon,
  style,
  testID,
}: KFButtonProps) {
  const colors = useColors();
  const isDisabled = !!disabled || !!loading;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  };

  const inner = (
    <View style={styles.buttonInner}>
      {loading ? (
        <ActivityIndicator
          color={variant === 'gradient' ? colors.primaryForeground : colors.primary}
          size="small"
        />
      ) : (
        <>
          {icon ? (
            <Feather
              name={icon}
              size={17}
              color={
                variant === 'gradient'
                  ? colors.primaryForeground
                  : variant === 'destructive'
                    ? colors.destructive
                    : colors.primary
              }
            />
          ) : null}
          <Text
            style={[
              styles.buttonText,
              {
                color:
                  variant === 'gradient'
                    ? colors.primaryForeground
                    : variant === 'destructive'
                      ? colors.destructive
                      : colors.primary,
              },
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </View>
  );

  return (
    <Pressable
      testID={testID}
      onPress={handlePress}
      disabled={isDisabled}
      style={({ pressed }) => [
        { opacity: isDisabled ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {variant === 'gradient' ? (
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.button, { borderRadius: colors.radius }]}
        >
          {inner}
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.button,
            {
              borderRadius: colors.radius,
              borderWidth: variant === 'ghost' ? 0 : 1,
              borderColor:
                variant === 'destructive' ? colors.destructive : colors.border,
              backgroundColor:
                variant === 'ghost' ? 'transparent' : colors.card,
            },
          ]}
        >
          {inner}
        </View>
      )}
    </Pressable>
  );
}

/* ── Card ────────────────────────────────────────────────────── */

export function KFCard({
  children,
  style,
  onPress,
  testID,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  testID?: string;
}) {
  const colors = useColors();
  const cardStyle = [
    styles.card,
    {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: colors.radius + 4,
    },
    style,
  ];
  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        style={({ pressed }) => [cardStyle, { opacity: pressed ? 0.85 : 1 }]}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View testID={testID} style={cardStyle}>
      {children}
    </View>
  );
}

/* ── Input ───────────────────────────────────────────────────── */

interface KFInputProps extends TextInputProps {
  label: string;
  error?: string;
}

export function KFInput({ label, error, style, ...props }: KFInputProps) {
  const colors = useColors();
  return (
    <View style={styles.inputWrap}>
      <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <TextInput
        placeholderTextColor={colors.mutedForeground}
        {...props}
        style={[
          styles.input,
          {
            backgroundColor: colors.input,
            borderColor: error ? colors.destructive : colors.border,
            borderRadius: colors.radius,
            color: colors.foreground,
          },
          style,
        ]}
      />
      {error ? (
        <Text style={[styles.inputError, { color: colors.destructive }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/* ── Status badges ───────────────────────────────────────────── */

export const LOAN_STATUS_META: Record<
  string,
  { label: string; colorKey: 'slate' | 'blue' | 'indigo' | 'warning' | 'purple' | 'primary' | 'destructive' | 'success' }
> = {
  draft: { label: 'Draft', colorKey: 'slate' },
  submitted: { label: 'Submitted', colorKey: 'blue' },
  docs_procured: { label: 'Docs Ready', colorKey: 'indigo' },
  under_review: { label: 'Under Review', colorKey: 'warning' },
  sent_to_bank: { label: 'Sent to Bank', colorKey: 'purple' },
  approved: { label: 'Approved', colorKey: 'primary' },
  rejected: { label: 'Rejected', colorKey: 'destructive' },
};

export function StatusBadge({ status }: { status: string }) {
  const colors = useColors();
  const meta = LOAN_STATUS_META[status] ?? { label: status, colorKey: 'slate' as const };
  const color = colors[meta.colorKey] as string;
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: `${color}22`, borderColor: `${color}55` },
      ]}
    >
      <Text style={[styles.badgeText, { color }]}>{meta.label}</Text>
    </View>
  );
}

export const DOC_STATUS_META: Record<
  string,
  { label: string; icon: keyof typeof Feather.glyphMap; colorKey: 'slate' | 'blue' | 'primary' | 'destructive' }
> = {
  pending: { label: 'Pending', icon: 'clock', colorKey: 'slate' },
  fetching: { label: 'Fetching…', icon: 'refresh-cw', colorKey: 'blue' },
  fetched: { label: 'Fetched', icon: 'check-circle', colorKey: 'primary' },
  failed: { label: 'Failed', icon: 'x-circle', colorKey: 'destructive' },
};

export function DocStatusPill({ status }: { status: string }) {
  const colors = useColors();
  const meta = DOC_STATUS_META[status] ?? DOC_STATUS_META.pending;
  const color = colors[meta.colorKey] as string;
  return (
    <View style={[styles.docPill, { backgroundColor: `${color}1c` }]}>
      <Feather name={meta.icon} size={12} color={color} />
      <Text style={[styles.docPillText, { color }]}>{meta.label}</Text>
    </View>
  );
}

/* ── States ──────────────────────────────────────────────────── */

export function LoadingView() {
  const colors = useColors();
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle?: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.center}>
      <View
        style={[
          styles.emptyIcon,
          { backgroundColor: colors.secondary, borderColor: colors.border },
        ]}
      >
        <Feather name={icon} size={26} color={colors.mutedForeground} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.center}>
      <Feather name="alert-triangle" size={28} color={colors.destructive} />
      <Text
        style={[styles.emptyTitle, { color: colors.foreground, marginTop: 12 }]}
      >
        Something went wrong
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
        {message}
      </Text>
      <KFButton
        title="Retry"
        onPress={onRetry}
        variant="outline"
        icon="rotate-cw"
        style={{ marginTop: 16, alignSelf: 'center', minWidth: 140 }}
      />
    </View>
  );
}

/* ── Styles ──────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },
  card: {
    borderWidth: 1,
    padding: 16,
  },
  inputWrap: {
    gap: 6,
  },
  inputLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
  },
  inputError: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
  docPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  docPillText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 19,
  },
});
