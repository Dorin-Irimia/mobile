import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import useStore from '../store';
import { T, RADIUS, SHADOW, FONTS } from '../theme';

const APP_VERSION = '1.0.0';

function SectionTitle({ label }) {
  return <Text style={styles.sectionTitle}>{label}</Text>;
}

function ToggleRow({ icon, label, value, onValueChange, disabled }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: T.line, true: T.brandSoft }}
        thumbColor={value ? T.brand : T.ink4}
        ios_backgroundColor={T.line}
      />
    </View>
  );
}

function SelectRow({ icon, label, options, selected, onSelect }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.segmented}>
        {options.map(opt => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.segmentBtn, selected === opt.value && styles.segmentBtnActive]}
            onPress={() => onSelect(opt.value)}
            activeOpacity={0.75}
          >
            <Text style={[styles.segmentLabel, selected === opt.value && styles.segmentLabelActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function InfoRow({ icon, label, value, onPress }) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <Text style={styles.rowIcon}>{icon}</Text>
      <Text style={styles.rowLabel}>{label}</Text>
      {value !== undefined && (
        <Text style={styles.rowValue}>{value}</Text>
      )}
      {onPress && <Text style={styles.rowArrow}>›</Text>}
    </TouchableOpacity>
  );
}

function RowSep() {
  return <View style={styles.rowSep} />;
}

