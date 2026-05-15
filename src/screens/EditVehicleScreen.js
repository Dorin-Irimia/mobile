import React, { useState, useEffect, useRef } from 'react';
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
import { T, RADIUS, FONTS, SHADOW } from '../theme';
import { Card, PrimaryButton, SectionHeader, LoadingView } from '../components/ui';
import { VEHICLE_CATEGORIES } from '../utils/vehicleCategories';
import { VehiclePhotoSticker } from '../components/VehiclePhotoSticker';

// ─── Constante ────────────────────────────────────────────────────────────────
const FUEL_TYPES = ['Benzină', 'Motorină', 'Hibrid', 'Electric', 'GPL', 'GNC'];
const CURRENT_YEAR = new Date().getFullYear();

// ─── Validări ─────────────────────────────────────────────────────────────────
function isValidDateFormat(str) {
  if (!str) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(str);
}

function isPastDate(str) {
  if (!str || !isValidDateFormat(str)) return false;
  return new Date(str) < new Date();
}

// ─── Componenta ────────────────────────────────────────────────────────────────
export default function EditVehicleScreen({ navigation, route }) {
  const { vehicleId, focusField } = route.params;
  const { vehicles, updateVehicle, deleteVehicle } = useStore();

  const vehicle = vehicles.find(v => v.id === vehicleId);

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

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
  });

  const pickPhoto = async () => {
    Alert.alert('Schimbă fotografia', 'Alege sursa:', [
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

  // Refs pentru focus programatic (ex: din VehicleDetailScreen)
  const fieldRefs = {
    itpDate: useRef(null),
    rcaDate: useRef(null),
    cascoDate: useRef(null),
    rovDate: useRef(null),
  };

  // ── Pre-populare din store ────────────────────────────────────────────────
  useEffect(() => {
    if (vehicle) {
      setForm({
        plate: vehicle.plate || '',
        brand: vehicle.brand || '',
        model: vehicle.model || '',
        year: vehicle.year ? String(vehicle.year) : '',
        vin: vehicle.vin || '',
        category: vehicle.category || 'masina',
        fuel: vehicle.fuel || 'Benzină',
        mileage: vehicle.km != null ? String(vehicle.km) : '',
        power: vehicle.power != null ? String(vehicle.power) : '',
        color: vehicle.color || '',
        photoUri: null,
        itpDate: vehicle.itpDate || '',
        rcaDate: vehicle.rcaDate || '',
        cascoDate: vehicle.cascoDate || '',
        rovDate: vehicle.rovDate || '',
      });
    }
  }, [vehicle]);

  // Focus pe câmpul solicitat (ex: edit dată din VehicleDetail)
  useEffect(() => {
    if (focusField && fieldRefs[focusField]?.current) {
      const timer = setTimeout(() => {
        fieldRefs[focusField].current?.focus();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [focusField]);

  // ── Setter ────────────────────────────────────────────────────────────────
  const set = (key, val) => {
    setForm(prev => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors(prev => { const e = { ...prev }; delete e[key]; return e; });
  };

  // ── Validare ──────────────────────────────────────────────────────────────
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

  // ── Submit actualizare ────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validate()) {
      Alert.alert('Date incomplete', 'Verifică câmpurile marcate cu roșu.');
      return;
    }

    setLoading(true);
    try {
      await updateVehicle(vehicleId, {
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
      });
      navigation.goBack();
    } catch (e) {
      const msg = e.response?.data?.error || 'Nu s-a putut actualiza vehiculul. Încearcă din nou.';
      Alert.alert('Eroare', msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Ştergere vehicul ──────────────────────────────────────────────────────
  const handleDelete = () => {
    Alert.alert(
      'Șterge vehicul',
      `Ești sigur că vrei să ștergi vehiculul ${vehicle?.plate || ''}? Toate datele asociate vor fi pierdute.`,
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Șterge definitiv',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await deleteVehicle(vehicleId);
              navigation.goBack();
            } catch {
              Alert.alert('Eroare', 'Nu s-a putut șterge vehiculul.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // ── Guards ────────────────────────────────────────────────────────────────
  if (!vehicle) return <LoadingView />;
  if (loading) return <LoadingView />;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.headerBtnText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Editează Vehicul</Text>
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
            photo={form.photoUri || vehicle?.photo}
            category={form.category}
            size={96}
            onPress={pickPhoto}
            editable
          />
          <Text style={styles.stickerHint}>Atinge pentru a schimba fotografia</Text>
        </View>

        {/* Banner info */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>ℹ️ Modificările se salvează imediat după apăsarea butonului Salvează</Text>
        </View>

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

        {/* ── Secțiunea Termene valabilitate ────────────────────────── */}
        <SectionHeader title="Termene valabilitate" />
        <Card style={styles.card}>
          {[
            { key: 'itpDate', label: 'Data expirare ITP' },
            { key: 'rcaDate', label: 'Data expirare RCA' },
            { key: 'cascoDate', label: 'Data expirare CASCO' },
            { key: 'rovDate', label: 'Data expirare Rovinieta' },
          ].map(({ key, label }) => {
            const past = isPastDate(form[key]);
            const errMsg = errors[key];
            return (
              <Field key={key} label={label} error={errMsg}>
                <TextInput
                  ref={fieldRefs[key] || null}
                  style={[
                    styles.input,
                    past && styles.inputWarn,
                    errMsg && styles.inputError,
                  ]}
                  value={form[key]}
                  onChangeText={v => set(key, v)}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={T.ink4}
                  keyboardType="number-pad"
                  maxLength={10}
                />
                {past && !errMsg && (
                  <Text style={styles.warnText}>⚠️ Data este în trecut</Text>
                )}
              </Field>
            );
          })}
        </Card>

        {/* Submit salvare */}
        <PrimaryButton
          title="Salvează modificările"
          onPress={handleSubmit}
          disabled={loading || !isFormValid()}
          style={styles.submitBtn}
        />

        {/* Buton ştergere vehicul */}
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={handleDelete}
          activeOpacity={0.8}
        >
          <Text style={styles.deleteBtnText}>🗑️  Șterge vehicul</Text>
        </TouchableOpacity>

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

  stickerWrap: { alignItems: 'center', paddingVertical: 20, gap: 10 },
  stickerHint: { fontSize: 12, color: T.ink3 },
  // Info banner
  infoBanner: {
    backgroundColor: T.brandTint2,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: T.brand,
  },
  infoBannerText: { fontSize: 13, color: T.brandDark, fontWeight: FONTS.regular, lineHeight: 18 },

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

  // Butoane submit
  submitBtn: { marginTop: 4, marginBottom: 12 },
  deleteBtn: {
    backgroundColor: T.dangerTint,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: T.danger,
  },
  deleteBtnText: {
    fontSize: 15,
    fontWeight: FONTS.semibold,
    color: T.danger,
  },

  bottomPad: { height: 32 },
});
