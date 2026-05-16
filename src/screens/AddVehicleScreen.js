import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import useStore from '../store';
import { T, RADIUS, FONTS, SHADOW, formatDate } from '../theme';
import { Card, PrimaryButton, SectionHeader } from '../components/ui';
import { VEHICLE_CATEGORIES } from '../utils/vehicleCategories';
import { VehiclePhotoSticker } from '../components/VehiclePhotoSticker';
import DateField from '../components/DateField';
import { promptAddToDeviceCalendar } from '../utils/deviceCalendar';
import { scheduleVehicleDeadlines } from '../utils/deadlineNotifications';

// ─── Constante ────────────────────────────────────────────────────────────────
const FUEL_TYPES = ['Benzină', 'Motorină', 'Hibrid', 'Electric', 'GPL', 'GNC'];
const CURRENT_YEAR = new Date().getFullYear();

// ─── Validări ─────────────────────────────────────────────────────────────────
function isValidDateFormat(str) {
  if (!str) return true; // optional field
  return /^\d{4}-\d{2}-\d{2}$/.test(str);
}

function isPastDate(str) {
  if (!str || !isValidDateFormat(str)) return false;
  return new Date(str) < new Date();
}

// ─── Componenta ────────────────────────────────────────────────────────────────
export default function AddVehicleScreen({ navigation, route }) {
  const { addVehicle } = useStore();
  const [loading, setLoading] = useState(false);
  const [ocrPopulated, setOcrPopulated] = useState(false);

  const [form, setForm] = useState({
    plate: '',
    brand: '',
    model: '',
    year: '',
    vin: '',
    category: 'masina',
    fuel: 'Benzină',
    mileage: '',
    power: '',
    color: '',
    photoUri: null,
    itpDate: '',
    rcaDate: '',
    cascoDate: '',
    rovDate: '',
    purchaseDate: '',
    purchaseKm: '',
  });

  const pickPhoto = async () => {
    Alert.alert('Adaugă fotografie', 'Alege sursa:', [
      {
        text: 'Camera', onPress: async () => {
          const res = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 });
          if (!res.canceled) set('photoUri', res.assets[0].uri);
        },
      },
      {
        text: 'Galerie', onPress: async () => {
          const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 });
          if (!res.canceled) set('photoUri', res.assets[0].uri);
        },
      },
      { text: 'Anulează', style: 'cancel' },
    ]);
  };

  const [errors, setErrors] = useState({});

  // ── Pre-populare din OCR ──────────────────────────────────────────────────
  useEffect(() => {
    const ocr = route.params?.ocrData;
    if (ocr) {
      setForm(prev => ({
        ...prev,
        plate: ocr.plate || prev.plate,
        brand: ocr.brand || prev.brand,
        model: ocr.model || prev.model,
        year: ocr.year ? String(ocr.year) : prev.year,
        vin: ocr.vin || prev.vin,
        fuel: ocr.fuel || prev.fuel,
        power: ocr.power ? String(ocr.power) : prev.power,
        color: ocr.color || prev.color,
      }));
      setOcrPopulated(true);
    }
  }, [route.params?.ocrData]);

  // ── Setter ────────────────────────────────────────────────────────────────
  const set = (key, val) => {
    setForm(prev => ({ ...prev, [key]: val }));
    // sterge eroarea la editare
    if (errors[key]) setErrors(prev => { const e = { ...prev }; delete e[key]; return e; });
  };

  // ── Validare câmpuri obligatorii ──────────────────────────────────────────
  const isFormValid = () => {
    const plate = form.plate.trim();
    const brand = form.brand.trim();
    const model = form.model.trim();
    const year = parseInt(form.year);
    return (
      plate.length > 0 &&
      brand.length > 0 &&
      model.length > 0 &&
      !isNaN(year) &&
      year >= 1900 &&
      year <= CURRENT_YEAR + 1
    );
  };

  // ── Validare completa + colectare erori ───────────────────────────────────
  const validate = () => {
    const newErrors = {};

    if (!form.plate.trim()) newErrors.plate = 'Numărul de înmatriculare este obligatoriu';
    if (!form.brand.trim()) newErrors.brand = 'Marca este obligatorie';
    if (!form.model.trim()) newErrors.model = 'Modelul este obligatoriu';

    const year = parseInt(form.year);
    if (!form.year || isNaN(year)) {
      newErrors.year = 'Anul fabricației este obligatoriu';
    } else if (year < 1900 || year > CURRENT_YEAR + 1) {
      newErrors.year = `Anul trebuie să fie între 1900 și ${CURRENT_YEAR + 1}`;
    }

    if (form.itpDate && !isValidDateFormat(form.itpDate)) newErrors.itpDate = 'Format invalid (YYYY-MM-DD)';
    if (form.rcaDate && !isValidDateFormat(form.rcaDate)) newErrors.rcaDate = 'Format invalid (YYYY-MM-DD)';
    if (form.cascoDate && !isValidDateFormat(form.cascoDate)) newErrors.cascoDate = 'Format invalid (YYYY-MM-DD)';
    if (form.rovDate && !isValidDateFormat(form.rovDate)) newErrors.rovDate = 'Format invalid (YYYY-MM-DD)';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validate()) {
      Alert.alert('Date incomplete', 'Verifică câmpurile marcate cu roșu.');
      return;
    }

    setLoading(true);
    try {
      const saved = await addVehicle({
        plate: form.plate.trim().toUpperCase(),
        brand: form.brand.trim(),
        model: form.model.trim(),
        year: parseInt(form.year),
        vin: form.vin.trim() || undefined,
        category: form.category,
        fuel: form.fuel,
        km: parseInt(form.mileage) || 0,
        power: parseInt(form.power) || undefined,
        color: form.color.trim() || undefined,
        photoUri: form.photoUri || undefined,
        itpDate: form.itpDate || undefined,
        rcaDate: form.rcaDate || undefined,
        cascoDate: form.cascoDate || undefined,
        rovDate: form.rovDate || undefined,
        purchaseDate: form.purchaseDate || undefined,
        purchaseKm: form.purchaseKm ? parseInt(form.purchaseKm) : undefined,
      });

      // Schedule 7/3/1-day notifications for every deadline that was set.
      scheduleVehicleDeadlines({
        id: saved?.id || saved?.clientId,
        plate: form.plate.trim().toUpperCase(),
        brand: form.brand.trim(),
        itpDate: form.itpDate,
        rcaDate: form.rcaDate,
        cascoDate: form.cascoDate,
        rovDate: form.rovDate,
      }).catch(() => {});

      // Offer to add each deadline to the phone calendar.
      const plate = form.plate.trim().toUpperCase();
      const deadlines = [
        { name: 'ITP', date: form.itpDate },
        { name: 'RCA', date: form.rcaDate },
        { name: 'CASCO', date: form.cascoDate },
        { name: 'Rovinietă', date: form.rovDate },
      ].filter(d => d.date);

      if (deadlines.length > 0) {
        await promptAddToDeviceCalendar({
          title: deadlines.length === 1
            ? `Expiră ${deadlines[0].name} · ${plate}`
            : `Termene vehicul · ${plate}`,
          notes: deadlines.map(d => `${d.name}: ${d.date}`).join('\n'),
          startDate: deadlines[0].date,
          endDate: deadlines[0].date,
          allDay: true,
          alarmsMinutesBefore: [60 * 24 * 7, 60 * 24 * 3, 60 * 24],
        }, {
          message: deadlines.length === 1
            ? `Adăugăm scadența ${deadlines[0].name} în calendarul telefonului?`
            : 'Adăugăm prima scadență în calendarul telefonului? (celelalte rămân doar în aplicație)',
        });
      }

      navigation.goBack();
    } catch (e) {
      const msg = e.response?.data?.error || 'Nu s-a putut adăuga vehiculul. Încearcă din nou.';
      Alert.alert('Eroare', msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.headerBtnText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Adaugă Vehicul</Text>
        <TouchableOpacity
          style={[styles.saveBtn, !isFormValid() && styles.saveBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading || !isFormValid()}
        >
          <Text style={[styles.saveBtnText, !isFormValid() && styles.saveBtnTextDisabled]}>
            Salvează
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Sticker foto vehicul */}
        <View style={styles.stickerWrap}>
          <VehiclePhotoSticker
            photo={form.photoUri}
            category={form.category}
            size={96}
            onPress={pickPhoto}
            editable
          />
          <Text style={styles.stickerHint}>
            {form.photoUri ? 'Atinge pentru a schimba' : 'Atinge pentru a adăuga fotografie'}
          </Text>
        </View>

        {/* Banner OCR */}
        {ocrPopulated && (
          <View style={styles.ocrBanner}>
            <Text style={styles.ocrBannerText}>✓ Date citite din talon</Text>
          </View>
        )}

        {/* Scanare talon */}
        <TouchableOpacity
          style={styles.scanBtn}
          onPress={() => navigation.navigate('Camera', { returnTo: 'AddVehicle' })}
          activeOpacity={0.8}
        >
          <Text style={styles.scanIcon}>📷</Text>
          <View style={styles.scanTextCol}>
            <Text style={styles.scanTitle}>Scanează Talon cu camera</Text>
            <Text style={styles.scanSub}>Completare automată a datelor</Text>
          </View>
        </TouchableOpacity>

        {/* ── Secțiunea Date vehicul ─────────────────────────────────── */}
        <SectionHeader title="Date vehicul" />
        <Card style={styles.card}>
          {/* Număr înmatriculare */}
          <Field label="Număr înmatriculare *" error={errors.plate}>
            <TextInput
              style={[styles.input, errors.plate && styles.inputError]}
              value={form.plate}
              onChangeText={v => set('plate', v.toUpperCase())}
              placeholder="B 123 ABC"
              placeholderTextColor={T.ink4}
              autoCapitalize="characters"
            />
          </Field>

          {/* Marcă + Model */}
          <View style={styles.row}>
            <View style={styles.half}>
              <Field label="Marcă *" error={errors.brand}>
                <TextInput
                  style={[styles.input, errors.brand && styles.inputError]}
                  value={form.brand}
                  onChangeText={v => set('brand', v)}
                  placeholder="Dacia"
                  placeholderTextColor={T.ink4}
                />
              </Field>
            </View>
            <View style={styles.half}>
              <Field label="Model *" error={errors.model}>
                <TextInput
                  style={[styles.input, errors.model && styles.inputError]}
                  value={form.model}
                  onChangeText={v => set('model', v)}
                  placeholder="Logan"
                  placeholderTextColor={T.ink4}
                />
              </Field>
            </View>
          </View>

          {/* An fabricație */}
          <Field label="An fabricație *" error={errors.year}>
            <TextInput
              style={[styles.input, errors.year && styles.inputError]}
              value={form.year}
              onChangeText={v => set('year', v)}
              placeholder="2020"
              keyboardType="number-pad"
              maxLength={4}
              placeholderTextColor={T.ink4}
            />
          </Field>

          {/* VIN */}
          <Field label="VIN (17 caractere)">
            <TextInput
              style={styles.input}
              value={form.vin}
              onChangeText={v => set('vin', v.toUpperCase())}
              placeholder="VF1AAAAAAA0000000"
              placeholderTextColor={T.ink4}
              autoCapitalize="characters"
              maxLength={17}
            />
          </Field>

          {/* Tip vehicul – grid categorie */}
          <Text style={styles.label}>Tip vehicul</Text>
          <View style={styles.categoryGrid}>
            {VEHICLE_CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat.key}
                style={[styles.categoryBtn, form.category === cat.key && styles.categoryBtnActive]}
                onPress={() => set('category', cat.key)}
                activeOpacity={0.75}
              >
                <Text style={styles.categoryIcon}>{cat.icon}</Text>
                <Text style={[styles.categoryText, form.category === cat.key && styles.categoryTextActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Combustibil – grid 6 butoane */}
          <Text style={styles.label}>Combustibil</Text>
          <View style={styles.fuelGrid}>
            {FUEL_TYPES.map(f => (
              <TouchableOpacity
                key={f}
                style={[styles.fuelBtn, form.fuel === f && styles.fuelBtnActive]}
                onPress={() => set('fuel', f)}
                activeOpacity={0.75}
              >
                <Text style={[styles.fuelBtnText, form.fuel === f && styles.fuelBtnTextActive]}>
                  {f}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Kilometraj + Putere */}
          <View style={styles.row}>
            <View style={styles.half}>
              <Field label="Kilometraj (km)">
                <TextInput
                  style={styles.input}
                  value={form.mileage}
                  onChangeText={v => set('mileage', v)}
                  placeholder="0"
                  keyboardType="number-pad"
                  placeholderTextColor={T.ink4}
                />
              </Field>
            </View>
            <View style={styles.half}>
              <Field label="Putere (CP)">
                <TextInput
                  style={styles.input}
                  value={form.power}
                  onChangeText={v => set('power', v)}
                  placeholder="90"
                  keyboardType="number-pad"
                  placeholderTextColor={T.ink4}
                />
              </Field>
            </View>
          </View>

          {/* Culoare */}
          <Field label="Culoare">
            <TextInput
              style={styles.input}
              value={form.color}
              onChangeText={v => set('color', v)}
              placeholder="Albastru, Negru, Alb..."
              placeholderTextColor={T.ink4}
            />
          </Field>
        </Card>

        {/* ── Secțiunea Achiziție ──────────────────────────────────── */}
        <SectionHeader title="Date achiziție" />
        <Card style={styles.card}>
          <DateField
            label="Data achiziției (opțional)"
            value={form.purchaseDate}
            onChange={v => set('purchaseDate', v)}
            maxDate={new Date()}
            placeholder="Atinge pentru a alege data"
          />
          <Field label="Kilometraj la achiziție (opțional)">
            <TextInput
              style={styles.input}
              value={form.purchaseKm}
              onChangeText={v => set('purchaseKm', v)}
              placeholder="ex: 0 pentru mașină nouă, sau km la cumpărare"
              placeholderTextColor={T.ink4}
              keyboardType="number-pad"
            />
          </Field>
          <Text style={styles.helperText}>
            Aceste date sunt folosite pentru graficul de evoluție km și costuri.
          </Text>
        </Card>

        {/* ── Secțiunea Termene valabilitate ────────────────────────── */}
        <SectionHeader title="Termene valabilitate" />
        <Card style={styles.card}>
          {[
            { key: 'itpDate', label: 'Data expirare ITP' },
            { key: 'rcaDate', label: 'Data expirare RCA' },
            { key: 'cascoDate', label: 'Data expirare CASCO' },
            { key: 'rovDate', label: 'Data expirare Rovinieta' },
          ].map(({ key, label }) => (
            <DateField
              key={key}
              label={label}
              value={form[key]}
              onChange={v => set(key, v)}
              showRelative
              error={errors[key]}
            />
          ))}
        </Card>

        {/* Submit */}
        <PrimaryButton
          title="Adaugă Vehicul"
          onPress={handleSubmit}
          disabled={loading || !isFormValid()}
          style={styles.submitBtn}
        />

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Componenta câmp cu label + eroare ───────────────────────────────────────
function Field({ label, error, children }) {
  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>{label}</Text>
      {children}
      {error ? <Text style={fieldStyles.error}>{error}</Text> : null}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: FONTS.medium, color: T.ink2, marginBottom: 6 },
  error: { fontSize: 11, color: T.danger, marginTop: 4 },
});

// ─── Stiluri ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },

  // Header custom
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: T.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
    ...SHADOW.sm,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: T.line2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnText: { fontSize: 16, color: T.ink2 },
  headerTitle: { fontSize: 17, fontWeight: FONTS.semibold, color: T.ink },
  saveBtn: {
    backgroundColor: T.brand,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
  },
  saveBtnDisabled: { backgroundColor: T.line },
  saveBtnText: { fontSize: 14, fontWeight: FONTS.semibold, color: '#fff' },
  saveBtnTextDisabled: { color: T.ink4 },

  // OCR Banner
  ocrBanner: {
    backgroundColor: T.successTint,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#b7dfc9',
  },
  ocrBannerText: { fontSize: 14, fontWeight: FONTS.medium, color: T.success },

  // Scan button
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.brandTint,
    borderRadius: RADIUS.md,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: T.brand,
    borderStyle: 'dashed',
    gap: 12,
  },
  scanIcon: { fontSize: 26 },
  scanTextCol: { flex: 1 },
  scanTitle: { fontSize: 15, fontWeight: FONTS.semibold, color: T.brand, marginBottom: 2 },
  scanSub: { fontSize: 12, color: T.brandDark },

  // Card & layout
  card: { padding: 16, marginBottom: 16 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  label: { fontSize: 13, fontWeight: FONTS.medium, color: T.ink2, marginBottom: 8 },

  // Input
  input: {
    backgroundColor: T.line2,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: T.ink,
    borderWidth: 1,
    borderColor: T.line,
  },
  inputError: { borderColor: T.danger, backgroundColor: T.dangerTint },
  inputWarn: { borderColor: T.warn, backgroundColor: T.warnTint },
  warnText: { fontSize: 11, color: T.warn, marginTop: 4 },
  helperText: { fontSize: 12, color: T.ink3, marginTop: 4, fontStyle: 'italic' },

  // Category grid
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  categoryBtn: {
    width: '22%',
    aspectRatio: 1,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: T.line,
    backgroundColor: T.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  categoryBtnActive: { backgroundColor: T.brandTint, borderColor: T.brand },
  categoryIcon: { fontSize: 22 },
  categoryText: { fontSize: 9, color: T.ink3, fontWeight: FONTS.medium, textAlign: 'center' },
  categoryTextActive: { color: T.brand, fontWeight: FONTS.semibold },

  // Fuel grid
  fuelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  fuelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: T.line,
    backgroundColor: T.card,
  },
  fuelBtnActive: {
    backgroundColor: T.brand,
    borderColor: T.brand,
  },
  fuelBtnText: { fontSize: 13, color: T.ink2, fontWeight: FONTS.medium },
  fuelBtnTextActive: { color: '#fff', fontWeight: FONTS.semibold },

  // Submit
  stickerWrap: { alignItems: 'center', paddingVertical: 20, gap: 10 },
  stickerHint: { fontSize: 12, color: T.ink3, fontWeight: FONTS.regular },
  submitBtn: { marginTop: 4 },
  bottomPad: { height: 32 },
});
