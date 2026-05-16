import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  StyleSheet,
  RefreshControl,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import useStore from '../store';
import {
  T,
  FONTS,
  RADIUS,
  SHADOW,
  SPACING,
  formatDate,
  daysUntil,
  useResponsive,
  useSafeBottomPadding,
  HIT_SLOP,
  TOUCH_TARGET,
  IS_IOS,
} from '../theme';
import { Card, Pill, PrimaryButton, EmptyState, LoadingView, StatusBadge } from '../components/ui';
import DateField from '../components/DateField';

const CATEGORIES = ['Toate', 'Talon', 'RCA', 'CASCO', 'ITP', 'Factură', 'Garanție'];

const TYPE_ICONS = {
  talon: '📄',
  rca: '🛡',
  casco: '🔰',
  itp: '🔧',
  factura: '🧾',
  factura2: '🧾',
  garantie: '📋',
};

function getIcon(type) {
  if (!type) return '📋';
  const key = type.toLowerCase()
    .replace(/ă/g, 'a')
    .replace(/î/g, 'i')
    .replace(/â/g, 'a')
    .replace(/ș/g, 's')
    .replace(/ț/g, 't')
    .replace(/\s+/g, '');
  return TYPE_ICONS[key] || '📋';
}

function normalizeStr(str) {
  if (!str) return '';
  return str.toLowerCase()
    .replace(/ă/g, 'a')
    .replace(/î/g, 'i')
    .replace(/â/g, 'a')
    .replace(/ș/g, 's')
    .replace(/ț/g, 't')
    .trim();
}

const DOC_TYPES = ['Talon', 'RCA', 'CASCO', 'ITP', 'Factură', 'Garanție', 'Altele'];

