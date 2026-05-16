import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, SectionList, ScrollView, TouchableOpacity, StyleSheet, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useStore from '../store';
import {
  T, RADIUS, FONTS, SHADOW, SPACING,
  formatDate, formatCurrency,
  useResponsive, useSafeBottomPadding,
} from '../theme';
import { EmptyState, LoadingView } from '../components/ui';

const CATEGORY_META = {
  salariu:    { color: '#10B981', bg: '#ECFDF5', icon: '💼', label: 'Salariu' },
  chirie:     { color: '#3B82F6', bg: '#EFF6FF', icon: '🏠', label: 'Chirie încasată' },
  freelance:  { color: '#8B5CF6', bg: '#F5F3FF', icon: '💻', label: 'Freelance' },
  dividende:  { color: '#F59E0B', bg: '#FFFBEB', icon: '📈', label: 'Dividende' },
  bonusuri:   { color: '#EC4899', bg: '#FDF2F8', icon: '🎁', label: 'Bonusuri' },
  cadou:      { color: '#A855F7', bg: '#FAF5FF', icon: '🎀', label: 'Cadou' },
  altele:     { color: T.ink3, bg: T.line2, icon: '💵', label: 'Altele' },
};
const CATEGORIES = [
  { key: 'toate', label: 'Toate ' },
  { key: 'salariu', label: '💼 Salariu ' },
  { key: 'chirie', label: '🏠 Chirie ' },
  { key: 'freelance', label: '💻 Freelance ' },
  { key: 'dividende', label: '📈 Dividende ' },
  { key: 'bonusuri', label: '🎁 Bonusuri ' },
  { key: 'altele', label: '💵 Altele ' },
];

