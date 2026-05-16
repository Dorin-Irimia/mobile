import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, KeyboardAvoidingView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useStore from '../store';
import { T, RADIUS, FONTS, SHADOW, SPACING, useResponsive, HIT_SLOP, HIT_SLOP_LG, TOUCH_TARGET, IS_IOS } from '../theme';
import DateField from '../components/DateField';
import CustomFieldsEditor from '../components/CustomFieldsEditor';

const CATEGORIES = [
  { key: 'salariu',    label: '💼 Salariu ' },
  { key: 'chirie',     label: '🏠 Chirie încasată ' },
  { key: 'freelance',  label: '💻 Freelance ' },
  { key: 'dividende',  label: '📈 Dividende ' },
  { key: 'bonusuri',   label: '🎁 Bonusuri ' },
  { key: 'cadou',      label: '🎀 Cadou ' },
  { key: 'altele',     label: '💵 Altele ' },
];

const RECURRING = [
  { key: 'none', label: '⏸ O dată', icon: '⏸' },
  { key: 'monthly', label: '📅 Lunar', icon: '📅' },
  { key: 'yearly', label: '🗓 Anual', icon: '🗓' },
];

const CURRENCIES = ['RON', 'EUR', 'USD'];

function todayStr() { return new Date().toISOString().split('T')[0]; }

