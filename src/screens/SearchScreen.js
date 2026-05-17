import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SectionList,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  T, RADIUS, FONTS, SHADOW, SPACING,
  formatCurrency, formatDate, HIT_SLOP,
} from '../theme';
import useStore from '../store';
import { pickSuggestions } from '../utils/suggestionsStore';

const TYPE_LABELS = {
  vehicle:        { single: 'Vehicul',           plural: 'Vehicule' },
  document:       { single: 'Document',          plural: 'Documente' },
  invoice:        { single: 'Factură',           plural: 'Facturi' },
  fuel:           { single: 'Alimentare',        plural: 'Alimentări' },
  reminder:       { single: 'Reminder',          plural: 'Remindere' },
  household:      { single: 'Locuință',          plural: 'Locuințe' },
  hexpense:       { single: 'Cheltuială casă',   plural: 'Cheltuieli casă' },
  hincome:        { single: 'Venit casă',        plural: 'Venituri casă' },
  hevent:         { single: 'Eveniment casă',    plural: 'Evenimente casă' },
};

const TYPE_COLORS = {
  vehicle:  { bg: '#EEF2FF', text: '#4F6BFF' },
  document: { bg: '#F0FDF4', text: '#2F9E6F' },
  invoice:  { bg: '#FFF7ED', text: '#FF6B1A' },
  fuel:     { bg: '#FEF3C7', text: '#B45309' },
  reminder: { bg: '#FEF9C3', text: '#A16207' },
  household:{ bg: '#FCE7F3', text: '#9D174D' },
  hexpense: { bg: '#FFE4E6', text: '#BE123C' },
  hincome:  { bg: '#DCFCE7', text: '#15803D' },
  hevent:   { bg: '#E0F2FE', text: '#0369A1' },
};

const SUGGEST_FIELDS = [
  'invoiceTitle', 'expenseTitle', 'incomeTitle', 'eventTitle', 'reminderTitle',
  'merchant', 'source', 'location', 'station', 'note',
];

function matches(haystack, needle) {
  if (!needle) return true;
  if (!haystack) return false;
  return String(haystack).toLowerCase().includes(needle);
}

function TypeBadge({ type }) {
  const colors = TYPE_COLORS[type] || { bg: T.line2, text: T.ink3 };
  const label = TYPE_LABELS[type]?.single || type;
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.badgeText, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

function ResultItem({ item, onPress }) {
  return (
    <TouchableOpacity style={styles.resultItem} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.resultIcon}>{item.icon}</Text>
      <View style={styles.resultContent}>
        <Text style={styles.resultTitle} numberOfLines={1}>{item.title}</Text>
        {!!item.subtitle && (
          <Text style={styles.resultSubtitle} numberOfLines={1}>{item.subtitle}</Text>
        )}
      </View>
      <TypeBadge type={item.type} />
    </TouchableOpacity>
  );
}

