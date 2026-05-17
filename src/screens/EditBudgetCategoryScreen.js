import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useStore from '../store';
import { T, RADIUS, SHADOW, FONTS, display, formatCurrency } from '../theme';
import { BUDGET_CATEGORY_TEMPLATES } from './BudgetTrackerScreen';

const ICON_PALETTE = ['💡', '🛒', '🏠', '🚇', '💊', '🎬', '🏦', '📺', '🛠', '🍽', '🧽', '🛋', '🔧', '📦', '🐾', '👶', '✈️', '👗', '⛽', '☕'];
const COLOR_PALETTE = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899', '#0EA5E9', '#A855F7', '#64748B', '#F97316', '#22D3EE', '#DC2626', '#6B7280', '#84CC16'];

function slugify(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || 'custom';
}

export default function EditBudgetCategoryScreen({ navigation, route }) {
  const householdId = route?.params?.householdId;
  const categoryId = route?.params?.categoryId || null;

  const categories = useStore(s => s.budgetCategories);
  const upsertBudgetCategory = useStore(s => s.upsertBudgetCategory);
  const updateBudgetCategory = useStore(s => s.updateBudgetCategory);
  const deleteBudgetCategory = useStore(s => s.deleteBudgetCategory);
  const fetchBudgetSummary = useStore(s => s.fetchBudgetSummary);

  const existing = categoryId ? categories.find(c => c.id === categoryId) : null;

  const [label, setLabel] = useState(existing?.label || '');
  const [icon, setIcon] = useState(existing?.icon || '📦');
  const [color, setColor] = useState(existing?.color || '#6B7280');
  const [limit, setLimit] = useState(
    existing?.monthlyLimit != null ? String(existing.monthlyLimit) : ''
  );
  const [key, setKey] = useState(existing?.key || '');
  const [saving, setSaving] = useState(false);

  const usedKeys = useMemo(
    () => new Set(categories.filter(c => c.id !== existing?.id).map(c => c.key)),
    [categories, existing]
  );

  const availableTemplates = useMemo(
    () => BUDGET_CATEGORY_TEMPLATES.filter(t => !usedKeys.has(t.key)),
    [usedKeys]
  );

  const applyTemplate = (tpl) => {
    setKey(tpl.key);
    setLabel(tpl.label);
    setIcon(tpl.icon);
    setColor(tpl.color);
  };

  const valid = label.trim().length > 0;

  const handleSubmit = async () => {
    if (!valid) {
      Alert.alert('Câmp lipsă', 'Introdu cel puțin un nume de categorie.');
      return;
    }
    setSaving(true);
    try {
      const finalKey = (key || slugify(label)).trim();
      if (existing) {
        await updateBudgetCategory(existing.id, {
          label: label.trim(),
          icon,
          color,
          monthlyLimit: limit === '' ? 0 : parseFloat(limit),
        });
      } else {
        if (usedKeys.has(finalKey)) {
          Alert.alert('Există deja', 'Această categorie este deja definită. Editeaz-o din listă.');
          setSaving(false);
          return;
        }
        await upsertBudgetCategory({
          householdId,
          key: finalKey,
          label: label.trim(),
          icon,
          color,
          monthlyLimit: limit === '' ? 0 : parseFloat(limit),
        });
      }
      await fetchBudgetSummary(householdId);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Eroare', e?.response?.data?.error || 'Nu pot salva.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!existing) return;
    Alert.alert(
      'Șterge categoria?',
      `"${existing.label}" — bugetul lunar nu se mai urmărește.`,
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Șterge', style: 'destructive',
          onPress: async () => {
            try {
              await deleteBudgetCategory(existing.id);
              await fetchBudgetSummary(householdId);
              navigation.goBack();
            } catch (e) {
              Alert.alert('Eroare', e?.response?.data?.error || 'Nu pot șterge.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, display(700)]}>
          {existing ? 'Editează categorie' : 'Categorie nouă'}
        </Text>
        <TouchableOpacity onPress={handleSubmit} style={styles.headerBtn} disabled={saving || !valid}>
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
          {!existing && availableTemplates.length > 0 && (
            <View>
              <Text style={styles.label}>Șabloane rapide</Text>
              <View style={styles.templateGrid}>
                {availableTemplates.map(tpl => (
                  <TouchableOpacity
                    key={tpl.key}
                    onPress={() => applyTemplate(tpl)}
                    style={[
                      styles.templateChip,
                      key === tpl.key && { borderColor: tpl.color, backgroundColor: tpl.color + '14' },
                    ]}
                  >
                    <Text style={{ fontSize: 18 }}>{tpl.icon}</Text>
                    <Text
                      style={[
                        styles.templateChipText,
                        key === tpl.key && { color: tpl.color, fontWeight: FONTS.bold },
                      ]}
                    >
                      {tpl.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Preview */}
          <View style={styles.preview}>
            <View style={[styles.previewIcon, { backgroundColor: color + '1A' }]}>
              <Text style={{ fontSize: 22 }}>{icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.previewLabel}>{label.trim() || 'Categorie'}</Text>
              <Text style={styles.previewSub}>
                {limit && parseFloat(limit) > 0
                  ? `Limită: ${formatCurrency(parseFloat(limit))} / lună`
                  : 'Fără limită lunară'}
              </Text>
            </View>
          </View>

          <View>
            <Text style={styles.label}>Nume</Text>
            <TextInput
              value={label}
              onChangeText={setLabel}
              placeholder="ex. Alimente, Utilități, Distracții…"
              placeholderTextColor={T.ink4}
              style={styles.input}
              autoCapitalize="sentences"
            />
          </View>

          <View>
            <Text style={styles.label}>Limită lunară (RON, 0 = fără limită)</Text>
            <TextInput
              value={limit}
              onChangeText={t => setLimit(t.replace(/[^0-9.,]/g, '').replace(',', '.'))}
              placeholder="ex. 1200"
              placeholderTextColor={T.ink4}
              keyboardType="decimal-pad"
              style={styles.input}
            />
          </View>

          <View>
            <Text style={styles.label}>Iconiță</Text>
            <View style={styles.paletteRow}>
              {ICON_PALETTE.map(em => {
                const active = em === icon;
                return (
                  <TouchableOpacity
                    key={em}
                    onPress={() => setIcon(em)}
                    style={[styles.iconCell, active && { borderColor: color, backgroundColor: color + '14' }]}
                  >
                    <Text style={{ fontSize: 20 }}>{em}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View>
            <Text style={styles.label}>Culoare</Text>
            <View style={styles.paletteRow}>
              {COLOR_PALETTE.map(c => {
                const active = c === color;
                return (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setColor(c)}
                    style={[
                      styles.colorCell,
                      { backgroundColor: c },
                      active && styles.colorCellActive,
                    ]}
                  />
                );
              })}
            </View>
          </View>

          {existing && (
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
              <Text style={styles.deleteBtnText}>Șterge categoria</Text>
            </TouchableOpacity>
          )}
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

  templateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  templateChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 7,
    backgroundColor: T.card, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: T.line,
  },
  templateChipText: { fontSize: 12, fontWeight: FONTS.semibold, color: T.ink2 },

  preview: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: T.card, padding: 14, borderRadius: RADIUS.lg,
    ...SHADOW.sm,
  },
  previewIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  previewLabel: { fontSize: 15, fontWeight: FONTS.bold, color: T.ink },
  previewSub: { fontSize: 12, color: T.ink3, marginTop: 2 },

  paletteRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconCell: {
    width: 44, height: 44, borderRadius: RADIUS.md,
    backgroundColor: T.card, borderWidth: 1.5, borderColor: T.line,
    alignItems: 'center', justifyContent: 'center',
  },
  colorCell: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'transparent' },
  colorCellActive: { borderColor: T.ink },

  deleteBtn: {
    marginTop: 8, paddingVertical: 14,
    borderRadius: RADIUS.lg, alignItems: 'center',
    borderWidth: 1, borderColor: T.danger,
  },
  deleteBtnText: { color: T.danger, fontSize: 14, fontWeight: FONTS.bold },
});
