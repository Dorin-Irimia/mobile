import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useStore from '../store';
import {
  T,
  RADIUS,
  FONTS,
  SHADOW,
  SPACING,
  useResponsive,
  HIT_SLOP,
} from '../theme';

export default function ModeSelectorScreen({ onSelected }) {
  const setAppMode = useStore(s => s.setAppMode);
  const user = useStore(s => s.user);
  const { isTablet, hPad, maxContentWidth } = useResponsive();

  const choose = (mode) => {
    setAppMode(mode);
    if (onSelected) onSelected(mode);
  };

  const firstName = user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'utilizator';

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingHorizontal: hPad },
            isTablet && { maxWidth: maxContentWidth, alignSelf: 'center', width: '100%' },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.hello}>Salut, {firstName}! 👋</Text>
            <Text style={styles.title}>Ce vrei să gestionezi astăzi?</Text>
            <Text style={styles.subtitle}>Poți schimba oricând din Profil.</Text>
          </View>

          <TouchableOpacity
            style={[styles.card, styles.cardVehicle]}
            onPress={() => choose('vehicle')}
            activeOpacity={0.85}
          >
            <View style={styles.cardIconWrap}>
              <Text style={styles.cardIcon}>🚗</Text>
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>Mașini</Text>
              <Text style={styles.cardDesc}>
                Vehiculele tale, documente, scadențe, cheltuieli, combustibil, partajare cu familia
              </Text>
              <View style={styles.featureRow}>
                <View style={styles.featurePill}><Text style={styles.featureText}>📅 ITP/RCA</Text></View>
                <View style={styles.featurePill}><Text style={styles.featureText}>⛽ Combustibil</Text></View>
                <View style={styles.featurePill}><Text style={styles.featureText}>🧾 Facturi</Text></View>
              </View>
            </View>
            <Text style={styles.cardArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.card, styles.cardHousehold]}
            onPress={() => choose('household')}
            activeOpacity={0.85}
          >
            <View style={[styles.cardIconWrap, styles.cardIconWrapHouse]}>
              <Text style={styles.cardIcon}>🏠</Text>
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>Casa</Text>
              <Text style={styles.cardDesc}>
                Locuința ta — cheltuieli utilități, venituri, programări, partajare cu membrii familiei
              </Text>
              <View style={styles.featureRow}>
                <View style={[styles.featurePill, { backgroundColor: '#E0F2FE' }]}>
                  <Text style={[styles.featureText, { color: '#0369A1' }]}>💡 Utilități</Text>
                </View>
                <View style={[styles.featurePill, { backgroundColor: '#DCFCE7' }]}>
                  <Text style={[styles.featureText, { color: '#15803D' }]}>💰 Venituri</Text>
                </View>
                <View style={[styles.featurePill, { backgroundColor: '#FCE7F3' }]}>
                  <Text style={[styles.featureText, { color: '#9F1239' }]}>📅 Evenimente</Text>
                </View>
              </View>
            </View>
            <Text style={styles.cardArrow}>›</Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              💡 Tip: poți avea atât mașini cât și locuințe. Datele sunt separate, dar prietenii și contul rămân comune.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  content: { flexGrow: 1, paddingVertical: SPACING.xl, gap: SPACING.lg },
  header: { marginBottom: SPACING.lg, alignItems: 'center' },
  hello: { fontSize: 14, color: T.ink3, fontWeight: FONTS.medium },
  title: {
    fontSize: 26,
    fontWeight: FONTS.bold,
    color: T.ink,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  subtitle: { fontSize: 13, color: T.ink3, marginTop: SPACING.sm, textAlign: 'center' },

  card: {
    backgroundColor: T.card,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    ...SHADOW.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardVehicle: { borderColor: T.brandTint2 },
  cardHousehold: { borderColor: '#FCE7F3' },

  cardIconWrap: {
    width: 70,
    height: 70,
    borderRadius: 18,
    backgroundColor: T.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconWrapHouse: { backgroundColor: '#FCE7F3' },
  cardIcon: { fontSize: 38 },

  cardBody: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 22, fontWeight: FONTS.bold, color: T.ink },
  cardDesc: { fontSize: 13, color: T.ink3, lineHeight: 18 },

  featureRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: SPACING.sm },
  featurePill: {
    backgroundColor: T.brandTint,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  featureText: { fontSize: 11, color: T.brand, fontWeight: FONTS.semibold },

  cardArrow: { fontSize: 32, color: T.ink3, fontWeight: FONTS.light },

  footer: {
    marginTop: SPACING.xl,
    backgroundColor: T.brandTint,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  footerText: { fontSize: 12, color: T.brandDark, textAlign: 'center', lineHeight: 18 },
});
