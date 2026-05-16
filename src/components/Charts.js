import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { T, RADIUS, FONTS, SPACING, SHADOW, formatCurrency } from '../theme';

const ROW_HEIGHT = 120;
const BAR_WIDTH = 14;
const BAR_GAP = 6;

function monthKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('ro-RO', { month: 'short' }).replace('.', '');
}

function lastNMonthKeys(n) {
  const now = new Date();
  const keys = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(monthKey(d));
  }
  return keys;
}

// Paired bar chart: income vs expense per month over the last N months.
export function MonthlyBarChart({ expenses = [], incomes = [], months = 6, currency = 'RON' }) {
  const keys = useMemo(() => lastNMonthKeys(months), [months]);

  const data = useMemo(() => {
    const expMap = {};
    const incMap = {};
    keys.forEach(k => { expMap[k] = 0; incMap[k] = 0; });
    expenses.forEach(e => {
      const k = monthKey(e.date || e.createdAt);
      if (k in expMap) expMap[k] += Number(e.amount || 0);
    });
    incomes.forEach(i => {
      const k = monthKey(i.date || i.createdAt);
      if (k in incMap) incMap[k] += Number(i.amount || 0);
    });
    return keys.map(k => ({ key: k, expense: expMap[k], income: incMap[k] }));
  }, [keys, expenses, incomes]);

  const max = useMemo(() => Math.max(1, ...data.map(d => Math.max(d.expense, d.income))), [data]);
  const totalExp = data.reduce((s, d) => s + d.expense, 0);
  const totalInc = data.reduce((s, d) => s + d.income, 0);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>📊 Ultimele {months} luni</Text>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
            <Text style={styles.legendLabel}>Venit</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: T.brand }]} />
            <Text style={styles.legendLabel}>Cheltuit</Text>
          </View>
        </View>
      </View>

      <View style={styles.chartRow}>
        {data.map(d => {
          const incH = (d.income / max) * ROW_HEIGHT;
          const expH = (d.expense / max) * ROW_HEIGHT;
          return (
            <View key={d.key} style={styles.column}>
              <View style={styles.barsArea}>
                <View
                  style={[
                    styles.bar,
                    { height: Math.max(2, incH), backgroundColor: '#10B981', marginRight: BAR_GAP / 2 },
                  ]}
                />
                <View
                  style={[
                    styles.bar,
                    { height: Math.max(2, expH), backgroundColor: T.brand, marginLeft: BAR_GAP / 2 },
                  ]}
                />
              </View>
              <Text style={styles.monthLabel}>{monthLabel(d.key)}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: '#10B981' }]}>Venit total</Text>
          <Text style={styles.summaryValue}>{formatCurrency(totalInc, currency)}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: T.brand }]}>Cheltuit total</Text>
          <Text style={styles.summaryValue}>{formatCurrency(totalExp, currency)}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: T.ink3 }]}>Balanță</Text>
          <Text
            style={[
              styles.summaryValue,
              { color: totalInc - totalExp >= 0 ? '#10B981' : T.danger },
            ]}
          >
            {formatCurrency(totalInc - totalExp, currency)}
          </Text>
        </View>
      </View>
    </View>
  );
}