function getCatMeta(c) { return CATEGORY_META[c] || CATEGORY_META.altele; }
function getMonthKey(s) { const d = new Date(s); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
function getMonthLabel(k) {
  const [y,m] = k.split('-');
  const lbl = new Date(parseInt(y), parseInt(m)-1, 1).toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' });
  return lbl.charAt(0).toUpperCase() + lbl.slice(1);
}
function groupByMonth(items) {
  const map = {};
  items.forEach(i => { const k = getMonthKey(i.date); if (!map[k]) map[k] = []; map[k].push(i); });
  return Object.keys(map).sort((a,b) => b.localeCompare(a)).map(k => ({ title: getMonthLabel(k), monthKey: k, data: map[k] }));
}

export default function HouseholdIncomesScreen({ navigation }) {
  const incomes = useStore(s => s.householdIncomes);
  const households = useStore(s => s.households);
  const selectedHouseholdId = useStore(s => s.selectedHouseholdId);
  const fetchHouseholdIncomes = useStore(s => s.fetchHouseholdIncomes);
  const fetchHouseholds = useStore(s => s.fetchHouseholds);
  const deleteHouseholdIncome = useStore(s => s.deleteHouseholdIncome);
  const user = useStore(s => s.user);

  const { isTablet, hPad, maxContentWidth } = useResponsive();
  const safeBottom = useSafeBottomPadding(28);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [catFilter, setCatFilter] = useState('toate');
  const [householdFilter, setHouseholdFilter] = useState(selectedHouseholdId || 'all');

  useEffect(() => {
    if (selectedHouseholdId) setHouseholdFilter(selectedHouseholdId);
  }, [selectedHouseholdId]);

  const load = useCallback(async () => {
    await Promise.all([fetchHouseholds(), fetchHouseholdIncomes()]);
  }, []);

  useEffect(() => { (async () => { setLoading(true); await load(); setLoading(false); })(); }, []);
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  const filtered = useMemo(() => incomes.filter(i => {
    const byHh = householdFilter === 'all' || i.householdId === householdFilter;
    const byCat = catFilter === 'toate' || (i.category || 'altele') === catFilter;
    return byHh && byCat;
  }), [incomes, householdFilter, catFilter]);

  const sections = useMemo(() => groupByMonth(filtered), [filtered]);

  const currentMonthKey = getMonthKey(new Date().toISOString().slice(0, 10));
  const currentMonthTotal = filtered.filter(i => getMonthKey(i.date) === currentMonthKey).reduce((s, i) => s + Number(i.amount || 0), 0);

  const handleDelete = (item) => {
    Alert.alert('Șterge venit', `Sigur ștergi "${item.title}"?`, [
      { text: 'Anulează', style: 'cancel' },
      { text: 'Șterge', style: 'destructive', onPress: () => deleteHouseholdIncome(item.id).catch(() => {}) },
    ]);
  };

  const canEdit = (item) => {
    if (item.userId === user?.id) return true;
    const h = households.find(x => x.id === item.householdId);
    return !!h?.isOwner;
  };

  const renderItem = ({ item }) => {
    const meta = getCatMeta(item.category);
    const household = households.find(h => h.id === item.householdId);
    return (
      <TouchableOpacity
        style={styles.itemCard}
        onPress={() => { if (canEdit(item)) navigation.navigate('AddHouseholdIncome', { incomeId: item.id }); }}
        onLongPress={() => canEdit(item) && handleDelete(item)}
        activeOpacity={0.85}
      >
        <View style={[styles.itemIcon, { backgroundColor: meta.bg }]}><Text style={styles.itemIconText}>{meta.icon}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
          <View style={styles.itemMetaRow}>
            <Text style={[styles.itemCat, { color: meta.color, backgroundColor: meta.bg }]}>{meta.label}</Text>
            {households.length > 1 && household && <Text style={styles.itemHh}>{household.name}</Text>}
            {item.recurring && item.recurring !== 'none' && (
              <Text style={styles.itemRecurring}>🔁 {item.recurring}</Text>
            )}
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.itemAmount}>+{formatCurrency(item.amount, item.currency || 'RON')}</Text>
          <Text style={styles.itemDate}>{formatDate(item.date)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) return <LoadingView />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[styles.header, { paddingHorizontal: hPad }]}>
        <Text style={styles.headerTitle}>Venituri</Text>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionTotal}>+{formatCurrency(section.data.reduce((s, i) => s + Number(i.amount), 0), 'RON')}</Text>
          </View>
        )}
        contentContainerStyle={[
          { paddingHorizontal: hPad, paddingBottom: safeBottom + 80, gap: SPACING.sm },
          isTablet && { alignSelf: 'center', width: '100%', maxWidth: maxContentWidth },
        ]}
        ListHeaderComponent={
          <View style={{ gap: SPACING.md, paddingTop: SPACING.lg, paddingBottom: SPACING.md }}>
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>Luna curentă</Text>
              <Text style={styles.totalValue}>+{formatCurrency(currentMonthTotal, 'RON')}</Text>
            </View>
            {households.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                <TouchableOpacity onPress={() => setHouseholdFilter('all')} style={[styles.chip, householdFilter === 'all' && styles.chipActive]}>
                  <Text style={[styles.chipText, householdFilter === 'all' && styles.chipTextActive]}>Toate</Text>
                </TouchableOpacity>
                {households.map(h => (
                  <TouchableOpacity key={h.id} onPress={() => setHouseholdFilter(h.id)} style={[styles.chip, householdFilter === h.id && styles.chipActive]}>
                    <Text style={[styles.chipText, householdFilter === h.id && styles.chipTextActive]}>🏠 {h.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {CATEGORIES.map(c => (
                <TouchableOpacity key={c.key} onPress={() => setCatFilter(c.key)} style={[styles.chip, catFilter === c.key && styles.chipActive]}>
                  <Text style={[styles.chipText, catFilter === c.key && styles.chipTextActive]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={<EmptyState icon="💰" title="Niciun venit" subtitle="Apasă + pentru a adăuga primul venit" />}
        stickySectionHeadersEnabled={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.brand} />}
      />

      <TouchableOpacity
        style={[styles.fab, { bottom: safeBottom, right: hPad }]}
        onPress={() => navigation.navigate('AddHouseholdIncome', { householdId: householdFilter !== 'all' ? householdFilter : selectedHouseholdId })}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  header: { paddingTop: SPACING.sm, paddingBottom: SPACING.md },
  headerTitle: { fontSize: 22, fontWeight: FONTS.bold, color: T.ink },
  totalCard: { backgroundColor: '#10B981', borderRadius: RADIUS.xl, padding: SPACING.lg, ...SHADOW.md },
  totalLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: FONTS.semibold, letterSpacing: 1 },
  totalValue: { color: '#fff', fontSize: 28, fontWeight: FONTS.bold, marginTop: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.full, backgroundColor: T.card, borderWidth: 1.5, borderColor: T.line },
  chipActive: { backgroundColor: T.brand, borderColor: T.brand },
  chipText: { fontSize: 12, fontWeight: FONTS.semibold, color: T.ink2 },
  chipTextActive: { color: '#fff' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: SPACING.md, marginBottom: SPACING.sm },
  sectionTitle: { fontSize: 13, fontWeight: FONTS.bold, color: T.ink3, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionTotal: { fontSize: 13, fontWeight: FONTS.bold, color: '#10B981' },
  itemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.card, borderRadius: RADIUS.lg, padding: SPACING.md, gap: SPACING.md, ...SHADOW.sm },
  itemIcon: { width: 44, height: 44, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  itemIconText: { fontSize: 22 },
  itemTitle: { fontSize: 15, fontWeight: FONTS.semibold, color: T.ink },
  itemMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  itemCat: { fontSize: 10, fontWeight: FONTS.bold, paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full },
  itemHh: { fontSize: 11, color: T.ink3 },
  itemRecurring: { fontSize: 10, color: '#10B981', fontStyle: 'italic' },
  itemAmount: { fontSize: 16, fontWeight: FONTS.bold, color: '#10B981' },
  itemDate: { fontSize: 11, color: T.ink3, marginTop: 2 },
  fab: { position: 'absolute', width: 56, height: 56, borderRadius: 28, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center', ...SHADOW.lg },
  fabIcon: { color: '#fff', fontSize: 30, fontWeight: FONTS.light, lineHeight: 34, marginTop: -2 },
});
