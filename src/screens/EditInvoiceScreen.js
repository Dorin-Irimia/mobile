import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
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
  useResponsive,
  HIT_SLOP,
  HIT_SLOP_LG,
  TOUCH_TARGET,
  IS_IOS,
} from '../theme';
import AttachmentsField from '../components/AttachmentsField';
import CustomFieldsEditor from '../components/CustomFieldsEditor';
import LocationField from '../components/LocationField';

const CATEGORIES = [
  { key: 'service', label: '🔧 Service' },
  { key: 'combustibil', label: '⛽ Combustibil' },
  { key: 'asigurare', label: '🛡️ Asigurare' },
  { key: 'anvelope', label: '🔄 Anvelope' },
  { key: 'piese', label: '🧰 Piese' },
  { key: 'altele', label: '🚗 Altele' },
];
const CURRENCIES = ['RON', 'EUR', 'USD'];

export default function EditInvoiceScreen({ navigation, route }) {
  const { invoiceId } = route.params || {};
  const vehicles = useStore(s => s.vehicles);
  const invoices = useStore(s => s.invoices);
  const updateInvoice = useStore(s => s.updateInvoice);
  const deleteInvoiceAttachment = useStore(s => s.deleteInvoiceAttachment);
  const { isTablet, hPad, maxContentWidth } = useResponsive();

  const invoice = invoices.find(i => i.id === invoiceId);

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('RON');
  const [category, setCategory] = useState('service');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [km, setKm] = useState('');
  const [merchant, setMerchant] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [customFields, setCustomFields] = useState({});
  const [existingAttachments, setExistingAttachments] = useState([]);
  const [newAttachments, setNewAttachments] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (invoice) {
      setTitle(invoice.title || '');
      setAmount(String(invoice.amount || ''));
      setCurrency(invoice.currency || 'RON');
      setCategory(invoice.category || 'altele');
      setDate(invoice.date || '');
      setTime(invoice.time || '');
      setKm(invoice.km ? String(invoice.km) : '');
      setMerchant(invoice.merchant || '');
      setLocation(invoice.location || '');
      setNotes(invoice.notes || '');
      setCustomFields(invoice.customFields || {});
      setExistingAttachments(invoice.attachments || []);
    }
  }, [invoice?.id]);

  const vehicle = useMemo(
    () => vehicles.find(v => v.id === invoice?.vehicleId),
    [vehicles, invoice?.vehicleId],
  );

  if (!invoice) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.loadingWrap}>
          <Text style={{ color: T.ink3 }}>Cheltuiala nu mai există.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleRemoveExistingAttachment = (att) => {
    Alert.alert(
      'Șterge atașament',
      `Sigur ștergi "${att.fileName}"? Această acțiune e definitivă.`,
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Șterge',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteInvoiceAttachment(invoice.id, att.id);
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
    if (!title.trim()) {
      Alert.alert('Titlu', 'Adaugă un titlu.');
      return;
    }
    if (!amount || isNaN(parseFloat(amount))) {
      Alert.alert('Sumă', 'Introdu o sumă validă.');
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('title', title.trim());
      fd.append('amount', String(parseFloat(amount)));
      fd.append('currency', currency);
      fd.append('category', category);
      fd.append('date', date);
      fd.append('time', time || '');
      fd.append('km', km ? String(parseInt(km)) : '');
      fd.append('merchant', merchant.trim());
      fd.append('location', location.trim());
      fd.append('notes', notes.trim());
      fd.append('customFields', JSON.stringify(customFields));

      newAttachments.forEach((a, i) => {
        fd.append('attachments', {
          uri: a.uri,
          name: a.name || `file-${i}`,
          type: a.mimeType || 'application/octet-stream',
        });
      });

      await updateInvoice(invoice.id, fd);
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
          <Text style={styles.headerTitle}>Editează cheltuiala</Text>
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
          {/* Vehicul readonly */}
          <View style={[styles.card, { backgroundColor: T.bgSoft }]}>
            <Text style={styles.label}>Vehicul</Text>
            <Text style={styles.vehicleReadonly}>
              {vehicle ? `${vehicle.plate} · ${vehicle.brand} ${vehicle.model}` : '—'}
            </Text>
            <Text style={styles.hint}>Vehiculul nu poate fi schimbat. Pentru altul, creează o cheltuială nouă.</Text>
          </View>

          {/* Categorie */}
          <View style={styles.card}>
            <Text style={styles.label}>Categorie</Text>
            <View style={styles.gridChips}>
              {CATEGORIES.map(c => (
                <TouchableOpacity
                  key={c.key}
                  onPress={() => setCategory(c.key)}
                  style={[styles.gridChip, category === c.key && styles.gridChipActive]}
                >
                  <Text style={[styles.gridChipText, category === c.key && styles.gridChipTextActive]}>
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Sumă + titlu */}
          <View style={styles.card}>
            <Text style={styles.label}>Titlu</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder='Ex: "Anvelope iarnă"'
              placeholderTextColor={T.ink4}
            />

            <View style={styles.row2}>
              <View style={{ flex: 1.5 }}>
                <Text style={styles.label}>Sumă</Text>
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

          {/* Dată, oră, km */}
          <View style={styles.card}>
            <View style={styles.row2}>
              <View style={{ flex: 1.4 }}>
                <Text style={styles.label}>Data</Text>
                <TextInput
                  style={styles.input}
                  value={date}
                  onChangeText={setDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={T.ink4}
                  keyboardType="numbers-and-punctuation"
                />
                <Text style={styles.hint}>{formatDate(date)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Ora</Text>
                <TextInput
                  style={styles.input}
                  value={time}
                  onChangeText={setTime}
                  placeholder="HH:mm"
                  placeholderTextColor={T.ink4}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>

            <Text style={styles.label}>Kilometraj la momentul cheltuielii</Text>
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
          </View>

          {/* Magazin + locație */}
          <View style={styles.card}>
            <Text style={styles.label}>Magazin / atelier / firmă</Text>
            <TextInput
              style={styles.input}
              value={merchant}
              onChangeText={setMerchant}
              placeholder='Ex: "Service Auto Popescu"'
              placeholderTextColor={T.ink4}
            />
            <LocationField
              value={location}
              onChange={setLocation}
              placeholder='Ex: "Calea Vitan 12, București"'
            />
          </View>

          {/* Atașamente */}
          <View style={styles.card}>
            <AttachmentsField
              existing={existingAttachments}
              selected={newAttachments}
              onSelectedChange={setNewAttachments}
              onRemoveExisting={handleRemoveExistingAttachment}
              maxFiles={20}
            />
          </View>

          {/* Note */}
          <View style={styles.card}>
            <Text style={styles.label}>Notițe</Text>
            <TextInput
              style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Detalii suplimentare"
              placeholderTextColor={T.ink4}
              multiline
            />
          </View>

          {/* Custom fields */}
          <View style={styles.card}>
            <CustomFieldsEditor value={customFields} onChange={setCustomFields} />
          </View>

          <TouchableOpacity
            style={[styles.bigSaveBtn, (loading || !title || !amount) && { opacity: 0.55 }]}
            onPress={handleSave}
            disabled={loading || !title || !amount}
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
    paddingBottom: SPACING.md,
    minHeight: TOUCH_TARGET,
  },
  backBtn: { flex: 1 },
  backBtnText: { color: '#fff', fontSize: 14, fontWeight: FONTS.medium },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: FONTS.bold },
  saveBtnHead: { flex: 1, alignItems: 'flex-end' },
  saveBtnHeadText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 14 },
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
  input2: { flexDirection: 'row', gap: 6, marginBottom: SPACING.sm },
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