export default function SettingsScreen({ navigation }) {
  const logout = useStore(s => s.logout);

  const [notifEnabled, setNotifEnabled] = useState(true);
  const [notifITP, setNotifITP] = useState(true);
  const [notifRCA, setNotifRCA] = useState(true);
  const [notifCASCO, setNotifCASCO] = useState(true);
  const [biometric, setBiometric] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [units, setUnits] = useState('km');
  const [currency, setCurrency] = useState('RON');

  useEffect(() => {
    (async () => {
      try {
        const available = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        setBiometricAvailable(available && enrolled);

        const stored = await SecureStore.getItemAsync('biometric_enabled');
        setBiometric(stored === 'true');

        const storedNotif = await SecureStore.getItemAsync('notif_enabled');
        if (storedNotif !== null) setNotifEnabled(storedNotif === 'true');

        const storedITP = await SecureStore.getItemAsync('notif_itp');
        if (storedITP !== null) setNotifITP(storedITP === 'true');

        const storedRCA = await SecureStore.getItemAsync('notif_rca');
        if (storedRCA !== null) setNotifRCA(storedRCA === 'true');

        const storedCASCO = await SecureStore.getItemAsync('notif_casco');
        if (storedCASCO !== null) setNotifCASCO(storedCASCO === 'true');

        const storedUnits = await SecureStore.getItemAsync('pref_units');
        if (storedUnits) setUnits(storedUnits);

        const storedCurrency = await SecureStore.getItemAsync('pref_currency');
        if (storedCurrency) setCurrency(storedCurrency);
      } catch (e) {
      }
    })();
  }, []);

  const saveSecure = async (key, value) => {
    try {
      await SecureStore.setItemAsync(key, String(value));
    } catch (e) {
    }
  };

  const handleNotifEnabled = (val) => {
    setNotifEnabled(val);
    saveSecure('notif_enabled', val);
  };

  const handleNotifITP = (val) => {
    setNotifITP(val);
    saveSecure('notif_itp', val);
  };

  const handleNotifRCA = (val) => {
    setNotifRCA(val);
    saveSecure('notif_rca', val);
  };

  const handleNotifCASCO = (val) => {
    setNotifCASCO(val);
    saveSecure('notif_casco', val);
  };

  const handleBiometric = async (val) => {
    if (val) {
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Autentifică-te pentru a activa această funcție',
          cancelLabel: 'Anulează',
          disableDeviceFallback: false,
        });
        if (result.success) {
          setBiometric(true);
          saveSecure('biometric_enabled', true);
        } else {
          Alert.alert('Autentificare eșuată', 'Nu s-a putut activa autentificarea biometrică.');
        }
      } catch (e) {
        Alert.alert('Eroare', 'Autentificarea biometrică nu este disponibilă.');
      }
    } else {
      setBiometric(false);
      saveSecure('biometric_enabled', false);
    }
  };

  const handleUnits = (val) => {
    setUnits(val);
    saveSecure('pref_units', val);
  };

  const handleCurrency = (val) => {
    setCurrency(val);
    saveSecure('pref_currency', val);
  };

  const handleDeleteData = () => {
    Alert.alert(
      'Șterge date locale',
      'Această acțiune va șterge toate datele salvate local. Ești sigur?',
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Continuă',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Confirmare finală',
              'Datele locale vor fi șterse definitiv. Nu se poate anula.',
              [
                { text: 'Anulează', style: 'cancel' },
                {
                  text: 'Șterge',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      const keys = [
                        'biometric_enabled',
                        'notif_enabled',
                        'notif_itp',
                        'notif_rca',
                        'notif_casco',
                        'pref_units',
                        'pref_currency',
                      ];
                      await Promise.all(keys.map(k => SecureStore.deleteItemAsync(k)));
                      Alert.alert('Succes', 'Datele locale au fost șterse.');
                    } catch (e) {
                      Alert.alert('Eroare', 'Nu s-au putut șterge datele.');
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const handlePrivacy = () => {
    Alert.alert('Politică confidențialitate', 'Vizitează urbio.ro/privacy pentru detalii.');
  };

  const handleTerms = () => {
    Alert.alert('Termeni și condiții', 'Vizitează urbio.ro/terms pentru detalii.');
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.header} edges={['top']}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => navigation.canGoBack() && navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.backBtn}
          >
            <Text style={styles.backBtnText}>← Înapoi</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Setări</Text>
          <View style={styles.headerPlaceholder} />
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SectionTitle label="Notificări" />
        <View style={styles.card}>
          <ToggleRow
            icon="🔔"
            label="Notificări activate"
            value={notifEnabled}
            onValueChange={handleNotifEnabled}
          />
          <RowSep />
          <ToggleRow
            icon="🔧"
            label="Scadențe ITP"
            value={notifITP}
            onValueChange={handleNotifITP}
            disabled={!notifEnabled}
          />
          <RowSep />
          <ToggleRow
            icon="🛡️"
            label="Scadențe RCA"
            value={notifRCA}
            onValueChange={handleNotifRCA}
            disabled={!notifEnabled}
          />
          <RowSep />
          <ToggleRow
            icon="🏥"
            label="Scadențe CASCO"
            value={notifCASCO}
            onValueChange={handleNotifCASCO}
            disabled={!notifEnabled}
          />
        </View>

        <SectionTitle label="Securitate" />
        <View style={styles.card}>
          <ToggleRow
            icon="👆"
            label="Autentificare biometrică"
            value={biometric}
            onValueChange={handleBiometric}
            disabled={!biometricAvailable}
          />
          {!biometricAvailable && (
            <Text style={styles.biometricHint}>
              Dispozitivul tău nu suportă autentificarea biometrică sau nu este configurată.
            </Text>
          )}
        </View>

        <SectionTitle label="Preferințe" />
        <View style={styles.card}>
          <SelectRow
            icon="📏"
            label="Unități"
            options={[
              { label: 'km', value: 'km' },
              { label: 'mile', value: 'mile' },
            ]}
            selected={units}
            onSelect={handleUnits}
          />
          <RowSep />
          <SelectRow
            icon="💱"
            label="Monedă"
            options={[
              { label: 'RON', value: 'RON' },
              { label: 'EUR', value: 'EUR' },
            ]}
            selected={currency}
            onSelect={handleCurrency}
          />
          <RowSep />
          <InfoRow icon="🌍" label="Limbă" value="Română" />
        </View>

        <SectionTitle label="Despre" />
        <View style={styles.card}>
          <InfoRow icon="📱" label="Versiune" value={APP_VERSION} />
          <RowSep />
          <InfoRow
            icon="🔒"
            label="Politică confidențialitate"
            onPress={handlePrivacy}
          />
          <RowSep />
          <InfoRow
            icon="📋"
            label="Termeni și condiții"
            onPress={handleTerms}
          />
        </View>

        <SectionTitle label="Date" />
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={handleDeleteData}
          activeOpacity={0.85}
        >
          <Text style={styles.deleteIcon}>🗑️</Text>
          <Text style={styles.deleteBtnLabel}>Șterge toate datele locale</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: T.bg,
  },
  header: {
    backgroundColor: T.brand,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  backBtn: {
    flex: 1,
  },
  backBtnText: {
    fontSize: 15,
    fontWeight: FONTS.medium,
    color: '#fff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: FONTS.bold,
    color: '#fff',
  },
  headerPlaceholder: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: FONTS.semibold,
    color: T.ink3,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 24,
    marginBottom: 10,
    marginLeft: 4,
  },
  card: {
    backgroundColor: T.card,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    ...SHADOW.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
  },
  rowIcon: {
    fontSize: 20,
    marginRight: 12,
    width: 28,
    textAlign: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: FONTS.medium,
    color: T.ink,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: FONTS.regular,
    color: T.ink3,
    marginRight: 4,
  },
  rowArrow: {
    fontSize: 22,
    color: T.ink4,
    marginLeft: 4,
  },
  rowSep: {
    height: 1,
    backgroundColor: T.line2,
    marginLeft: 56,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: T.line2,
    borderRadius: RADIUS.sm,
    padding: 3,
    gap: 3,
  },
  segmentBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.sm - 2,
  },
  segmentBtnActive: {
    backgroundColor: T.brand,
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: FONTS.semibold,
    color: T.ink3,
  },
  segmentLabelActive: {
    color: '#fff',
  },
  biometricHint: {
    fontSize: 12,
    fontWeight: FONTS.regular,
    color: T.ink4,
    paddingHorizontal: 16,
    paddingBottom: 12,
    lineHeight: 17,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.dangerTint,
    borderRadius: RADIUS.lg,
    padding: 16,
    borderWidth: 1.5,
    borderColor: T.danger,
    gap: 10,
  },
  deleteIcon: {
    fontSize: 20,
  },
  deleteBtnLabel: {
    fontSize: 15,
    fontWeight: FONTS.bold,
    color: T.danger,
  },
  bottomSpacer: {
    height: 40,
  },
});
