import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { T, RADIUS, FONTS, SPACING, HIT_SLOP, TOUCH_TARGET } from '../theme';

export default function CustomFieldsEditor({ value, onChange }) {
  const fields = Object.entries(value || {}).map(([key, val]) => ({ key, val }));
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');

  const updateKey = (oldKey, newKeyName) => {
    if (!newKeyName) return;
    const next = { ...value };
    const v = next[oldKey];
    delete next[oldKey];
    next[newKeyName] = v;
    onChange(next);
  };

  const updateValue = (key, v) => {
    onChange({ ...value, [key]: v });
  };

  const remove = (key) => {
    const next = { ...value };
    delete next[key];
    onChange(next);
  };

  const addNew = () => {
    if (!newKey.trim()) return;
    onChange({ ...value, [newKey.trim()]: newVal });
    setNewKey('');
    setNewVal('');
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>Câmpuri personalizate</Text>
        <Text style={styles.hint}>({fields.length})</Text>
      </View>

      {fields.length === 0 && (
        <Text style={styles.emptyText}>
          Adaugă câmpuri proprii (ex: "Garanție până la", "Cod produs", "Mecanic")
        </Text>
      )}

      {fields.map(({ key, val }) => (
        <View key={key} style={styles.row}>
          <TextInput
            style={[styles.input, styles.keyInput]}
            value={key}
            onChangeText={(t) => updateKey(key, t)}
            placeholder="Nume câmp"
            placeholderTextColor={T.ink4}
            autoCapitalize="none"
          />
          <TextInput
            style={[styles.input, styles.valInput]}
            value={String(val ?? '')}
            onChangeText={(t) => updateValue(key, t)}
            placeholder="Valoare"
            placeholderTextColor={T.ink4}
          />
          <TouchableOpacity onPress={() => remove(key)} hitSlop={HIT_SLOP} style={styles.removeBtn}>
            <Text style={styles.removeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}

      <View style={[styles.row, styles.addRow]}>
        <TextInput
          style={[styles.input, styles.keyInput, styles.addInput]}
          value={newKey}
          onChangeText={setNewKey}
          placeholder="+ Nume câmp"
          placeholderTextColor={T.ink4}
          autoCapitalize="none"
        />
        <TextInput
          style={[styles.input, styles.valInput, styles.addInput]}
          value={newVal}
          onChangeText={setNewVal}
          placeholder="Valoare"
          placeholderTextColor={T.ink4}
          returnKeyType="done"
          onSubmitEditing={addNew}
        />
        <TouchableOpacity
          onPress={addNew}
          disabled={!newKey.trim()}
          style={[styles.addBtn, !newKey.trim() && styles.addBtnDisabled]}
          hitSlop={HIT_SLOP}
        >
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: SPACING.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm, gap: SPACING.sm },
  label: { fontSize: 13, fontWeight: FONTS.semibold, color: T.ink2 },
  hint: { fontSize: 12, color: T.ink4 },
  emptyText: { fontSize: 12, color: T.ink4, fontStyle: 'italic', marginBottom: SPACING.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.sm },
  addRow: { marginTop: 4 },
  input: {
    borderWidth: 1.5,
    borderColor: T.line,
    backgroundColor: T.bgSoft,
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
    color: T.ink,
    minHeight: 42,
  },
  keyInput: { flex: 1 },
  valInput: { flex: 1.3 },
  addInput: { borderStyle: 'dashed', backgroundColor: T.bg },
  removeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.line2,
    borderRadius: 16,
  },
  removeBtnText: { color: T.ink2, fontWeight: FONTS.bold, fontSize: 14 },
  addBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.brand,
    borderRadius: 18,
  },
  addBtnDisabled: { opacity: 0.4 },
  addBtnText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 18, lineHeight: 22 },
});