// Category breakdown chart: horizontal proportional bars + percent share.
// `getMeta(key) -> { label, icon, color, bg }` is used so the caller controls
// whether to include user-defined custom categories.
export function CategoryBreakdown({ items = [], getMeta, title = '📈 Pe categorii', currency = 'RON', emptyHint }) {
  const totals = useMemo(() => {
    const map = {};
    items.forEach(it => {
      const k = it.category || 'altele';
      map[k] = (map[k] || 0) + Number(it.amount || 0);
    });
    const list = Object.entries(map)
      .map(([key, value]) => ({ key, value }))
      .sort((a, b) => b.value - a.value);
    const sum = list.reduce((s, x) => s + x.value, 0);
    return { list, sum };
  }, [items]);

  if (totals.sum <= 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.empty}>{emptyHint || 'Adaugă tranzacții pentru a vedea repartiția.'}</Text>
      </View>
    );
  }

  // "Donut-like" stacked horizontal bar at the top, then a list of categories.
  const segments = totals.list.map(({ key, value }) => {
    const meta = getMeta(key);
    return {
      key,
      value,
      width: (value / totals.sum) * 100,
      meta,
    };
  });

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSub}>{formatCurrency(totals.sum, currency)}</Text>
      </View>

      <View style={styles.stackedBar}>
        {segments.map(seg => (
          <View
            key={seg.key}
            style={{ width: `${seg.width}%`, height: '100%', backgroundColor: seg.meta?.color || T.ink3 }}
          />
        ))}
      </View>

      <View style={{ gap: 8 }}>
        {segments.map(seg => {
          const pct = ((seg.value / totals.sum) * 100).toFixed(seg.width < 1 ? 1 : 0);
          return (
            <View key={seg.key} style={styles.legendListRow}>
              <View style={[styles.legendListDot, { backgroundColor: seg.meta?.color || T.ink3 }]} />
              <Text style={styles.legendListIcon}>{seg.meta?.icon || '📌'}</Text>
              <Text style={styles.legendListLabel} numberOfLines={1}>
                {seg.meta?.label || seg.key}
              </Text>
              <Text style={styles.legendListPct}>{pct}%</Text>
              <Text style={styles.legendListValue}>{formatCurrency(seg.value, currency)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// Line-like chart drawn with rectangles — visually approximates a cardiogram
// by drawing a thin segment per month and a dot at each value.
export function LineChartMini({ items = [], months = 6, color = T.brand, label = 'Tendință', currency = 'RON' }) {
  const keys = useMemo(() => lastNMonthKeys(months), [months]);
  const points = useMemo(() => {
    const map = {};
    keys.forEach(k => { map[k] = 0; });
    items.forEach(it => {
      const k = monthKey(it.date || it.createdAt);
      if (k in map) map[k] += Number(it.amount || 0);
    });
    return keys.map(k => ({ key: k, value: map[k] }));
  }, [keys, items]);

  const max = Math.max(1, ...points.map(p => p.value));
  const colWidth = 100 / Math.max(1, points.length - 1);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{label}</Text>
      <View style={styles.lineArea}>
        {points.map((p, i) => {
          const bottomPct = (p.value / max) * 100;
          // Vertical guide line + dot
          return (
            <View
              key={p.key}
              style={{
                position: 'absolute',
                left: `${i * colWidth}%`,
                bottom: 18,
                width: 0,
                height: '80%',
                alignItems: 'center',
              }}
            >
              <View style={{ flex: 1 }} />
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: color,
                  marginBottom: `${bottomPct * 0.8}%`,
                  borderWidth: 2,
                  borderColor: '#fff',
                }}
              />
            </View>
          );
        })}
        {/* Segments connecting points: drawn as thin rotated rectangles is non-trivial without SVG.
            Instead we draw small "rises" between adjacent points as colored mini-bars to suggest a
            line trend (looks like a cardiogram line). */}
        {points.slice(1).map((p, i) => {
          const prev = points[i];
          const a = (prev.value / max) * 80;
          const b = (p.value / max) * 80;
          const top = 100 - Math.max(a, b);
          const h = Math.abs(a - b) + 2;
          return (
            <View
              key={`${p.key}-seg`}
              style={{
                position: 'absolute',
                left: `${(i + 0.5) * colWidth}%`,
                top: `${top}%`,
                width: 2,
                height: `${h}%`,
                backgroundColor: color,
                opacity: 0.5,
              }}
            />
          );
        })}
      </View>
      <View style={styles.lineLabels}>
        {points.map(p => (
          <Text key={p.key} style={styles.lineLabel}>{monthLabel(p.key)}</Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: T.card,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    gap: SPACING.md,
    ...SHADOW.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  cardTitle: { fontSize: 15, fontWeight: FONTS.bold, color: T.ink },
  cardSub: { fontSize: 13, fontWeight: FONTS.bold, color: T.ink2 },
  empty: { fontSize: 13, color: T.ink3, paddingVertical: SPACING.md, textAlign: 'center' },

  legendRow: { flexDirection: 'row', gap: SPACING.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 9, height: 9, borderRadius: 2 },
  legendLabel: { fontSize: 11, color: T.ink3, fontWeight: FONTS.semibold },

  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: ROW_HEIGHT + 28,
    paddingTop: 4,
  },
  column: { alignItems: 'center', flex: 1 },
  barsArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: ROW_HEIGHT,
  },
  bar: {
    width: BAR_WIDTH,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  monthLabel: {
    fontSize: 10,
    color: T.ink3,
    marginTop: 6,
    fontWeight: FONTS.semibold,
    textTransform: 'capitalize',
  },

  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: T.line2,
    paddingTop: SPACING.md,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, height: 28, backgroundColor: T.line2 },
  summaryLabel: { fontSize: 10, fontWeight: FONTS.bold, letterSpacing: 0.4, textTransform: 'uppercase' },
  summaryValue: { fontSize: 13, fontWeight: FONTS.bold, color: T.ink, marginTop: 3 },

  stackedBar: {
    flexDirection: 'row',
    height: 18,
    borderRadius: 9,
    overflow: 'hidden',
    backgroundColor: T.line2,
  },

  legendListRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendListDot: { width: 9, height: 9, borderRadius: 5 },
  legendListIcon: { fontSize: 14 },
  legendListLabel: { flex: 1, fontSize: 13, color: T.ink, fontWeight: FONTS.semibold },
  legendListPct: { fontSize: 11, color: T.ink3, fontWeight: FONTS.bold, width: 42, textAlign: 'right' },
  legendListValue: { fontSize: 12, color: T.ink2, fontWeight: FONTS.bold, width: 88, textAlign: 'right' },

  lineArea: { height: 100, position: 'relative' },
  lineLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  lineLabel: { fontSize: 10, color: T.ink3, fontWeight: FONTS.semibold },
});
