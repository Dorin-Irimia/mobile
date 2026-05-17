import { Platform } from 'react-native';

// Font family names mirror the @expo-google-fonts packages. Each weight
// is a separate font file on the device, so reference it directly via
// `fontFamily` rather than relying on `fontWeight` (RN does not blend
// fontWeight with custom fonts reliably).
export const FONT_FAMILY = {
  display: {
    500: 'BricolageGrotesque_500Medium',
    600: 'BricolageGrotesque_600SemiBold',
    700: 'BricolageGrotesque_700Bold',
  },
  body: {
    400: 'PlusJakartaSans_400Regular',
    500: 'PlusJakartaSans_500Medium',
    600: 'PlusJakartaSans_600SemiBold',
    700: 'PlusJakartaSans_700Bold',
  },
};

// Display heading style — Bricolage Grotesque with tight tracking.
// Use this on greetings, app title, hero balance, screen titles. Body
// text keeps the system font so existing fontWeight styles still work.
export function display(weight = 700, extra = {}) {
  const w = String(weight);
  const family = FONT_FAMILY.display[w] || FONT_FAMILY.display[700];
  return { fontFamily: family, letterSpacing: -0.3, ...extra };
}

export const T = {
  brand: '#FF6B1A',
  brandSoft: '#ff8a47',
  brandDark: '#e85a0c',
  brandTint: '#FFF1E8',
  brandTint2: '#FFE3D1',
  ink: '#0E1116',
  ink2: '#3C4149',
  ink3: '#6A6F78',
  ink4: '#A0A5AD',
  line: '#E8E9EC',
  line2: '#F2F3F5',
  bg: '#F6F5F2',
  bgSoft: '#FBFAF8',
  card: '#FFFFFF',
  success: '#2F9E6F',
  successTint: '#E8F5EE',
  warn: '#E0A52C',
  warnTint: '#FDF6E3',
  danger: '#E0432C',
  dangerTint: '#FDECEA',
};

export const FONTS = {
  light: '300',
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

const iosShadow = (h, opacity, radius) => ({
  shadowColor: '#000',
  shadowOffset: { width: 0, height: h },
  shadowOpacity: opacity,
  shadowRadius: radius,
});

const androidElevation = (elevation) => ({
  elevation,
  shadowColor: '#000',
});

export const SHADOW = {
  sm: Platform.select({
    ios: iosShadow(1, 0.06, 4),
    android: androidElevation(2),
  }),
  md: Platform.select({
    ios: iosShadow(2, 0.08, 8),
    android: androidElevation(4),
  }),
  lg: Platform.select({
    ios: iosShadow(4, 0.12, 16),
    android: androidElevation(8),
  }),
};

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function statusFor(days) {
  if (days === null) return { label: 'N/A', color: T.ink4, bg: T.line2 };
  if (days < 0) return { label: 'Expirat', color: T.danger, bg: T.dangerTint };
  if (days <= 14) return { label: `${days}z`, color: T.danger, bg: T.dangerTint };
  if (days <= 30) return { label: `${days}z`, color: T.warn, bg: T.warnTint };
  return { label: `${days}z`, color: T.success, bg: T.successTint };
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatCurrency(amount, currency = 'RON') {
  return `${Number(amount).toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export * from './responsive';
