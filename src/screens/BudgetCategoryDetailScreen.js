import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import useStore from '../store';
import {
  T, RADIUS, SHADOW, FONTS, formatDate, formatCurrency, display,
} from '../theme';
import AuditFooter from '../components/AuditFooter';

const MONTHS_RO = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
                   'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];

function MiniRing({ pct, color }) {
  const size = 80;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const dash = (Math.min(100, pct) / 100) * circ;
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
          {pct.toFixed(0)}<Text style={ringStyles.pctUnit}>%</Text>
        </Text>
      </View>
    </View>
  );
}

const ringStyles = StyleSheet.create({
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  pct: { fontSize: 18, color: T.ink, fontWeight: FONTS.bold, letterSpacing: -0.3 },
  pctUnit: { fontSize: 11, color: T.ink3, fontWeight: FONTS.medium },
});

export default function BudgetCategoryDetailScreen({ navigation, route }) {
  const { categoryId, householdId } = route.params || {};
  const categories = useStore(s => s.budgetCategories);
  const expenses = useStore(s => s.householdExpenses);
  const fetchBudgetCategories = useStore(s => s.fetchBudgetCategories);
  const fetchHouseholdExpenses = useStore(s => s.fetchHouseholdExpenses);
  const deleteHouseholdExpense = useStore(s => s.deleteHouseholdExpense);
  const user = useStore(s => s.user);
  const households = useStore(s => s.households);
  const household = households.find(h => h.id === householdId);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scope, setScope] = useState('month'); // 'month' | 'all'

  const category = categories.find(c => c.id === categoryId);

  const load = useCallback(async () => {
    if (!householdId) return;
    await Promise.all([
      fetchBudgetCategories(householdId),
      fetchHouseholdExpenses(householdId),
    ]);
  }, [householdId, fetchBudgetCategories, fetchHouseholdExpenses]);

  useEffect(() => {
    (async () => { try { await load(); } finally { setLoading(false); } })();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await load(); }
    finally { setRefreshing(false); }
  };

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthLabel = `${MONTHS_RO[now.getMonth()]} ${now.getFullYear()}`;

  const matching = useMemo(() => {
    if (!category) return [];
    return (expenses || [])
      .filter(e => e.householdId === householdId && e.category === category.key)
      .filter(e => scope === 'all' ? true : (e.date || '').startsWith(monthKey))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [expenses, householdId, category, scope, monthKey]);

  const totalSpent = matching.reduce((s, e) => s + Number(e.amount || 0), 0);

  // Per-user breakdown for this category (current scope)
  const byUser = useMemo(() => {
    const map = {};
    matching.forEach(e => {
      const u = e.user || { id: e.userId, name: 'Necunoscut' };
      if (!map[u.id]) map[u.id] = { user: u, total: 0, count: 0 };
      map[u.id].total += Number(e.amount || 0);
      map[u.id].count += 1;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [matching]);

  const limit = category?.monthlyLimit || 0;
  const pct = limit > 0 ? (totalSpent / limit) * 100 : 0;
  const over = limit > 0 && totalSpent > limit;
  const ringColor = over ? T.danger : pct > 85 ? T.warn : (category?.color || T.brand);

  const handleDeleteExpense = (exp) => {
    const canDelete = exp.userId === user?.id || household?.userId === user?.id;
    if (!canDelete) {
      Alert.alert('Acces refuzat', 'Poți șterge doar cheltuielile adăugate de tine.');
      return;
    }
    Alert.alert(
      'Șterge cheltuiala?',
      `"${exp.title}" — ${formatCurrency(exp.amount, exp.currency || 'RON')}`,
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Șterge', style: 'destructive',
          onPress: async () => {
            try { await deleteHouseholdExpense(exp.id); }
            catch (e) { Alert.alert('Eroare', e?.response?.data?.error || 'Nu pot șterge.'); }
          },
        },
      ]
    );
  };

  if (!category) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <Header navigation={navigation} title="Categorie" />
        <View style={styles.empty}>
          <ActivityIndicator color={T.brand} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Header navigation={navigation} title={category.label} subtitle={household?.name || ''} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.brand} />}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={[styles.heroIcon, { backgroundColor: (category.color || '#6B7280') + '1A' }]}>
            <Text style={{ fontSize: 28 }}>{category.icon || '📌'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.heroSpent, display(700)]}>{formatCurrency(totalSpent)}</Text>
            {limit > 0 ? (
              <Text style={styles.heroLimit}>din {formatCurrency(limit)} / lună</Text>
            ) : (
              <Text style={styles.heroLimit}>fără limită lunară definită</Text>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              {limit > 0 && (
                <View style={[styles.pctPill, { backgroundColor: over ? T.dangerTint : (pct > 85 ? T.warnTint : T.successTint) }]}>
                  <Text style={[styles.pctPillText, { color: over ? T.danger : (pct > 85 ? T.warn : T.success) }]}>
                    {over ? `↑ ${formatCurrency(totalSpent - limit)} peste buget` : `${pct.toFixed(0)}% folosit`}
                  </Text>
                </View>
              )}
              <Text style={styles.heroCount}>{matching.length} înregistrări · {monthLabel}</Text>
            </View>
          </View>
          {limit > 0 && <MiniRing pct={pct} color={ringColor} />}
        </View>

        {/* Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('EditBudgetCategory', { householdId, categoryId: category.id })}
          >
            <Text style={styles.actionBtnText}>✎ Editează categoria</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnPrimary]}
            onPress={() => navigation.navigate('AddHouseholdExpense', { householdId })}
          >
            <Text style={[styles.actionBtnText, styles.actionBtnTextPrimary]}>+ Cheltuială nouă</Text>
          </TouchableOpacity>
        </View>

        {/* Scope toggle */}
        <View style={styles.scopeRow}>
          {[
            { k: 'month', l: monthLabel },
            { k: 'all', l: 'Toate' },
          ].map(s => {
            const active = scope === s.k;
            return (
              <TouchableOpacity
                key={s.k}
                onPress={() => setScope(s.k)}
                style={[styles.scopeBtn, active && styles.scopeBtnActive]}
              >
                <Text style={[styles.scopeBtnText, active && styles.scopeBtnTextActive]}>{s.l}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Per-user breakdown */}
        {byUser.length >= 2 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>👥 Pe membri</Text>
            <View style={{ gap: 8, marginTop: 10 }}>
              {byUser.map(u => {
                const share = totalSpent > 0 ? (u.total / totalSpent) * 100 : 0;
                return (
                  <View key={u.user.id}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={styles.userName} numberOfLines={1}>{u.user.name}</Text>
                      <Text style={styles.userAmount}>{formatCurrency(u.total)}</Text>
                    </View>
                    <View style={styles.bar}>
                      <View style={[styles.barFill, { width: `${share}%`, backgroundColor: category.color || T.brand }]} />
                    </View>
                    <Text style={styles.userMeta}>{share.toFixed(1)}% · {u.count} înregistrări</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Expenses list */}
        <View>
          <Text style={[styles.sectionTitle, { paddingHorizontal: 4 }]}>
            🧾 Cheltuieli {scope === 'all' ? 'toate' : monthLabel}
          </Text>
          {loading ? (
            <ActivityIndicator color={T.brand} style={{ marginTop: 30 }} />
          ) : matching.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🧾</Text>
              <Text style={styles.emptyTitle}>Nicio cheltuială încă</Text>
              <Text style={styles.emptySub}>
                {scope === 'month'
                  ? 'Adaugă o cheltuială sau încearcă scope "Toate".'
                  : 'Adaugă o cheltuială nouă cu butonul de mai sus.'}
              </Text>
            </View>
          ) : (
            <View style={{ gap: 8, marginTop: 8 }}>
              {matching.map(exp => {
                const fromSync = exp.source === 'invoice' || exp.source === 'fuel';
                return (
                  <TouchableOpacity
                    key={exp.id}
                    style={styles.expRow}
                    onPress={() => navigation.navigate('AddHouseholdExpense', { expenseId: exp.id })}
                    onLongPress={() => handleDeleteExpense(exp)}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.expIcon, { backgroundColor: (category.color || '#6B7280') + '1A' }]}>
                      <Text style={{ fontSize: 18 }}>{category.icon || '📌'}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.expTitle} numberOfLines={1}>{exp.title}</Text>
                        {fromSync && (
                          <Text style={{ fontSize: 9, color: T.brand, fontWeight: '700' }}>
                            {exp.source === 'fuel' ? '⛽' : '🚗'}
                          </Text>
                        )}
                      </View>
                      <Text style={styles.expDate}>{formatDate(exp.date)}</Text>
                      <AuditFooter
                        creator={exp.user}
                        updater={exp.updatedBy}
                        createdAt={exp.createdAt}
                        updatedAt={exp.updatedAt}
                      />
                    </View>
                    <Text style={styles.expAmount}>{formatCurrency(exp.amount, exp.currency || 'RON')}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
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
        <Text style={[styles.headerTitle, display(700)]} numberOfLines={1}>{title}</Text>
        {!!subtitle && <Text style={styles.headerSubtitle} numberOfLines={1}>{subtitle}</Text>}
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

  hero: {
    backgroundColor: T.card, borderRadius: RADIUS.xl, padding: 18,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    ...SHADOW.md,
  },
  heroIcon: { width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  heroSpent: { fontSize: 22, color: T.ink, fontWeight: FONTS.bold, letterSpacing: -0.4 },
  heroLimit: { fontSize: 12, color: T.ink3, marginTop: 2 },
  pctPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  pctPillText: { fontSize: 10, fontWeight: FONTS.bold },
  heroCount: { fontSize: 10, color: T.ink3 },

  actionsRow: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1, paddingVertical: 12, borderRadius: RADIUS.md,
    backgroundColor: T.card, borderWidth: 1, borderColor: T.line,
    alignItems: 'center',
  },
  actionBtnPrimary: { backgroundColor: T.brand, borderColor: T.brand, ...SHADOW.sm },
  actionBtnText: { fontSize: 13, color: T.ink2, fontWeight: FONTS.semibold },
  actionBtnTextPrimary: { color: '#fff' },

  scopeRow: { flexDirection: 'row', gap: 8 },
  scopeBtn: {
    flex: 1, paddingVertical: 10, borderRadius: RADIUS.full,
    backgroundColor: T.card, borderWidth: 1, borderColor: T.line, alignItems: 'center',
  },
  scopeBtnActive: { backgroundColor: T.ink, borderColor: T.ink },
  scopeBtnText: { fontSize: 12, color: T.ink2, fontWeight: FONTS.semibold },
  scopeBtnTextActive: { color: '#fff' },

  card: {
    backgroundColor: T.card, borderRadius: RADIUS.lg, padding: 14,
    ...SHADOW.sm,
  },
  sectionTitle: { fontSize: 13, color: T.ink, fontWeight: FONTS.bold },

  bar: { height: 5, backgroundColor: T.line2, borderRadius: 3, marginTop: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  userName: { fontSize: 13, color: T.ink, fontWeight: FONTS.semibold, flex: 1 },
  userAmount: { fontSize: 13, color: T.ink, fontWeight: FONTS.bold },
  userMeta: { fontSize: 10, color: T.ink3, marginTop: 2 },

  empty: { alignItems: 'center', paddingHorizontal: 30, paddingTop: 30 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 16, color: T.ink, fontWeight: FONTS.bold, marginTop: 10 },
  emptySub: { fontSize: 12, color: T.ink3, marginTop: 6, textAlign: 'center' },

  expRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: T.card, borderRadius: RADIUS.lg, padding: 12,
    ...SHADOW.sm,
  },
  expIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  expTitle: { fontSize: 13, color: T.ink, fontWeight: FONTS.semibold, flexShrink: 1 },
  expDate: { fontSize: 11, color: T.ink3, marginTop: 2 },
  expAmount: { fontSize: 13, color: T.ink, fontWeight: FONTS.bold, fontVariant: ['tabular-nums'] },
});
