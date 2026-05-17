import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useStore from '../store';
import {
  T, RADIUS, FONTS, SHADOW, SPACING,
  useResponsive, HIT_SLOP, HIT_SLOP_LG, TOUCH_TARGET, IS_IOS,
} from '../theme';
import AttachmentsField from '../components/AttachmentsField';
import CustomFieldsEditor from '../components/CustomFieldsEditor';
import LocationField from '../components/LocationField';
import DateField from '../components/DateField';
import TimeField from '../components/TimeField';
import SuggestInput from '../components/SuggestInput';
import { getCategoriesFor } from '../utils/categories';

const SPLIT_OPTIONS = [
  { key: 'single', label: 'Doar eu', icon: '👤', desc: 'Plată făcută doar de tine' },
  { key: 'equal', label: 'Egal', icon: '⚖️', desc: 'Împărțit egal între membri' },
];

const CURRENCIES = ['RON', 'EUR', 'USD'];

function todayStr() { return new Date().toISOString().split('T')[0]; }
function nowTimeStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function AddHouseholdExpenseScreen({ navigation, route }) {
  const households = useStore(s => s.households);
  const householdExpenses = useStore(s => s.householdExpenses);
  const addHouseholdExpense = useStore(s => s.addHouseholdExpense);
  const recordSuggestions = useStore(s => s.recordSuggestions);
  const updateHouseholdExpense = useStore(s => s.updateHouseholdExpense);
  const selectedHouseholdId = useStore(s => s.selectedHouseholdId);
  const customCategories = useStore(s => s.customCategories);
  const loadCustomCategories = useStore(s => s.loadCustomCategories);
  const { isTablet, hPad, maxContentWidth } = useResponsive();

  useEffect(() => { loadCustomCategories(); }, []);
  const CATEGORIES = useMemo(
    () => getCategoriesFor('expense', customCategories).map(c => ({
      ...c,
      label: `${c.icon} ${c.label} `,
    })),
    [customCategories],
  );

  const expenseId = route?.params?.expenseId;
  const isEdit = !!expenseId;
  const existing = isEdit ? householdExpenses.find(e => e.id === expenseId) : null;

  const initialHouseholdId =
    existing?.householdId ||
    route?.params?.householdId ||
    selectedHouseholdId ||
    households[0]?.id || null;

  const [householdId, setHouseholdId] = useState(initialHouseholdId);
  const [title, setTitle] = useState(existing?.title || '');
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '');
  const [currency, setCurrency] = useState(existing?.currency || 'RON');
  const [category, setCategory] = useState(existing?.category || 'utilitati');
  const [date, setDate] = useState(existing?.date || todayStr());
  const [time, setTime] = useState(existing?.time || nowTimeStr());
  const [merchant, setMerchant] = useState(existing?.merchant || '');
  const [location, setLocation] = useState(existing?.location || '');
  const [notes, setNotes] = useState(existing?.notes || '');
  const [customFields, setCustomFields] = useState(existing?.customFields || {});
  const [splitMode, setSplitMode] = useState(existing?.splitMode || 'single');
  const [attachments, setAttachments] = useState([]);
  const [existingAttachments, setExistingAttachments] = useState(existing?.attachments || []);
  const [loading, setLoading] = useState(false);

  const selectedCat = CATEGORIES.find(c => c.key === category) || CATEGORIES[0];
  const selectedHousehold = households.find(h => h.id === householdId);

  const handleSave = async () => {
    if (!householdId) return Alert.alert('Locuință', 'Alege o locuință.');
    if (!title.trim()) return Alert.alert('Titlu', 'Adaugă un titlu.');
    if (!amount || isNaN(parseFloat(amount))) return Alert.alert('Sumă', 'Introdu sumă validă.');
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('householdId', householdId);
      fd.append('title', title.trim());
      fd.append('amount', String(parseFloat(amount)));
      fd.append('currency', currency);
      fd.append('category', category);
      fd.append('date', date);
      if (time) fd.append('time', time);
      if (merchant.trim()) fd.append('merchant', merchant.trim());
      if (location.trim()) fd.append('location', location.trim());
      if (notes.trim()) fd.append('notes', notes.trim());
      if (Object.keys(customFields).length > 0) fd.append('customFields', JSON.stringify(customFields));
      fd.append('splitMode', splitMode);
      attachments.forEach((a, i) => {
        fd.append('attachments', { uri: a.uri, name: a.name || `file-${i}`, type: a.mimeType || 'application/octet-stream' });
      });

      if (isEdit) {
        await updateHouseholdExpense(expenseId, fd);
      } else {
        await addHouseholdExpense(fd);
      }
      recordSuggestions({
        expenseTitle: title.trim(),
        merchant: merchant.trim(),
        location: location.trim(),
        note: notes.trim(),
      }).catch(() => {});
      navigation.goBack();
    } catch (e) {
      Alert.alert('Eroare', e?.response?.data?.error || 'Nu s-a putut salva.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={[styles.header, { backgroundColor: selectedCat.color }]} edges={['top']}>
        <View style={[styles.headerContent, { paddingHorizontal: hPad }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={HIT_SLOP_LG} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Anulează</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEdit ? 'Editează cheltuiala' : 'Cheltuială nouă'}</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={loading || !title || !amount}
            style={[styles.saveHead, (loading || !title || !amount) && { opacity: 0.5 }]}
            hitSlop={HIT_SLOP}
          >
            {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveHeadText}>Salvează</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={IS_IOS ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[
            { padding: hPad, gap: SPACING.lg, paddingBottom: 60 },
            isTablet && { alignSelf: 'center', width: '100%', maxWidth: maxContentWidth },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Household selector */}
          <View style={styles.card}>
            <Text style={styles.label}>Locuință *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
              {households.map(h => (
                <TouchableOpacity
                  key={h.id}
                  onPress={() => setHouseholdId(h.id)}
                  style={[styles.chip, householdId === h.id && styles.chipActive]}
                >
                  <Text style={[styles.chipText, householdId === h.id && styles.chipTextActive]}>
                    🏠 {h.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Categorie */}
          <View style={styles.card}>
            <Text style={styles.label}>Categorie</Text>
            <View style={styles.catGrid}>
              {CATEGORIES.map(c => {
                const active = category === c.key;
                return (
                  <TouchableOpacity
                    key={c.key}
                    onPress={() => setCategory(c.key)}
                    style={[
                      styles.catTile,
                      { backgroundColor: active ? c.color : T.bgSoft, borderColor: active ? c.color : T.line },
                    ]}
                  >
                    <Text style={[styles.catText, { color: active ? '#fff' : T.ink2 }]}>{c.label}</Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                onPress={() => navigation.navigate('CustomCategories')}
                style={[styles.catTile, { backgroundColor: T.card, borderColor: T.line, borderStyle: 'dashed' }]}
              >
                <Text style={[styles.catText, { color: T.brand }]}>+ Categorie nouă</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Title + amount */}
          <View style={styles.card}>
            <Text style={styles.label}>Titlu *</Text>
            <SuggestInput
              field="expenseTitle"
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder='Ex: "Factură curent"'
              placeholderTextColor={T.ink4}
            />
            <View style={styles.row2}>
              <View style={{ flex: 1.5 }}>
                <Text style={styles.label}>Sumă *</Text>
                <TextInput
                  style={styles.input}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.00"
                  placeholderTextColor={T.ink4}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Monedă</Text>
                <View style={styles.miniRow}>
                  {CURRENCIES.map(c => (
                    <TouchableOpacity
                      key={c}
                      onPress={() => setCurrency(c)}
                      style={[styles.mini, currency === c && styles.miniActive]}
                    >
                      <Text style={[styles.miniText, currency === c && styles.miniTextActive]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </View>

          {/* Split */}
          {selectedHousehold?.memberCount > 0 && (
            <View style={styles.card}>
              <Text style={styles.label}>Cum se împarte cheltuiala?</Text>
              <View style={{ gap: SPACING.sm, marginTop: 4 }}>
                {SPLIT_OPTIONS.map(opt => {
                  const active = splitMode === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      onPress={() => setSplitMode(opt.key)}
                      style={[styles.splitRow, active && styles.splitRowActive]}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.splitIcon}>{opt.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.splitLabel, active && { color: T.brand }]}>{opt.label}</Text>
                        <Text style={styles.splitDesc}>{opt.desc}</Text>
                      </View>
                      <View style={[styles.radio, active && styles.radioActive]}>
                        {active && <View style={styles.radioInner} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Date + time */}
          <View style={styles.card}>
            <DateField label="Data *" value={date} onChange={setDate} maxDate={new Date()} required />
            <TimeField label="Ora (opțional)" value={time} onChange={setTime} />
          </View>

          {/* Merchant + location */}
          <View style={styles.card}>
            <Text style={styles.label}>Magazin / furnizor (opțional)</Text>
            <SuggestInput
              field="merchant"
              style={styles.input}
              value={merchant}
              onChangeText={setMerchant}
              placeholder='Ex: "ENEL", "Lidl", "Bricostore"'
              placeholderTextColor={T.ink4}
            />
            <LocationField value={location} onChange={setLocation} placeholder="Adresa unde a fost cheltuiala" />
          </View>

          {/* Atașamente */}
          <View style={styles.card}>
            <AttachmentsField
              existing={existingAttachments}
              selected={attachments}
              onSelectedChange={setAttachments}
              maxFiles={10}
            />
          </View>

          {/* Notes */}
          <View style={styles.card}>
            <Text style={styles.label}>Notițe</Text>
            <TextInput
              style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Detalii suplimentare"
              placeholderTextColor={T.ink4}
              multiline
            />
          </View>

          {/* Custom */}
          <View style={styles.card}>
            <CustomFieldsEditor value={customFields} onChange={setCustomFields} />
          </View>

          <TouchableOpacity
            style={[
              styles.bigSave,
              { backgroundColor: selectedCat.color },
              (loading || !title || !amount) && { opacity: 0.6 },
            ]}
            onPress={handleSave}
            disabled={loading || !title || !amount}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color="#fff" /> : (
              <Text style={styles.bigSaveText}>💾 {isEdit ? 'Salvează modificările' : 'Salvează cheltuiala'}</Text>
            )}
          </TouchableOpacity>

          <View style={{ height: 24 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  header: {},
  headerContent: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: SPACING.sm, paddingBottom: SPACING.md,
    minHeight: TOUCH_TARGET,
  },
  backBtn: { flex: 1 },
  backBtnText: { color: '#fff', fontSize: 14, fontWeight: FONTS.medium },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: FONTS.bold },
  saveHead: { flex: 1, alignItems: 'flex-end' },
  saveHeadText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 14 },

  card: {
    backgroundColor: T.card, borderRadius: RADIUS.lg,
    padding: SPACING.lg, ...SHADOW.sm,
  },
  label: { fontSize: 12, fontWeight: FONTS.bold, color: T.ink2, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: SPACING.sm, marginTop: SPACING.sm },
  input: {
    borderWidth: 1.5, borderColor: T.line, backgroundColor: T.bgSoft,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 12,
    fontSize: 15, color: T.ink, minHeight: 46, marginBottom: SPACING.sm,
  },
  row2: { flexDirection: 'row', gap: SPACING.md },
  miniRow: { flexDirection: 'row', gap: 4 },
  mini: {
    flex: 1, paddingVertical: 12,
    backgroundColor: T.bgSoft,
    borderWidth: 1.5, borderColor: T.line,
    borderRadius: RADIUS.md, alignItems: 'center',
  },
  miniActive: { backgroundColor: T.brand, borderColor: T.brand },
  miniText: { fontSize: 12, fontWeight: FONTS.semibold, color: T.ink2 },
  miniTextActive: { color: '#fff' },

  chip: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: RADIUS.full,
    backgroundColor: T.bgSoft,
    borderWidth: 1.5, borderColor: T.line,
  },
  chipActive: { backgroundColor: T.brand, borderColor: T.brand },
  chipText: { fontSize: 13, fontWeight: FONTS.semibold, color: T.ink2 },
  chipTextActive: { color: '#fff' },

  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  catTile: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1.5, borderRadius: RADIUS.md,
  },
  catText: { fontSize: 13, fontWeight: FONTS.semibold },

  splitRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    padding: SPACING.md, borderRadius: RADIUS.md,
    backgroundColor: T.bgSoft, borderWidth: 1.5, borderColor: T.line,
  },
  splitRowActive: { borderColor: T.brand, backgroundColor: T.brandTint },
  splitIcon: { fontSize: 26 },
  splitLabel: { fontSize: 14, fontWeight: FONTS.bold, color: T.ink },
  splitDesc: { fontSize: 11, color: T.ink3, marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: T.line, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: T.brand },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: T.brand },

  bigSave: {
    height: 54, borderRadius: RADIUS.lg,
    alignItems: 'center', justifyContent: 'center',
    ...SHADOW.md,
  },
  bigSaveText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 16 },
});
