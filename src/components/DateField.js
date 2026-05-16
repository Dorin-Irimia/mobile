import React, { useState, useMemo } from 'react';
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

const MONTHS_RO = [
  'ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
  'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie',
];
const DAYS_RO = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă'];

function pad(n) { return String(n).padStart(2, '0'); }

function ymdFromDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dateFromYmd(value) {
  if (!value) return null;
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
  if (isNaN(d.getTime())) return null;
  return d;
}

function formatPretty(value) {
  const d = dateFromYmd(value);
  if (!d) return '';
  return `${DAYS_RO[d.getDay()]}, ${d.getDate()} ${MONTHS_RO[d.getMonth()]} ${d.getFullYear()}`;
}

function diffDays(value) {
  const d = dateFromYmd(value);
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d - today) / (1000 * 60 * 60 * 24));
}

/**
 * Calendar picker pentru date (YYYY-MM-DD).
 * Pe iOS: deschide modal cu picker inline (spinner sau wheel).
 * Pe Android: deschide direct calendarul nativ.
 */
export default function DateField({
  label,
  value,                  // 'YYYY-MM-DD' or empty
  onChange,               // (yyyymmdd: string) => void
  placeholder = 'Atinge pentru a alege data',
  error,
  minDate,                // Date object or 'YYYY-MM-DD'
  maxDate,
  showRelative = false,   // dacă să afișeze "în X zile" / "acum Y zile"
  allowClear = true,
  required = false,
  hint,
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState(() => dateFromYmd(value) || new Date());

  const currentDate = useMemo(() => dateFromYmd(value), [value]);
  const pretty = useMemo(() => formatPretty(value), [value]);
  const relativeDays = showRelative ? diffDays(value) : null;

  const minDateObj = useMemo(() => {
    if (!minDate) return undefined;
    return typeof minDate === 'string' ? dateFromYmd(minDate) : minDate;
  }, [minDate]);
  const maxDateObj = useMemo(() => {
    if (!maxDate) return undefined;
    return typeof maxDate === 'string' ? dateFromYmd(maxDate) : maxDate;
  }, [maxDate]);

  const openPicker = () => {
    setTempDate(currentDate || new Date());
    setShowPicker(true);
  };

  const handleAndroidChange = (event, selected) => {
    setShowPicker(false);
    if (event.type === 'set' && selected) {
      onChange(ymdFromDate(selected));
    }
  };

  const handleIOSChange = (event, selected) => {
    if (selected) setTempDate(selected);
  };

  const confirmIOS = () => {
    onChange(ymdFromDate(tempDate));
    setShowPicker(false);
  };

  const renderRelative = () => {
    if (relativeDays === null) return null;
    let label = '';
    let color = T.ink3;
    if (relativeDays === 0) { label = 'Astăzi'; color = T.brand; }
    else if (relativeDays === 1) { label = 'Mâine'; color = T.success; }
    else if (relativeDays === -1) { label = 'Ieri'; color = T.warn; }
    else if (relativeDays > 0) {
      label = `în ${relativeDays} zile`;
      color = relativeDays <= 14 ? T.danger : relativeDays <= 30 ? T.warn : T.success;
    } else {
      label = `acum ${Math.abs(relativeDays)} zile`;
      color = T.danger;
    }
    return <Text style={[styles.relative, { color }]}>{label}</Text>;
  };

  return (
    <View style={styles.wrap}>
      {label != null && (
        <View style={styles.labelRow}>
          <Text style={styles.label}>
            {label}{required && <Text style={{ color: T.danger }}> *</Text>}
          </Text>
          {allowClear && value ? (
            <TouchableOpacity onPress={() => onChange('')} hitSlop={HIT_SLOP}>
              <Text style={styles.clearText}>șterge</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      <TouchableOpacity
        style={[styles.field, error && styles.fieldError]}
        onPress={openPicker}
        activeOpacity={0.7}
      >
        <Text style={styles.icon}>📅</Text>
        <View style={{ flex: 1 }}>
          {value ? (
            <>
              <Text style={styles.fieldValue}>{value}</Text>
              {pretty && <Text style={styles.fieldPretty}>{pretty}</Text>}
            </>
          ) : (
            <Text style={styles.fieldPlaceholder}>{placeholder}</Text>
          )}
        </View>
        {renderRelative()}
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      {hint && !error ? <Text style={styles.hint}>{hint}</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* Android: nativ direct */}
      {Platform.OS === 'android' && showPicker && (
        <DateTimePicker
          value={tempDate}
          mode="date"
          display="calendar"
          onChange={handleAndroidChange}
          minimumDate={minDateObj}
          maximumDate={maxDateObj}
        />
      )}

      {/* iOS: modal cu calendar inline */}
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
                <Text style={styles.iosTitle}>{label || 'Alege data'}</Text>
                <TouchableOpacity onPress={confirmIOS} hitSlop={HIT_SLOP}>
                  <Text style={[styles.iosBtn, { fontWeight: FONTS.bold, color: T.brand }]}>OK</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="inline"
                themeVariant="light"
                onChange={handleIOSChange}
                minimumDate={minDateObj}
                maximumDate={maxDateObj}
                locale="ro-RO"
                style={{ backgroundColor: '#fff' }}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

export { ymdFromDate, dateFromYmd, formatPretty };

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
    minHeight: 56,
  },
  fieldError: { borderColor: T.danger, backgroundColor: T.dangerTint },
  icon: { fontSize: 20 },
  fieldValue: { fontSize: 15, color: T.ink, fontWeight: FONTS.semibold },
  fieldPretty: { fontSize: 12, color: T.ink3, marginTop: 2, textTransform: 'capitalize' },
  fieldPlaceholder: { fontSize: 14, color: T.ink4 },
  chevron: { fontSize: 22, color: T.ink4 },
  relative: {
    fontSize: 11,
    fontWeight: FONTS.bold,
    marginRight: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    backgroundColor: T.line2,
  },
  hint: { fontSize: 11, color: T.ink4, marginTop: 4, fontStyle: 'italic' },
  errorText: { fontSize: 11, color: T.danger, marginTop: 4 },

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
