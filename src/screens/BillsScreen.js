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

const TABS = [
  { k: 'all',     l: 'Toate' },
  { k: 'due',     l: 'De plătit' },
  { k: 'paid',    l: 'Plătite' },
  { k: 'overdue', l: 'Restante' },
];

function statusMeta(s, days) {
  if (s === 'paid')      return { label: 'Plătit',                  color: T.success, bg: T.successTint, icon: '✓' };
  if (s === 'overdue')   return { label: `Restant ${Math.abs(days)}z`, color: T.danger,  bg: T.dangerTint,  icon: '!' };
  if (s === 'scheduled') return { label: `În ${days}z`,              color: T.ink3,    bg: T.line2,       icon: '⏱' };
  if (days !== null && days <= 5) return { label: `${days}z`, color: T.warn, bg: T.warnTint, icon: '⚠' };
  return { label: `${days}z`, color: T.ink2, bg: T.line2, icon: '○' };
}

export default function BillsScreen({ navigation }) {
  const households = useStore(s => s.households);
  const selectedHouseholdId = useStore(s => s.selectedHouseholdId);
  const bills = useStore(s => s.householdBills);
  const fetchHouseholdBills = useStore(s => s.fetchHouseholdBills);
  const payHouseholdBill = useStore(s => s.payHouseholdBill);
  const deleteHouseholdBill = useStore(s => s.deleteHouseholdBill);

  const household = households.find(h => h.id === selectedHouseholdId) || households[0];
  const householdId = household?.id;

  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!householdId) return;
    await fetchHouseholdBills(householdId);
  }, [householdId, fetchHouseholdBills]);

  useEffect(() => {
    (async () => {
      try { await load(); }
      finally { setLoading(false); }
    })();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await load(); }
    finally { setRefreshing(false); }
  };

  const scoped = useMemo(
    () => (bills || []).filter(b => !householdId || b.householdId === householdId),
    [bills, householdId]
  );

  const enriched = useMemo(
    () => scoped.map(b => ({ ...b, daysLeft: daysUntil(b.dueDate) })),
    [scoped]
  );

  const filtered = useMemo(
    () => enriched
      .filter(b => filter === 'all' || b.status === filter)
      .sort((a, b) => {
        if (a.status === 'overdue' && b.status !== 'overdue') return -1;
        if (b.status === 'overdue' && a.status !== 'overdue') return 1;
        return new Date(a.dueDate) - new Date(b.dueDate);
      }),
    [enriched, filter]
  );

  // Only count monthly recurring bills in the hero progress to avoid yearly insurance distorting it.
  const monthly = enriched.filter(b => b.recurring === 'lunar');
  const totalDue = monthly.filter(b => b.status === 'due' || b.status === 'overdue').reduce((s, b) => s + b.amount, 0);
  const totalPaid = monthly.filter(b => b.status === 'paid').reduce((s, b) => s + b.amount, 0);
  const monthlyTotal = monthly.reduce((s, b) => s + b.amount, 0);
  const paidPct = monthlyTotal > 0 ? (totalPaid / monthlyTotal) * 100 : 0;

  const handlePay = (b) => {
    Alert.alert(
      'Marchează ca plătit?',
      `"${b.name}" — ${formatCurrency(b.amount)}`,
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Da, am plătit',
          onPress: async () => {
            try { await payHouseholdBill(b.id); }
            catch (e) { Alert.alert('Eroare', e?.response?.data?.error || 'Nu pot marca'); }
          },
        },
      ]
    );
  };

  const handleDelete = (b) => {
    Alert.alert(
      'Șterge factura?',
      `"${b.name}" se va elimina permanent.`,
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Șterge', style: 'destructive',
          onPress: async () => {
            try { await deleteHouseholdBill(b.id); }
            catch (e) { Alert.alert('Eroare', e?.response?.data?.error || 'Nu pot șterge'); }
          },
        },
      ]
    );
  };

  if (!householdId) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <Header navigation={navigation} title="Facturi" subtitle="" />
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🏠</Text>
          <Text style={styles.emptyTitle}>Adaugă o locuință</Text>
          <Text style={styles.emptySub}>Facturile recurente se țin pe locuință.</Text>
          <TouchableOpacity
            style={styles.cta}
            onPress={() => navigation.navigate('AddHousehold')}
          >
            <Text style={styles.ctaText}>+ Locuință nouă</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Header navigation={navigation} title="Facturi & abonamente" subtitle={household.name} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.brand} />}
      >
        {loading ? (
          <ActivityIndicator color={T.brand} style={{ marginTop: 60 }} />
        ) : (
          <>
            {/* Hero */}
            <View style={styles.hero}>
              <Text style={styles.heroLabel}>DE PLĂTIT LUNA ASTA</Text>
              <Text style={[styles.heroValue, display(700)]}>{formatCurrency(totalDue)}</Text>
              <View style={styles.heroBar}>
                <View style={styles.heroBarTrack}>
                  <View style={[styles.heroBarFill, { width: `${paidPct}%` }]} />
                </View>
                <Text style={styles.heroBarPct}>{paidPct.toFixed(0)}%</Text>
              </View>
              <View style={styles.heroFooter}>
                <Text style={styles.heroFootText}>✓ Plătit: {formatCurrency(totalPaid)}</Text>
                <Text style={styles.heroFootText}>
                  {monthly.length} {monthly.length === 1 ? 'factură' : 'facturi'} · {formatCurrency(monthlyTotal)}
                </Text>
              </View>
            </View>

            {/* Tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabsRow}
            >
              {TABS.map(t => {
                const active = filter === t.k;
                const count = t.k === 'all' ? enriched.length : enriched.filter(b => b.status === t.k).length;
                return (
                  <TouchableOpacity
                    key={t.k}
                    onPress={() => setFilter(t.k)}
                    style={[styles.tab, active && styles.tabActive]}
                  >
                    <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.l}</Text>
                    <View style={[styles.tabCount, active && styles.tabCountActive]}>
                      <Text style={[styles.tabCountText, active && styles.tabCountTextActive]}>{count}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Bills */}
            {filtered.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>🧾</Text>
                <Text style={styles.emptyTitle}>
                  {enriched.length === 0
                    ? 'Niciuna încă'
                    : `Nicio factură ${filter === 'paid' ? 'plătită' : filter === 'overdue' ? 'restantă' : 'de plătit'}`}
                </Text>
                {enriched.length === 0 && (
                  <Text style={styles.emptySub}>
                    Adaugă facturile recurente (curent, gaz, internet, abonamente) ca să le ai într-un singur loc.
                  </Text>
                )}
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {filtered.map(b => {
                  const meta = statusMeta(b.status, b.daysLeft);
                  const isOverdue = b.status === 'overdue';
                  const isDueSoon = b.status === 'due' && b.daysLeft !== null && b.daysLeft <= 5;
                  return (
                    <TouchableOpacity
                      key={b.id}
                      activeOpacity={0.85}
                      onPress={() => navigation.navigate('AddBill', { billId: b.id, householdId })}
                      onLongPress={() => handleDelete(b)}
                      style={[
                        styles.bill,
                        isOverdue && { borderColor: T.danger + '66', borderWidth: 1.5 },
                        isDueSoon && !isOverdue && { borderColor: T.warn + '66', borderWidth: 1 },
                      ]}
                    >
                      <View style={[styles.stripe, { backgroundColor: b.color }]} />
                      <View style={[styles.billIcon, { backgroundColor: (b.color || '#6B7280') + '1A' }]}>
                        <Text style={{ fontSize: 22 }}>{b.icon || '📄'}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={styles.billTitleRow}>
                          <Text style={styles.billName} numberOfLines={1}>{b.name}</Text>
                          {!!b.recurring && b.recurring !== 'none' && (
                            <View style={styles.recurringPill}>
                              <Text style={styles.recurringText}>{b.recurring}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.billProvider} numberOfLines={1}>
                          {b.provider} · scadent {formatDate(b.dueDate)}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.billAmount, display(700)]}>{formatCurrency(b.amount)}</Text>
                        {b.status !== 'paid' ? (
                          <TouchableOpacity
                            onPress={() => handlePay(b)}
                            style={[styles.statusPill, { backgroundColor: meta.bg }]}
                          >
                            <Text style={[styles.statusText, { color: meta.color }]}>{meta.icon} {meta.label}</Text>
                          </TouchableOpacity>
                        ) : (
                          <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                            <Text style={[styles.statusText, { color: meta.color }]}>{meta.icon} {meta.label}</Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => navigation.navigate('AddBill', { householdId })}
            >
              <Text style={styles.addBtnText}>+ Adaugă factură recurentă</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ navigation, title, subtitle }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Text style={styles.backArrow}>‹</Text>
      </TouchableOpacity>
      <View style={styles.headerCenter}>
        <Text style={[styles.headerTitle, display(700)]}>{title}</Text>
        {!!subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
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

  empty: { alignItems: 'center', paddingHorizontal: 30, paddingTop: 40 },
  emptyIcon: { fontSize: 64 },
  emptyTitle: { fontSize: 18, color: T.ink, fontWeight: FONTS.bold, marginTop: 10 },
  emptySub: { fontSize: 13, color: T.ink3, marginTop: 6, textAlign: 'center', lineHeight: 19 },
  cta: { backgroundColor: T.brand, paddingVertical: 14, paddingHorizontal: 24, borderRadius: RADIUS.lg, marginTop: 24, ...SHADOW.md },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: FONTS.bold },

  hero: {
    backgroundColor: T.brand,
    borderRadius: RADIUS.xl, padding: 18,
    ...SHADOW.md,
  },
  heroLabel: {
    fontSize: 11, color: 'rgba(255,255,255,0.85)',
    fontWeight: FONTS.semibold, letterSpacing: 1,
  },
  heroValue: {
    fontSize: 32, color: '#fff', marginTop: 4,
    fontWeight: FONTS.bold, letterSpacing: -0.5,
  },
  heroBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  heroBarTrack: { flex: 1, height: 8, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 4, overflow: 'hidden' },
  heroBarFill: { height: '100%', backgroundColor: '#fff', borderRadius: 4 },
  heroBarPct: { fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: FONTS.semibold },
  heroFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  heroFootText: { fontSize: 10, color: 'rgba(255,255,255,0.75)' },

  tabsRow: { gap: 6, paddingRight: 16 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: T.card, borderWidth: 1, borderColor: T.line,
  },
  tabActive: { backgroundColor: T.ink, borderColor: T.ink },
  tabText: { fontSize: 12, color: T.ink2, fontWeight: FONTS.semibold },
  tabTextActive: { color: '#fff' },
  tabCount: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: RADIUS.full, backgroundColor: T.line2 },
  tabCountActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  tabCountText: { fontSize: 10, color: T.ink3, fontWeight: FONTS.bold },
  tabCountTextActive: { color: '#fff' },

  bill: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: T.card, borderRadius: RADIUS.lg, padding: 14,
    borderWidth: 1, borderColor: T.line2,
    overflow: 'hidden',
    ...SHADOW.sm,
  },
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  billIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  billTitleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  billName: { fontSize: 14, fontWeight: FONTS.bold, color: T.ink, flexShrink: 1 },
  recurringPill: { backgroundColor: T.line2, paddingHorizontal: 6, paddingVertical: 1, borderRadius: RADIUS.full },
  recurringText: { fontSize: 9, color: T.ink3, fontWeight: FONTS.bold, letterSpacing: 0.4, textTransform: 'uppercase' },
  billProvider: { fontSize: 11, color: T.ink3, marginTop: 2 },
  billAmount: { fontSize: 16, color: T.ink, fontWeight: FONTS.bold },
  statusPill: { marginTop: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  statusText: { fontSize: 10, fontWeight: FONTS.bold },

  addBtn: {
    paddingVertical: 12, borderRadius: RADIUS.lg,
    borderWidth: 1.5, borderColor: T.line, borderStyle: 'dashed',
    alignItems: 'center',
  },
  addBtnText: { fontSize: 13, fontWeight: FONTS.semibold, color: T.ink3 },
});
