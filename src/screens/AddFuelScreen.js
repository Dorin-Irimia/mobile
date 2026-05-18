import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Switch,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useStore from '../store';
import {
  T,
  RADIUS,
  FONTS,
  SHADOW,
  SPACING,
  formatDate,
  formatCurrency,
  useResponsive,
  HIT_SLOP,
  HIT_SLOP_LG,
  TOUCH_TARGET,
  IS_IOS,
} from '../theme';
import AttachmentsField from '../components/AttachmentsField';
import CustomFieldsEditor from '../components/CustomFieldsEditor';
import LocationField from '../components/LocationField';
import DateField from '../components/DateField';
import TimeField from '../components/TimeField';
import SuggestInput from '../components/SuggestInput';

const FUEL_TYPES = [
  { key: 'benzina', label: '⛽ Benzină' },
  { key: 'motorina', label: '🛢️ Motorină' },
  { key: 'gpl', label: '💨 GPL' },
  { key: 'electric', label: '⚡ Electric' },
];

function fuelKeyFromVehicleFuel(raw) {
  if (!raw) return 'benzina';
  const v = String(raw).toLowerCase()
    .replace(/ă/g, 'a').replace(/â/g, 'a').replace(/î/g, 'i')
    .replace(/ț/g, 't').replace(/ș/g, 's').trim();
  if (v.includes('motor')) return 'motorina';
  if (v.includes('gpl')) return 'gpl';
  if (v.includes('elect') || v.includes('ev')) return 'electric';
  return 'benzina';
}

const COMMON_STATIONS = ['OMV', 'Petrom', 'Lukoil', 'Rompetrol', 'Mol', 'Shell', 'Gazprom', 'Socar'];

