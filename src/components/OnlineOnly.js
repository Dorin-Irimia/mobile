import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import useStore from '../store';
import { T, FONTS, RADIUS, SPACING } from '../theme';
import { showOfflineAlert, OFFLINE_REQUIRED_MSG } from '../utils/onlineGate';

// Wraps a TouchableOpacity. When offline, the wrapped element renders
// grayed-out and tapping shows the offline alert instead of running onPress.
// Also exposes an `OfflineBadge` element to overlay a "🔒 offline" pill.
export default function OnlineOnly({
  children,
  onPress,
  style,
  message,
  title = 'Funcție online',
  showBadge = false,
  activeOpacity = 0.85,
  disabled,
  hitSlop,
}) {
  const isOnline = useStore(s => s.isOnline);
  const blocked = !isOnline || disabled;

  const handlePress = () => {
    if (!isOnline) {
      showOfflineAlert(title, message || OFFLINE_REQUIRED_MSG);
      return;
    }
    if (!disabled) onPress?.();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={[style, blocked && styles.disabled]}
      activeOpacity={activeOpacity}
      hitSlop={hitSlop}
    >
      {children}
      {showBadge && !isOnline && (
        <View style={styles.badge} pointerEvents="none">
          <Text style={styles.badgeText}>🔒 offline</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export function OfflineLockBadge({ style }) {
  const isOnline = useStore(s => s.isOnline);
  if (isOnline) return null;
  return (
    <View style={[styles.inlineBadge, style]} pointerEvents="none">
      <Text style={styles.inlineBadgeText}>offline</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  disabled: { opacity: 0.45 },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: FONTS.bold },
  inlineBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    alignSelf: 'flex-start',
  },
  inlineBadgeText: { color: '#B91C1C', fontSize: 10, fontWeight: FONTS.bold, letterSpacing: 0.5 },
});
