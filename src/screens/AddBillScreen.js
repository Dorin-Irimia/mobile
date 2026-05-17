import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useStore from '../store';
import { T, RADIUS, SHADOW, FONTS, display, formatCurrency } from '../theme';
import DateField from '../components/DateField';

const PROVIDER_PRESETS = [
  { name: 'Enel',         label: 'Curent electric',     icon: '⚡', color: '#F59E0B' },
  { name: 'E.ON',         label: 'Gaze naturale',        icon: '🔥', color: '#EF4444' },
  { name: 'Digi',         label: 'Internet + TV',        icon: '📶', color: '#3B82F6' },
  { name: 'RCS-RDS',      label: 'Internet',             icon: '📶', color: '#3B82F6' },
  { name: 'Orange',       label: 'Telefon',              icon: '📱', color: '#F97316' },
  { name: 'Vodafone',     label: 'Telefon',              icon: '📱', color: '#DC2626' },
  { name: 'RADET',        label: 'Apă + canal',          icon: '💧', color: '#06B6D4' },
  { name: 'Asoc. prop.',  label: 'Întreținere bloc',     icon: '🏢', color: '#6B7280' },
  { name: 'Salubritate',  label: 'Gunoi menajer',        icon: '🗑️', color: '#84CC16' },
  { name: 'Netflix',      label: 'Abonament streaming',  icon: '🎬', color: '#DC2626' },
  { name: 'Spotify',      label: 'Abonament muzică',     icon: '🎵', color: '#10B981' },
  { name: 'Asigurare',    label: 'Asig. locuință',       icon: '🛡️', color: '#8B5CF6' },
];

const ICON_PALETTE = ['📄', '⚡', '🔥', '💧', '📶', '📱', '🎬', '🎵', '🏢', '🗑️', '🛡️', '🏦', '📺', '☎️'];
const COLOR_PALETTE = ['#F59E0B', '#EF4444', '#3B82F6', '#06B6D4', '#10B981', '#8B5CF6', '#DC2626', '#F97316', '#84CC16', '#6B7280', '#0EA5E9', '#A855F7'];

const RECURRING_OPTIONS = [
  { k: 'lunar', l: 'Lunar', icon: '🔁' },
  { k: 'anual', l: 'Anual', icon: '🗓' },
  { k: 'none',  l: 'O singură dată', icon: '·' },
];

