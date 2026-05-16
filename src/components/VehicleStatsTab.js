import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import useStore from '../store';
import { T, RADIUS, FONTS, SHADOW, SPACING, formatCurrency } from '../theme';

const MONTH_NAMES_RO = [
  'Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun',
  'Iul', 'Aug', 'Sep', 'Oct', 'Noi', 'Dec',
];

function formatMonthLabel(key) {
  const [year, month] = key.split('-');
  return `${MONTH_NAMES_RO[parseInt(month) - 1]} ${year.slice(2)}`;
}

export default function VehicleStatsTab({ vehicleId }) {
  const fetchVehicleStats = useStore(s => s.fetchVehicleStats);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await fetchVehicleStats(vehicleId);
        setStats(data);
      } catch (e) {
        setError(e?.response?.data?.error || 'Nu s-au putut încărca statisticile.');
      } finally {
        setLoading(false);
      }
    })();
  }, [vehicleId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={T.brand} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={{ color: T.ink3 }}>{error}</Text>
      </View>
    );
  }

  if (!stats || stats.months.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyIcon}>📊</Text>
        <Text style={styles.emptyTitle}>Nu există date suficiente</Text>
        <Text style={styles.emptyBody}>
          Adaugă cheltuieli sau alimentări cu km și completează data achiziției
          în detaliile vehiculului pentru a vedea graficul.
        </Text>
      </View>
    );
  }

  const maxKm = Math.max(...stats.months.map(m => m.kmDelta || 0), 1);
  const maxCost = Math.max(...stats.months.map(m => m.totalCost || 0), 1);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {/* Sumar */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>📊 De la {stats.purchaseDate || stats.months[0].month} până azi</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryVal}>{stats.total.kmDelta.toLocaleString('ro-RO')}</Text>
            <Text style={styles.summaryLbl}>km parcurși</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryVal}>{stats.total.fuelLiters.toFixed(0)} L</Text>
            <Text style={styles.summaryLbl}>combustibil</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryVal}>{formatCurrency(stats.total.totalCost, 'RON')}</Text>
            <Text style={styles.summaryLbl}>cheltuit total</Text>
          </View>
        </View>
        {stats.purchaseKm != null && (
          <Text style={styles.summaryNote}>
            Km la achiziție: {stats.purchaseKm.toLocaleString('ro-RO')} · azi: {stats.currentKm.toLocaleString('ro-RO')}
          </Text>
        )}
      </View>

      {/* Graficul */}
      <Text style={styles.sectionTitle}>📈 Evoluție lunară</Text>
      <View style={styles.chartCard}>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: T.brand }]} />
          <Text style={styles.legendText}>km parcurși</Text>
          <View style={[styles.legendDot, { backgroundColor: T.success, marginLeft: SPACING.lg }]} />
          <Text style={styles.legendText}>cheltuieli (RON)</Text>
        </View>

        <View style={styles.chartArea}>
          {stats.months.map((m) => {
            const kmHeight = m.kmDelta > 0 ? Math.max(4, (m.kmDelta / maxKm) * 100) : 4;
            const costHeight = m.totalCost > 0 ? Math.max(4, (m.totalCost / maxCost) * 100) : 4;
            return (
              <View key={m.month} style={styles.barGroup}>
                <View style={styles.barWrap}>
                  <View style={styles.barCol}>
                    {m.kmDelta > 0 && (
                      <Text style={styles.barValueKm}>{m.kmDelta > 999 ? `${(m.kmDelta / 1000).toFixed(1)}k` : m.kmDelta}</Text>
                    )}
                    <View style={[styles.bar, { height: `${kmHeight}%`, backgroundColor: T.brand }]} />
                  </View>
                  <View style={styles.barCol}>
                    {m.totalCost > 0 && (
                      <Text style={styles.barValueCost}>{m.totalCost > 999 ? `${(m.totalCost / 1000).toFixed(1)}k` : Math.round(m.totalCost)}</Text>
                    )}
                    <View style={[styles.bar, { height: `${costHeight}%`, backgroundColor: T.success }]} />
                  </View>
                </View>
                <Text style={styles.barLabel}>{formatMonthLabel(m.month)}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Detalii pe luni */}
      <Text style={styles.sectionTitle}>📋 Detalii lunare</Text>
      {[...stats.months].reverse().map((m) => (
        <View key={m.month} style={styles.monthCard}>
          <View style={styles.monthHeader}>
            <Text style={styles.monthTitle}>{formatMonthLabel(m.month)}</Text>
            <Text style={styles.monthTotal}>{formatCurrency(m.totalCost, 'RON')}</Text>
          </View>
          <View style={styles.monthRow}>
            <View style={styles.monthItem}>
              <Text style={styles.monthItemLbl}>Km parcurși</Text>
              <Text style={styles.monthItemVal}>+{m.kmDelta.toLocaleString('ro-RO')}</Text>
            </View>
            <View style={styles.monthItem}>
              <Text style={styles.monthItemLbl}>Combustibil</Text>
              <Text style={styles.monthItemVal}>{m.fuelLiters.toFixed(1)} L</Text>
              <Text style={styles.monthItemSub}>{formatCurrency(m.fuelCost, 'RON')}</Text>
            </View>
            <View style={styles.monthItem}>
              <Text style={styles.monthItemLbl}>Alte cheltuieli</Text>
              <Text style={styles.monthItemVal}>{formatCurrency(m.invoiceCost, 'RON')}</Text>
            </View>
          </View>
        </View>
      ))}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xxl },
  emptyIcon: { fontSize: 48, marginBottom: SPACING.md },
  emptyTitle: { fontSize: 16, fontWeight: FONTS.bold, color: T.ink2, marginBottom: SPACING.sm },
  emptyBody: { fontSize: 13, color: T.ink3, textAlign: 'center', lineHeight: 18, paddingHorizontal: SPACING.md },
  content: { padding: SPACING.md, gap: SPACING.md },
  summaryCard: {
    backgroundColor: T.brand,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOW.md,
  },
  summaryTitle: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginBottom: SPACING.md, fontWeight: FONTS.semibold },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryVal: { fontSize: 17, fontWeight: FONTS.bold, color: '#fff', marginBottom: 2 },
  summaryLbl: { fontSize: 11, color: 'rgba(255,255,255,0.85)' },
  summaryDivider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.25)' },
  summaryNote: { color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: SPACING.md, textAlign: 'center' },
  sectionTitle: {
    fontSize: 14,
    fontWeight: FONTS.bold,
    color: T.ink,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    paddingHorizontal: 4,
  },
  chartCard: {
    backgroundColor: T.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOW.sm,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  legendText: { fontSize: 11, color: T.ink3, fontWeight: FONTS.medium },
  chartArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 180,
    gap: SPACING.sm,
  },
  barGroup: { flex: 1, alignItems: 'center', height: '100%' },
  barWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: '85%',
    width: '100%',
    justifyContent: 'center',
  },
  barCol: {
    width: '40%',
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    minHeight: 2,
  },
  barValueKm: { fontSize: 9, color: T.brand, fontWeight: FONTS.bold, marginBottom: 2 },
  barValueCost: { fontSize: 9, color: T.success, fontWeight: FONTS.bold, marginBottom: 2 },
  barLabel: { fontSize: 10, color: T.ink3, marginTop: 4, fontWeight: FONTS.medium },
  monthCard: {
    backgroundColor: T.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    ...SHADOW.sm,
    marginBottom: SPACING.sm,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: T.line2,
  },
  monthTitle: { fontSize: 15, fontWeight: FONTS.bold, color: T.ink },
  monthTotal: { fontSize: 16, fontWeight: FONTS.bold, color: T.brand },
  monthRow: { flexDirection: 'row' },
  monthItem: { flex: 1 },
  monthItemLbl: { fontSize: 11, color: T.ink3, marginBottom: 2 },
  monthItemVal: { fontSize: 13, fontWeight: FONTS.bold, color: T.ink },
  monthItemSub: { fontSize: 10, color: T.ink4, marginTop: 1 },
});
