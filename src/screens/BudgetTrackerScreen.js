import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import useStore from '../store';
import {
  T, RADIUS, SHADOW, FONTS, formatCurrency, display,
} from '../theme';

const MONTHS_RO = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];

// Pre-defined templates the user can add quickly. They map 1:1 onto the
// household expense `category` field so spent/limit math is automatic.
export const BUDGET_CATEGORY_TEMPLATES = [
  { key: 'utilitati',  label: 'Utilități',   icon: '💡', color: '#3B82F6' },
  { key: 'alimente',   label: 'Alimente',    icon: '🛒', color: '#10B981' },
  { key: 'casa',       label: 'Casă',        icon: '🏠', color: '#8B5CF6' },
  { key: 'transport',  label: 'Transport',   icon: '🚇', color: '#F59E0B' },
  { key: 'sanatate',   label: 'Sănătate',    icon: '💊', color: '#EF4444' },
  { key: 'distractii', label: 'Timp liber',  icon: '🎬', color: '#EC4899' },
  { key: 'rate',       label: 'Rate',        icon: '🏦', color: '#0EA5E9' },
  { key: 'abonamente', label: 'Abonamente',  icon: '📺', color: '#A855F7' },
  { key: 'intretinere', label: 'Întreținere', icon: '🛠', color: '#64748B' },
  { key: 'mancare',    label: 'Restaurante', icon: '🍽', color: '#F97316' },
  { key: 'curatenie',  label: 'Curățenie',   icon: '🧽', color: '#22D3EE' },
  { key: 'mobila',     label: 'Mobilă',      icon: '🛋', color: '#8B5CF6' },
  { key: 'reparatii',  label: 'Reparații',   icon: '🔧', color: '#DC2626' },
  { key: 'altele',     label: 'Altele',      icon: '📦', color: '#6B7280' },
];

function DonutRing({ pct, color }) {
  const size = 110;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const filled = Math.min(100, pct);
  const dash = (filled / 100) * circ;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={T.line2} strokeWidth={stroke} />
        <Circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          rotation="-90" origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={ringStyles.center}>
        <Text style={[ringStyles.pct, display(700)]}>
          {pct.toFixed(0)}
          <Text style={ringStyles.pctUnit}>%</Text>
        </Text>
        <Text style={ringStyles.label}>FOLOSIT</Text>
      </View>
    </View>
  );
}

const ringStyles = StyleSheet.create({
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  pct: { fontSize: 24, color: T.ink, fontWeight: FONTS.bold, letterSpacing: -0.5 },
  pctUnit: { fontSize: 12, color: T.ink3, fontWeight: FONTS.medium },
  label: { fontSize: 9, color: T.ink3, fontWeight: FONTS.bold, letterSpacing: 0.5, marginTop: 2 },
});

