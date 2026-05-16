import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  SectionList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useStore from '../store';
import {
  T, RADIUS, FONTS, SHADOW, SPACING,
  formatDate, formatCurrency,
  useResponsive, useSafeBottomPadding,
} from '../theme';
import { EmptyState, LoadingView } from '../components/ui';
import { exportTransactions, pickTransactionsFile } from '../utils/expenseIO';
import { getCategoryMeta, getCategoriesFor } from '../utils/categories';
import MonthPicker from '../components/MonthPicker';
import { CategoryBreakdown } from '../components/Charts';
import {
  startOfBillingMonth,
  isInBillingMonth,
  billingMonthLabel,
} from '../utils/monthRange';

function getMonthKey(s) {
  const d = new Date(s);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function getMonthLabel(k) {
  const [y, m] = k.split('-');
  const lbl = new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' });
  return lbl.charAt(0).toUpperCase() + lbl.slice(1);
}
function groupByMonth(items) {
  const map = {};
  items.forEach(i => {
    const k = getMonthKey(i.date);
    if (!map[k]) map[k] = [];
    map[k].push(i);
  });
  return Object.keys(map).sort((a, b) => b.localeCompare(a))
    .map(k => ({ title: getMonthLabel(k), monthKey: k, data: map[k] }));
}

export default function HouseholdIncomesScreen({ navigation }) {
  const incomes = useStore(s => s.householdIncomes);
  const households = useStore(s => s.households);
  const selectedHouseholdId = useStore(s => s.selectedHouseholdId);
  const fetchHouseholdIncomes = useStore(s => s.fetchHouseholdIncomes);
  const fetchHouseholds = useStore(s => s.fetchHouseholds);
  const deleteHouseholdIncome = useStore(s => s.deleteHouseholdIncome);
  const importHouseholdIncomes = useStore(s => s.importHouseholdIncomes);
  const customCategories = useStore(s => s.customCategories);
  const loadCustomCategories = useStore(s => s.loadCustomCategories);
  const monthStartDay = useStore(s => s.monthStartDay);
  const loadMonthStartDay = useStore(s => s.loadMonthStartDay);
  const user = useStore(s => s.user);

  const { isTablet, hPad, maxContentWidth } = useResponsive();
  const safeBottom = useSafeBottomPadding(28);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [catFilter, setCatFilter] = useState('toate');
  const [householdFilter, setHouseholdFilter] = useState(selectedHouseholdId || 'all');
  const [ioBusy, setIoBusy] = useState(false);
  const [monthAnchor, setMonthAnchor] = useState(() => startOfBillingMonth(new Date(), monthStartDay));
  const [scope, setScope] = useState('month'); // 'month' | 'all'

  useEffect(() => { loadCustomCategories(); loadMonthStartDay(); }, []);

  useEffect(() => {
    if (selectedHouseholdId) setHouseholdFilter(selectedHouseholdId);
  }, [selectedHouseholdId]);

  const load = useCallback(async () => {
    await Promise.all([fetchHouseholds(), fetchHouseholdIncomes()]);
  }, [fetchHouseholds, fetchHouseholdIncomes]);

  useEffect(() => { (async () => { setLoading(true); await load(); setLoading(false); })(); }, []);
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  const filterCategories = useMemo(
    () => [
      { key: 'toate', label: 'Toate ' },
      ...getCategoriesFor('income', customCategories).map(c => ({
        key: c.key,
        label: `${c.icon} ${c.label} `,
      })),
    ],
    [customCategories],
  );

  const getCatMeta = (key) => getCategoryMeta(key, 'income', customCategories);

  const baseFiltered = useMemo(() => incomes.filter(i => {
    const byHh = householdFilter === 'all' || i.householdId === householdFilter;
    const byCat = catFilter === 'toate' || (i.category || 'altele') === catFilter;
    return byHh && byCat;
  }), [incomes, householdFilter, catFilter]);

  const filtered = useMemo(() => {
    if (scope !== 'month') return baseFiltered;
    return baseFiltered.filter(i => isInBillingMonth(i.date, monthAnchor, monthStartDay));
  }, [baseFiltered, scope, monthAnchor, monthStartDay]);

  const sections = useMemo(() => groupByMonth(filtered), [filtered]);

  const periodLabel = billingMonthLabel(monthAnchor, monthStartDay);
  const periodTotal = filtered.reduce((s, i) => s + Number(i.amount || 0), 0);

  const targetHouseholdName = () => {
    if (householdFilter === 'all') return 'venituri';
    return households.find(h => h.id === householdFilter)?.name || 'venituri';
  };

  const targetImportHouseholdId = () => {
    if (householdFilter !== 'all') return householdFilter;
    return selectedHouseholdId || households[0]?.id || null;
  };

  const promptExport = () => {
    if (filtered.length === 0) {
      Alert.alert('Export', 'Nu există venituri de exportat în filtrul curent.');
      return;
    }
    Alert.alert('Exportă venituri', `Filtru curent: ${filtered.length} venituri`, [
      { text: 'Anulează', style: 'cancel' },
      {
        text: 'JSON',
        onPress: async () => {
          setIoBusy(true);
          try {
            await exportTransactions(filtered, { format: 'json', kind: 'income', householdName: targetHouseholdName() });
          } catch (e) {
            Alert.alert('Eroare', 'Nu s-a putut exporta.');
          } finally { setIoBusy(false); }
        },
      },
      {
        text: 'CSV',
        onPress: async () => {
          setIoBusy(true);
          try {
            await exportTransactions(filtered, { format: 'csv', kind: 'income', householdName: targetHouseholdName() });
          } catch (e) {
            Alert.alert('Eroare', 'Nu s-a putut exporta.');
          } finally { setIoBusy(false); }
        },
      },
    ]);
  };

  const handleImport = async () => {
    const targetId = targetImportHouseholdId();
    if (!targetId) {
      Alert.alert('Import', 'Adaugă mai întâi o locuință.');
      return;
    }
    setIoBusy(true);
    try {
      const picked = await pickTransactionsFile();
      if (!picked) return;
      const targetName = households.find(h => h.id === targetId)?.name || '';
      Alert.alert(
        'Confirmă import',
        `Vrei să imporți ${picked.items.length} venituri în „${targetName}"?`,
        [
          { text: 'Anulează', style: 'cancel' },
          {
            text: 'Importă',
            onPress: async () => {
              try {
                const { imported, skipped } = await importHouseholdIncomes(picked.items, targetId);
                Alert.alert(
                  'Import finalizat',
                  `Adăugate: ${imported}${skipped ? ` · Ignorate: ${skipped}` : ''}`,
                );
              } catch (e) {
                Alert.alert('Eroare', e?.message || 'Nu s-a putut importa.');
              }
            },
          },
        ],
      );
    } catch (e) {
      Alert.alert('Eroare', e?.message || 'Fișier invalid.');
    } finally { setIoBusy(false); }
  };

  const handleDelete = (item) => {
    Alert.alert('Șterge venit', `Sigur ștergi "${item.title}"?`, [
      { text: 'Anulează', style: 'cancel' },
      {
        text: 'Șterge', style: 'destructive',
        onPress: async () => {
          try {
            await deleteHouseholdIncome(item.id);
          } catch (e) {
            Alert.alert(e?.offline ? 'Mod offline' : 'Eroare', e?.message || e?.response?.data?.error || 'Nu s-a putut șterge.');
          }
        },
      },
    ]);
  };

  const canEdit = (item) => {
    if (!item) return false;
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
        <View style={[styles.itemIcon, { backgroundColor: meta.bg }]}>
          <Text style={styles.itemIconText}>{meta.icon}</Text>
        </View>
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
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={handleImport}
            disabled={ioBusy}
            activeOpacity={0.8}
          >
            <Text style={styles.headerBtnText}>📥 Importă</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerBtn, styles.headerBtnPrimary]}
            onPress={promptExport}
            disabled={ioBusy}
            activeOpacity={0.8}
          >
            <Text style={[styles.headerBtnText, styles.headerBtnTextPrimary]}>📤 Exportă</Text>
          </TouchableOpacity>
        </View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionTotal}>
              +{formatCurrency(section.data.reduce((s, i) => s + Number(i.amount || 0), 0), 'RON')}
            </Text>
          </View>
        )}
        contentContainerStyle={[
          { paddingHorizontal: hPad, paddingBottom: safeBottom + 80, gap: SPACING.sm },
          isTablet && { alignSelf: 'center', width: '100%', maxWidth: maxContentWidth },
        ]}
        ListHeaderComponent={
          <View style={{ gap: SPACING.md, paddingTop: SPACING.lg, paddingBottom: SPACING.md }}>
            {/* Period total */}
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>
                {scope === 'month' ? periodLabel : 'Total filtrat'}
              </Text>
              <Text style={styles.totalValue}>+{formatCurrency(periodTotal, 'RON')}</Text>
              <Text style={styles.totalSub}>
                {filtered.length} {filtered.length === 1 ? 'venit' : 'venituri'}
              </Text>
            </View>

            {/* Month navigator */}
            <MonthPicker
              value={monthAnchor}
              onChange={(d) => { setMonthAnchor(d); setScope('month'); }}
            />

            {/* Scope toggle */}
            <View style={styles.scopeRow}>
              <TouchableOpacity
                onPress={() => setScope('month')}
                style={[styles.scopeChip, scope === 'month' && styles.scopeChipActive]}
              >
                <Text style={[styles.scopeChipText, scope === 'month' && styles.scopeChipTextActive]}>
                  📅 Luna selectată
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setScope('all')}
                style={[styles.scopeChip, scope === 'all' && styles.scopeChipActive]}
              >
                <Text style={[styles.scopeChipText, scope === 'all' && styles.scopeChipTextActive]}>
                  📚 Toate lunile
                </Text>
              </TouchableOpacity>
            </View>

            {/* Period chart */}
            {scope === 'month' && filtered.length > 0 && (
              <CategoryBreakdown
                items={filtered}
                currency="RON"
                title={`💰 Distribuție · ${periodLabel}`}
                getMeta={(k) => getCatMeta(k)}
              />
            )}

            {/* Household filter */}
            {households.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                <TouchableOpacity
                  onPress={() => setHouseholdFilter('all')}
                  style={[styles.chip, householdFilter === 'all' && styles.chipActive]}
                >
                  <Text style={[styles.chipText, householdFilter === 'all' && styles.chipTextActive]}>Toate</Text>
                </TouchableOpacity>
                {households.map(h => (
                  <TouchableOpacity
                    key={h.id}
                    onPress={() => setHouseholdFilter(h.id)}
                    style={[styles.chip, householdFilter === h.id && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, householdFilter === h.id && styles.chipTextActive]}>
                      🏠 {h.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* Category filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {filterCategories.map(c => (
                <TouchableOpacity
                  key={c.key}
                  onPress={() => setCatFilter(c.key)}
                  style={[styles.chip, catFilter === c.key && styles.chipActive]}
                >
                  <Text style={[styles.chipText, catFilter === c.key && styles.chipTextActive]}>
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="💰"
            title={scope === 'month' ? `Fără venituri în ${periodLabel}` : 'Niciun venit'}
            subtitle="Apasă + pentru a adăuga primul venit pentru locuință"
          />
        }
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
  header: {
    paddingTop: SPACING.sm, paddingBottom: SPACING.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm,
  },
  headerTitle: { fontSize: 22, fontWeight: FONTS.bold, color: T.ink, flex: 1 },
  headerActions: { flexDirection: 'row', gap: 6 },
  headerBtn: {
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: RADIUS.full,
    backgroundColor: T.card,
    borderWidth: 1, borderColor: T.line,
  },
  headerBtnPrimary: { backgroundColor: '#10B981', borderColor: '#10B981' },
  headerBtnText: { fontSize: 12, fontWeight: FONTS.bold, color: T.ink2 },
  headerBtnTextPrimary: { color: '#fff' },

  totalCard: { backgroundColor: '#10B981', borderRadius: RADIUS.xl, padding: SPACING.lg, ...SHADOW.md },
  totalLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: FONTS.semibold, letterSpacing: 1, textTransform: 'capitalize' },
  totalValue: { color: '#fff', fontSize: 28, fontWeight: FONTS.bold, marginTop: 4 },
  totalSub: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 4, fontWeight: FONTS.semibold },

  scopeRow: { flexDirection: 'row', gap: 8 },
  scopeChip: {
    flex: 1, alignItems: 'center',
    paddingVertical: 9,
    borderRadius: RADIUS.full,
    backgroundColor: T.card,
    borderWidth: 1.5, borderColor: T.line,
  },
  scopeChipActive: { backgroundColor: '#10B981', borderColor: '#10B981' },
  scopeChipText: { fontSize: 12, fontWeight: FONTS.bold, color: T.ink2 },
  scopeChipTextActive: { color: '#fff' },

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

  fab: {
    position: 'absolute',
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#10B981',
    alignItems: 'center', justifyContent: 'center',
    ...SHADOW.lg,
  },
  fabIcon: { color: '#fff', fontSize: 30, fontWeight: FONTS.light, lineHeight: 34, marginTop: -2 },
});
