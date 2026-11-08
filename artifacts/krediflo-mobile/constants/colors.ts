/**
 * Krediflo brand tokens — synced from artifacts/nexgen-fintech/src/index.css.
 * The brand is navy-first (the web hero/footer use #030d1a) with a cyan→blue
 * gradient accent, so the mobile app uses the navy palette for both schemes.
 */

const navy = {
  text: '#E7F0FA',
  tint: '#00D2FF',

  background: '#050D1A',
  foreground: '#E7F0FA',

  card: '#0C1830',
  cardForeground: '#E7F0FA',

  primary: '#00D2FF',
  primaryForeground: '#06121F',

  secondary: '#122442',
  secondaryForeground: '#E7F0FA',

  muted: '#0E1C36',
  mutedForeground: '#8CA3C0',

  accent: '#122442',
  accentForeground: '#E7F0FA',

  destructive: '#EF4444',
  destructiveForeground: '#FFFFFF',

  border: '#1B3050',
  input: '#132644',

  // Krediflo extras (status + gradient stops)
  gradientStart: '#00D2FF',
  gradientEnd: '#2563EB',
  success: '#34D399',
  warning: '#F59E0B',
  blue: '#60A5FA',
  indigo: '#818CF8',
  purple: '#A78BFA',
  slate: '#94A3B8',
};

const colors = {
  light: navy,
  radius: 12,
};

export default colors;
