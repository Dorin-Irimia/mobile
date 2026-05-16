import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Modal,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { T, RADIUS, FONTS, SPACING, HIT_SLOP } from '../theme';

function pad(n) { return String(n).padStart(2, '0'); }

function hmFromDate(d) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function dateFromHm(value) {
  const today = new Date();
  if (!value) return today;
  const m = String(value).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return today;
  const d = new Date();
  d.setHours(parseInt(m[1]), parseInt(m[2]), 0, 0);
  return d;
}

export default function TimeField({
  label,
  value,                // 'HH:mm'
  onChange,
  placeholder = 'Atinge pentru a alege ora',
  allowClear = true,
  hint,
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState(() => dateFromHm(value));

  const openPicker = () => {
    setTempDate(dateFromHm(value));
    setShowPicker(true);
  };

  const handleAndroidChange = (event, selected) => {
    setShowPicker(false);
    if (event.type === 'set' && selected) {
      onChange(hmFromDate(selected));
    }
  };

  const handleIOSChange = (event, selected) => {
    if (selected) setTempDate(selected);
  };

  const confirmIOS = () => {
    onChange(hmFromDate(tempDate));
    setShowPicker(false);
  };

  return (
    <View style={styles.wrap}>
      {label != null && (
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          {allowClear && value ? (
            <TouchableOpacity onPress={() => onChange('')} hitSlop={HIT_SLOP}>
              <Text style={styles.clearText}>șterge</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      <TouchableOpacity style={styles.field} onPress={openPicker} activeOpacity={0.7}>
        <Text style={styles.icon}>🕐</Text>
        <View style={{ flex: 1 }}>
          {value ? (
            <Text style={styles.fieldValue}>{value}</Text>
          ) : (
            <Text style={styles.fieldPlaceholder}>{placeholder}</Text>
          )}
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      {hint ? <Text style={styles.hint}>{hint}</Text> : null}

      {Platform.OS === 'android' && showPicker && (
        <DateTimePicker
          value={tempDate}
          mode="time"
          is24Hour
          display="clock"
          onChange={handleAndroidChange}
        />
      )}

      {Platform.OS === 'ios' && (
        <Modal
          visible={showPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowPicker(false)}
        >
          <View style={styles.iosBackdrop}>
            <View style={styles.iosSheet}>
              <View style={styles.iosHeader}>
                <TouchableOpacity onPress={() => setShowPicker(false)} hitSlop={HIT_SLOP}>
                  <Text style={styles.iosBtn}>Anulează</Text>
                </TouchableOpacity>
                <Text style={styles.iosTitle}>{label || 'Alege ora'}</Text>
                <TouchableOpacity onPress={confirmIOS} hitSlop={HIT_SLOP}>
                  <Text style={[styles.iosBtn, { fontWeight: FONTS.bold, color: T.brand }]}>OK</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempDate}
                mode="time"
                is24Hour
                display="spinner"
                themeVariant="light"
                onChange={handleIOSChange}
                locale="ro-RO"
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: SPACING.sm },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: { fontSize: 13, fontWeight: FONTS.semibold, color: T.ink2 },
  clearText: { fontSize: 12, color: T.ink3, fontStyle: 'italic' },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    borderWidth: 1.5,
    borderColor: T.line,
    backgroundColor: T.bgSoft,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    minHeight: 50,
  },
  icon: { fontSize: 18 },
  fieldValue: { fontSize: 15, color: T.ink, fontWeight: FONTS.semibold },
  fieldPlaceholder: { fontSize: 14, color: T.ink4 },
  chevron: { fontSize: 22, color: T.ink4 },
  hint: { fontSize: 11, color: T.ink4, marginTop: 4, fontStyle: 'italic' },

  iosBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  iosSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
  },
  iosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: T.line2,
  },
  iosTitle: { fontSize: 15, fontWeight: FONTS.semibold, color: T.ink },
  iosBtn: { fontSize: 15, color: T.ink2 },
});
