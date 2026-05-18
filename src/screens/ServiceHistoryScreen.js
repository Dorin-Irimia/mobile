import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useStore from '../store';
import {
  T, RADIUS, SHADOW, FONTS, daysUntil, formatDate, formatCurrency, display,
} from '../theme';
import AuditFooter from '../components/AuditFooter';

export const SERVICE_TYPES = {
  'service-general': { icon: '🔧', color: '#3B82F6', label: 'Service general' },
  'schimb-ulei':     { icon: '🛢️', color: '#F59E0B', label: 'Schimb ulei' },
  'anvelope':        { icon: '⚙️', color: '#8B5CF6', label: 'Anvelope' },
  'frane':           { icon: '🛑', color: '#EF4444', label: 'Frâne' },
  'itp':             { icon: '🔧', color: '#3B82F6', label: 'ITP' },
  'curatenie':       { icon: '✨', color: '#10B981', label: 'Curățenie' },
  'reparatie':       { icon: '🔨', color: '#EF4444', label: 'Reparație' },
  'piese':           { icon: '🔩', color: '#F59E0B', label: 'Piese' },
};

const FILTERS = [
  { k: 'all',     l: 'Toate' },
  { k: 'upcoming', l: '⏱ Viitoare' },
  { k: 'past',    l: '✓ Trecute' },
];

function isUpcoming(rec) {
  if (rec.upcoming) return true;
  const today = new Date().toISOString().slice(0, 10);
  return rec.date > today;
}

