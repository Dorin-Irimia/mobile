import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useStore from '../store';
import { T, RADIUS, SHADOW, FONTS, display, formatCurrency } from '../theme';
import DateField from '../components/DateField';
import { SERVICE_TYPES } from './ServiceHistoryScreen';

const TYPE_KEYS = Object.keys(SERVICE_TYPES);

export default function AddServiceRecordScreen({ navigation, route }) {
  const vehicles = useStore(s => s.vehicles);
  const selectedVehicleId = useStore(s => s.selectedVehicleId);
  const records = useStore(s => s.serviceRecords);
  const addServiceRecord = useStore(s => s.addServiceRecord);
  const updateServiceRecord = useStore(s => s.updateServiceRecord);

  const recordId = route?.params?.recordId || null;
  const initialVehicleId = route?.params?.vehicleId || selectedVehicleId || vehicles[0]?.id || null;
  const existing = recordId ? records.find(r => r.id === recordId) : null;

  const [vehicleId, setVehicleId] = useState(existing?.vehicleId || initialVehicleId);
  const [type, setType]           = useState(existing?.type || 'service-general');
  const [title, setTitle]         = useState(existing?.title || '');
  const [provider, setProvider]   = useState(existing?.provider || '');
  const [date, setDate]           = useState(existing?.date || new Date().toISOString().slice(0, 10));
  const [km, setKm]               = useState(existing?.km != null ? String(existing.km) : '');
  const [cost, setCost]           = useState(existing?.cost != null ? String(existing.cost) : '');
  const [upcoming, setUpcoming]   = useState(existing?.upcoming || false);
  const [notes, setNotes]         = useState(existing?.notes || '');
  const [saving, setSaving]       = useState(false);

  // Auto-mark as upcoming if user picks a future date and hasn't toggled it manually
  useEffect(() => {
    if (existing) return;
    if (!date) return;
    const today = new Date().toISOString().slice(0, 10);
    if (date > today && !upcoming) setUpcoming(true);
  }, [date, existing]);

  // If user picks a known type and title is empty, prefill the label
  useEffect(() => {
    if (!title.trim()) {
      const meta = SERVICE_TYPES[type];
      if (meta) setTitle(meta.label);
    }
  }, [type]); // eslint-disable-line react-hooks/exhaustive-deps

  const vehicle = useMemo(() => vehicles.find(v => v.id === vehicleId), [vehicles, vehicleId]);

  const valid = vehicleId && title.trim() && date && type;

  const handleSubmit = async () => {
    if (!valid) {
      Alert.alert('Câmpuri lipsă', 'Selectează vehiculul, tipul, titlul și data.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        vehicleId,
        type,
        title: title.trim(),
        provider: provider.trim() || null,
        date,
        km: km.trim() === '' ? null : parseInt(km, 10),
        cost: cost.trim() === '' ? 0 : parseFloat(cost),
        upcoming,
        notes: notes.trim() || null,
      };
      if (existing) {
        await updateServiceRecord(existing.id, payload);
      } else {
        await addServiceRecord(payload);
      }
      navigation.goBack();
    } catch (e) {
      Alert.alert('Eroare', e?.response?.data?.error || 'Nu pot salva.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, display(700)]}>
          {existing ? 'Editează service' : 'Service nou'}
        </Text>
        <TouchableOpacity
          onPress={handleSubmit}
          style={styles.headerBtn}
          disabled={saving || !valid}
        >
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
          {/* Vehicle picker */}
          {vehicles.length > 1 && (
            <View>
              <Text style={styles.label}>Vehicul</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {vehicles.map(v => {
                  const active = v.id === vehicleId;
                  return (
                    <TouchableOpacity
                      key={v.id}
                      onPress={() => setVehicleId(v.id)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {v.plate}{v.brand ? ` · ${v.brand}` : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Type picker */}
          <View>
            <Text style={styles.label}>Tip service</Text>
            <View style={styles.typeGrid}>
              {TYPE_KEYS.map(k => {
                const meta = SERVICE_TYPES[k];
                const active = type === k;
                return (
                  <TouchableOpacity
                    key={k}
                    onPress={() => setType(k)}
                    style={[
                      styles.typeChip,
                      active && { borderColor: meta.color, backgroundColor: meta.color + '14' },
                    ]}
                  >
                    <Text style={{ fontSize: 18 }}>{meta.icon}</Text>
                    <Text style={[styles.typeChipText, active && { color: meta.color, fontWeight: FONTS.bold }]}>
                      {meta.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Title */}
          <View>
            <Text style={styles.label}>Titlu</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="ex. Revizie 10.000 km"
              placeholderTextColor={T.ink4}
              style={styles.input}
            />
          </View>

          {/* Provider */}
          <View>
            <Text style={styles.label}>Service / atelier</Text>
            <TextInput
              value={provider}
              onChangeText={setProvider}
              placeholder="ex. Service Petrescu"
              placeholderTextColor={T.ink4}
              style={styles.input}
            />
          </View>

          {/* Date */}
          <DateField
            label="Data"
            value={date}
            onChange={setDate}
            allowClear={false}
            showRelative
          />

          {/* KM + Cost */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Kilometraj</Text>
              <TextInput
                value={km}
                onChangeText={t => setKm(t.replace(/[^0-9]/g, ''))}
                placeholder={vehicle?.km ? String(vehicle.km) : 'ex. 84500'}
                placeholderTextColor={T.ink4}
                keyboardType="number-pad"
                style={styles.input}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Cost (RON)</Text>
              <TextInput
                value={cost}
                onChangeText={t => setCost(t.replace(/[^0-9.,]/g, '').replace(',', '.'))}
                placeholder="ex. 320.50"
                placeholderTextColor={T.ink4}
                keyboardType="decimal-pad"
                style={styles.input}
              />
            </View>
          </View>

          {/* Upcoming toggle */}
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>Programat (viitor)</Text>
              <Text style={styles.toggleSub}>
                Marchează ca planificat — costul rămâne estimativ
              </Text>
            </View>
            <Switch
              value={upcoming}
              onValueChange={setUpcoming}
              trackColor={{ false: T.line, true: T.brandTint2 }}
              thumbColor={upcoming ? T.brand : '#fff'}
            />
          </View>

          {/* Notes */}
          <View>
            <Text style={styles.label}>Notițe</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Detalii suplimentare…"
              placeholderTextColor={T.ink4}
              multiline
              style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
            />
          </View>

          {/* Bottom save */}
          <TouchableOpacity
            onPress={handleSubmit}
            style={[styles.saveBig, !valid && { opacity: 0.5 }]}
            disabled={saving || !valid}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.saveBigText}>
                  {existing ? 'Salvează modificările' : `Adaugă ${cost ? '· ' + formatCurrency(parseFloat(cost) || 0) : ''}`}
                </Text>}
          </TouchableOpacity>
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

  content: { padding: 16, gap: 16, paddingBottom: 60 },
  label: { fontSize: 13, color: T.ink2, fontWeight: FONTS.semibold, marginBottom: 8 },
  input: {
    backgroundColor: T.card, borderWidth: 1, borderColor: T.line,
    borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 12,
    fontSize: 15, color: T.ink,
  },

  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.full,
    backgroundColor: T.card, borderWidth: 1, borderColor: T.line,
  },
  chipActive: { backgroundColor: T.brand, borderColor: T.brand },
  chipText: { fontSize: 12, fontWeight: FONTS.semibold, color: T.ink2 },
  chipTextActive: { color: '#fff' },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: T.card, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: T.line,
  },
  typeChipText: { fontSize: 12, fontWeight: FONTS.semibold, color: T.ink2 },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: T.card, borderRadius: RADIUS.md, padding: 14,
    borderWidth: 1, borderColor: T.line,
  },
  toggleLabel: { fontSize: 14, fontWeight: FONTS.bold, color: T.ink },
  toggleSub: { fontSize: 11, color: T.ink3, marginTop: 2 },

  saveBig: {
    backgroundColor: T.brand, borderRadius: RADIUS.lg,
    paddingVertical: 14, alignItems: 'center',
    ...SHADOW.md,
  },
  saveBigText: { color: '#fff', fontSize: 15, fontWeight: FONTS.bold },
});
