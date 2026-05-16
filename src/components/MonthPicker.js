import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import useStore from '../store';
import { T, RADIUS, FONTS, SPACING, HIT_SLOP } from '../theme';
import {
  billingMonthLabel,
  shiftBillingMonth,
  startOfBillingMonth,
} from '../utils/monthRange';

function sameMonth(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export default function MonthPicker({ value, onChange, tone = 'light' }) {
  const monthStartDay = useStore(s => s.monthStartDay);
  const anchor = value instanceof Date ? value : startOfBillingMonth(new Date(), monthStartDay);

  const goto = (delta) => {
    onChange?.(shiftBillingMonth(anchor, monthStartDay, delta));
  };

  const isCurrent = sameMonth(
    startOfBillingMonth(new Date(), monthStartDay),
    startOfBillingMonth(anchor, monthStartDay),
  );

  const dark = tone === 'dark';
  const trackBg = dark ? 'rgba(255,255,255,0.10)' : T.card;
  const trackBorder = dark ? 'rgba(255,255,255,0.20)' : T.line;
  const textColor = dark ? '#fff' : T.ink;
  const subColor = dark ? 'rgba(255,255,255,0.65)' : T.ink3;

  return (
    <View style={[styles.wrap, { backgroundColor: trackBg, borderColor: trackBorder }]}>
      <TouchableOpacity onPress={() => goto(-1)} hitSlop={HIT_SLOP} style={styles.navBtn}>
        <Text style={[styles.navText, { color: textColor }]}>‹</Text>
      </TouchableOpacity>

      <View style={styles.labelWrap}>
        <Text style={[styles.label, { color: textColor }]} numberOfLines={1}>
          {billingMonthLabel(anchor, monthStartDay)}
        </Text>
        {!isCurrent && (
          <TouchableOpacity
            onPress={() => onChange?.(startOfBillingMonth(new Date(), monthStartDay))}
            hitSlop={HIT_SLOP}
          >
            <Text style={[styles.todayBtn, { color: dark ? '#10B981' : T.brand }]}>· Azi</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        onPress={() => goto(1)}
        hitSlop={HIT_SLOP}
        style={[styles.navBtn, isCurrent && styles.navBtnDisabled]}
        disabled={isCurrent}
      >
        <Text style={[styles.navText, { color: isCurrent ? subColor : textColor }]}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  navBtn: {
    width: 32, height: 32,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 16,
  },
  navBtnDisabled: { opacity: 0.4 },
  navText: { fontSize: 22, fontWeight: FONTS.bold, lineHeight: 24 },
  labelWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: SPACING.sm,
  },
  label: { fontSize: 13, fontWeight: FONTS.bold, textTransform: 'capitalize' },
  todayBtn: { fontSize: 12, fontWeight: FONTS.bold },
});