export default function BudgetTrackerScreen({ navigation }) {
  const households = useStore(s => s.households);
  const selectedHouseholdId = useStore(s => s.selectedHouseholdId);
  const summary = useStore(s => s.budgetSummary);
  const fetchBudgetSummary = useStore(s => s.fetchBudgetSummary);
  const fetchHouseholdExpenses = useStore(s => s.fetchHouseholdExpenses);

  const household = households.find(h => h.id === selectedHouseholdId) || households[0];
  const householdId = household?.id;

  // Show full spinner only when we have absolutely nothing to render. Otherwise
  // we draw whatever's in cache instantly and refresh in the background — feels
  // way snappier on flaky / offline connections.
  const hasAnyData = !!(summary && summary.categories);
  const [loading, setLoading] = useState(!hasAnyData);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!householdId) return;
    await Promise.all([
      fetchBudgetSummary(householdId),
      fetchHouseholdExpenses(householdId),
    ]);
  }, [householdId, fetchBudgetSummary, fetchHouseholdExpenses]);

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

  const now = new Date();
  const monthLabel = `${MONTHS_RO[now.getMonth()]} ${now.getFullYear()}`;
  const daysLeft = useMemo(() => {
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return Math.max(0, end - now.getDate());
  }, [now]);

  const categories = summary?.categories || [];
  const totalSpent = summary?.totalSpent || 0;
  const otherSpent = summary?.otherSpent || 0;
  const totalLimit = categories.reduce((s, c) => s + (c.monthlyLimit || 0), 0);
  const trackedSpent = categories.reduce((s, c) => s + (c.spent || 0), 0);
  const budgetPct = totalLimit > 0 ? (trackedSpent / totalLimit) * 100 : 0;
  const overBudget = categories.filter(c => (c.spent || 0) > (c.monthlyLimit || 0) && c.monthlyLimit > 0);
  const remaining = totalLimit - trackedSpent;
  const dailyAvg = remaining > 0 && daysLeft > 0 ? remaining / daysLeft : 0;
  const ringColor = budgetPct > 100 ? T.danger : budgetPct > 85 ? T.warn : T.success;

  if (!householdId) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <Header navigation={navigation} title="Buget" subtitle="" />
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🏠</Text>
          <Text style={styles.emptyTitle}>Adaugă o locuință</Text>
          <Text style={styles.emptySub}>Bugetul se urmărește la nivel de locuință.</Text>
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
      <Header navigation={navigation} title="Buget" subtitle={`${household.name} · ${monthLabel}`} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.brand} />}
      >
        {loading ? (
          <ActivityIndicator color={T.brand} style={{ marginTop: 60 }} />
        ) : categories.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyTitle}>Niciun buget definit</Text>
            <Text style={styles.emptySub}>
              Adaugă categorii de buget cu limite lunare. Cheltuielile tale se vor mapa automat pe ele.
            </Text>
            <TouchableOpacity
              style={styles.cta}
              onPress={() => navigation.navigate('EditBudgetCategory', { householdId })}
            >
              <Text style={styles.ctaText}>+ Adaugă prima categorie</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Hero — donut */}
            <View style={styles.hero}>
              <DonutRing pct={budgetPct} color={ringColor} />
              <View style={{ flex: 1 }}>
                <Text style={styles.heroLabel}>CHELTUIT (urmărit)</Text>
                <Text style={[styles.heroValue, display(700)]}>{formatCurrency(trackedSpent)}</Text>
                <Text style={styles.heroSub}>
                  din <Text style={styles.heroSubStrong}>{formatCurrency(totalLimit)}</Text>
                </Text>
                {remaining > 0 ? (
                  <View style={[styles.heroPill, { backgroundColor: T.successTint }]}>
                    <Text style={[styles.heroPillText, { color: T.success }]}>
                      ↓ {formatCurrency(remaining)} rămas
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.heroPill, { backgroundColor: T.dangerTint }]}>
                    <Text style={[styles.heroPillText, { color: T.danger }]}>
                      ↑ {formatCurrency(-remaining)} peste buget
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Daily allowance */}
            {remaining > 0 && daysLeft > 0 && (
              <View style={styles.alertBox}>
                <Text style={{ fontSize: 24 }}>💡</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertTitle}>
                    Poți cheltui <Text style={styles.alertStrong}>{formatCurrency(dailyAvg)}/zi</Text> până la finalul lunii
                  </Text>
                  <Text style={styles.alertSub}>
                    {daysLeft} zile rămase
                  </Text>
                </View>
              </View>
            )}

            {/* Over-budget alert */}
            {overBudget.length > 0 && (
              <View style={styles.warningBox}>
                <Text style={{ fontSize: 24 }}>⚠️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.warningTitle}>
                    {overBudget.length} categori{overBudget.length > 1 ? 'i' : 'e'} peste buget
                  </Text>
                  <Text style={styles.warningSub}>{overBudget.map(c => c.label).join(' · ')}</Text>
                </View>
              </View>
            )}

            {/* Untracked spend hint */}
            {otherSpent > 0 && (
              <View style={styles.infoBox}>
                <Text style={{ fontSize: 18 }}>📦</Text>
                <Text style={styles.infoText}>
                  <Text style={{ fontWeight: FONTS.bold }}>{formatCurrency(otherSpent)}</Text> sunt cheltuieli din categorii fără buget definit.
                </Text>
              </View>
            )}

            {/* Categories */}
            <View style={styles.categoriesCard}>
              {categories.map((c, i) => {
                const limit = c.monthlyLimit || 0;
                const spent = c.spent || 0;
                const pct = limit > 0 ? (spent / limit) * 100 : 0;
                const over = limit > 0 && spent > limit;
                const barColor = limit === 0 ? T.line : over ? T.danger : pct > 85 ? T.warn : c.color;
                return (
                  <TouchableOpacity
                    key={c.id}
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate('BudgetCategoryDetail', { categoryId: c.id, householdId })}
                    onLongPress={() => navigation.navigate('EditBudgetCategory', { householdId, categoryId: c.id })}
                    style={[
                      styles.catRow,
                      i < categories.length - 1 && styles.catRowBorder,
                    ]}
                  >
                    <View style={styles.catTop}>
                      <View style={[styles.catIcon, { backgroundColor: (c.color || '#6B7280') + '1A' }]}>
                        <Text style={{ fontSize: 18 }}>{c.icon || '📦'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.catLabel}>{c.label}</Text>
                        <Text style={[styles.catAmount, over && { color: T.danger }]}>
                          {formatCurrency(spent)}{' '}
                          <Text style={styles.catLimit}>
                            {limit > 0 ? `din ${formatCurrency(limit)}` : '· fără limită'}
                          </Text>
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        {limit > 0 && (
                          <Text style={[styles.catPct, display(700), over && { color: T.danger }]}>
                            {pct.toFixed(0)}
                            <Text style={styles.catPctUnit}>%</Text>
                          </Text>
                        )}
                        {over && <Text style={styles.overBadge}>OVER</Text>}
                      </View>
                    </View>
                    {limit > 0 && (
                      <View style={styles.progress}>
                        <View style={[styles.progressFill, { width: `${Math.min(100, pct)}%`, backgroundColor: barColor }]} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => navigation.navigate('EditBudgetCategory', { householdId })}
            >
              <Text style={styles.addBtnText}>+ Adaugă categorie</Text>
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

  empty: { alignItems: 'center', paddingHorizontal: 30, paddingTop: 60 },
  emptyIcon: { fontSize: 64 },
  emptyTitle: { fontSize: 20, color: T.ink, fontWeight: FONTS.bold, marginTop: 12 },
  emptySub: { fontSize: 13, color: T.ink3, marginTop: 8, textAlign: 'center', lineHeight: 19 },
  cta: { backgroundColor: T.brand, paddingVertical: 14, paddingHorizontal: 24, borderRadius: RADIUS.lg, marginTop: 24, ...SHADOW.md },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: FONTS.bold },

  hero: {
    backgroundColor: T.card, borderRadius: RADIUS.xl, padding: 20,
    flexDirection: 'row', alignItems: 'center', gap: 20,
    ...SHADOW.md,
  },
  heroLabel: { fontSize: 11, color: T.ink3, fontWeight: FONTS.semibold, letterSpacing: 0.8 },
  heroValue: { fontSize: 26, color: T.ink, fontWeight: FONTS.bold, marginTop: 2, letterSpacing: -0.5 },
  heroSub: { fontSize: 12, color: T.ink3, marginTop: 4 },
  heroSubStrong: { color: T.ink2, fontWeight: FONTS.bold },
  heroPill: { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.full },
  heroPillText: { fontSize: 11, fontWeight: FONTS.bold },

  alertBox: {
    backgroundColor: T.brandTint, borderColor: T.brandTint2, borderWidth: 1,
    borderRadius: RADIUS.lg, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  alertTitle: { fontSize: 12, color: T.brandDark, fontWeight: FONTS.semibold },
  alertStrong: { color: T.brand, fontWeight: FONTS.bold },
  alertSub: { fontSize: 10, color: T.brandDark, opacity: 0.75, marginTop: 2 },

  warningBox: {
    backgroundColor: T.dangerTint, borderColor: T.danger + '33', borderWidth: 1,
    borderRadius: RADIUS.lg, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  warningTitle: { fontSize: 12, color: T.danger, fontWeight: FONTS.bold },
  warningSub: { fontSize: 10, color: T.danger, opacity: 0.85, marginTop: 2 },

  infoBox: {
    backgroundColor: T.line2, borderRadius: RADIUS.md, padding: 12,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  infoText: { flex: 1, fontSize: 12, color: T.ink3 },

  categoriesCard: { backgroundColor: T.card, borderRadius: RADIUS.lg, padding: 4, ...SHADOW.sm },
  catRow: { paddingVertical: 12, paddingHorizontal: 8 },
  catRowBorder: { borderBottomWidth: 1, borderBottomColor: T.line2 },
  catTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  catIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  catLabel: { fontSize: 14, fontWeight: FONTS.bold, color: T.ink },
  catAmount: { fontSize: 11, color: T.ink3, marginTop: 2, fontWeight: FONTS.medium },
  catLimit: { color: T.ink4 },
  catPct: { fontSize: 16, color: T.ink, fontWeight: FONTS.bold, letterSpacing: -0.2 },
  catPctUnit: { fontSize: 11, color: T.ink3 },
  overBadge: { fontSize: 9, color: T.danger, fontWeight: FONTS.bold, marginTop: 2 },
  progress: { height: 6, backgroundColor: T.line2, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },

  addBtn: {
    paddingVertical: 12, borderRadius: RADIUS.lg,
    borderWidth: 1.5, borderColor: T.line, borderStyle: 'dashed',
    alignItems: 'center',
  },
  addBtnText: { fontSize: 13, fontWeight: FONTS.semibold, color: T.ink3 },
});
