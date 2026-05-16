import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, KeyboardAvoidingView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useStore from '../store';
import { T, RADIUS, FONTS, SHADOW, SPACING, useResponsive, HIT_SLOP, HIT_SLOP_LG, TOUCH_TARGET, IS_IOS } from '../theme';

const TYPES = [
  { key: 'apartament', label: '🏢 Apartament ' },
  { key: 'casa',       label: '🏠 Casă ' },
  { key: 'studio',     label: '🛏️ Studio ' },
  { key: 'birou',      label: '🏢 Birou ' },
];

export default function AddHouseholdScreen({ navigation, route }) {
  const households = useStore(s => s.households);
  const addHousehold = useStore(s => s.addHousehold);
  const updateHousehold = useStore(s => s.updateHousehold);
  const deleteHousehold = useStore(s => s.deleteHousehold);
  const setSelectedHousehold = useStore(s => s.setSelectedHousehold);
  const { isTablet, hPad, maxContentWidth } = useResponsive();

  const householdId = route?.params?.householdId;
  const isEdit = !!householdId;
  const existing = isEdit ? households.find(h => h.id === householdId) : null;

  const [name, setName] = useState(existing?.name || '');
  const [address, setAddress] = useState(existing?.address || '');
  const [type, setType] = useState(existing?.type || 'apartament');
  const [rooms, setRooms] = useState(existing?.rooms ? String(existing.rooms) : '');
  const [surface, setSurface] = useState(existing?.surface ? String(existing.surface) : '');
  const [monthlyBudget, setMonthlyBudget] = useState(existing?.monthlyBudget ? String(existing.monthlyBudget) : '');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return Alert.alert('Nume', 'Adaugă un nume.');
    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        address: address.trim() || null,
        type,
        rooms: rooms ? parseInt(rooms) : null,
        surface: surface ? parseFloat(surface) : null,
        monthlyBudget: monthlyBudget ? parseFloat(monthlyBudget) : null,
      };
      let saved;
      if (isEdit) {
        saved = await updateHousehold(householdId, payload);
      } else {
        saved = await addHousehold(payload);
        setSelectedHousehold(saved.id);
      }
      navigation.goBack();
    } catch (e) {
      Alert.alert('Eroare', e?.response?.data?.error || 'Nu s-a putut salva.');
    } finally { setLoading(false); }
  };

  const handleDelete = () => {
    Alert.alert(
      'Șterge locuința',
      `Sigur ștergi "${existing?.name}"? Toate cheltuielile, veniturile și evenimentele asociate vor fi pierdute.`,
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Șterge', style: 'destructive',
          onPress: async () => {
            try {
              await deleteHousehold(householdId);
              navigation.goBack();
            } catch (e) {
              Alert.alert('Eroare', 'Nu s-a putut șterge.');
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.header} edges={['top']}>
        <View style={[styles.headerContent, { paddingHorizontal: hPad }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={HIT_SLOP_LG} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Anulează</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEdit ? 'Editează locuință' : 'Locuință nouă'}</Text>
          <TouchableOpacity onPress={handleSave} disabled={loading || !name} style={[styles.saveHead, (loading || !name) && { opacity: 0.5 }]} hitSlop={HIT_SLOP}>
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
            <Text style={styles.label}>Nume *</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder='Ex: "Casa principală", "Apartament București"' placeholderTextColor={T.ink4} />

            <Text style={styles.label}>Adresă</Text>
            <TextInput style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]} value={address} onChangeText={setAddress} placeholder="Adresa completă" placeholderTextColor={T.ink4} multiline />
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Tip locuință</Text>
            <View style={styles.typeGrid}>
              {TYPES.map(t => (
                <TouchableOpacity key={t.key} onPress={() => setType(t.key)} style={[styles.typeTile, type === t.key && styles.typeTileActive]}>
                  <Text style={[styles.typeText, type === t.key && styles.typeTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Camere</Text>
                <TextInput style={styles.input} value={rooms} onChangeText={setRooms} placeholder="ex: 3" placeholderTextColor={T.ink4} keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Suprafață (m²)</Text>
                <TextInput style={styles.input} value={surface} onChangeText={setSurface} placeholder="ex: 65" placeholderTextColor={T.ink4} keyboardType="decimal-pad" />
              </View>
            </View>

            <Text style={styles.label}>Buget lunar (opțional, RON)</Text>
            <TextInput style={styles.input} value={monthlyBudget} onChangeText={setMonthlyBudget} placeholder='ex: "3000" pt cheltuieli lunare' placeholderTextColor={T.ink4} keyboardType="decimal-pad" />
          </View>

          <TouchableOpacity style={[styles.bigSave, (loading || !name) && { opacity: 0.6 }]} onPress={handleSave} disabled={loading || !name} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.bigSaveText}>💾 {isEdit ? 'Salvează modificările' : 'Adaugă locuință'}</Text>}
          </TouchableOpacity>

          {isEdit && existing?.isOwner && (
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.85}>
              <Text style={styles.deleteBtnText}>🗑️ Șterge locuința</Text>
            </TouchableOpacity>
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  header: { backgroundColor: T.brand },
  headerContent: { flexDirection: 'row', alignItems: 'center', paddingTop: SPACING.sm, paddingBottom: SPACING.md, minHeight: TOUCH_TARGET },
  backBtn: { flex: 1 },
  backBtnText: { color: '#fff', fontSize: 14, fontWeight: FONTS.medium },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: FONTS.bold },
  saveHead: { flex: 1, alignItems: 'flex-end' },
  saveHeadText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 14 },
  card: { backgroundColor: T.card, borderRadius: RADIUS.lg, padding: SPACING.lg, ...SHADOW.sm },
  label: { fontSize: 12, fontWeight: FONTS.bold, color: T.ink2, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: SPACING.sm, marginTop: SPACING.sm },
  input: { borderWidth: 1.5, borderColor: T.line, backgroundColor: T.bgSoft, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 12, fontSize: 15, color: T.ink, minHeight: 46, marginBottom: SPACING.sm },
  row2: { flexDirection: 'row', gap: SPACING.md },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  typeTile: { paddingHorizontal: 14, paddingVertical: 10, backgroundColor: T.bgSoft, borderWidth: 1.5, borderColor: T.line, borderRadius: RADIUS.md },
  typeTileActive: { backgroundColor: T.brand, borderColor: T.brand },
  typeText: { fontSize: 13, fontWeight: FONTS.semibold, color: T.ink2 },
  typeTextActive: { color: '#fff' },
  bigSave: { height: 54, borderRadius: RADIUS.lg, backgroundColor: T.brand, alignItems: 'center', justifyContent: 'center', ...SHADOW.md },
  bigSaveText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 16 },
  deleteBtn: { marginTop: SPACING.md, paddingVertical: SPACING.md, backgroundColor: T.dangerTint, borderRadius: RADIUS.lg, borderWidth: 1.5, borderColor: T.danger, alignItems: 'center' },
  deleteBtnText: { color: T.danger, fontWeight: FONTS.bold, fontSize: 15 },
});
