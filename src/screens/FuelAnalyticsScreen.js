import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import useStore from '../store';
import {
  T, RADIUS, SHADOW, FONTS, formatDate, formatCurrency, display,
} from '../theme';

const MONTHS_RO = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Noi', 'Dec'];

function Sparkline({ data, width }) {
  if (!data || data.length < 2) return null;
  const h = 60;
  const min = Math.min(...data) - 0.5;
  const max = Math.max(...data) + 0.5;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = h - ((v - min) / (max - min || 1)) * h;
    return [x, y];
  });
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
  const fill = `${line} L ${width} ${h} L 0 ${h} Z`;
  return (
    <Svg width={width} height={h}>
      <Defs>
        <LinearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#FF6B1A" stopOpacity="0.45" />
          <Stop offset="100%" stopColor="#FF6B1A" stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Path d={fill} fill="url(#sparkFill)" />
      <Path d={line} stroke="#FF6B1A" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => {
        const last = i === points.length - 1;
        return (
          <Circle
            key={i}
            cx={p[0]} cy={p[1]}
            r={last ? 4 : 2.5}
            fill={last ? '#fff' : '#FF6B1A'}
            stroke={last ? '#FF6B1A' : undefined}
            strokeWidth={last ? 2 : 0}
          />
        );
      })}
    </Svg>
  );
}

/**
 * Compute per-fill consumption (L/100km) using km deltas between consecutive
 * full-tank fills. Returns a new array enriched with `consumption` and sorted
 * newest-first.
 */
function enrichWithConsumption(logs) {
  const sortedAsc = [...logs].sort((a, b) => {
    if (a.km !== b.km) return (a.km || 0) - (b.km || 0);
    return new Date(a.date) - new Date(b.date);
  });
  let lastFullKm = null;
  let litersSinceLastFull = 0;
  const enriched = sortedAsc.map((f) => {
    const km = Number(f.km) || 0;
    const liters = Number(f.liters) || 0;
    const full = f.fullTank !== false; // default true if missing
    let consumption = 0;
    if (full && lastFullKm != null && km > lastFullKm) {
      const dist = km - lastFullKm;
      // include the current fill's liters in the "used since last full" total
      consumption = ((litersSinceLastFull + liters) * 100) / dist;
      lastFullKm = km;
      litersSinceLastFull = 0;
    } else if (full) {
      lastFullKm = km;
      litersSinceLastFull = 0;
    } else {
      litersSinceLastFull += liters;
    }
    return { ...f, _computedConsumption: Math.round(consumption * 10) / 10 };
  });
  return enriched.sort((a, b) => new Date(b.date) - new Date(a.date));
}

