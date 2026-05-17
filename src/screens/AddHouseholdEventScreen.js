import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, KeyboardAvoidingView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useStore from '../store';
import { T, RADIUS, FONTS, SHADOW, SPACING, useResponsive, HIT_SLOP, HIT_SLOP_LG, TOUCH_TARGET, IS_IOS } from '../theme';
import DateField from '../components/DateField';
import TimeField from '../components/TimeField';
import LocationField from '../components/LocationField';
import { promptAddToDeviceCalendar } from '../utils/deviceCalendar';
import { scheduleDeadlineNotifications } from '../utils/deadlineNotifications';
import SuggestInput from '../components/SuggestInput';

const TYPES = [
  { key: 'curierat',    label: '📦 Curierat ',    color: '#F59E0B' },
  { key: 'vizita',      label: '👋 Vizită ',      color: '#8B5CF6' },
  { key: 'petrecere',   label: '🎉 Petrecere ',   color: '#EC4899' },
  { key: 'intretinere', label: '🔧 Întreținere ', color: '#10B981' },
  { key: 'utilitati',   label: '💡 Utilități ',   color: '#3B82F6' },
  { key: 'medical',     label: '🏥 Medical ',     color: '#EF4444' },
  { key: 'scoala',      label: '🎓 Școală ',      color: '#06B6D4' },
  { key: 'altele',      label: '📌 Altele ',      color: T.brand },
];

function todayStr() { return new Date().toISOString().split('T')[0]; }