export default function AddBillScreen({ navigation, route }) {
  const householdId = route?.params?.householdId;
  const billId = route?.params?.billId || null;

  const households = useStore(s => s.households);
  const bills = useStore(s => s.householdBills);
  const addHouseholdBill = useStore(s => s.addHouseholdBill);
  const updateHouseholdBill = useStore(s => s.updateHouseholdBill);
  const deleteHouseholdBill = useStore(s => s.deleteHouseholdBill);

  const household = households.find(h => h.id === householdId) || households[0];
  const existing = billId ? bills.find(b => b.id === billId) : null;

  const [provider, setProvider] = useState(existing?.provider || '');
  const [name, setName]         = useState(existing?.name || '');
  const [icon, setIcon]         = useState(existing?.icon || '📄');
  const [color, setColor]       = useState(existing?.color || '#6B7280');
  const [amount, setAmount]     = useState(existing?.amount != null ? String(existing.amount) : '');
  const [dueDate, setDueDate]   = useState(existing?.dueDate || new Date().toISOString().slice(0, 10));
  const [recurring, setRecurring] = useState(existing?.recurring || 'lunar');
  const [notes, setNotes]       = useState(existing?.notes || '');
  const [saving, setSaving]     = useState(false);

  const applyPreset = (p) => {
    setProvider(p.name);
    if (!name) setName(p.label);
    setIcon(p.icon);
    setColor(p.color);
  };

  const valid = provider.trim() && name.trim() && amount.trim() && dueDate;

  const handleSubmit = async () => {
    if (!valid) {
      Alert.alert('Câmpuri lipsă', 'Completează furnizor, nume, sumă și scadență.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        provider: provider.trim(),
        name: name.trim(),
        icon, color,
        amount: parseFloat(amount),
        dueDate,
        recurring,
        notes: notes.trim() || null,
      };
      if (existing) {
        await updateHouseholdBill(existing.id, payload);
      } else {
        await addHouseholdBill({ ...payload, householdId: household.id });
      }
      navigation.goBack();
    } catch (e) {
      Alert.alert('Eroare', e?.response?.data?.error || 'Nu pot salva.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!existing) return;
    Alert.alert(
      'Șterge factura?',
      `"${existing.name}" — această acțiune nu se poate anula.`,
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Șterge', style: 'destructive',
          onPress: async () => {
            try { await deleteHouseholdBill(existing.id); navigation.goBack(); }
            catch (e) { Alert.alert('Eroare', e?.response?.data?.error || 'Nu pot șterge.'); }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, display(700)]}>
          {existing ? 'Editează factura' : 'Factură nouă'}
        </Text>
        <TouchableOpacity onPress={handleSubmit} style={styles.headerBtn} disabled={saving || !valid}>
          {saving
            ? <ActivityIndicator color={T.brand} size="small" />
            : <Text style={[styles.saveBtn, !valid && { color: T.ink4 }]}>Salvează</Text>}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Preview card */}
          <View style={styles.preview}>
            <View style={[styles.stripe, { backgroundColor: color }]} />
            <View style={[styles.previewIcon, { backgroundColor: color + '1A' }]}>
              <Text style={{ fontSize: 22 }}>{icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.previewName} numberOfLines={1}>{name || 'Nume factură'}</Text>
              <Text style={styles.previewProvider}>
                {provider || 'Furnizor'} · {recurring === 'none' ? 'o dată' : recurring}
              </Text>
            </View>
            <Text style={[styles.previewAmount, display(700)]}>
              {amount ? formatCurrency(parseFloat(amount) || 0) : '—'}
            </Text>
          </View>

          {!existing && (
            <View>
              <Text style={styles.label}>Șabloane rapide</Text>
              <View style={styles.presetGrid}>
                {PROVIDER_PRESETS.map(p => {
                  const active = provider === p.name;
                  return (
                    <TouchableOpacity
                      key={p.name}
                      onPress={() => applyPreset(p)}
                      style={[
                        styles.preset,
                        active && { borderColor: p.color, backgroundColor: p.color + '14' },
                      ]}
                    >
                      <Text style={{ fontSize: 16 }}>{p.icon}</Text>
                      <View style={{ flexShrink: 1 }}>
                        <Text style={[styles.presetName, active && { color: p.color }]} numberOfLines={1}>{p.name}</Text>
                        <Text style={styles.presetLabel} numberOfLines={1}>{p.label}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Furnizor</Text>
              <TextInput
                value={provider}
                onChangeText={setProvider}
                placeholder="ex. Enel"
                placeholderTextColor={T.ink4}
                style={styles.input}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Sumă (RON)</Text>
              <TextInput
                value={amount}
                onChangeText={t => setAmount(t.replace(/[^0-9.,]/g, '').replace(',', '.'))}
                placeholder="ex. 320"
                placeholderTextColor={T.ink4}
                keyboardType="decimal-pad"
                style={styles.input}
              />
            </View>
          </View>

          <View>
            <Text style={styles.label}>Nume factură</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="ex. Curent electric"
              placeholderTextColor={T.ink4}
              style={styles.input}
            />
          </View>

          <DateField
            label="Scadență"
            value={dueDate}
            onChange={setDueDate}
            allowClear={false}
            showRelative
          />

          <View>
            <Text style={styles.label}>Frecvență</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {RECURRING_OPTIONS.map(r => {
                const active = recurring === r.k;
                return (
                  <TouchableOpacity
                    key={r.k}
                    onPress={() => setRecurring(r.k)}
                    style={[styles.freqChip, active && { borderColor: T.brand, backgroundColor: T.brandTint }]}
                  >
                    <Text style={{ fontSize: 14 }}>{r.icon}</Text>
                    <Text style={[styles.freqText, active && { color: T.brand, fontWeight: FONTS.bold }]}>
                      {r.l}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View>
            <Text style={styles.label}>Iconiță</Text>
            <View style={styles.paletteRow}>
              {ICON_PALETTE.map(em => {
                const active = em === icon;
                return (
                  <TouchableOpacity
                    key={em}
                    onPress={() => setIcon(em)}
                    style={[styles.iconCell, active && { borderColor: color, backgroundColor: color + '14' }]}
                  >
                    <Text style={{ fontSize: 20 }}>{em}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View>
            <Text style={styles.label}>Culoare</Text>
            <View style={styles.paletteRow}>
              {COLOR_PALETTE.map(c => {
                const active = c === color;
                return (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setColor(c)}
                    style={[styles.colorCell, { backgroundColor: c }, active && styles.colorCellActive]}
                  />
                );
              })}
            </View>
          </View>

          <View>
            <Text style={styles.label}>Notițe</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="ex. nr. contract, date utile…"
              placeholderTextColor={T.ink4}
              multiline
              style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
            />
          </View>

          {existing && (
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
              <Text style={styles.deleteBtnText}>Șterge factura</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
  headerBtn: { minWidth: 60, height: 40, justifyContent: 'center', alignItems: 'center' },
  backArrow: { color: T.brand, fontSize: 30, lineHeight: 32 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, color: T.ink, fontWeight: FONTS.bold },
  saveBtn: { color: T.brand, fontSize: 15, fontWeight: FONTS.bold },

  content: { padding: 16, gap: 16, paddingBottom: 80 },

  preview: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: T.card, borderRadius: RADIUS.lg, padding: 14,
    overflow: 'hidden', ...SHADOW.sm,
  },
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  previewIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  previewName: { fontSize: 14, fontWeight: FONTS.bold, color: T.ink },
  previewProvider: { fontSize: 11, color: T.ink3, marginTop: 2, textTransform: 'capitalize' },
  previewAmount: { fontSize: 16, color: T.ink, fontWeight: FONTS.bold },

  label: { fontSize: 13, color: T.ink2, fontWeight: FONTS.semibold, marginBottom: 8 },
  input: {
    backgroundColor: T.card, borderWidth: 1, borderColor: T.line,
    borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 12,
    fontSize: 15, color: T.ink,
  },

  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 10, paddingVertical: 7,
    backgroundColor: T.card, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: T.line,
    maxWidth: 170,
  },
  presetName: { fontSize: 12, fontWeight: FONTS.bold, color: T.ink },
  presetLabel: { fontSize: 10, color: T.ink3 },

  freqChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: RADIUS.md,
    backgroundColor: T.card, borderWidth: 1.5, borderColor: T.line,
  },
  freqText: { fontSize: 13, color: T.ink2, fontWeight: FONTS.semibold },

  paletteRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconCell: {
    width: 44, height: 44, borderRadius: RADIUS.md,
    backgroundColor: T.card, borderWidth: 1.5, borderColor: T.line,
    alignItems: 'center', justifyContent: 'center',
  },
  colorCell: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'transparent' },
  colorCellActive: { borderColor: T.ink },

  deleteBtn: {
    marginTop: 8, paddingVertical: 14,
    borderRadius: RADIUS.lg, alignItems: 'center',
    borderWidth: 1, borderColor: T.danger,
  },
  deleteBtnText: { color: T.danger, fontSize: 14, fontWeight: FONTS.bold },
});
