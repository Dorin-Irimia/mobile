import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import useStore from '../store';
import { T, RADIUS, FONTS, SPACING } from '../theme';

export default function ModePill({ tone = 'light' }) {
  const appMode = useStore(s => s.appMode);
  const setAppMode = useStore(s => s.setAppMode);

  const dark = tone === 'dark';
  const trackBg = dark ? 'rgba(255,255,255,0.12)' : T.bgSoft;
  const trackBorder = dark ? 'rgba(255,255,255,0.18)' : T.line;
  const inactiveColor = dark ? 'rgba(255,255,255,0.78)' : T.ink3;

  const Item = ({ mode, icon, label }) => {
    const active = appMode === mode;
    return (
      <TouchableOpacity
        onPress={() => setAppMode(mode)}
        activeOpacity={0.85}
        style={[
          styles.item,
          active && { backgroundColor: T.brand },
        ]}
      >
        <Text style={[styles.icon, !active && { opacity: 0.85 }]}>{icon}</Text>
        <Text style={[
          styles.label,
          { color: active ? '#fff' : inactiveColor },
        ]} numberOfLines={1}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.wrap, { backgroundColor: trackBg, borderColor: trackBorder }]}>
      <Item mode="vehicle" icon="🚗" label="Mașini" />
      <Item mode="household" icon="🏠" label="Casă" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    borderRadius: RADIUS.full,
    padding: 3,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  icon: { fontSize: 13 },
  label: { fontSize: 12, fontWeight: FONTS.bold },
});