export default function DocumentsScreen({ navigation }) {
  const { documents, vehicles, fetchDocuments, addDocument, deleteDocument } = useStore();
  const { isTablet, hPad, maxContentWidth } = useResponsive();
  const safeBottom = useSafeBottomPadding(28);
  const [activeCategory, setActiveCategory] = useState('Toate');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailDoc, setDetailDoc] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('Talon');
  const [formVehicleId, setFormVehicleId] = useState('');
  const [formExpiry, setFormExpiry] = useState('');
  const [formImage, setFormImage] = useState(null);

  useEffect(() => {
    fetchDocuments().finally(() => setLoading(false));
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDocuments();
    setRefreshing(false);
  }, []);

  const filteredDocs = activeCategory === 'Toate'
    ? documents
    : documents.filter(d => normalizeStr(d.type) === normalizeStr(activeCategory));

  const vehicleName = (id) => {
    const v = vehicles.find(veh => veh.id === id);
    return v ? `${v.make} ${v.model} · ${v.plate}` : '—';
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permisiune necesară', 'Acordă acces la bibliotecă pentru a atașa fișiere.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.length) {
      setFormImage(result.assets[0]);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormType('Talon');
    setFormVehicleId('');
    setFormExpiry('');
    setFormImage(null);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      Alert.alert('Eroare', 'Introduceți numele documentului.');
      return;
    }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('name', formName.trim());
      formData.append('type', formType);
      if (formVehicleId) formData.append('vehicleId', formVehicleId);
      if (formExpiry) formData.append('expiryDate', formExpiry);
      if (formImage) {
        const uri = formImage.uri;
        const filename = uri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename);
        const mimeType = match ? `image/${match[1].toLowerCase()}` : 'image/jpeg';
        formData.append('image', { uri, name: filename, type: mimeType });
      }
      await addDocument(formData);
      setShowAdd(false);
      resetForm();
    } catch {
      Alert.alert('Eroare', 'Nu s-a putut salva documentul.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id) => {
    Alert.alert('Ștergere document', 'Ești sigur că vrei să ștergi acest document?', [
      { text: 'Anulează', style: 'cancel' },
      {
        text: 'Șterge',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDocument(id);
          } finally {
            setDetailDoc(null);
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }) => {
    const days = item.expiryDate ? daysUntil(item.expiryDate) : null;
    return (
      <TouchableOpacity
        onPress={() => setDetailDoc(item)}
        activeOpacity={0.8}
        style={[styles.itemWrap, isTablet && { flex: 1 }]}
      >
        <Card style={styles.itemCard}>
          <View style={styles.itemRow}>
            <Text style={styles.itemIcon}>{getIcon(item.type)}</Text>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
              <Pill style={styles.itemPill}>{item.type || 'Altele'}</Pill>
              {item.vehicleId ? (
                <Text style={styles.itemVehicle} numberOfLines={1}>{vehicleName(item.vehicleId)}</Text>
              ) : null}
            </View>
            <View style={styles.itemRight}>
              {days !== null && <StatusBadge days={days} />}
              {item.isSigned && (
                <View style={styles.signedBadge}>
                  <Text style={styles.signedText}>✓ Semnat</Text>
                </View>
              )}
            </View>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  if (loading) return <LoadingView />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[styles.header, { paddingHorizontal: hPad }]}>
        <Text style={styles.headerTitle}>Documentele Mele</Text>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.navigate('Search')}
          hitSlop={HIT_SLOP}
        >
          <Text style={styles.headerBtnText}>🔍</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={[styles.filterContent, { paddingHorizontal: hPad - 4 }]}
      >
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat}
            onPress={() => setActiveCategory(cat)}
            style={[styles.filterPill, activeCategory === cat && styles.filterPillActive]}
          >
            <Text style={[styles.filterText, activeCategory === cat && styles.filterTextActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filteredDocs}
        keyExtractor={item => String(item.id)}
        renderItem={renderItem}
        numColumns={isTablet ? 2 : 1}
        key={isTablet ? 'two-col' : 'one-col'}
        columnWrapperStyle={isTablet ? { gap: SPACING.md, paddingHorizontal: hPad } : undefined}
        contentContainerStyle={[
          styles.list,
          { paddingHorizontal: isTablet ? 0 : hPad - 4, paddingBottom: safeBottom + 80 },
          isTablet && { alignSelf: 'center', width: '100%', maxWidth: maxContentWidth },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.brand} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="📂"
            title="Niciun document"
            subtitle="Adaugă primul tău document cu butonul +"
          />
        }
      />

      <TouchableOpacity
        style={[styles.fab, { bottom: safeBottom, right: hPad }]}
        onPress={() => setShowAdd(true)}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal
        visible={!!detailDoc}
        animationType="slide"
        transparent
        onRequestClose={() => setDetailDoc(null)}
      >
        <View style={styles.overlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle} numberOfLines={2}>{detailDoc?.name}</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Tip</Text>
              <Text style={styles.infoValue}>{detailDoc?.type || '—'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Vehicul</Text>
              <Text style={styles.infoValue}>{detailDoc?.vehicleId ? vehicleName(detailDoc.vehicleId) : '—'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Adăugat</Text>
              <Text style={styles.infoValue}>{formatDate(detailDoc?.createdAt)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Expiră</Text>
              <Text style={styles.infoValue}>{formatDate(detailDoc?.expiryDate)}</Text>
            </View>
            <View style={styles.modalActions}>
              {!detailDoc?.isSigned && (
                <PrimaryButton
                  title="✍️ Semnează"
                  onPress={() => {
                    const id = detailDoc.id;
                    setDetailDoc(null);
                    navigation.navigate('Signature', { documentId: id });
                  }}
                />
              )}
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(detailDoc?.id)}>
                <Text style={styles.deleteBtnText}>🗑️ Șterge</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setDetailDoc(null)}>
                <Text style={styles.closeBtnText}>✕ Închide</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showAdd}
        animationType="slide"
        transparent
        onRequestClose={() => { setShowAdd(false); resetForm(); }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.overlay}
        >
          <ScrollView
            style={styles.modalSheetScroll}
            contentContainerStyle={styles.modalSheetContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.modalTitle}>Adaugă Document</Text>

            <Text style={styles.fieldLabel}>Nume document</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: RCA 2025"
              placeholderTextColor={T.ink4}
              value={formName}
              onChangeText={setFormName}
            />

            <Text style={styles.fieldLabel}>Tip</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {DOC_TYPES.map(t => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setFormType(t)}
                  style={[styles.chip, formType === t && styles.chipActive]}
                >
                  <Text style={[styles.chipText, formType === t && styles.chipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>Vehicul (opțional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              <TouchableOpacity
                onPress={() => setFormVehicleId('')}
                style={[styles.chip, formVehicleId === '' && styles.chipActive]}
              >
                <Text style={[styles.chipText, formVehicleId === '' && styles.chipTextActive]}>Fără vehicul</Text>
              </TouchableOpacity>
              {vehicles.map(v => (
                <TouchableOpacity
                  key={v.id}
                  onPress={() => setFormVehicleId(v.id)}
                  style={[styles.chip, formVehicleId === v.id && styles.chipActive]}
                >
                  <Text style={[styles.chipText, formVehicleId === v.id && styles.chipTextActive]}>{v.plate}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <DateField
              label="Data expirare (opțional)"
              value={formExpiry}
              onChange={setFormExpiry}
              showRelative
            />

            <TouchableOpacity style={styles.attachBtn} onPress={pickImage}>
              <Text style={styles.attachText}>
                {formImage ? `📎 ${formImage.uri.split('/').pop()}` : '📎 Atașează fișier'}
              </Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <PrimaryButton title="Salvează" onPress={handleSave} loading={saving} />
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => { setShowAdd(false); resetForm(); }}
              >
                <Text style={styles.closeBtnText}>✕ Anulează</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerTitle: { fontSize: 22, fontWeight: FONTS.bold, color: T.ink },
  headerBtn: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.card,
    borderRadius: RADIUS.full,
    ...SHADOW.sm,
  },
  headerBtnText: { fontSize: 18 },
  filterScroll: { maxHeight: 52 },
  filterContent: { paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row' },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    marginRight: 8,
  },
  filterPillActive: { backgroundColor: T.brand, borderColor: T.brand },
  filterText: { fontSize: 14, fontWeight: FONTS.medium, color: T.ink2 },
  filterTextActive: { color: '#fff' },
  list: { paddingHorizontal: 16, paddingBottom: 100, paddingTop: 8 },
  itemWrap: { marginBottom: 10 },
  itemCard: { padding: 14 },
  itemRow: { flexDirection: 'row', alignItems: 'center' },
  itemIcon: { fontSize: 28, width: 40, textAlign: 'center', marginRight: 12 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: FONTS.semibold, color: T.ink, marginBottom: 4 },
  itemPill: { alignSelf: 'flex-start', marginBottom: 4 },
  itemVehicle: { fontSize: 12, color: T.ink3 },
  itemRight: { alignItems: 'flex-end', marginLeft: 8 },
  signedBadge: {
    backgroundColor: T.successTint,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    marginTop: 4,
  },
  signedText: { fontSize: 11, fontWeight: FONTS.semibold, color: T.success },
  fab: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: RADIUS.full,
    backgroundColor: T.brand,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.lg,
  },
  fabText: { fontSize: 30, color: '#fff', lineHeight: 34, marginTop: -2 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: T.card,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: 24,
    paddingBottom: 36,
  },
  modalSheetScroll: {
    backgroundColor: T.card,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '90%',
  },
  modalSheetContent: { padding: 24, paddingBottom: 36 },
  modalTitle: { fontSize: 20, fontWeight: FONTS.bold, color: T.ink, marginBottom: 16 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
  },
  infoLabel: { fontSize: 14, color: T.ink3, fontWeight: FONTS.medium },
  infoValue: { fontSize: 14, color: T.ink, fontWeight: FONTS.semibold, maxWidth: '60%', textAlign: 'right' },
  modalActions: { marginTop: 20, gap: 10 },
  deleteBtn: {
    backgroundColor: T.dangerTint,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteBtnText: { color: T.danger, fontSize: 16, fontWeight: FONTS.semibold },
  closeBtn: {
    backgroundColor: T.line2,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeBtnText: { color: T.ink2, fontSize: 16, fontWeight: FONTS.semibold },
  fieldLabel: { fontSize: 13, fontWeight: FONTS.semibold, color: T.ink3, marginBottom: 6, marginTop: 16 },
  input: {
    backgroundColor: T.line2,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: T.ink,
    borderWidth: 1,
    borderColor: T.line,
  },
  chipRow: { marginBottom: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: T.line2,
    borderWidth: 1,
    borderColor: T.line,
    marginRight: 8,
  },
  chipActive: { backgroundColor: T.brand, borderColor: T.brand },
  chipText: { fontSize: 13, fontWeight: FONTS.medium, color: T.ink2 },
  chipTextActive: { color: '#fff' },
  attachBtn: {
    marginTop: 14,
    backgroundColor: T.brandTint,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: T.brand + '50',
  },
  attachText: { color: T.brand, fontSize: 14, fontWeight: FONTS.semibold },
});