export default function AddHouseholdIncomeScreen({ navigation, route }) {
  const households = useStore(s => s.households);
  const householdIncomes = useStore(s => s.householdIncomes);
  const addHouseholdIncome = useStore(s => s.addHouseholdIncome);
  const updateHouseholdIncome = useStore(s => s.updateHouseholdIncome);
  const selectedHouseholdId = useStore(s => s.selectedHouseholdId);
  const { isTablet, hPad, maxContentWidth } = useResponsive();

  const incomeId = route?.params?.incomeId;
  const isEdit = !!incomeId;
  const existing = isEdit ? householdIncomes.find(i => i.id === incomeId) : null;

  const initialHouseholdId = existing?.householdId || route?.params?.householdId || selectedHouseholdId || households[0]?.id || null;

  const [householdId, setHouseholdId] = useState(initialHouseholdId);
  const [title, setTitle] = useState(existing?.title || '');
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '');
  const [currency, setCurrency] = useState(existing?.currency || 'RON');
  const [category, setCategory] = useState(existing?.category || 'salariu');
  const [date, setDate] = useState(existing?.date || todayStr());
  const [source, setSource] = useState(existing?.source || '');
  const [recurring, setRecurring] = useState(existing?.recurring || 'none');
  const [notes, setNotes] = useState(existing?.notes || '');
  const [customFields, setCustomFields] = useState(existing?.customFields || {});
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!householdId) return Alert.alert('Locuință', 'Alege o locuință.');
    if (!title.trim()) return Alert.alert('Titlu', 'Adaugă un titlu.');
    if (!amount || isNaN(parseFloat(amount))) return Alert.alert('Sumă', 'Introdu sumă validă.');
    setLoading(true);
    try {
      const payload = {
        householdId, title: title.trim(),
        amount: parseFloat(amount), currency, category, date,
        source: source.trim() || null,
        recurring,
        notes: notes.trim() || null,
        customFields: Object.keys(customFields).length > 0 ? customFields : null,
      };
      if (isEdit) await updateHouseholdIncome(incomeId, payload);
      else await addHouseholdIncome(payload);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Eroare', e?.response?.data?.error || 'Nu s-a putut salva.');
    } finally { setLoading(false); }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.header} edges={['top']}>
        <View style={[styles.headerContent, { paddingHorizontal: hPad }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={HIT_SLOP_LG} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Anulează</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEdit ? 'Editează venit' : 'Venit nou'}</Text>
          <TouchableOpacity onPress={handleSave} disabled={loading || !title || !amount} style={[styles.saveHead, (loading || !title || !amount) && { opacity: 0.5 }]} hitSlop={HIT_SLOP}>
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
          <View style={styles.card}>
            <Text style={styles.label}>Locuință *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
              {households.map(h => (
                <TouchableOpacity key={h.id} onPress={() => setHouseholdId(h.id)} style={[styles.chip, householdId === h.id && styles.chipActive]}>
                  <Text style={[styles.chipText, householdId === h.id && styles.chipTextActive]}>🏠 {h.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Categorie</Text>
            <View style={styles.catGrid}>
              {CATEGORIES.map(c => (
                <TouchableOpacity key={c.key} onPress={() => setCategory(c.key)} style={[styles.catTile, category === c.key && styles.catTileActive]}>
                  <Text style={[styles.catText, category === c.key && styles.catTextActive]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Titlu *</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder='Ex: "Salariu martie"' placeholderTextColor={T.ink4} />
            <View style={styles.row2}>
              <View style={{ flex: 1.5 }}>
                <Text style={styles.label}>Sumă *</Text>
                <TextInput style={styles.input} value={amount} onChangeText={setAmount} placeholder="0.00" placeholderTextColor={T.ink4} keyboardType="decimal-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Monedă</Text>
                <View style={styles.miniRow}>
                  {CURRENCIES.map(c => (
                    <TouchableOpacity key={c} onPress={() => setCurrency(c)} style={[styles.mini, currency === c && styles.miniActive]}>
                      <Text style={[styles.miniText, currency === c && styles.miniTextActive]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Sursă (opțional)</Text>
            <TextInput style={styles.input} value={source} onChangeText={setSource} placeholder='Ex: "Firma X SRL", "Chiriaș Apt2"' placeholderTextColor={T.ink4} />
          </View>

          <View style={styles.card}>
            <DateField label="Data *" value={date} onChange={setDate} required />
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Repetare</Text>
            <View style={styles.recurringRow}>
              {RECURRING.map(r => (
                <TouchableOpacity key={r.key} onPress={() => setRecurring(r.key)} style={[styles.recurringBtn, recurring === r.key && styles.recurringBtnActive]}>
                  <Text style={styles.recurringIcon}>{r.icon}</Text>
                  <Text style={[styles.recurringText, recurring === r.key && styles.recurringTextActive]}>{r.label.replace(/^[^ ]+ /, '')}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Notițe</Text>
            <TextInput style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]} value={notes} onChangeText={setNotes} placeholder="Detalii" placeholderTextColor={T.ink4} multiline />
          </View>

          <View style={styles.card}>
            <CustomFieldsEditor value={customFields} onChange={setCustomFields} />
          </View>

          <TouchableOpacity
            style={[styles.bigSave, (loading || !title || !amount) && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={loading || !title || !amount}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.bigSaveText}>💾 {isEdit ? 'Salvează modificările' : 'Salvează venitul'}</Text>}
          </TouchableOpacity>
          <View style={{ height: 24 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  header: { backgroundColor: '#10B981' },
  headerContent: { flexDirection: 'row', alignItems: 'center', paddingTop: SPACING.sm, paddingBottom: SPACING.md, minHeight: TOUCH_TARGET },
  backBtn: { flex: 1 },
  backBtnText: { color: '#fff', fontSize: 14, fontWeight: FONTS.medium },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: FONTS.bold },
  saveHead: { flex: 1, alignItems: 'flex-end' },
  saveHeadText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 14 },
  card: { backgroundColor: T.card, borderRadius: RADIUS.lg, padding: SPACING.lg, ...SHADOW.sm },
  label: { fontSize: 12, fontWeight: FONTS.bold, color: T.ink2, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: SPACING.sm, marginTop: SPACING.sm },
  input: { borderWidth: 1.5, borderColor: T.line, backgroundColor: T.bgSoft, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 12, fontSize: 15, color: T.ink, minHeight: 46, marginBottom: SPACING.sm },
  row2: { flexDirection: 'row', gap: SPACING.md },
  miniRow: { flexDirection: 'row', gap: 4 },
  mini: { flex: 1, paddingVertical: 12, backgroundColor: T.bgSoft, borderWidth: 1.5, borderColor: T.line, borderRadius: RADIUS.md, alignItems: 'center' },
  miniActive: { backgroundColor: '#10B981', borderColor: '#10B981' },
  miniText: { fontSize: 12, fontWeight: FONTS.semibold, color: T.ink2 },
  miniTextActive: { color: '#fff' },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.full, backgroundColor: T.bgSoft, borderWidth: 1.5, borderColor: T.line },
  chipActive: { backgroundColor: '#10B981', borderColor: '#10B981' },
  chipText: { fontSize: 13, fontWeight: FONTS.semibold, color: T.ink2 },
  chipTextActive: { color: '#fff' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  catTile: { paddingHorizontal: 14, paddingVertical: 10, backgroundColor: T.bgSoft, borderWidth: 1.5, borderColor: T.line, borderRadius: RADIUS.md },
  catTileActive: { backgroundColor: '#10B981', borderColor: '#10B981' },
  catText: { fontSize: 13, fontWeight: FONTS.semibold, color: T.ink2 },
  catTextActive: { color: '#fff' },
  recurringRow: { flexDirection: 'row', gap: SPACING.sm },
  recurringBtn: { flex: 1, paddingVertical: SPACING.md, borderRadius: RADIUS.md, backgroundColor: T.bgSoft, borderWidth: 1.5, borderColor: T.line, alignItems: 'center', gap: 2 },
  recurringBtnActive: { backgroundColor: '#10B981', borderColor: '#10B981' },
  recurringIcon: { fontSize: 20 },
  recurringText: { fontSize: 12, fontWeight: FONTS.semibold, color: T.ink2 },
  recurringTextActive: { color: '#fff' },
  bigSave: { height: 54, borderRadius: RADIUS.lg, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center', ...SHADOW.md },
  bigSaveText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 16 },
});