function todayStr() {
  return new Date().toISOString().split('T')[0];
}
function nowTimeStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function AddFuelScreen({ navigation, route }) {
  const vehicles = useStore(s => s.vehicles);
  const addFuelLog = useStore(s => s.addFuelLog);
  const recordSuggestions = useStore(s => s.recordSuggestions);
  const { isTablet, hPad, maxContentWidth } = useResponsive();

  const presetVehicleId = route?.params?.vehicleId;
  const ownedAndShared = vehicles || [];
  const initialVehicleId = presetVehicleId || ownedAndShared[0]?.id || null;
  const initialVehicle = ownedAndShared.find(v => v.id === initialVehicleId);

  const [vehicleId, setVehicleId] = useState(initialVehicleId);
  const [date, setDate] = useState(todayStr());
  const [time, setTime] = useState(nowTimeStr());
  const [liters, setLiters] = useState('');
  const [pricePerL, setPricePerL] = useState('');
  const [km, setKm] = useState('');
  const [station, setStation] = useState('');
  const [location, setLocation] = useState('');
  const [fuelType, setFuelType] = useState(fuelKeyFromVehicleFuel(initialVehicle?.fuel));
  const [userTouchedFuelType, setUserTouchedFuelType] = useState(false);
  const [fullTank, setFullTank] = useState(true);
  const [notes, setNotes] = useState('');
  const [customFields, setCustomFields] = useState({});
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(false);

  // Sincronizare cu casa
  const households = useStore(s => s.households);
  const selectedHouseholdId = useStore(s => s.selectedHouseholdId);
  const defaultHouseholdId = selectedHouseholdId || households[0]?.id || null;
  const [syncToHousehold, setSyncToHousehold] = useState(false);
  const [syncHouseholdId, setSyncHouseholdId] = useState(defaultHouseholdId);

  const selectedVehicle = useMemo(
    () => ownedAndShared.find(v => v.id === vehicleId),
    [ownedAndShared, vehicleId],
  );

  // Sincronizează automat fuelType cu carburantul vehiculului selectat,
  // doar dacă utilizatorul nu l-a modificat manual.
  React.useEffect(() => {
    if (userTouchedFuelType) return;
    if (selectedVehicle?.fuel) {
      const next = fuelKeyFromVehicleFuel(selectedVehicle.fuel);
      setFuelType(prev => prev === next ? prev : next);
    }
  }, [selectedVehicle?.fuel, userTouchedFuelType]);

  // Prefill km from vehicle's current km when changing vehicle
  React.useEffect(() => {
    if (selectedVehicle?.km && !km) {
      setKm(String(selectedVehicle.km));
    }
  }, [selectedVehicle?.id]);

  const computedTotal =
    liters && pricePerL && !isNaN(parseFloat(liters)) && !isNaN(parseFloat(pricePerL))
      ? parseFloat(liters) * parseFloat(pricePerL)
      : 0;

  const handleSave = async () => {
    if (!vehicleId) {
      Alert.alert('Vehicul', 'Alege un vehicul.');
      return;
    }
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert('Dată', 'Format dată: YYYY-MM-DD');
      return;
    }
    if (!liters || isNaN(parseFloat(liters)) || parseFloat(liters) <= 0) {
      Alert.alert('Litri', 'Introdu numărul de litri.');
      return;
    }
    if (!pricePerL || isNaN(parseFloat(pricePerL)) || parseFloat(pricePerL) <= 0) {
      Alert.alert('Preț', 'Introdu prețul pe litru.');
      return;
    }
    if (!km || isNaN(parseInt(km))) {
      Alert.alert('Kilometraj', 'Introdu kilometrajul.');
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('vehicleId', vehicleId);
      fd.append('date', date);
      if (time) fd.append('time', time);
      fd.append('liters', String(parseFloat(liters)));
      fd.append('pricePerL', String(parseFloat(pricePerL)));
      fd.append('km', String(parseInt(km)));
      if (station.trim()) fd.append('station', station.trim());
      if (location.trim()) fd.append('location', location.trim());
      if (fuelType) fd.append('fuelType', fuelType);
      fd.append('fullTank', fullTank ? 'true' : 'false');
      if (notes.trim()) fd.append('notes', notes.trim());
      if (Object.keys(customFields).length > 0) {
        fd.append('customFields', JSON.stringify(customFields));
      }
      if (syncToHousehold && syncHouseholdId) {
        fd.append('syncToHouseholdId', syncHouseholdId);
        fd.append('syncCategory', 'transport');
      }
      attachments.forEach((a, i) => {
        fd.append('attachments', {
          uri: a.uri,
          name: a.name || `file-${i}`,
          type: a.mimeType || 'application/octet-stream',
        });
      });
      await addFuelLog(fd);
      recordSuggestions({
        station: station.trim(),
        location: location.trim(),
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
      <SafeAreaView style={styles.header} edges={['top']}>
        <View style={[styles.headerContent, { paddingHorizontal: hPad }]}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            hitSlop={HIT_SLOP_LG}
          >
            <Text style={styles.backBtnText}>← Anulează</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Alimentare nouă</Text>
          <TouchableOpacity
            style={[styles.saveBtnHead, (loading || !liters || !pricePerL || !km) && { opacity: 0.5 }]}
            onPress={handleSave}
            disabled={loading || !liters || !pricePerL || !km}
            hitSlop={HIT_SLOP}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveBtnHeadText}>Salvează</Text>
            )}
          </TouchableOpacity>
        </View>
        <View style={[styles.totalBanner, { paddingHorizontal: hPad }]}>
          <Text style={styles.totalLabel}>Total alimentare</Text>
          <Text style={styles.totalValue}>{formatCurrency(computedTotal, 'RON')}</Text>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={IS_IOS ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            { paddingHorizontal: hPad, paddingVertical: SPACING.xl, gap: SPACING.lg },
            isTablet && { alignSelf: 'center', width: '100%', maxWidth: maxContentWidth },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Vehicul */}
          <View style={styles.card}>
            <Text style={styles.label}>Vehicul *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {ownedAndShared.map(v => (
                <TouchableOpacity
                  key={v.id}
                  onPress={() => setVehicleId(v.id)}
                  style={[styles.chip, vehicleId === v.id && styles.chipActive]}
                >
                  <Text style={[styles.chipText, vehicleId === v.id && styles.chipTextActive]}>
                    {v.plate}
                  </Text>
                  {v.role === 'member' && (
                    <Text style={[styles.chipBadge, vehicleId === v.id && { color: '#fff' }]}>👥</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            {selectedVehicle && (
              <Text style={styles.vehicleSub}>
                {selectedVehicle.brand} {selectedVehicle.model} · {selectedVehicle.year}
                {selectedVehicle.role === 'member' && ' · partajat'}
              </Text>
            )}
          </View>

          {/* Tip combustibil */}
          <View style={styles.card}>
            <Text style={styles.label}>Tip combustibil</Text>
            <View style={styles.gridChips}>
              {FUEL_TYPES.map(t => (
                <TouchableOpacity
                  key={t.key}
                  onPress={() => { setFuelType(t.key); setUserTouchedFuelType(true); }}
                  style={[styles.gridChip, fuelType === t.key && styles.gridChipActive]}
                >
                  <Text style={[styles.gridChipText, fuelType === t.key && styles.gridChipTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Litri + preț */}
          <View style={styles.card}>
            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Litri *</Text>
                <View style={styles.inputWithSuffix}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                    value={liters}
                    onChangeText={setLiters}
                    placeholder="0.00"
                    placeholderTextColor={T.ink4}
                    keyboardType="decimal-pad"
                  />
                  <Text style={styles.suffix}>L</Text>
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Preț / L *</Text>
                <View style={styles.inputWithSuffix}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                    value={pricePerL}
                    onChangeText={setPricePerL}
                    placeholder="0.00"
                    placeholderTextColor={T.ink4}
                    keyboardType="decimal-pad"
                  />
                  <Text style={styles.suffix}>RON</Text>
                </View>
              </View>
            </View>

            <Text style={styles.label}>Kilometraj *</Text>
            <View style={styles.inputWithSuffix}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                value={km}
                onChangeText={setKm}
                placeholder={
                  selectedVehicle?.km
                    ? `Ex: ${selectedVehicle.km.toLocaleString('ro-RO')}`
                    : 'Ex: 50000'
                }
                placeholderTextColor={T.ink4}
                keyboardType="number-pad"
              />
              <Text style={styles.suffix}>km</Text>
            </View>

            <View style={[styles.row, { marginTop: SPACING.md, justifyContent: 'space-between' }]}>
              <Text style={[styles.label, { marginTop: 0, flex: 1 }]}>Plin complet</Text>
              <Switch
                value={fullTank}
                onValueChange={setFullTank}
                trackColor={{ false: T.line, true: T.brand }}
              />
            </View>
          </View>

          {/* Dată + oră */}
          <View style={styles.card}>
            <DateField
              label="Data *"
              value={date}
              onChange={setDate}
              maxDate={new Date()}
              required
            />
            <TimeField
              label="Ora (opțional)"
              value={time}
              onChange={setTime}
            />
          </View>

          {/* Benzinărie + locație */}
          <View style={styles.card}>
            <Text style={styles.label}>Benzinărie</Text>
            <SuggestInput
              field="station"
              style={styles.input}
              value={station}
              onChangeText={setStation}
              placeholder='Ex: "OMV", "Petrom"'
              placeholderTextColor={T.ink4}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {COMMON_STATIONS.map(s => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setStation(s)}
                  style={[styles.chipSmall, station === s && styles.chipSmallActive]}
                >
                  <Text style={[styles.chipSmallText, station === s && styles.chipSmallTextActive]}>
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <LocationField
              value={location}
              onChange={setLocation}
              placeholder='Ex: "Șos. Pipera 42, București"'
            />
          </View>

          {/* Atașamente */}
          <View style={styles.card}>
            <AttachmentsField
              selected={attachments}
              onSelectedChange={setAttachments}
              maxFiles={20}
            />
          </View>

          {/* Sincronizare cu cheltuielile casnice */}
          {households.length > 0 && (
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>🏠 Adaugă și la cheltuielile casei</Text>
                  <Text style={styles.helper}>
                    Aceeași sumă apare automat ca o cheltuială casnică (categorie „transport"). Se sincronizează la editare/ștergere.
                  </Text>
                </View>
                <Switch
                  value={syncToHousehold}
                  onValueChange={setSyncToHousehold}
                  trackColor={{ false: T.line, true: T.brandTint2 }}
                  thumbColor={syncToHousehold ? T.brand : '#fff'}
                />
              </View>
              {syncToHousehold && households.length > 1 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }} contentContainerStyle={{ gap: 8 }}>
                  {households.map(h => {
                    const active = h.id === syncHouseholdId;
                    return (
                      <TouchableOpacity
                        key={h.id}
                        onPress={() => setSyncHouseholdId(h.id)}
                        style={{
                          paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
                          backgroundColor: active ? T.brand : T.card,
                          borderWidth: 1, borderColor: active ? T.brand : T.line,
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '600', color: active ? '#fff' : T.ink2 }}>{h.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          )}

          {/* Note */}
          <View style={styles.card}>
            <Text style={styles.label}>Notițe</Text>
            <TextInput
              style={[styles.input, { minHeight: 70 }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Detalii suplimentare (opțional)"
              placeholderTextColor={T.ink4}
              multiline
            />
          </View>

          {/* Câmpuri custom */}
          <View style={styles.card}>
            <CustomFieldsEditor value={customFields} onChange={setCustomFields} />
          </View>

          <TouchableOpacity
            style={[
              styles.bigSaveBtn,
              (loading || !liters || !pricePerL || !km) && { opacity: 0.55 },
            ]}
            onPress={handleSave}
            disabled={loading || !liters || !pricePerL || !km}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.bigSaveBtnText}>⛽ Salvează alimentare</Text>
            )}
          </TouchableOpacity>

          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  header: { backgroundColor: T.brand },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
    minHeight: TOUCH_TARGET,
  },
  backBtn: { flex: 1 },
  backBtnText: { color: '#fff', fontSize: 14, fontWeight: FONTS.medium },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: FONTS.bold },
  saveBtnHead: { flex: 1, alignItems: 'flex-end' },
  saveBtnHeadText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 14 },
  totalBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingBottom: SPACING.md,
  },
  totalLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  totalValue: { color: '#fff', fontSize: 22, fontWeight: FONTS.bold },
  scroll: { flex: 1 },
  card: {
    backgroundColor: T.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOW.sm,
  },
  label: {
    fontSize: 13,
    fontWeight: FONTS.semibold,
    color: T.ink2,
    marginBottom: 6,
    marginTop: SPACING.sm,
  },
  hint: { fontSize: 11, color: T.ink4, marginTop: 4, marginBottom: SPACING.sm },
  helper: { fontSize: 11, color: T.ink3, lineHeight: 16, marginTop: 4 },
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
    marginBottom: SPACING.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  row2: { flexDirection: 'row', gap: SPACING.md },
  inputWithSuffix: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  suffix: { fontSize: 14, color: T.ink3, fontWeight: FONTS.medium, minWidth: 30 },
  chipRow: { marginVertical: SPACING.sm },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    backgroundColor: T.bgSoft,
    borderWidth: 1.5,
    borderColor: T.line,
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipActive: { backgroundColor: T.brand, borderColor: T.brand },
  chipText: { fontSize: 14, fontWeight: FONTS.semibold, color: T.ink2, letterSpacing: 0.5 },
  chipTextActive: { color: '#fff' },
  chipBadge: { fontSize: 12, color: T.ink3 },
  chipSmall: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: T.bgSoft,
    borderWidth: 1,
    borderColor: T.line,
    marginRight: 6,
  },
  chipSmallActive: { backgroundColor: T.brandTint, borderColor: T.brand },
  chipSmallText: { fontSize: 12, color: T.ink2 },
  chipSmallTextActive: { color: T.brand, fontWeight: FONTS.semibold },
  vehicleSub: { fontSize: 12, color: T.ink3, marginTop: 4 },
  gridChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  gridChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: T.bgSoft,
    borderWidth: 1.5,
    borderColor: T.line,
    borderRadius: RADIUS.md,
  },
  gridChipActive: { backgroundColor: T.brand, borderColor: T.brand },
  gridChipText: { fontSize: 14, fontWeight: FONTS.medium, color: T.ink2 },
  gridChipTextActive: { color: '#fff', fontWeight: FONTS.bold },
  bigSaveBtn: {
    height: 54,
    borderRadius: RADIUS.lg,
    backgroundColor: T.brand,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.md,
  },
  bigSaveBtnText: { color: '#fff', fontSize: 16, fontWeight: FONTS.bold },
});
