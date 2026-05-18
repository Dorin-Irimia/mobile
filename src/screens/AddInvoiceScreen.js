import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Switch,
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

const CATEGORIES = [
  { key: 'service', label: '🔧 Service' },
  { key: 'combustibil', label: '⛽ Combustibil' },
  { key: 'asigurare', label: '🛡️ Asigurare' },
  { key: 'anvelope', label: '🔄 Anvelope' },
  { key: 'piese', label: '🧰 Piese' },
  { key: 'altele', label: '🚗 Altele' },
];

const CURRENCIES = ['RON', 'EUR', 'USD'];

function todayStr() {
  return new Date().toISOString().split('T')[0];
}
function nowTimeStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function AddInvoiceScreen({ navigation, route }) {
  const vehicles = useStore(s => s.vehicles);
  const addInvoice = useStore(s => s.addInvoice);
  const recordSuggestions = useStore(s => s.recordSuggestions);
  const { isTablet, hPad, maxContentWidth } = useResponsive();

  const presetVehicleId = route?.params?.vehicleId;
  const ownedAndShared = vehicles || [];
  const initialVehicleId =
    presetVehicleId ||
    ownedAndShared[0]?.id ||
    null;

  const [vehicleId, setVehicleId] = useState(initialVehicleId);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('RON');
  const [category, setCategory] = useState('service');
  const [date, setDate] = useState(todayStr());
  const [time, setTime] = useState(nowTimeStr());
  const [km, setKm] = useState('');
  const [merchant, setMerchant] = useState('');
  const [location, setLocation] = useState('');
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

  const handleSave = async () => {
    if (!vehicleId) {
      Alert.alert('Vehicul', 'Alege un vehicul.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Titlu', 'Adaugă un titlu (ex: "Anvelope iarnă").');
      return;
    }
    if (!amount || isNaN(parseFloat(amount))) {
      Alert.alert('Sumă', 'Introdu o sumă validă.');
      return;
    }
    if (!date) {
      Alert.alert('Dată', 'Alege data cheltuielii.');
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('vehicleId', vehicleId);
      fd.append('title', title.trim());
      fd.append('amount', String(parseFloat(amount)));
      fd.append('currency', currency);
      fd.append('category', category);
      fd.append('date', date);
      if (time) fd.append('time', time);
      if (km) fd.append('km', String(parseInt(km)));
      if (merchant.trim()) fd.append('merchant', merchant.trim());
      if (location.trim()) fd.append('location', location.trim());
      if (notes.trim()) fd.append('notes', notes.trim());
      if (Object.keys(customFields).length > 0) {
        fd.append('customFields', JSON.stringify(customFields));
      }
      if (syncToHousehold && syncHouseholdId) {
        fd.append('syncToHouseholdId', syncHouseholdId);
        // Map vehicle invoice categories onto household categories.
        const mapCategory = {
          service: 'transport',
          combustibil: 'transport',
          asigurare: 'transport',
          anvelope: 'transport',
          piese: 'transport',
          altele: 'transport',
        };
        fd.append('syncCategory', mapCategory[category] || 'transport');
      }
      attachments.forEach((a, i) => {
        fd.append('attachments', {
          uri: a.uri,
          name: a.name || `file-${i}`,
          type: a.mimeType || 'application/octet-stream',
        });
      });
      await addInvoice(fd);
      recordSuggestions({
        invoiceTitle: title.trim(),
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
      <SafeAreaView style={styles.header} edges={['top']}>
        <View style={[styles.headerContent, { paddingHorizontal: hPad }]}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            hitSlop={HIT_SLOP_LG}
          >
            <Text style={styles.backBtnText}>← Anulează</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Cheltuială nouă</Text>
          <TouchableOpacity
            style={[styles.saveBtnHead, (loading || !title || !amount) && { opacity: 0.5 }]}
            onPress={handleSave}
            disabled={loading || !title || !amount}
            hitSlop={HIT_SLOP}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveBtnHeadText}>Salvează</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={IS_IOS ? 'padding' : undefined}
        keyboardVerticalOffset={IS_IOS ? 0 : 0}
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

          {/* Categorie */}
          <View style={styles.card}>
            <Text style={styles.label}>Categorie *</Text>
            <View style={styles.gridChips}>
              {CATEGORIES.map(c => (
                <TouchableOpacity
                  key={c.key}
                  onPress={() => setCategory(c.key)}
                  style={[styles.gridChip, category === c.key && styles.gridChipActive]}
                >
                  <Text
                    style={[styles.gridChipText, category === c.key && styles.gridChipTextActive]}
                  >
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Sumă + titlu */}
          <View style={styles.card}>
            <Text style={styles.label}>Titlu *</Text>
            <SuggestInput
              field="invoiceTitle"
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder='Ex: "Anvelope iarnă", "Schimb ulei"'
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
                <View style={styles.input2}>
                  {CURRENCIES.map(c => (
                    <TouchableOpacity
                      key={c}
                      onPress={() => setCurrency(c)}
                      style={[styles.mini, currency === c && styles.miniActive]}
                    >
                      <Text style={[styles.miniText, currency === c && styles.miniTextActive]}>
                        {c}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </View>

          {/* Data, ora, km */}
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

            <Text style={styles.label}>Kilometraj la momentul cheltuielii</Text>
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
          </View>

          {/* Magazin + locație */}
          <View style={styles.card}>
            <Text style={styles.label}>Magazin / atelier / firmă</Text>
            <SuggestInput
              field="merchant"
              style={styles.input}
              value={merchant}
              onChangeText={setMerchant}
              placeholder='Ex: "Service Auto Popescu", "Praktiker"'
              placeholderTextColor={T.ink4}
            />

            <LocationField
              value={location}
              onChange={setLocation}
              placeholder='Ex: "Calea Vitan 12, Sector 3, București"'
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
                  <Text style={[styles.helper, { marginTop: 4 }]}>
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
              style={[styles.input, { minHeight: 80 }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Detalii suplimentare (opțional)"
              placeholderTextColor={T.ink4}
              multiline
            />
          </View>

          {/* Câmpuri personalizate */}
          <View style={styles.card}>
            <CustomFieldsEditor value={customFields} onChange={setCustomFields} />
          </View>

          {/* Salvează buton mare jos */}
          <TouchableOpacity
            style={[styles.bigSaveBtn, (loading || !title || !amount) && { opacity: 0.55 }]}
            onPress={handleSave}
            disabled={loading || !title || !amount}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.bigSaveBtnText}>💾 Salvează cheltuiala</Text>
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
    paddingBottom: SPACING.md,
    minHeight: TOUCH_TARGET,
  },
  backBtn: { flex: 1 },
  backBtnText: { color: '#fff', fontSize: 14, fontWeight: FONTS.medium },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: FONTS.bold },
  saveBtnHead: {
    flex: 1,
    alignItems: 'flex-end',
  },
  saveBtnHeadText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 14 },
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
  helper: { fontSize: 11, color: T.ink3, lineHeight: 16 },
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
  input2: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: SPACING.sm,
  },
  mini: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: T.bgSoft,
    borderWidth: 1.5,
    borderColor: T.line,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    minHeight: 46,
    justifyContent: 'center',
  },
  miniActive: { backgroundColor: T.brand, borderColor: T.brand },
  miniText: { fontSize: 13, fontWeight: FONTS.medium, color: T.ink2 },
  miniTextActive: { color: '#fff', fontWeight: FONTS.bold },
  row2: { flexDirection: 'row', gap: SPACING.md },
  inputWithSuffix: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  suffix: { fontSize: 14, color: T.ink3, fontWeight: FONTS.medium },
  chipRow: { marginBottom: SPACING.sm, marginTop: 4 },
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
  vehicleSub: { fontSize: 12, color: T.ink3, marginTop: 4 },
  gridChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
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
