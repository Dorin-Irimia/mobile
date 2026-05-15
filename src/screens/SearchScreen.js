import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SectionList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { T, RADIUS, FONTS, SHADOW } from '../theme';
import useStore from '../store';

const RECENT_SEARCHES = ['Dacia Logan', 'RCA', 'ITP 2025', 'Factura service'];

function formatCurrency(amount, currency) {
  if (amount === undefined || amount === null) return '';
  return `${Number(amount).toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

const TYPE_LABELS = {
  vehicle: 'Vehicul',
  document: 'Document',
  invoice: 'Factură',
  reminder: 'Reminder',
};

const TYPE_COLORS = {
  vehicle: { bg: '#EEF2FF', text: '#4F6BFF' },
  document: { bg: '#F0FDF4', text: '#2F9E6F' },
  invoice: { bg: '#FFF7ED', text: '#FF6B1A' },
  reminder: { bg: '#FEF9C3', text: '#A16207' },
};

function TypeBadge({ type }) {
  const colors = TYPE_COLORS[type] || { bg: T.line2, text: T.ink3 };
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.badgeText, { color: colors.text }]}>{TYPE_LABELS[type] || type}</Text>
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
  const { vehicles = [], documents = [], invoices = [], reminders = [] } = useStore();

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  const q = query.toLowerCase().trim();

  const results =
    q.length < 2
      ? []
      : [
          ...vehicles
            .filter(v =>
              `${v.brand} ${v.model} ${v.plate}`.toLowerCase().includes(q),
            )
            .map(v => ({
              type: 'vehicle',
              id: v.id,
              icon: '🚗',
              title: `${v.brand} ${v.model}`,
              subtitle: v.plate,
              screen: 'VehicleDetail',
              params: { vehicleId: v.id },
            })),
          ...documents
            .filter(d => d.name.toLowerCase().includes(q))
            .map(d => ({
              type: 'document',
              id: d.id,
              icon: '📄',
              title: d.name,
              subtitle: d.type,
              screen: null,
              params: null,
            })),
          ...invoices
            .filter(i => (i.title || '').toLowerCase().includes(q))
            .map(i => ({
              type: 'invoice',
              id: i.id,
              icon: '🧾',
              title: i.title,
              subtitle: formatCurrency(i.amount, i.currency || 'RON'),
              screen: null,
              params: null,
            })),
          ...reminders
            .filter(r => (r.title || '').toLowerCase().includes(q))
            .map(r => ({
              type: 'reminder',
              id: r.id,
              icon: '🔔',
              title: r.title,
              subtitle: r.dueDate,
              screen: null,
              params: null,
            })),
        ];

  const grouped = {};
  results.forEach(item => {
    if (!grouped[item.type]) grouped[item.type] = [];
    grouped[item.type].push(item);
  });

  const sections = Object.entries(grouped).map(([type, data]) => ({
    type,
    title: `${TYPE_LABELS[type] || type}e (${data.length})`,
    data,
  }));

  const handleItemPress = item => {
    if (item.screen) {
      navigation.navigate(item.screen, item.params);
    }
  };

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
          <Text style={styles.recentTitle}>Căutări recente</Text>
          {RECENT_SEARCHES.map((s, i) => (
            <TouchableOpacity
              key={i}
              style={styles.recentItem}
              onPress={() => setQuery(s)}>
              <Text style={styles.recentIcon}>🕐</Text>
              <Text style={styles.recentText}>{s}</Text>
            </TouchableOpacity>
          ))}
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
        <Text style={styles.stateSubtitle}>pentru "{query}"</Text>
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
            placeholder="Caută vehicule, documente, facturi..."
            placeholderTextColor={T.ink4}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {!!query && (
            <TouchableOpacity onPress={() => setQuery('')} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>Anulează</Text>
        </TouchableOpacity>
      </View>

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
        />
      ) : (
        <FlatList
          data={[]}
          renderItem={null}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: T.card,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
    gap: 10,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.bg,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: T.line,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: T.ink,
    padding: 0,
  },
  clearBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: T.ink4,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  clearBtnText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontFamily: FONTS.medium,
  },
  cancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  cancelText: {
    fontSize: 15,
    fontFamily: FONTS.medium,
    color: T.brand,
  },
  listContent: {
    paddingBottom: 32,
    flexGrow: 1,
  },
  sectionHeader: {
    backgroundColor: T.bg,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontFamily: FONTS.semibold,
    color: T.ink3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  resultIcon: {
    fontSize: 22,
    marginRight: 12,
    width: 32,
    textAlign: 'center',
  },
  resultContent: {
    flex: 1,
    marginRight: 10,
  },
  resultTitle: {
    fontSize: 15,
    fontFamily: FONTS.medium,
    color: T.ink,
    marginBottom: 2,
  },
  resultSubtitle: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: T.ink4,
  },
  badge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: FONTS.medium,
  },
  separator: {
    height: 1,
    backgroundColor: T.line,
    marginLeft: 60,
  },
  emptyContainer: {
    padding: 16,
  },
  recentTitle: {
    fontSize: 13,
    fontFamily: FONTS.semibold,
    color: T.ink3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginLeft: 4,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.card,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    ...SHADOW.sm,
  },
  recentIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  recentText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: T.ink2,
  },
  stateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  stateIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  stateTitle: {
    fontSize: 18,
    fontFamily: FONTS.semibold,
    color: T.ink,
    marginBottom: 4,
  },
  stateSubtitle: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: T.ink4,
    textAlign: 'center',
  },
  stateText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: T.ink4,
    textAlign: 'center',
  },
});
