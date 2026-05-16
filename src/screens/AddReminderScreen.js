import React, { useState, useMemo } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useStore from '../store';
import {
  T,
  FONTS,
  RADIUS,
  SHADOW,
  SPACING,
  useResponsive,
  HIT_SLOP,
  HIT_SLOP_LG,
  TOUCH_TARGET,
  formatDate,
  daysUntil,
  IS_IOS,
} from '../theme';
import DateField from '../components/DateField';

// Categorii cu culori și iconițe (sync cu CalendarScreen)
const REMINDER_TYPES = [
  { key: 'itp',       label: 'ITP',       icon: '🔧', color: '#3B82F6', bg: '#EFF6FF' },
  { key: 'rca',       label: 'RCA',       icon: '🛡️', color: '#10B981', bg: '#ECFDF5' },
  { key: 'casco',     label: 'CASCO',     icon: '🔰', color: '#8B5CF6', bg: '#F5F3FF' },
  { key: 'rovinieta', label: 'Rovinietă', icon: '🛣️', color: '#F59E0B', bg: '#FFFBEB' },
  { key: 'service',   label: 'Service',   icon: '🔧', color: '#EF4444', bg: '#FEF2F2' },
  { key: 'altele',    label: 'Altele',    icon: '📌', color: T.brand,   bg: T.brandTint },
];

const REPEAT_OPTIONS = [
  { key: 'none',    label: 'Niciodată', icon: '⏸' },
  { key: 'monthly', label: 'Lunar',     icon: '📅' },
  { key: 'yearly',  label: 'Anual',     icon: '🗓' },
];

const DAY_ABBR = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

function toYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

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

function validateDate(str) {
  if (!str) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(str) && !isNaN(new Date(str).getTime());
}

