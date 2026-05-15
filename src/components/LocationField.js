import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { T, RADIUS, FONTS, SPACING, HIT_SLOP } from '../theme';

export default function LocationField({
  value,
  onChange,
  label = 'Locație / adresă',
  placeholder = 'Adresa sau coordonate',
  multiline = true,
}) {
  const [busy, setBusy] = useState(false);

  const captureLocation = async () => {
    setBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permisiune necesară',
          'Pentru a prelua locația automat, acordă permisiunea de localizare în setări.',
        );
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = position.coords;

      let addressText = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      try {
        const places = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (places && places.length > 0) {
          const p = places[0];
          const parts = [
            p.street && p.streetNumber ? `${p.street} ${p.streetNumber}` : p.street,
            p.district,
            p.city || p.subregion,
            p.region,
            p.country,
          ].filter(Boolean);
          if (parts.length > 0) {
            addressText = parts.join(', ');
          }
        }
      } catch (geoErr) {
        // Reverse geocode might fail (offline, no provider) — păstrăm coordonatele
      }

      onChange(addressText);
    } catch (e) {
      Alert.alert(
        'Locație indisponibilă',
        e?.message?.includes('disabled')
          ? 'Activează GPS-ul în setări.'
          : 'Nu am putut obține locația. Încearcă din nou sau scrie-o manual.',
      );
    } finally {
      setBusy(false);
    }
  };

  const clearLocation = () => onChange('');

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.actions}>
          {!!value && (
            <TouchableOpacity onPress={clearLocation} hitSlop={HIT_SLOP} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>✕</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={captureLocation}
            disabled={busy}
            style={[styles.gpsBtn, busy && { opacity: 0.6 }]}
            hitSlop={HIT_SLOP}
            activeOpacity={0.85}
          >
            {busy ? (
              <ActivityIndicator color={T.brand} size="small" />
            ) : (
              <>
                <Text style={styles.gpsIcon}>📍</Text>
                <Text style={styles.gpsText}>Locația mea</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <TextInput
        style={[styles.input, multiline && { minHeight: 60, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={T.ink4}
        multiline={multiline}
      />

      <Text style={styles.hint}>
        Atinge "Locația mea" pentru a completa automat, sau scrie adresa manual.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: SPACING.sm },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    marginTop: SPACING.sm,
  },
  label: { fontSize: 13, fontWeight: FONTS.semibold, color: T.ink2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  clearBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.line2,
    borderRadius: 14,
  },
  clearBtnText: { color: T.ink2, fontSize: 13, fontWeight: FONTS.bold },
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: T.brandTint,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: T.brand + '40',
    minHeight: 32,
    justifyContent: 'center',
  },
  gpsIcon: { fontSize: 13 },
  gpsText: { color: T.brand, fontSize: 12, fontWeight: FONTS.bold },
  input: {
    borderWidth: 1.5,
    borderColor: T.line,
    borderRadius: RADIUS.md,
    backgroundColor: T.bgSoft,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    fontSize: 15,
    color: T.ink,
  },
  hint: { fontSize: 11, color: T.ink4, marginTop: 4, fontStyle: 'italic' },
});