export default function ServiceHistoryScreen({ navigation, route }) {
  const vehicleId = route?.params?.vehicleId;
  const vehicles = useStore(s => s.vehicles);
  const selectedVehicleId = useStore(s => s.selectedVehicleId);
  const records = useStore(s => s.serviceRecords);
  const fetchServiceRecords = useStore(s => s.fetchServiceRecords);
  const deleteServiceRecord = useStore(s => s.deleteServiceRecord);

  const effectiveVehicleId = vehicleId || selectedVehicleId || null;
  const vehicle = effectiveVehicleId ? vehicles.find(v => v.id === effectiveVehicleId) : null;

  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    (async () => {
      try { await fetchServiceRecords(effectiveVehicleId); }
      finally { setLoading(false); }
    })();
  }, [effectiveVehicleId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await fetchServiceRecords(effectiveVehicleId); }
    finally { setRefreshing(false); }
  }, [effectiveVehicleId]);

  const scoped = useMemo(() => {
    if (!effectiveVehicleId) return records;
    return records.filter(r => r.vehicleId === effectiveVehicleId);
  }, [records, effectiveVehicleId]);

  const items = useMemo(
    () => scoped
      .filter(s => filter === 'all'
        || (filter === 'upcoming' ? isUpcoming(s) : !isUpcoming(s)))
      .sort((a, b) => a.date < b.date ? 1 : -1),
    [scoped, filter]
  );

  const yearNow = new Date().getFullYear();
  const totalCost = scoped
    .filter(s => !isUpcoming(s) && s.date.slice(0, 4) === String(yearNow))
    .reduce((sum, s) => sum + (s.cost || 0), 0);
  const upcomingCount = scoped.filter(s => isUpcoming(s)).length;

  const handleDelete = (rec) => {
    Alert.alert(
      'Șterge înregistrarea?',
      `"${rec.title}" din ${formatDate(rec.date)}`,
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Șterge', style: 'destructive',
          onPress: async () => {
            try { await deleteServiceRecord(rec.id); }
            catch (e) { Alert.alert('Eroare', e?.response?.data?.error || 'Nu pot șterge'); }
          },
        },
      ]
    );
  };

  const plate = vehicle?.plate || 'Toate vehiculele';

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, display(700)]}>Istoric service</Text>
          <Text style={styles.headerSubtitle}>{plate}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.summary}>
        <View style={styles.summaryTile}>
          <Text style={styles.summaryLabel}>Cheltuit anul ăsta</Text>
          <Text style={[styles.summaryValue, display(700)]}>{formatCurrency(totalCost)}</Text>
        </View>
        <View style={styles.summaryTile}>
          <Text style={styles.summaryLabel}>Programate</Text>
          <Text style={[styles.summaryValue, display(700)]}>{upcomingCount}</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        {FILTERS.map(c => {
          const active = filter === c.k;
          return (
            <TouchableOpacity
              key={c.k}
              onPress={() => setFilter(c.k)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.l}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        contentContainerStyle={styles.timelineWrap}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.brand} />}
      >
        {loading ? (
          <ActivityIndicator color={T.brand} style={{ marginTop: 40 }} />
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔧</Text>
            <Text style={styles.emptyTitle}>Niciun service încă</Text>
            <Text style={styles.emptySub}>
              {filter === 'upcoming'
                ? 'Programează o vizită cu butonul +.'
                : filter === 'past'
                  ? 'Înregistrează un service efectuat cu butonul +.'
                  : 'Adaugă revizii, reparații sau ITP din butonul +.'}
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.rail} />
            {items.map((s, i) => {
              const meta = SERVICE_TYPES[s.type] || SERVICE_TYPES['service-general'];
              const up = isUpcoming(s);
              return (
                <TouchableOpacity
                  key={s.id}
                  onLongPress={() => handleDelete(s)}
                  onPress={() => navigation.navigate('AddServiceRecord', { recordId: s.id, vehicleId: s.vehicleId })}
                  activeOpacity={0.85}
                  style={[styles.row, i === items.length - 1 && { marginBottom: 0 }]}
                >
                  <View
                    style={[
                      styles.dot,
                      {
                        backgroundColor: up ? T.brandTint : meta.color,
                        borderStyle: up ? 'dashed' : 'solid',
                        borderColor: up ? T.brand : T.bg,
                        borderWidth: up ? 2 : 3,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 14 }}>{meta.icon}</Text>
                  </View>

                  <View
                    style={[
                      styles.card,
                      up && { borderStyle: 'dashed', borderColor: T.brandTint2, borderWidth: 1.5 },
                    ]}
                  >
                    <View style={styles.cardTop}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.cardTitle} numberOfLines={1}>{s.title}</Text>
                        {!!s.provider && <Text style={styles.cardProvider} numberOfLines={1}>{s.provider}</Text>}
                      </View>
                      <Text style={[styles.cardCost, display(700), { color: up ? T.ink3 : T.brand }]}>
                        {up ? '—' : formatCurrency(s.cost || 0)}
                      </Text>
                    </View>

                    <View style={styles.metaRow}>
                      <View style={[styles.typePill, { backgroundColor: meta.color + '1A' }]}>
                        <Text style={[styles.typePillText, { color: meta.color }]}>{meta.label}</Text>
                      </View>
                      <Text style={styles.metaText}>{formatDate(s.date)}</Text>
                      {s.km != null && (
                        <>
                          <Text style={styles.metaDot}>·</Text>
                          <Text style={styles.metaText}>{Number(s.km).toLocaleString('ro-RO')} km</Text>
                        </>
                      )}
                      {up && (
                        <View style={styles.daysPill}>
                          <Text style={styles.daysPillText}>În {Math.max(0, daysUntil(s.date) || 0)} zile</Text>
                        </View>
                      )}
                    </View>

                    {!!s.notes && (
                      <View style={styles.notes}>
                        <Text style={styles.notesText}>{s.notes}</Text>
                      </View>
                    )}
                    <AuditFooter
                      creator={s.user}
                      updater={s.updatedBy}
                      createdAt={s.createdAt}
                      updatedAt={s.updatedAt}
                    />
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('AddServiceRecord', { vehicleId: effectiveVehicleId })}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
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
  headerSubtitle: { fontSize: 11, color: T.ink3, marginTop: 2, letterSpacing: 0.3 },

  summary: {
    flexDirection: 'row', gap: 14,
    backgroundColor: T.brand, padding: 16,
  },
  summaryTile: {
    flex: 1, padding: 10, borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  summaryLabel: {
    fontSize: 10, color: 'rgba(255,255,255,0.85)',
    fontWeight: FONTS.semibold, letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  summaryValue: { fontSize: 20, color: '#fff', marginTop: 4, fontWeight: FONTS.bold },

  chipsRow: { paddingHorizontal: 20, paddingVertical: 14, gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full,
    backgroundColor: T.bgSoft, borderWidth: 1.5, borderColor: T.line,
  },
  chipActive: { backgroundColor: T.brand, borderColor: T.brand },
  chipText: { fontSize: 13, color: T.ink2, fontWeight: FONTS.semibold },
  chipTextActive: { color: '#fff' },

  timelineWrap: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 100, position: 'relative' },
  rail: {
    position: 'absolute', left: 36, top: 4, bottom: 100,
    width: 2, backgroundColor: T.line,
  },
  row: { flexDirection: 'row', gap: 16, marginBottom: 14 },
  dot: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 4, zIndex: 1,
  },
  card: {
    flex: 1, backgroundColor: T.card,
    borderRadius: RADIUS.lg, padding: 14,
    borderWidth: 1, borderColor: T.line2,
    ...SHADOW.sm,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 6 },
  cardTitle: { fontSize: 14, fontWeight: FONTS.bold, color: T.ink },
  cardProvider: { fontSize: 12, color: T.ink3, marginTop: 2 },
  cardCost: { fontSize: 15, fontWeight: FONTS.bold },

  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  typePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full },
  typePillText: { fontSize: 10, fontWeight: FONTS.bold },
  metaText: { fontSize: 11, color: T.ink3, fontWeight: FONTS.medium },
  metaDot: { fontSize: 11, color: T.ink4 },
  daysPill: {
    marginLeft: 'auto',
    backgroundColor: T.brandTint, paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  daysPillText: { fontSize: 10, color: T.brand, fontWeight: FONTS.bold },

  notes: {
    marginTop: 8, padding: 10,
    backgroundColor: T.bgSoft, borderRadius: RADIUS.sm,
    borderLeftWidth: 2, borderLeftColor: T.brand,
  },
  notesText: { fontSize: 11, color: T.ink3 },

  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 20 },
  emptyIcon: { fontSize: 56, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: FONTS.bold, color: T.ink },
  emptySub: { fontSize: 13, color: T.ink3, marginTop: 6, textAlign: 'center' },

  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: T.brand,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: T.brand, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 16, elevation: 8,
  },
  fabText: { color: '#fff', fontSize: 32, fontWeight: '300', lineHeight: 34 },
});