export default function AddReminderScreen({ navigation, route }) {
  const { addReminder, vehicles } = useStore();
  const selectedVehicleIdGlobal = useStore(s => s.selectedVehicleId);
  const { isTablet, hPad, maxContentWidth } = useResponsive();

  const presetVehicleId = route?.params?.vehicleId;
  const initialVehicleId = presetVehicleId || selectedVehicleIdGlobal || null;

  const [title, setTitle] = useState('');
  const [typeKey, setTypeKey] = useState('itp');
  const [selectedVehicleId, setSelectedVehicleId] = useState(initialVehicleId);
  const [dueDate, setDueDate] = useState('');
  const [repeat, setRepeat] = useState('none');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const twoWeekDays = useMemo(() => getTwoWeekDays(), []);
  const selectedType = REMINDER_TYPES.find(t => t.key === typeKey) || REMINDER_TYPES[0];
  const daysLeft = dueDate ? daysUntil(dueDate) : null;

  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);

  const handleDayPick = (date) => setDueDate(toYMD(date));

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Eroare', 'Adaugă un titlu pentru reminder.');
      return;
    }
    if (!dueDate) {
      Alert.alert('Eroare', 'Alege data scadenței.');
      return;
    }
    if (!validateDate(dueDate)) {
      Alert.alert('Eroare', 'Data nu este validă.');
      return;
    }
    setSaving(true);
    try {
      await addReminder({
        title: title.trim(),
        dueDate,
        type: typeKey,
        vehicleId: selectedVehicleId || undefined,
        repeat,
        notes: notes.trim() || undefined,
      });
      navigation.goBack();
    } catch {
      Alert.alert('Eroare', 'Nu s-a putut salva reminderul.');
    } finally {
      setSaving(false);
    }
  };

  // Status culoare zile rămase
  let daysColor = T.ink3;
  let daysLabel = '';
  if (daysLeft !== null) {
    if (daysLeft === 0) { daysLabel = 'Astăzi'; daysColor = T.brand; }
    else if (daysLeft === 1) { daysLabel = 'Mâine'; daysColor = T.warn; }
    else if (daysLeft < 0) { daysLabel = `acum ${Math.abs(daysLeft)} zile`; daysColor = T.danger; }
    else if (daysLeft <= 7) { daysLabel = `în ${daysLeft} zile`; daysColor = T.danger; }
    else if (daysLeft <= 30) { daysLabel = `în ${daysLeft} zile`; daysColor = T.warn; }
    else { daysLabel = `în ${daysLeft} zile`; daysColor = T.success; }
  }

  return (
    <View style={styles.root}>
      {/* Hero header */}
      <SafeAreaView style={styles.hero} edges={['top']}>
        <View style={[styles.heroContent, { paddingHorizontal: hPad }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={HIT_SLOP_LG}
            style={styles.heroBack}
          >
            <Text style={styles.heroBackText}>✕</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroSubtitle}>REMINDER NOU</Text>
            <Text style={styles.heroTitle}>
              {selectedType.icon} {selectedType.label}
            </Text>
            {dueDate ? (
              <Text style={styles.heroDate}>
                {formatDate(dueDate)}
                {daysLabel ? ` · ${daysLabel}` : ''}
              </Text>
            ) : (
              <Text style={styles.heroDateMuted}>Alege o dată mai jos</Text>
            )}
          </View>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={IS_IOS ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            { paddingHorizontal: hPad, paddingVertical: SPACING.xl, gap: SPACING.lg },
            isTablet && { alignSelf: 'center', width: '100%', maxWidth: maxContentWidth },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Titlu */}
          <View style={styles.card}>
            <Text style={styles.label}>Titlu *</Text>
            <TextInput
              style={styles.titleInput}
              placeholder='Ex: "Reînnoire RCA Dacia"'
              placeholderTextColor={T.ink4}
              value={title}
              onChangeText={setTitle}
              autoFocus
            />
          </View>

          {/* Categorie */}
          <View style={styles.card}>
            <Text style={styles.label}>Categorie</Text>
            <View style={styles.catGrid}>
              {REMINDER_TYPES.map(t => {
                const active = typeKey === t.key;
                return (
                  <TouchableOpacity
                    key={t.key}
                    onPress={() => setTypeKey(t.key)}
                    activeOpacity={0.85}
                    style={[
                      styles.catTile,
                      { backgroundColor: active ? t.color : t.bg },
                      active && { borderColor: t.color, ...SHADOW.sm },
                    ]}
                  >
                    <Text style={[styles.catIcon, { opacity: active ? 1 : 0.85 }]}>
                      {t.icon}
                    </Text>
                    <Text style={[
                      styles.catLabel,
                      { color: active ? '#fff' : t.color },
                    ]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Vehicul */}
          <View style={styles.card}>
            <Text style={styles.label}>Vehicul (opțional)</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
            >
              <TouchableOpacity
                onPress={() => setSelectedVehicleId(null)}
                activeOpacity={0.85}
                style={[styles.vehChip, !selectedVehicleId && styles.vehChipActive]}
              >
                <Text style={[styles.vehChipText, !selectedVehicleId && styles.vehChipTextActive]}>
                  👤 Personal
                </Text>
              </TouchableOpacity>
              {vehicles.map(v => {
                const active = selectedVehicleId === v.id;
                return (
                  <TouchableOpacity
                    key={v.id}
                    onPress={() => setSelectedVehicleId(v.id)}
                    activeOpacity={0.85}
                    style={[styles.vehChip, active && styles.vehChipActive]}
                  >
                    <Text style={[styles.vehChipText, active && styles.vehChipTextActive]}>
                      🚗 {v.plate}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {selectedVehicle && (
              <Text style={styles.vehHint}>
                {selectedVehicle.brand} {selectedVehicle.model} · {selectedVehicle.year}
              </Text>
            )}
          </View>

          {/* Data scadenței */}
          <View style={styles.card}>
            <Text style={styles.label}>Data scadenței *</Text>
            <Text style={styles.sublabel}>Atinge o zi rapid sau folosește calendarul</Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingVertical: 8 }}
            >
              {twoWeekDays.map((d, idx) => {
                const ymd = toYMD(d);
                const selected = dueDate === ymd;
                const isToday = idx === 0;
                return (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => handleDayPick(d)}
                    activeOpacity={0.85}
                    style={[
                      styles.miniDay,
                      selected && styles.miniDaySelected,
                      isToday && !selected && styles.miniDayToday,
                    ]}
                  >
                    <Text style={[
                      styles.miniDayLabel,
                      selected && styles.miniDayLabelSelected,
                      isToday && !selected && { color: T.brand },
                    ]}>
                      {isToday ? 'Azi' : DAY_ABBR[d.getDay()]}
                    </Text>
                    <Text style={[
                      styles.miniDayNum,
                      selected && styles.miniDayNumSelected,
                    ]}>
                      {d.getDate()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>sau</Text>
              <View style={styles.dividerLine} />
            </View>

            <DateField
              label="Alege din calendar"
              value={dueDate}
              onChange={setDueDate}
              minDate={new Date()}
              showRelative
            />
          </View>

          {/* Repetare */}
          <View style={styles.card}>
            <Text style={styles.label}>Se repetă</Text>
            <View style={styles.repeatRow}>
              {REPEAT_OPTIONS.map(opt => {
                const active = repeat === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => setRepeat(opt.key)}
                    activeOpacity={0.85}
                    style={[styles.repeatBtn, active && styles.repeatBtnActive]}
                  >
                    <Text style={styles.repeatIcon}>{opt.icon}</Text>
                    <Text style={[styles.repeatText, active && styles.repeatTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Notițe */}
          <View style={styles.card}>
            <Text style={styles.label}>Notițe (opțional)</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Detalii suplimentare, sumă, observații..."
              placeholderTextColor={T.ink4}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[
              styles.submitBtn,
              (saving || !title.trim() || !dueDate) && styles.submitBtnDisabled,
              { backgroundColor: selectedType.color },
            ]}
            onPress={handleSubmit}
            disabled={saving || !title.trim() || !dueDate}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>
                {selectedType.icon}  Salvează reminderul
              </Text>
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

  // Hero
  hero: { backgroundColor: T.brand },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl,
    gap: SPACING.md,
  },
  heroBack: {
    width: TOUCH_TARGET, height: TOUCH_TARGET,
    borderRadius: TOUCH_TARGET / 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroBackText: { color: '#fff', fontSize: 18, fontWeight: FONTS.bold },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: FONTS.bold,
    letterSpacing: 1.5,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 26,
    fontWeight: FONTS.bold,
    marginTop: 4,
  },
  heroDate: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 13,
    fontWeight: FONTS.semibold,
    marginTop: 4,
  },
  heroDateMuted: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },

  // Cards
  card: {
    backgroundColor: T.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOW.sm,
  },
  label: {
    fontSize: 12,
    fontWeight: FONTS.bold,
    color: T.ink2,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },
  sublabel: { fontSize: 12, color: T.ink3, marginTop: -SPACING.xs, marginBottom: SPACING.sm },

  titleInput: {
    backgroundColor: T.bgSoft,
    borderWidth: 1.5,
    borderColor: T.line,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    fontSize: 17,
    fontWeight: FONTS.semibold,
    color: T.ink,
    minHeight: 50,
  },

  // Categorie grid
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  catTile: {
    flexGrow: 1,
    flexBasis: '30%',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    gap: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  catIcon: { fontSize: 22 },
  catLabel: { fontSize: 12, fontWeight: FONTS.bold, letterSpacing: 0.3 },

  // Vehicul chips
  vehChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: T.bgSoft,
    borderWidth: 1.5,
    borderColor: T.line,
  },
  vehChipActive: { backgroundColor: T.brand, borderColor: T.brand },
  vehChipText: { fontSize: 13, fontWeight: FONTS.semibold, color: T.ink2 },
  vehChipTextActive: { color: '#fff' },
  vehHint: { fontSize: 12, color: T.ink3, marginTop: SPACING.sm, fontStyle: 'italic' },

  // Mini days
  miniDay: {
    width: 52,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    backgroundColor: T.bgSoft,
    borderWidth: 1.5,
    borderColor: T.line,
  },
  miniDaySelected: {
    backgroundColor: T.brand,
    borderColor: T.brand,
    ...SHADOW.sm,
  },
  miniDayToday: { borderColor: T.brand, borderWidth: 2 },
  miniDayLabel: { fontSize: 10, fontWeight: FONTS.bold, color: T.ink3, letterSpacing: 0.5 },
  miniDayLabelSelected: { color: '#fff' },
  miniDayNum: { fontSize: 18, fontWeight: FONTS.bold, color: T.ink, marginTop: 2 },
  miniDayNumSelected: { color: '#fff' },

  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: SPACING.md, gap: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: T.line },
  dividerText: { fontSize: 11, color: T.ink4, fontWeight: FONTS.medium },

  // Repeat
  repeatRow: { flexDirection: 'row', gap: SPACING.sm },
  repeatBtn: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: T.bgSoft,
    borderWidth: 1.5,
    borderColor: T.line,
    alignItems: 'center',
    gap: 2,
  },
  repeatBtnActive: { backgroundColor: T.brand, borderColor: T.brand, ...SHADOW.sm },
  repeatIcon: { fontSize: 20 },
  repeatText: { fontSize: 12, fontWeight: FONTS.semibold, color: T.ink2 },
  repeatTextActive: { color: '#fff', fontWeight: FONTS.bold },

  // Notes
  notesInput: {
    backgroundColor: T.bgSoft,
    borderWidth: 1.5,
    borderColor: T.line,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    fontSize: 14,
    color: T.ink,
    minHeight: 84,
  },

  // Submit
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: RADIUS.lg,
    ...SHADOW.md,
    marginTop: SPACING.sm,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: FONTS.bold, letterSpacing: 0.3 },
});
