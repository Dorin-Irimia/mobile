import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useStore from '../store';
import {
  T, RADIUS, SHADOW, FONTS, SPACING,
  useResponsive, HIT_SLOP, HIT_SLOP_LG,
} from '../theme';
import {
  CUSTOM_COLOR_PALETTE,
  EMOJI_PICKER,
  newCustomCategoryKey,
} from '../utils/categories';

const TYPE_OPTIONS = [
  { key: 'expense', label: '💸 Cheltuială' },
  { key: 'income', label: '💰 Venit' },
];

function pickRandomColor(existing) {
  const used = new Set((existing || []).map(c => c.color));
  const available = CUSTOM_COLOR_PALETTE.filter(c => !used.has(c));
  const pool = available.length > 0 ? available : CUSTOM_COLOR_PALETTE;
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function CustomCategoriesScreen({ navigation }) {
  const customCategories = useStore(s => s.customCategories);
  const loadCustomCategories = useStore(s => s.loadCustomCategories);
  const addCustomCategory = useStore(s => s.addCustomCategory);
  const updateCustomCategory = useStore(s => s.updateCustomCategory);
  const removeCustomCategory = useStore(s => s.removeCustomCategory);
  const { isTablet, hPad, maxContentWidth } = useResponsive();

  const [editor, setEditor] = useState(null);
  // editor: { key?: string, name: string, icon: string, color: string, type: 'expense'|'income' }

  useEffect(() => { loadCustomCategories(); }, []);

  const openCreate = (type) => {
    setEditor({
      name: '',
      icon: '📌',
      color: pickRandomColor(customCategories),
      type,
    });
  };

  const openEdit = (cat) => {
    setEditor({
      key: cat.key,
      name: cat.label,
      icon: cat.icon || '📌',
      color: cat.color || CUSTOM_COLOR_PALETTE[0],
      type: cat.type || 'expense',
    });
  };

  const handleSave = async () => {
    if (!editor) return;
    const name = editor.name.trim();
    if (!name) {
      Alert.alert('Nume', 'Adaugă un nume pentru categorie.');
      return;
    }
    try {
      if (editor.key) {
        await updateCustomCategory(editor.key, {
          label: name,
          icon: editor.icon,
          color: editor.color,
          type: editor.type,
        });
      } else {
        await addCustomCategory({
          key: newCustomCategoryKey(),
          label: name,
          icon: editor.icon,
          color: editor.color,
          type: editor.type,
        });
      }
      setEditor(null);
    } catch (e) {
      Alert.alert('Eroare', 'Nu s-a putut salva categoria.');
    }
  };

  const handleDelete = (cat) => {
    Alert.alert('Șterge categoria', `Sigur ștergi „${cat.label}"?`, [
      { text: 'Anulează', style: 'cancel' },
      {
        text: 'Șterge',
        style: 'destructive',
        onPress: () => removeCustomCategory(cat.key),
      },
    ]);
  };

  const byType = (type) => customCategories.filter(c => (c.type || 'expense') === type);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.header} edges={['top']}>
        <View style={[styles.headerRow, { paddingHorizontal: hPad }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={HIT_SLOP_LG}>
            <Text style={styles.back}>← Înapoi</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Categorii custom</Text>
          <View style={{ width: 60 }} />
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={[
          { padding: hPad, paddingBottom: 80, gap: SPACING.lg },
          isTablet && { alignSelf: 'center', width: '100%', maxWidth: maxContentWidth },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>
          Adaugă categorii personalizate pentru a clasifica mai precis cheltuielile și veniturile.
          Numele, emoji-ul și culoarea sunt salvate pe dispozitiv.
        </Text>

        {TYPE_OPTIONS.map(t => {
          const list = byType(t.key);
          return (
            <View key={t.key} style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>{t.label}</Text>
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={() => openCreate(t.key)}
                  hitSlop={HIT_SLOP}
                  activeOpacity={0.85}
                >
                  <Text style={styles.addBtnText}>+ Adaugă</Text>
                </TouchableOpacity>
              </View>
              {list.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>
                    Nicio categorie {t.key === 'income' ? 'de venit' : 'de cheltuială'} personalizată.
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 8 }}>
                  {list.map(cat => (
                    <View key={cat.key} style={styles.catRow}>
                      <View style={[styles.catSwatch, { backgroundColor: cat.color || T.brand }]}>
                        <Text style={styles.catSwatchIcon}>{cat.icon || '📌'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.catName} numberOfLines={1}>{cat.label}</Text>
                        <Text style={styles.catMeta}>{cat.color}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => openEdit(cat)}
                        hitSlop={HIT_SLOP}
                        style={styles.rowAction}
                      >
                        <Text style={styles.rowActionText}>✏️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDelete(cat)}
                        hitSlop={HIT_SLOP}
                        style={styles.rowAction}
                      >
                        <Text style={styles.rowActionText}>🗑</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <Modal
        visible={!!editor}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditor(null)}
      >
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editor?.key ? 'Editează categoria' : 'Categorie nouă'}
            </Text>
            <TouchableOpacity onPress={() => setEditor(null)} hitSlop={HIT_SLOP}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          {editor && (
            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <View style={styles.previewRow}>
                <View style={[styles.previewSwatch, { backgroundColor: editor.color }]}>
                  <Text style={styles.previewIcon}>{editor.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.previewName}>{editor.name || 'Nume categorie'}</Text>
                  <Text style={styles.previewType}>
                    {editor.type === 'income' ? '💰 Venit' : '💸 Cheltuială'}
                  </Text>
                </View>
              </View>

              <Text style={styles.fieldLabel}>Tip</Text>
              <View style={styles.typeRow}>
                {TYPE_OPTIONS.map(t => {
                  const active = editor.type === t.key;
                  return (
                    <TouchableOpacity
                      key={t.key}
                      onPress={() => setEditor(e => ({ ...e, type: t.key }))}
                      style={[styles.typeChip, active && styles.typeChipActive]}
                    >
                      <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>Nume</Text>
              <TextInput
                value={editor.name}
                onChangeText={(v) => setEditor(e => ({ ...e, name: v }))}
                placeholder="Ex.: Animale de companie"
                placeholderTextColor={T.ink4}
                style={styles.input}
                maxLength={36}
              />

              <Text style={styles.fieldLabel}>Emoji</Text>
              <View style={styles.emojiGrid}>
                {EMOJI_PICKER.map((emo, idx) => {
                  const active = editor.icon === emo;
                  return (
                    <TouchableOpacity
                      key={`${emo}-${idx}`}
                      onPress={() => setEditor(e => ({ ...e, icon: emo }))}
                      style={[styles.emojiTile, active && styles.emojiTileActive]}
                    >
                      <Text style={styles.emojiText}>{emo}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>Culoare</Text>
              <View style={styles.colorRow}>
                {CUSTOM_COLOR_PALETTE.map(col => {
                  const active = editor.color === col;
                  return (
                    <TouchableOpacity
                      key={col}
                      onPress={() => setEditor(e => ({ ...e, color: col }))}
                      style={[
                        styles.colorDot,
                        { backgroundColor: col },
                        active && styles.colorDotActive,
                      ]}
                    />
                  );
                })}
              </View>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSave}
                activeOpacity={0.85}
              >
                <Text style={styles.saveBtnText}>
                  {editor.key ? 'Salvează modificările' : 'Adaugă categoria'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  header: { backgroundColor: T.card, borderBottomWidth: 1, borderBottomColor: T.line },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
  },
  back: { fontSize: 15, color: T.brand, fontWeight: FONTS.semibold, width: 60 },
  title: { fontSize: 17, fontWeight: FONTS.bold, color: T.ink },

  intro: { fontSize: 13, color: T.ink3, lineHeight: 18 },

  section: { gap: SPACING.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 14, fontWeight: FONTS.bold, color: T.ink },
  addBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: T.brand, borderRadius: RADIUS.full,
  },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: FONTS.bold },

  emptyBox: {
    padding: SPACING.md,
    backgroundColor: T.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: T.line,
  },
  emptyText: { fontSize: 12, color: T.ink3, textAlign: 'center' },

  catRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: T.card, borderRadius: RADIUS.lg, padding: SPACING.md,
    ...SHADOW.sm,
  },
  catSwatch: {
    width: 42, height: 42, borderRadius: RADIUS.md,
    alignItems: 'center', justifyContent: 'center',
  },
  catSwatchIcon: { fontSize: 22 },
  catName: { fontSize: 14, fontWeight: FONTS.bold, color: T.ink },
  catMeta: { fontSize: 11, color: T.ink3, marginTop: 2 },
  rowAction: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: T.bgSoft,
  },
  rowActionText: { fontSize: 16 },

  modalSafe: { flex: 1, backgroundColor: T.bg },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: T.line,
  },
  modalTitle: { fontSize: 16, fontWeight: FONTS.bold, color: T.ink },
  modalClose: { fontSize: 20, color: T.ink2, paddingHorizontal: 8 },
  modalContent: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: 80 },

  previewRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: T.card, padding: SPACING.md, borderRadius: RADIUS.lg,
    ...SHADOW.sm,
  },
  previewSwatch: {
    width: 56, height: 56, borderRadius: RADIUS.md,
    alignItems: 'center', justifyContent: 'center',
  },
  previewIcon: { fontSize: 30 },
  previewName: { fontSize: 16, fontWeight: FONTS.bold, color: T.ink },
  previewType: { fontSize: 12, color: T.ink3, marginTop: 3 },

  fieldLabel: { fontSize: 12, fontWeight: FONTS.bold, color: T.ink3, marginTop: 8, letterSpacing: 0.4, textTransform: 'uppercase' },
  input: {
    backgroundColor: T.card,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 11,
    fontSize: 15,
    color: T.ink,
    borderWidth: 1, borderColor: T.line,
  },

  typeRow: { flexDirection: 'row', gap: 8 },
  typeChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    backgroundColor: T.card,
    borderWidth: 1.5, borderColor: T.line,
    alignItems: 'center',
  },
  typeChipActive: { backgroundColor: T.brandTint, borderColor: T.brand },
  typeChipText: { fontSize: 13, fontWeight: FONTS.bold, color: T.ink2 },
  typeChipTextActive: { color: T.brand },

  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  emojiTile: {
    width: 42, height: 42, borderRadius: RADIUS.md,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: T.card,
    borderWidth: 1.5, borderColor: T.line,
  },
  emojiTileActive: { borderColor: T.brand, backgroundColor: T.brandTint },
  emojiText: { fontSize: 22 },

  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorDot: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 3, borderColor: 'transparent',
  },
  colorDotActive: { borderColor: T.ink },

  saveBtn: {
    backgroundColor: T.brand,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: SPACING.md,
    ...SHADOW.sm,
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: FONTS.bold },
});
