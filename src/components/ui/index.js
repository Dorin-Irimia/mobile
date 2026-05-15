import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { T, RADIUS, SHADOW, FONTS } from '../../theme';

export function Card({ children, style, padded = true }) {
  return (
    <View style={[styles.card, padded && styles.cardPadded, style]}>
      {children}
    </View>
  );
}

export function Pill({ children, color = T.ink3, bg = T.line2, style }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }, style]}>
      <Text style={[styles.pillText, { color }]}>{children}</Text>
    </View>
  );
}

export function PrimaryButton({ title, onPress, loading, disabled, style }) {
  return (
    <TouchableOpacity
      style={[styles.btn, (disabled || loading) && styles.btnDisabled, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <Text style={styles.btnText}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

export function SecondaryButton({ title, onPress, style }) {
  return (
    <TouchableOpacity style={[styles.btnSecondary, style]} onPress={onPress} activeOpacity={0.8}>
      <Text style={styles.btnSecondaryText}>{title}</Text>
    </TouchableOpacity>
  );
}

export function SectionHeader({ title, action, onAction }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && (
        <TouchableOpacity onPress={onAction}>
          <Text style={styles.sectionAction}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function EmptyState({ icon, title, subtitle, action, onAction }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>{icon || '📭'}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle && <Text style={styles.emptySubtitle}>{subtitle}</Text>}
      {action && onAction && (
        <TouchableOpacity onPress={onAction} style={styles.emptyActionBtn}>
          <Text style={styles.emptyActionText}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function LoadingView() {
  return (
    <View style={styles.loadingView}>
      <ActivityIndicator size="large" color={T.brand} />
    </View>
  );
}

export function ErrorView({ message, onRetry }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>⚠️</Text>
      <Text style={styles.emptyTitle}>{message || 'A apărut o eroare'}</Text>
      {onRetry && (
        <TouchableOpacity onPress={onRetry} style={styles.retryBtn}>
          <Text style={styles.retryText}>Încearcă din nou</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function StatusBadge({ days }) {
  const color = days === null ? T.ink4 : days < 0 ? T.danger : days <= 14 ? T.danger : days <= 30 ? T.warn : T.success;
  const bg = days === null ? T.line2 : days < 0 ? T.dangerTint : days <= 14 ? T.dangerTint : days <= 30 ? T.warnTint : T.successTint;
  const label = days === null ? 'N/A' : days < 0 ? 'Expirat' : `${days}z`;
  return <Pill color={color} bg={bg}>{label}</Pill>;
}

export function Divider({ style }) {
  return <View style={[styles.divider, style]} />;
}

const styles = StyleSheet.create({
  card: { backgroundColor: T.card, borderRadius: RADIUS.lg, ...SHADOW.sm },
  cardPadded: { padding: 16 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: FONTS.semibold },
  btn: { backgroundColor: T.brand, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: FONTS.semibold },
  btnSecondary: { borderWidth: 1.5, borderColor: T.brand, borderRadius: RADIUS.md, paddingVertical: 13, alignItems: 'center' },
  btnSecondaryText: { color: T.brand, fontSize: 16, fontWeight: FONTS.semibold },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: FONTS.semibold, color: T.ink },
  sectionAction: { fontSize: 14, color: T.brand, fontWeight: FONTS.medium },
  emptyState: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: FONTS.semibold, color: T.ink2, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: T.ink3, textAlign: 'center', marginTop: 6 },
  emptyActionBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: T.brand, borderRadius: RADIUS.md },
  emptyActionText: { color: '#fff', fontWeight: FONTS.semibold, fontSize: 14 },
  loadingView: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: T.bg },
  retryBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: T.brand, borderRadius: RADIUS.md },
  retryText: { color: '#fff', fontWeight: FONTS.semibold },
  divider: { height: 1, backgroundColor: T.line, marginVertical: 8 },
});
