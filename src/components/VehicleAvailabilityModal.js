import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useStore from '../store';
import { T, RADIUS, FONTS, SHADOW, SPACING, HIT_SLOP, TOUCH_TARGET, formatDate } from '../theme';
import DateField from './DateField';

const QUICK_REASONS = [
  '🔧 În service',
  '🛞 Schimb anvelope',
  '💥 Avariat',
  '🚫 Nu mă folosesc',
  '📋 Documente lipsă',
];

export default function VehicleAvailabilityModal({ visible, vehicle, onClose }) {
  const setVehicleAvailability = useStore(s => s.setVehicleAvailability);
  const [isAvailable, setIsAvailable] = useState(true);
  const [reason, setReason] = useState('');
  const [until, setUntil] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && vehicle) {
      setIsAvailable(vehicle.isAvailable !== false);
      setReason(vehicle.unavailableReason || '');
      setUntil(vehicle.unavailableUntil || '');
    }
  }, [visible, vehicle?.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setVehicleAvailability(vehicle.id, {
        isAvailable,
        unavailableReason: isAvailable ? null : reason.trim(),
        unavailableUntil: isAvailable ? null : (until || null),
      });
      onClose();
    } catch (e) {
      Alert.alert('Eroare', e?.response?.data?.error || 'Nu s-a putut salva.');
    } finally {
      setSaving(false);
    }
  };

  const docReasons = vehicle?.availabilityReasons?.filter(r => r.type !== 'manual') || [];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.title}>Disponibilitate vehicul</Text>
          <TouchableOpacity onPress={onClose} hitSlop={HIT_SLOP}>
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>
                {isAvailable ? '✅ Disponibil' : '🚫 Indisponibil'}
              </Text>
              <Text style={styles.toggleSub}>
                {isAvailable
                  ? 'Vehiculul poate fi utilizat.'
                  : 'Membrii vor primi notificare că vehiculul nu e disponibil.'}
              </Text>
            </View>
            <Switch
              value={isAvailable}
              onValueChange={setIsAvailable}
              trackColor={{ false: T.danger, true: T.success }}
            />
          </View>

          {!isAvailable && (
            <>
              <Text style={styles.fieldLabel}>Motiv (opțional)</Text>
              <TextInput
                style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
                value={reason}
                onChangeText={setReason}
                placeholder='Ex: "În service la Auto Popescu pt. cutie viteze"'
                placeholderTextColor={T.ink4}
                multiline
              />

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                {QUICK_REASONS.map(r => (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setReason(r)}
                    style={styles.chip}
                  >
                    <Text style={styles.chipText}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <DateField
                label="Indisponibil până la (opțional)"
                value={until}
                onChange={setUntil}
                minDate={new Date()}
                placeholder="Atinge pentru a alege"
                hint={until
                  ? `Va redeveni automat disponibil pe ${formatDate(until)}`
                  : 'Lăsat gol = indisponibil pe perioadă nedeterminată'}
              />
            </>
          )}

          {docReasons.length > 0 && (
            <View style={styles.warnBox}>
              <Text style={styles.warnTitle}>⚠️ Documente expirate</Text>
              <Text style={styles.warnBody}>
                Chiar dacă marchezi vehiculul ca disponibil manual, sistemul îl va considera
                indisponibil cât timp există documente expirate:
              </Text>
              {docReasons.map((r, i) => (
                <Text key={i} style={styles.warnItem}>• {r.label}</Text>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>💾 Salvează</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
    backgroundColor: T.card,
  },
  title: { fontSize: 17, fontWeight: FONTS.bold, color: T.ink },
  close: { fontSize: 20, color: T.ink3, padding: 4 },
  content: { padding: SPACING.xl, gap: SPACING.sm },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    backgroundColor: T.card,
    borderRadius: RADIUS.lg,
    ...SHADOW.sm,
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  toggleLabel: { fontSize: 16, fontWeight: FONTS.bold, color: T.ink },
  toggleSub: { fontSize: 12, color: T.ink3, marginTop: 4, lineHeight: 16 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: FONTS.semibold,
    color: T.ink2,
    marginTop: SPACING.md,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1.5,
    borderColor: T.line,
    borderRadius: RADIUS.md,
    backgroundColor: T.bgSoft,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    fontSize: 15,
    color: T.ink,
    minHeight: 46,
  },
  hint: { fontSize: 11, color: T.ink4, marginTop: 6, fontStyle: 'italic' },
  chipRow: { marginVertical: SPACING.sm },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: T.brandTint,
    borderWidth: 1,
    borderColor: T.brand + '40',
    marginRight: 8,
  },
  chipText: { color: T.brand, fontSize: 12, fontWeight: FONTS.semibold },
  warnBox: {
    marginTop: SPACING.xl,
    padding: SPACING.lg,
    backgroundColor: T.warnTint,
    borderWidth: 1,
    borderColor: T.warn,
    borderRadius: RADIUS.lg,
  },
  warnTitle: { fontSize: 14, fontWeight: FONTS.bold, color: T.warn, marginBottom: 6 },
  warnBody: { fontSize: 12, color: T.ink2, lineHeight: 18, marginBottom: 8 },
  warnItem: { fontSize: 12, color: T.ink, fontWeight: FONTS.medium, lineHeight: 18 },
  saveBtn: {
    marginTop: SPACING.xl,
    height: 52,
    backgroundColor: T.brand,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.sm,
  },
  saveBtnText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 15 },
});
