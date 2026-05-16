import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { T, RADIUS, FONTS, SHADOW, SPACING, TOUCH_TARGET, HIT_SLOP } from '../theme';

/**
 * Bottom sheet pentru selectarea sursei unui fișier.
 * Mai fiabil decât Alert.alert care e limitat pe iOS la 3-4 butoane vertical.
 *
 * Props:
 *  - visible: boolean
 *  - onClose: () => void
 *  - title: string
 *  - options: [{ key, icon, label, sub?, onPress, danger? }]
 */
export default function SourcePickerSheet({ visible, onClose, title = 'Alege sursa', options = [] }) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <SafeAreaView edges={['bottom']}>
            <View style={styles.handle} />
            <Text style={styles.title}>{title}</Text>

            <View style={styles.options}>
              {options.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.option, opt.danger && styles.optionDanger]}
                  onPress={() => {
                    onClose();
                    // Run after modal animation finishes (avoids picker glitches on iOS)
                    setTimeout(() => opt.onPress && opt.onPress(), 200);
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={styles.optionIcon}>{opt.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionLabel, opt.danger && { color: T.danger }]}>
                      {opt.label}
                    </Text>
                    {opt.sub && (
                      <Text style={styles.optionSub}>{opt.sub}</Text>
                    )}
                  </View>
                  <Text style={styles.chev}>›</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              hitSlop={HIT_SLOP}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelText}>Anulează</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: T.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    ...SHADOW.lg,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: T.line,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: 17,
    fontWeight: FONTS.bold,
    color: T.ink,
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  options: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: T.bgSoft,
    borderRadius: RADIUS.lg,
    minHeight: TOUCH_TARGET + 8,
  },
  optionDanger: { backgroundColor: T.dangerTint },
  optionIcon: { fontSize: 28, width: 36, textAlign: 'center' },
  optionLabel: { fontSize: 15, fontWeight: FONTS.semibold, color: T.ink },
  optionSub: { fontSize: 12, color: T.ink3, marginTop: 2 },
  chev: { fontSize: 22, color: T.ink4 },
  cancelBtn: {
    marginTop: SPACING.md,
    marginHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: T.line2,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: FONTS.semibold, color: T.ink2 },
});
