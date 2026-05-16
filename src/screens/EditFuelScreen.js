import React, { useState, useMemo, useEffect } from 'react';
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

const FUEL_TYPES = [
  { key: 'benzina', label: '⛽ Benzină' },
  { key: 'motorina', label: '🛢️ Motorină' },
  { key: 'gpl', label: '💨 GPL' },
  { key: 'electric', label: '⚡ Electric' },
];

const COMMON_STATIONS = ['OMV', 'Petrom', 'Lukoil', 'Rompetrol', 'Mol', 'Shell', 'Gazprom', 'Socar'];

export default function EditFuelScreen({ navigation, route }) {
  const { fuelLogId } = route.params || {};
  const vehicles = useStore(s => s.vehicles);
  const fuelLogs = useStore(s => s.fuelLogs);
  const updateFuelLog = useStore(s => s.updateFuelLog);
  const deleteFuelAttachment = useStore(s => s.deleteFuelAttachment);
  const { isTablet, hPad, maxContentWidth } = useResponsive();

  const log = fuelLogs.find(f => f.id === fuelLogId);

  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [liters, setLiters] = useState('');
  const [pricePerL, setPricePerL] = useState('');
  const [km, setKm] = useState('');
  const [station, setStation] = useState('');
  const [location, setLocation] = useState('');
  const [fuelType, setFuelType] = useState('benzina');
  const [fullTank, setFullTank] = useState(true);
  const [notes, setNotes] = useState('');
  const [customFields, setCustomFields] = useState({});
  const [existingAttachments, setExistingAttachments] = useState([]);
  const [newAttachments, setNewAttachments] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (log) {
      setDate(log.date || '');
      setTime(log.time || '');
      setLiters(String(log.liters || ''));
      setPricePerL(String(log.pricePerL || ''));
      setKm(log.km ? String(log.km) : '');
      setStation(log.station || '');
      setLocation(log.location || '');
      setFuelType(log.fuelType || 'benzina');
      setFullTank(!!log.fullTank);
      setNotes(log.notes || '');
      setCustomFields(log.customFields || {});
      setExistingAttachments(log.attachments || []);
    }
  }, [log?.id]);

  const vehicle = useMemo(
    () => vehicles.find(v => v.id === log?.vehicleId),
    [vehicles, log?.vehicleId],
  );

  const computedTotal =
    liters && pricePerL && !isNaN(parseFloat(liters)) && !isNaN(parseFloat(pricePerL))
      ? parseFloat(liters) * parseFloat(pricePerL)
      : 0;

  if (!log) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.loadingWrap}>
          <Text style={{ color: T.ink3 }}>Înregistrarea nu mai există.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleRemoveExistingAttachment = (att) => {
    Alert.alert(
      'Șterge atașament',
      `Sigur ștergi "${att.fileName}"?`,
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Șterge',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFuelAttachment(log.id, att.id);
              setExistingAttachments(prev => prev.filter(a => a.id !== att.id));
            } catch (e) {
              Alert.alert('Eroare', e?.response?.data?.error || 'Nu s-a putut șterge.');
            }
          },
        },
      ],
    );
  };

  const handleSave = async () => {
    if (!liters || isNaN(parseFloat(liters))) {
      Alert.alert('Litri', 'Introdu numărul de litri.');
      return;
    }
    if (!pricePerL || isNaN(parseFloat(pricePerL))) {
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
      fd.append('date', date);
      fd.append('time', time || '');
      fd.append('liters', String(parseFloat(liters)));
      fd.append('pricePerL', String(parseFloat(pricePerL)));
      fd.append('km', String(parseInt(km)));
      fd.append('station', station.trim());
      fd.append('location', location.trim());
      fd.append('fuelType', fuelType || '');
      fd.append('fullTank', fullTank ? 'true' : 'false');
      fd.append('notes', notes.trim());
      fd.append('customFields', JSON.stringify(customFields));

      newAttachments.forEach((a, i) => {
        fd.append('attachments', {
          uri: a.uri,
          name: a.name || `file-${i}`,
          type: a.mimeType || 'application/octet-stream',
        });
      });

      await updateFuelLog(log.id, fd);
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
          <Text style={styles.headerTitle}>Editează alimentarea</Text>
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
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatCurrency(computedTotal, 'RON')}</Text>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={IS_IOS ? 'padding' : undefined}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            { paddingHorizontal: hPad, paddingVertical: SPACING.xl, gap: SPACING.lg },
            isTablet && { alignSelf: 'center', width: '100%', maxWidth: maxContentWidth },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.card, { backgroundColor: T.bgSoft }]}>
            <Text style={styles.label}>Vehicul</Text>
            <Text style={styles.vehicleReadonly}>
              {vehicle ? `${vehicle.plate} · ${vehicle.brand} ${vehicle.model}` : '—'}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Tip combustibil</Text>
            <View style={styles.gridChips}>
              {FUEL_TYPES.map(t => (
                <TouchableOpacity
                  key={t.key}
                  onPress={() => setFuelType(t.key)}
                  style={[styles.gridChip, fuelType === t.key && styles.gridChipActive]}
                >
                  <Text style={[styles.gridChipText, fuelType === t.key && styles.gridChipTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Litri</Text>
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
                <Text style={styles.label}>Preț / L</Text>
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

            <Text style={styles.label}>Kilometraj</Text>
            <View style={styles.inputWithSuffix}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                value={km}
                onChangeText={setKm}
                placeholder="Ex: 50000"
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

          <View style={styles.card}>
            <DateField
              label="Data"
              value={date}
              onChange={setDate}
            />
            <TimeField
              label="Ora (opțional)"
              value={time}
              onChange={setTime}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Benzinărie</Text>
            <TextInput
              style={styles.input}
              value={station}
              onChangeText={setStation}
              placeholder='Ex: "OMV"'
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
              placeholder='Ex: "Șos. Pipera 42"'
            />
          </View>

          <View style={styles.card}>
            <AttachmentsField
              existing={existingAttachments}
              selected={newAttachments}
              onSelectedChange={setNewAttachments}
              onRemoveExisting={handleRemoveExistingAttachment}
              maxFiles={20}
            />
          </View>

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
              <Text style={styles.bigSaveBtnText}>💾 Salvează modificările</Text>
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
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  vehicleReadonly: { fontSize: 15, fontWeight: FONTS.semibold, color: T.ink, marginVertical: 6 },
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