export default function FuelAnalyticsScreen({ navigation, route }) {
  const vehicleId = route?.params?.vehicleId;
  const vehicles = useStore(s => s.vehicles);
  const selectedVehicleId = useStore(s => s.selectedVehicleId);
  const fuelLogs = useStore(s => s.fuelLogs);
  const fetchFuelLogs = useStore(s => s.fetchFuelLogs);

  const effectiveVehicleId = vehicleId || selectedVehicleId || null;
  const vehicle = effectiveVehicleId ? vehicles.find(v => v.id === effectiveVehicleId) : null;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    (async () => {
      try { await fetchFuelLogs(effectiveVehicleId); }
      finally { setLoading(false); }
    })();
  }, [effectiveVehicleId]);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await fetchFuelLogs(effectiveVehicleId); }
    finally { setRefreshing(false); }
  };

  // Normalize: the FuelLog model stores price as `pricePerL` and amount as `total`.
  // We expose consistent shape across both legacy and new fields.
  const data = useMemo(() => {
    const scoped = (fuelLogs || []).filter(f => !effectiveVehicleId || f.vehicleId === effectiveVehicleId);
    const normalized = scoped.map(f => ({
      ...f,
      date: f.date || '',
      km: Number(f.km) || 0,
      liters: Number(f.liters) || 0,
      total: Number(f.total ?? f.totalCost ?? (Number(f.liters) * Number(f.pricePerL || 0))) || 0,
      pricePerL: Number(f.pricePerL ?? f.pricePerLiter) || 0,
      station: f.station || f.location || 'Stație necunoscută',
      fullTank: f.fullTank !== false,
    })).filter(f => f.liters > 0 && f.date);
    return enrichWithConsumption(normalized);
  }, [fuelLogs, effectiveVehicleId]);

  const stats = useMemo(() => {
    const withCons = data.filter(f => f._computedConsumption > 0);
    const avg = withCons.length
      ? withCons.reduce((s, f) => s + f._computedConsumption, 0) / withCons.length
      : 0;
    const last = withCons[0]?._computedConsumption || 0;
    const totalL = data.reduce((s, f) => s + f.liters, 0);
    const totalC = data.reduce((s, f) => s + f.total, 0);

    const groups = {};
    data.forEach(f => {
      if (!groups[f.station]) groups[f.station] = { count: 0, total: 0, liters: 0 };
      groups[f.station].count++;
      groups[f.station].total += f.total;
      groups[f.station].liters += f.liters;
    });
    const stations = Object.entries(groups)
      .map(([name, g]) => ({ name, ...g }))
      .sort((a, b) => b.total - a.total);

    // Monthly bars — last 6 months (incl. current) of total spend
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        m: MONTHS_RO[d.getMonth()],
        v: 0,
      });
    }
    data.forEach(f => {
      const key = f.date.slice(0, 7);
      const slot = months.find(m => m.key === key);
      if (slot) slot.v += f.total;
    });

    return { avg, last, totalL, totalC, stations, months };
  }, [data]);

  const screenW = Dimensions.get('window').width;
  const heroPad = 20;
  const sparkW = screenW - 32 - heroPad * 2;

  const trend = stats.last - stats.avg;
  const improved = trend < 0;
  const sparkData = useMemo(
    () => [...data].reverse().map(f => f._computedConsumption).filter(v => v > 0),
    [data]
  );
  const monthMax = Math.max(1, ...stats.months.map(m => m.v));
  const avgPpl = stats.totalL > 0 ? stats.totalC / stats.totalL : 0;

  const plate = vehicle?.plate || 'Toate vehiculele';
  const model = vehicle ? `${vehicle.brand || ''} ${vehicle.model || ''}`.trim() : '';

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <Header navigation={navigation} plate={plate} model={model} />
        <ActivityIndicator color={T.brand} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  if (data.length === 0) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <Header navigation={navigation} plate={plate} model={model} />
        <ScrollView
          contentContainerStyle={styles.emptyWrap}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.brand} />}
        >
          <Text style={styles.emptyIcon}>⛽</Text>
          <Text style={styles.emptyTitle}>Niciun consum încă</Text>
          <Text style={styles.emptySub}>
            Adaugă cel puțin 2 alimentări cu kilometraj ca să calculăm consumul mediu.
          </Text>
          <TouchableOpacity
            style={styles.cta}
            onPress={() => navigation.navigate('AddFuel', { vehicleId: effectiveVehicleId })}
          >
            <Text style={styles.ctaText}>+ Adaugă alimentare</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Header navigation={navigation} plate={plate} model={model} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.brand} />}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroBlob} />
          <Text style={styles.heroLabel}>CONSUM MEDIU</Text>
          <View style={styles.heroMetric}>
            <Text style={[styles.heroValue, display(700)]}>
              {stats.avg > 0 ? stats.avg.toFixed(1) : '—'}
            </Text>
            <Text style={styles.heroUnit}>L/100km</Text>
          </View>
          {stats.avg > 0 && stats.last > 0 && (
            <View
              style={[
                styles.trendPill,
                {
                  backgroundColor: improved ? 'rgba(116,224,164,0.22)' : 'rgba(255,107,107,0.22)',
                  borderColor: improved ? 'rgba(116,224,164,0.4)' : 'rgba(255,107,107,0.4)',
                },
              ]}
            >
              <Text style={[styles.trendText, { color: improved ? '#74E0A4' : '#FF8A8A' }]}>
                {improved ? '↓' : '↑'} {Math.abs(trend).toFixed(1)} L vs media
              </Text>
            </View>
          )}

          {sparkData.length >= 2 && (
            <View style={{ marginTop: 14 }}>
              <Sparkline data={sparkData} width={sparkW} />
              <View style={styles.sparkLabels}>
                <Text style={styles.sparkLabel}>{sparkData.length} alimentări în urmă</Text>
                <Text style={styles.sparkLabel}>Acum</Text>
              </View>
            </View>
          )}
        </View>

        {/* Stat tiles */}
        <View style={styles.tilesRow}>
          {[
            { v: `${stats.totalL.toFixed(0)} L`, l: 'Total litri', c: T.brand },
            { v: formatCurrency(stats.totalC), l: 'Cost total', c: T.success },
            { v: `${avgPpl.toFixed(2)} RON/L`, l: 'Preț mediu', c: T.warn },
          ].map(t => (
            <View key={t.l} style={styles.tile}>
              <Text style={[styles.tileValue, display(700), { color: t.c }]} numberOfLines={1}>{t.v}</Text>
              <Text style={styles.tileLabel}>{t.l}</Text>
            </View>
          ))}
        </View>

        {/* Monthly bars */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>💰 Cheltuieli pe lună</Text>
            <Text style={styles.cardSub}>ultimele 6 luni</Text>
          </View>
          <View style={styles.barsRow}>
            {stats.months.map((m, i) => {
              const h = m.v > 0 ? Math.max(6, (m.v / monthMax) * 72) : 6;
              const last = i === stats.months.length - 1;
              return (
                <View key={m.key} style={styles.barCol}>
                  <Text style={styles.barValue}>{m.v > 0 ? Math.round(m.v) : ''}</Text>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: h,
                        backgroundColor: m.v > 0 ? (last ? T.brand : T.brandTint2) : T.line2,
                      },
                    ]}
                  />
                  <Text style={[styles.barLabel, last && { color: T.brand, fontWeight: FONTS.bold }]}>{m.m}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Station breakdown */}
        {stats.stations.length > 0 && (
          <View style={styles.card}>
            <Text style={[styles.cardTitle, { marginBottom: 12 }]}>⛽ Stații preferate</Text>
            <View style={{ gap: 10 }}>
              {stats.stations.slice(0, 6).map(s => {
                const pct = stats.totalC ? (s.total / stats.totalC) * 100 : 0;
                return (
                  <View key={s.name}>
                    <View style={styles.stationHead}>
                      <Text style={styles.stationName} numberOfLines={1}>{s.name}</Text>
                      <Text style={styles.stationMeta}>{s.count}× · {formatCurrency(s.total)}</Text>
                    </View>
                    <View style={styles.progress}>
                      <View style={[styles.progressFill, { width: `${pct}%` }]} />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Recent fills */}
        <View>
          <View style={styles.listHead}>
            <Text style={styles.cardTitle}>📋 Ultimele alimentări</Text>
            <TouchableOpacity onPress={() => navigation.navigate('FuelLog')}>
              <Text style={styles.linkText}>Vezi tot</Text>
            </TouchableOpacity>
          </View>
          <View style={{ gap: 6 }}>
            {data.slice(0, 6).map((f, i) => (
              <View key={f.id || i} style={styles.fillRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.fillStation} numberOfLines={1}>{f.station}</Text>
                  <Text style={styles.fillMeta}>{formatDate(f.date)}{f.km ? ` · ${f.km.toLocaleString('ro-RO')} km` : ''}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.fillLiters}>{f.liters.toFixed(1)} L</Text>
                  {f._computedConsumption > 0 && (
                    <Text style={styles.fillCons}>{f._computedConsumption.toFixed(1)} L/100km</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ navigation, plate, model }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Text style={styles.backArrow}>‹</Text>
      </TouchableOpacity>
      <View style={styles.headerCenter}>
        <Text style={[styles.headerTitle, display(700)]}>Analiză combustibil</Text>
        <Text style={styles.headerSubtitle}>{plate}{model ? ` · ${model}` : ''}</Text>
      </View>
      <View style={{ width: 40 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 12,
    backgroundColor: T.card, borderBottomWidth: 1, borderBottomColor: T.line,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backArrow: { color: T.brand, fontSize: 30, lineHeight: 32 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, color: T.ink, fontWeight: FONTS.bold },
  headerSubtitle: { fontSize: 11, color: T.ink3, marginTop: 2 },

  scroll: { padding: 16, paddingBottom: 100, gap: 12 },

  emptyWrap: { padding: 30, alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 64 },
  emptyTitle: { fontSize: 20, color: T.ink, fontWeight: FONTS.bold, marginTop: 12 },
  emptySub: { fontSize: 13, color: T.ink3, marginTop: 8, textAlign: 'center', lineHeight: 19 },
  cta: { backgroundColor: T.brand, paddingVertical: 14, paddingHorizontal: 24, borderRadius: RADIUS.lg, marginTop: 24, ...SHADOW.md },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: FONTS.bold },

  hero: {
    backgroundColor: '#172027',
    borderRadius: RADIUS.xl, padding: 20,
    overflow: 'hidden',
    ...SHADOW.md,
  },
  heroBlob: {
    position: 'absolute', top: -40, right: -40,
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(255,107,26,0.18)',
  },
  heroLabel: {
    fontSize: 11, color: 'rgba(255,255,255,0.7)',
    fontWeight: FONTS.semibold, letterSpacing: 1,
  },
  heroMetric: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 6 },
  heroValue: { fontSize: 56, color: '#fff', fontWeight: FONTS.bold, letterSpacing: -1.5, lineHeight: 60 },
  heroUnit: { fontSize: 16, color: 'rgba(255,255,255,0.7)', fontWeight: FONTS.medium },
  trendPill: {
    alignSelf: 'flex-start', marginTop: 10,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: RADIUS.full, borderWidth: 1,
  },
  trendText: { fontSize: 11, fontWeight: FONTS.bold },
  sparkLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  sparkLabel: { fontSize: 10, color: 'rgba(255,255,255,0.5)' },

  tilesRow: { flexDirection: 'row', gap: 10 },
  tile: {
    flex: 1, backgroundColor: T.card,
    borderRadius: RADIUS.lg, paddingVertical: 12, paddingHorizontal: 10,
    alignItems: 'center', ...SHADOW.sm,
  },
  tileValue: { fontSize: 15, fontWeight: FONTS.bold, letterSpacing: -0.2 },
  tileLabel: { fontSize: 10, color: T.ink3, marginTop: 4, fontWeight: FONTS.medium },

  card: { backgroundColor: T.card, borderRadius: RADIUS.lg, padding: 16, ...SHADOW.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 },
  cardTitle: { fontSize: 13, fontWeight: FONTS.bold, color: T.ink },
  cardSub: { fontSize: 11, color: T.ink3 },

  barsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 100 },
  barCol: { flex: 1, alignItems: 'center', gap: 6 },
  barValue: { fontSize: 9, color: T.ink3, fontWeight: FONTS.semibold, minHeight: 11 },
  bar: { width: '100%', borderRadius: 6 },
  barLabel: { fontSize: 10, color: T.ink3, fontWeight: FONTS.medium },

  stationHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4, gap: 8 },
  stationName: { fontSize: 13, color: T.ink, fontWeight: FONTS.semibold, flex: 1 },
  stationMeta: { fontSize: 11, color: T.ink3 },
  progress: { height: 6, backgroundColor: T.line2, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: T.brand, borderRadius: 3 },

  listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 4, paddingBottom: 8 },
  linkText: { fontSize: 11, color: T.brand, fontWeight: FONTS.semibold },
  fillRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: T.card, borderRadius: RADIUS.md, paddingVertical: 10, paddingHorizontal: 12,
    ...SHADOW.sm,
  },
  fillStation: { fontSize: 12, color: T.ink, fontWeight: FONTS.semibold },
  fillMeta: { fontSize: 10, color: T.ink3, marginTop: 2 },
  fillLiters: { fontSize: 13, color: T.ink, fontWeight: FONTS.bold },
  fillCons: { fontSize: 10, color: T.brand, fontWeight: FONTS.semibold },
});
