import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useStore from '../store';
import { T, FONTS, RADIUS, SHADOW } from '../theme';
import { PrimaryButton } from '../components/ui';

const REMINDER_TYPES = ['ITP', 'RCA', 'CASCO', 'Rovinietă', 'Service', 'Altele'];
const REPEAT_OPTIONS = ['Niciodată', 'Lunar', 'Anual'];

function getTwoWeekDays() {
  const days = [];
  const now = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    days.push(d);
  }
  return days;
}

function toYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const DAY_ABBR = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

function validateDate(str) {
  if (!str) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(str) && !isNaN(new Date(str).getTime());
}

export default function AddReminderScreen({ navigation }) {
  const { addReminder, vehicles } = useStore();

  const [title, setTitle] = useState('');
  const [type, setType] = useState('ITP');
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [dueDate, setDueDate] = useState('');
  const [repeat, setRepeat] = useState('Niciodată');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const twoWeekDays = getTwoWeekDays();

  const handleDayPick = (date) => {
    setDueDate(toYMD(date));
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Eroare', 'Titlul este obligatoriu.');
      return;
    }
    if (!dueDate) {
      Alert.alert('Eroare', 'Data scadenței este obligatorie.');
      return;
    }
    if (!validateDate(dueDate)) {
      Alert.alert('Eroare', 'Data trebuie să fie în formatul YYYY-MM-DD și să fie validă.');
      return;
    }
    setSaving(true);
    try {
      await addReminder({
        title: title.trim(),
        dueDate,
        type,
        vehicleId: selectedVehicleId || undefined,
        repeat,
        notes: notes.trim() || undefined,
      });
      navigation.goBack();
    } catch {
      Alert.alert('Eroare', 'Nu s-a putut salva reminderul. Încearcă din nou.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn} activeOpacity={0.7}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reminder Nou</Text>
        <View style={styles.closeBtn} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>Titlu *</Text>
          <TextInput
            style={styles.titleInput}
            placeholder="Ex: Reînnoire RCA"
            placeholderTextColor={T.ink4}
            value={title}
            onChangeText={setTitle}
            autoFocus
          />

          <Text style={styles.label}>Tip</Text>
          <View style={styles.typeGrid}>
            {REMINDER_TYPES.map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.typeBtn, type === t && styles.typeBtnActive]}
                onPress={() => setType(t)}
                activeOpacity={0.8}
              >
                <Text style={[styles.typeBtnText, type === t && styles.typeBtnTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Vehicul (opțional)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.vehicleScroll}>
            <TouchableOpacity
              style={[styles.vehicleBtn, selectedVehicleId === null && styles.vehicleBtnActive]}
              onPress={() => setSelectedVehicleId(null)}
              activeOpacity={0.8}
            >
              <Text style={[styles.vehicleBtnText, selectedVehicleId === null && styles.vehicleBtnTextActive]}>
                Fără vehicul
              </Text>
            </TouchableOpacity>
            {vehicles.map(v => (
              <TouchableOpacity
                key={v.id}
                style={[styles.vehicleBtn, selectedVehicleId === v.id && styles.vehicleBtnActive]}
                onPress={() => setSelectedVehicleId(v.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.vehicleBtnText, selectedVehicleId === v.id && styles.vehicleBtnTextActive]}>
                  {v.plate}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Data scadenței *</Text>

          <View style={styles.miniCalendar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.miniCalContent}>
              {twoWeekDays.map((d, idx) => {
                const ymd = toYMD(d);
                const selected = dueDate === ymd;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.miniDay, selected && styles.miniDaySelected]}
                    onPress={() => handleDayPick(d)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.miniDayName, selected && styles.miniDayTextSelected]}>
                      {DAY_ABBR[d.getDay()]}
                    </Text>
                    <Text style={[styles.miniDayNum, selected && styles.miniDayTextSelected]}>
                      {d.getDate()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={T.ink4}
            value={dueDate}
            onChangeText={setDueDate}
            keyboardType="numbers-and-punctuation"
          />

          <Text style={styles.label}>Repetare</Text>
          <View style={styles.repeatRow}>
            {REPEAT_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt}
                style={[styles.repeatBtn, repeat === opt && styles.repeatBtnActive]}
                onPress={() => setRepeat(opt)}
                activeOpacity={0.8}
              >
                <Text style={[styles.repeatBtnText, repeat === opt && styles.repeatBtnTextActive]}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Notă (opțional)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Detalii suplimentare..."
            placeholderTextColor={T.ink4}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          <View style={styles.submitWrap}>
            <PrimaryButton title="Salvează Reminder" onPress={handleSubmit} loading={saving} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
    backgroundColor: T.card,
  },
  headerTitle: { fontSize: 18, fontWeight: FONTS.bold, color: T.ink },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 18, color: T.ink3 },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: FONTS.semibold, color: T.ink3, marginBottom: 8, marginTop: 20 },
  titleInput: {
    backgroundColor: T.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: T.line,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    fontWeight: FONTS.bold,
    color: T.ink,
    ...SHADOW.sm,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    ...SHADOW.sm,
  },
  typeBtnActive: { backgroundColor: T.brand, borderColor: T.brand },
  typeBtnText: { fontSize: 14, fontWeight: FONTS.medium, color: T.ink2 },
  typeBtnTextActive: { color: '#fff' },
  vehicleScroll: { marginBottom: 4 },
  vehicleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    marginRight: 8,
    ...SHADOW.sm,
  },
  vehicleBtnActive: { backgroundColor: T.brand, borderColor: T.brand },
  vehicleBtnText: { fontSize: 13, fontWeight: FONTS.medium, color: T.ink2 },
  vehicleBtnTextActive: { color: '#fff' },
  miniCalendar: {
    backgroundColor: T.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: T.line,
    marginBottom: 10,
    paddingVertical: 10,
    ...SHADOW.sm,
  },
  miniCalContent: { paddingHorizontal: 10, gap: 6 },
  miniDay: {
    width: 44,
    height: 56,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.line2,
    marginRight: 6,
  },
  miniDaySelected: { backgroundColor: T.brand },
  miniDayName: { fontSize: 11, fontWeight: FONTS.semibold, color: T.ink3, marginBottom: 4 },
  miniDayNum: { fontSize: 16, fontWeight: FONTS.bold, color: T.ink },
  miniDayTextSelected: { color: '#fff' },
  input: {
    backgroundColor: T.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: T.line,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: T.ink,
    ...SHADOW.sm,
  },
  repeatRow: { flexDirection: 'row', gap: 10 },
  repeatBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    alignItems: 'center',
    ...SHADOW.sm,
  },
  repeatBtnActive: { backgroundColor: T.brand, borderColor: T.brand },
  repeatBtnText: { fontSize: 13, fontWeight: FONTS.medium, color: T.ink2 },
  repeatBtnTextActive: { color: '#fff' },
  notesInput: {
    backgroundColor: T.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: T.line,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: T.ink,
    minHeight: 88,
    ...SHADOW.sm,
  },
  submitWrap: { marginTop: 28 },
});