export default function AddHouseholdEventScreen({ navigation, route }) {
  const households = useStore(s => s.households);
  const householdEvents = useStore(s => s.householdEvents);
  const addHouseholdEvent = useStore(s => s.addHouseholdEvent);
  const updateHouseholdEvent = useStore(s => s.updateHouseholdEvent);
  const recordSuggestions = useStore(s => s.recordSuggestions);
  const selectedHouseholdId = useStore(s => s.selectedHouseholdId);
  const { isTablet, hPad, maxContentWidth } = useResponsive();

  const eventId = route?.params?.eventId;
  const isEdit = !!eventId;
  const existing = isEdit ? householdEvents.find(e => e.id === eventId) : null;

  const initialHouseholdId = existing?.householdId || route?.params?.householdId || selectedHouseholdId || households[0]?.id || null;

  const [householdId, setHouseholdId] = useState(initialHouseholdId);
  const [title, setTitle] = useState(existing?.title || '');
  const [type, setType] = useState(existing?.type || 'curierat');
  const [startDate, setStartDate] = useState(existing?.startDate || todayStr());
  const [startTime, setStartTime] = useState(existing?.startTime || '');
  const [endDate, setEndDate] = useState(existing?.endDate || '');
  const [endTime, setEndTime] = useState(existing?.endTime || '');
  const [location, setLocation] = useState(existing?.location || '');
  const [notes, setNotes] = useState(existing?.notes || '');
  const [reminderMinutes, setReminderMinutes] = useState(existing?.reminderMinutes != null ? String(existing.reminderMinutes) : '');
  const [loading, setLoading] = useState(false);

  const selectedType = TYPES.find(t => t.key === type) || TYPES[0];

  const handleSave = async () => {
    if (!householdId) return Alert.alert('Locuință', 'Alege o locuință.');
    if (!title.trim()) return Alert.alert('Titlu', 'Adaugă un titlu.');
    if (!startDate) return Alert.alert('Dată', 'Alege data.');
    setLoading(true);
    try {
      const payload = {
        householdId, title: title.trim(), type, startDate,
        startTime: startTime || null,
        endDate: endDate || null,
        endTime: endTime || null,
        location: location.trim() || null,
        notes: notes.trim() || null,
        reminderMinutes: reminderMinutes ? parseInt(reminderMinutes) : null,
      };
      const saved = isEdit
        ? await updateHouseholdEvent(eventId, payload)
        : await addHouseholdEvent(payload);

      recordSuggestions({
        eventTitle: title.trim(),
        location: location.trim(),
        note: notes.trim(),
      }).catch(() => {});

      const evId = saved?.id || saved?.clientId || eventId || `${Date.now()}`;
      scheduleDeadlineNotifications({
        key: `householdEvent:${evId}`,
        title: `📅 ${title.trim()}`,
        body: location.trim() || title.trim(),
        date: startDate,
        time: startTime || '09:00',
        data: { relatedType: 'HouseholdEvent', relatedId: evId },
      }).catch(() => {});

      await promptAddToDeviceCalendar({
        title: title.trim(),
        notes: notes.trim() || undefined,
        location: location.trim() || undefined,
        startDate,
        endDate: endDate || startDate,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        allDay: !startTime,
        alarmsMinutesBefore: reminderMinutes
          ? [parseInt(reminderMinutes), 60 * 24 * 3, 60 * 24 * 7]
          : [60 * 24 * 7, 60 * 24 * 3, 60 * 24],
      }, { message: 'Adăugăm evenimentul și în calendarul telefonului?' });

      navigation.goBack();
    } catch (e) {
      Alert.alert('Eroare', e?.response?.data?.error || 'Nu s-a putut salva.');
    } finally { setLoading(false); }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={[styles.header, { backgroundColor: selectedType.color }]} edges={['top']}>
        <View style={[styles.headerContent, { paddingHorizontal: hPad }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={HIT_SLOP_LG} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Anulează</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEdit ? 'Editează eveniment' : 'Eveniment nou'}</Text>
          <TouchableOpacity onPress={handleSave} disabled={loading || !title} style={[styles.saveHead, (loading || !title) && { opacity: 0.5 }]} hitSlop={HIT_SLOP}>
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
            <Text style={styles.label}>Tip eveniment</Text>
            <View style={styles.typeGrid}>
              {TYPES.map(t => (
                <TouchableOpacity
                  key={t.key}
                  onPress={() => setType(t.key)}
                  style={[
                    styles.typeTile,
                    { backgroundColor: type === t.key ? t.color : T.bgSoft, borderColor: type === t.key ? t.color : T.line },
                  ]}
                >
                  <Text style={[styles.typeText, { color: type === t.key ? '#fff' : T.ink2 }]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Titlu *</Text>
            <SuggestInput field="eventTitle" style={styles.input} value={title} onChangeText={setTitle} placeholder='Ex: "Curier eMag", "Vizită părinți"' placeholderTextColor={T.ink4} />
          </View>

          <View style={styles.card}>
            <DateField label="Data începere *" value={startDate} onChange={setStartDate} required />
            <TimeField label="Ora începere (opțional)" value={startTime} onChange={setStartTime} />
            <DateField label="Data sfârșit (opțional)" value={endDate} onChange={setEndDate} />
            <TimeField label="Ora sfârșit (opțional)" value={endTime} onChange={setEndTime} />
          </View>

          <View style={styles.card}>
            <LocationField value={location} onChange={setLocation} placeholder="Adresă sau detalii loc" />
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Reminder înainte de eveniment</Text>
            <View style={styles.reminderRow}>
              {[
                { v: '', l: 'Fără' },
                { v: '15', l: '15 min' },
                { v: '60', l: '1 oră' },
                { v: '1440', l: '1 zi' },
                { v: '10080', l: '1 săpt' },
              ].map(opt => (
                <TouchableOpacity
                  key={opt.v}
                  onPress={() => setReminderMinutes(opt.v)}
                  style={[styles.remBtn, reminderMinutes === opt.v && styles.remBtnActive]}
                >
                  <Text style={[styles.remText, reminderMinutes === opt.v && styles.remTextActive]}>{opt.l}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Notițe</Text>
            <TextInput style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]} value={notes} onChangeText={setNotes} placeholder="Detalii suplimentare" placeholderTextColor={T.ink4} multiline />
          </View>

          <TouchableOpacity
            style={[styles.bigSave, { backgroundColor: selectedType.color }, (loading || !title) && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={loading || !title}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.bigSaveText}>💾 {isEdit ? 'Salvează modificările' : 'Salvează evenimentul'}</Text>}
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
  headerContent: { flexDirection: 'row', alignItems: 'center', paddingTop: SPACING.sm, paddingBottom: SPACING.md, minHeight: TOUCH_TARGET },
  backBtn: { flex: 1 },
  backBtnText: { color: '#fff', fontSize: 14, fontWeight: FONTS.medium },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: FONTS.bold },
  saveHead: { flex: 1, alignItems: 'flex-end' },
  saveHeadText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 14 },
  card: { backgroundColor: T.card, borderRadius: RADIUS.lg, padding: SPACING.lg, ...SHADOW.sm },
  label: { fontSize: 12, fontWeight: FONTS.bold, color: T.ink2, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: SPACING.sm, marginTop: SPACING.sm },
  input: { borderWidth: 1.5, borderColor: T.line, backgroundColor: T.bgSoft, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 12, fontSize: 15, color: T.ink, minHeight: 46, marginBottom: SPACING.sm },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.full, backgroundColor: T.bgSoft, borderWidth: 1.5, borderColor: T.line },
  chipActive: { backgroundColor: T.brand, borderColor: T.brand },
  chipText: { fontSize: 13, fontWeight: FONTS.semibold, color: T.ink2 },
  chipTextActive: { color: '#fff' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  typeTile: { paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1.5, borderRadius: RADIUS.md },
  typeText: { fontSize: 12, fontWeight: FONTS.semibold },
  reminderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  remBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full, backgroundColor: T.bgSoft, borderWidth: 1.5, borderColor: T.line },
  remBtnActive: { backgroundColor: T.brand, borderColor: T.brand },
  remText: { fontSize: 12, fontWeight: FONTS.semibold, color: T.ink2 },
  remTextActive: { color: '#fff' },
  bigSave: { height: 54, borderRadius: RADIUS.lg, alignItems: 'center', justifyContent: 'center', ...SHADOW.md },
  bigSaveText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 16 },
});