export default function SearchScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  const vehicles            = useStore(s => s.vehicles) || [];
  const documents           = useStore(s => s.documents) || [];
  const invoices            = useStore(s => s.invoices) || [];
  const fuelLogs            = useStore(s => s.fuelLogs) || [];
  const reminders           = useStore(s => s.reminders) || [];
  const households          = useStore(s => s.households) || [];
  const householdExpenses   = useStore(s => s.householdExpenses) || [];
  const householdIncomes    = useStore(s => s.householdIncomes) || [];
  const householdEvents     = useStore(s => s.householdEvents) || [];
  const suggestions         = useStore(s => s.suggestions);
  const recentSearches      = useStore(s => s.recentSearches) || [];
  const pushRecent          = useStore(s => s.pushRecentSearch);
  const removeRecent        = useStore(s => s.removeRecentSearch);
  const clearRecents        = useStore(s => s.clearRecentSearches);
  const loadRecents         = useStore(s => s.loadSuggestionsAndRecents);

  useEffect(() => {
    loadRecents().catch(() => {});
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  const q = query.trim().toLowerCase();
  const hasQuery = q.length >= 2;

  const results = useMemo(() => {
    if (!hasQuery) return [];
    const out = [];

    vehicles.forEach(v => {
      const hay = `${v.brand || ''} ${v.model || ''} ${v.plate || ''} ${v.vin || ''} ${v.color || ''}`;
      if (matches(hay, q)) out.push({
        type: 'vehicle', id: v.id,
        icon: '🚗',
        title: `${v.brand || ''} ${v.model || ''}`.trim() || 'Vehicul',
        subtitle: [v.plate, v.year].filter(Boolean).join(' · '),
        screen: 'VehicleDetail', params: { vehicleId: v.id },
      });
    });

    documents.forEach(d => {
      if (matches(`${d.name || ''} ${d.type || ''}`, q)) out.push({
        type: 'document', id: d.id,
        icon: '📄',
        title: d.name || 'Document',
        subtitle: [d.type, d.expiryDate && `expiră ${formatDate(d.expiryDate)}`].filter(Boolean).join(' · '),
        screen: 'Main', params: { screen: 'Documents' },
      });
    });

    invoices.forEach(i => {
      const hay = `${i.title || ''} ${i.merchant || ''} ${i.location || ''} ${i.notes || ''} ${i.category || ''}`;
      if (matches(hay, q)) out.push({
        type: 'invoice', id: i.id,
        icon: '🧾',
        title: i.title || 'Factură',
        subtitle: [
          formatCurrency(i.amount || 0, i.currency || 'RON'),
          i.merchant || i.category,
          i.date && formatDate(i.date),
        ].filter(Boolean).join(' · '),
        screen: 'EditInvoice', params: { invoiceId: i.id },
      });
    });

    fuelLogs.forEach(f => {
      const hay = `${f.station || ''} ${f.location || ''} ${f.fuelType || ''} ${f.notes || ''}`;
      if (matches(hay, q)) out.push({
        type: 'fuel', id: f.id,
        icon: '⛽',
        title: f.station || `${f.fuelType || 'Combustibil'}`,
        subtitle: [
          `${Number(f.liters || 0).toFixed(2)} L`,
          formatCurrency(f.total || (f.liters || 0) * (f.pricePerL || 0), 'RON'),
          f.date && formatDate(f.date),
        ].filter(Boolean).join(' · '),
        screen: 'EditFuel', params: { fuelId: f.id },
      });
    });

    reminders.forEach(r => {
      if (matches(`${r.title || ''} ${r.notes || ''} ${r.type || ''}`, q)) out.push({
        type: 'reminder', id: r.id,
        icon: '🔔',
        title: r.title || 'Reminder',
        subtitle: [r.type, r.dueDate && formatDate(r.dueDate)].filter(Boolean).join(' · '),
        screen: 'Notifications', params: undefined,
      });
    });

    households.forEach(h => {
      const hay = `${h.name || ''} ${h.address || ''} ${h.type || ''}`;
      if (matches(hay, q)) out.push({
        type: 'household', id: h.id,
        icon: '🏠',
        title: h.name || 'Locuință',
        subtitle: [h.type, h.address].filter(Boolean).join(' · '),
        screen: 'EditHousehold', params: { householdId: h.id },
      });
    });

    householdExpenses.forEach(e => {
      const hay = `${e.title || ''} ${e.merchant || ''} ${e.location || ''} ${e.notes || ''} ${e.category || ''}`;
      if (matches(hay, q)) out.push({
        type: 'hexpense', id: e.id,
        icon: '💸',
        title: e.title || 'Cheltuială',
        subtitle: [
          formatCurrency(e.amount || 0, e.currency || 'RON'),
          e.merchant || e.category,
          e.date && formatDate(e.date),
        ].filter(Boolean).join(' · '),
        screen: 'AddHouseholdExpense', params: { expenseId: e.id },
      });
    });

    householdIncomes.forEach(i => {
      const hay = `${i.title || ''} ${i.source || ''} ${i.notes || ''} ${i.category || ''}`;
      if (matches(hay, q)) out.push({
        type: 'hincome', id: i.id,
        icon: '💰',
        title: i.title || 'Venit',
        subtitle: [
          `+${formatCurrency(i.amount || 0, i.currency || 'RON')}`,
          i.source || i.category,
          i.date && formatDate(i.date),
        ].filter(Boolean).join(' · '),
        screen: 'AddHouseholdIncome', params: { incomeId: i.id },
      });
    });

    householdEvents.forEach(ev => {
      const hay = `${ev.title || ''} ${ev.location || ''} ${ev.notes || ''} ${ev.type || ''}`;
      if (matches(hay, q)) out.push({
        type: 'hevent', id: ev.id,
        icon: '📅',
        title: ev.title || 'Eveniment',
        subtitle: [ev.type, ev.startDate && formatDate(ev.startDate), ev.location].filter(Boolean).join(' · '),
        screen: 'AddHouseholdEvent', params: { eventId: ev.id },
      });
    });

    return out;
  }, [hasQuery, q, vehicles, documents, invoices, fuelLogs, reminders, households, householdExpenses, householdIncomes, householdEvents]);

  const sections = useMemo(() => {
    const map = {};
    results.forEach(item => { (map[item.type] ||= []).push(item); });
    return Object.entries(map).map(([type, data]) => ({
      type,
      title: `${TYPE_LABELS[type]?.plural || type} · ${data.length}`,
      data,
    }));
  }, [results]);

  // Suggestions sourced from past form input (titles/merchants/locations/etc.)
  const inlineSuggestions = useMemo(() => {
    if (!query.trim()) return [];
    const out = [];
    const seen = new Set();
    for (const field of SUGGEST_FIELDS) {
      for (const val of pickSuggestions(suggestions, field, query, 5)) {
        const key = val.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(val);
        if (out.length >= 6) return out;
      }
    }
    return out;
  }, [suggestions, query]);

  const handleItemPress = useCallback((item) => {
    pushRecent(query).catch(() => {});
    if (!item.screen) return;
    if (item.params?.screen) {
      navigation.navigate(item.screen, item.params);
    } else if (item.params) {
      navigation.navigate(item.screen, item.params);
    } else {
      navigation.navigate(item.screen);
    }
  }, [navigation, pushRecent, query]);

  const onSubmitEditing = useCallback(() => {
    if (q.length >= 2) pushRecent(query).catch(() => {});
  }, [pushRecent, query, q]);

  const handleClearRecents = useCallback(() => {
    Alert.alert('Șterge istoricul', 'Goleşti lista de căutări recente?', [
      { text: 'Anulează', style: 'cancel' },
      { text: 'Goleşte', style: 'destructive', onPress: () => clearRecents().catch(() => {}) },
    ]);
  }, [clearRecents]);

  const renderSectionHeader = ({ section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{section.title}</Text>
    </View>
  );

  const renderItem = ({ item }) => (
    <ResultItem item={item} onPress={() => handleItemPress(item)} />
  );

  const renderEmpty = () => {
    if (!query) {
      return (
        <View style={styles.emptyContainer}>
          <View style={styles.recentHead}>
            <Text style={styles.recentTitle}>Căutări recente</Text>
            {recentSearches.length > 0 && (
              <TouchableOpacity onPress={handleClearRecents} hitSlop={HIT_SLOP}>
                <Text style={styles.clearLink}>Goleşte</Text>
              </TouchableOpacity>
            )}
          </View>

          {recentSearches.length === 0 ? (
            <View style={styles.recentEmpty}>
              <Text style={styles.recentEmptyIcon}>🔎</Text>
              <Text style={styles.recentEmptyText}>
                Aici vor apărea căutările pe care le faci.
              </Text>
            </View>
          ) : (
            recentSearches.map((s, i) => (
              <TouchableOpacity
                key={`${s}-${i}`}
                style={styles.recentItem}
                onPress={() => setQuery(s)}
                onLongPress={() => removeRecent(s).catch(() => {})}
              >
                <Text style={styles.recentIcon}>🕐</Text>
                <Text style={styles.recentText} numberOfLines={1}>{s}</Text>
                <TouchableOpacity
                  onPress={() => removeRecent(s).catch(() => {})}
                  hitSlop={HIT_SLOP}
                  style={styles.recentRemove}
                >
                  <Text style={styles.recentRemoveText}>✕</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}
        </View>
      );
    }
    if (q.length < 2) {
      return (
        <View style={styles.stateContainer}>
          <Text style={styles.stateText}>Introdu cel puțin 2 caractere</Text>
        </View>
      );
    }
    return (
      <View style={styles.stateContainer}>
        <Text style={styles.stateIcon}>🔍</Text>
        <Text style={styles.stateTitle}>Niciun rezultat</Text>
        <Text style={styles.stateSubtitle}>pentru „{query}"</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.inputWrapper}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={onSubmitEditing}
            placeholder="Caută vehicule, facturi, casă..."
            placeholderTextColor={T.ink4}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {!!query && (
            <TouchableOpacity onPress={() => setQuery('')} style={styles.clearBtn} hitSlop={HIT_SLOP}>
              <Text style={styles.clearBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>Anulează</Text>
        </TouchableOpacity>
      </View>

      {/* Inline suggestions from past form input */}
      {inlineSuggestions.length > 0 && (
        <View style={styles.suggestStrip}>
          {inlineSuggestions.map((s, i) => (
            <TouchableOpacity
              key={`${s}-${i}`}
              style={styles.suggestChip}
              onPress={() => { setQuery(s); }}
            >
              <Text style={styles.suggestChipText} numberOfLines={1}>🕐 {s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {sections.length > 0 ? (
        <SectionList
          sections={sections}
          keyExtractor={item => `${item.type}-${item.id}`}
          renderSectionHeader={renderSectionHeader}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          keyboardShouldPersistTaps="handled"
        />
      ) : (
        <FlatList
          data={[]}
          renderItem={null}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: T.card,
    borderBottomWidth: 1, borderBottomColor: T.line,
    gap: 10,
  },
  inputWrapper: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: T.bg, borderRadius: RADIUS.xl,
    borderWidth: 1, borderColor: T.line,
    paddingHorizontal: 12, height: 44,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  input: { flex: 1, fontSize: 14, color: T.ink, padding: 0 },
  clearBtn: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: T.ink4,
    alignItems: 'center', justifyContent: 'center', marginLeft: 6,
  },
  clearBtnText: { fontSize: 11, color: '#fff', fontWeight: FONTS.bold },
  cancelBtn: { paddingVertical: 6, paddingHorizontal: 4 },
  cancelText: { fontSize: 15, fontWeight: FONTS.semibold, color: T.brand },

  suggestStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: T.bgSoft,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
  },
  suggestChip: {
    backgroundColor: T.card,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: T.line,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: '100%',
  },
  suggestChipText: { fontSize: 12, fontWeight: FONTS.semibold, color: T.ink2 },

  listContent: { paddingBottom: 32, flexGrow: 1 },
  sectionHeader: {
    backgroundColor: T.bg,
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6,
  },
  sectionHeaderText: {
    fontSize: 12, fontWeight: FONTS.bold, color: T.ink3,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  resultItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: T.card,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  resultIcon: { fontSize: 22, marginRight: 12, width: 32, textAlign: 'center' },
  resultContent: { flex: 1, marginRight: 10 },
  resultTitle: { fontSize: 15, fontWeight: FONTS.semibold, color: T.ink, marginBottom: 2 },
  resultSubtitle: { fontSize: 12, color: T.ink3 },
  badge: { borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: FONTS.bold },
  separator: { height: 1, backgroundColor: T.line, marginLeft: 60 },

  emptyContainer: { padding: 16 },
  recentHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: SPACING.sm, marginHorizontal: 4,
  },
  recentTitle: {
    fontSize: 12, fontWeight: FONTS.bold, color: T.ink3,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  clearLink: { fontSize: 12, fontWeight: FONTS.bold, color: T.brand },
  recentItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: T.card, borderRadius: RADIUS.md,
    paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 8,
    ...SHADOW.sm,
  },
  recentIcon: { fontSize: 16, marginRight: 10 },
  recentText: { flex: 1, fontSize: 14, color: T.ink2 },
  recentRemove: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: T.line2,
    alignItems: 'center', justifyContent: 'center',
  },
  recentRemoveText: { fontSize: 12, color: T.ink3, fontWeight: FONTS.bold },
  recentEmpty: { alignItems: 'center', paddingVertical: SPACING.xxl },
  recentEmptyIcon: { fontSize: 36, marginBottom: SPACING.sm },
  recentEmptyText: { fontSize: 13, color: T.ink3, textAlign: 'center' },

  stateContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 32 },
  stateIcon: { fontSize: 48, marginBottom: 16 },
  stateTitle: { fontSize: 18, fontWeight: FONTS.bold, color: T.ink, marginBottom: 4 },
  stateSubtitle: { fontSize: 14, color: T.ink4, textAlign: 'center' },
  stateText: { fontSize: 14, color: T.ink4, textAlign: 'center' },
});
