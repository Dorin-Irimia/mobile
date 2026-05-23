// Allows a user currently in guest (local-only) mode to create / sign in to
// a real account. On success, every locally-stored item is pushed to the
// server in dependency order — vehicles before fuel logs, households before
// expenses, etc. ID references are translated through an in-flight map so
// nothing gets orphaned.

import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useStore from '../store';
import { T, RADIUS, SHADOW, FONTS, display } from '../theme';

export default function UpgradeToAccountScreen({ navigation }) {
  const login = useStore(s => s.login);
  const register = useStore(s => s.register);
  const migrateGuestData = useStore(s => s.migrateGuestData);
  const state = useStore.getState();

  // Show user how much data they're about to upload — anchors the value.
  const counts = useMemo(() => {
    const s = state;
    const isLocal = (u) => typeof u === 'string' && u.startsWith('file:');
    const countAtts = (arr) =>
      (arr || []).reduce((sum, item) => sum + ((item.attachments || []).filter(a => isLocal(a.fileUrl)).length), 0);
    return {
      vehicles: (s.vehicles || []).length,
      households: (s.households || []).length,
      docs: (s.documents || []).length,
      invoices: (s.invoices || []).length,
      fuel: (s.fuelLogs || []).length,
      services: (s.serviceRecords || []).length,
      expenses: (s.householdExpenses || []).length,
      incomes: (s.householdIncomes || []).length,
      bills: (s.householdBills || []).length,
      budgets: (s.budgetCategories || []).length,
      // attachments that ride along with their parent record
      attachments:
        countAtts(s.invoices) + countAtts(s.fuelLogs) + countAtts(s.householdExpenses)
        + (s.documents || []).filter(d => isLocal(d.fileUrl)).length,
    };
  }, []);
  const totalItems = counts.vehicles + counts.households + counts.docs + counts.invoices
    + counts.fuel + counts.services + counts.expenses + counts.incomes + counts.bills + counts.budgets;

  const [tab, setTab] = useState(1); // 0 = login, 1 = register
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(null); // { done, total, label }

  const handleSubmit = async () => {
    setError('');
    const emailOK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    if (!emailOK) return setError('Email invalid.');
    if (password.length < 6) return setError('Parola minim 6 caractere.');
    if (tab === 1) {
      if (name.trim().length < 2) return setError('Nume invalid.');
      if (phone.trim().length < 10) return setError('Telefon invalid.');
    }

    setSubmitting(true);
    try {
      // Step 1 — auth. This swaps the guest user object with a real one
      // (login/register also clears isGuest implicitly via auth flow).
      const result = tab === 0
        ? await login(email.trim(), password)
        : await register(email.trim(), password, name.trim(), phone.trim());

      if (!result?.success) {
        setError(result?.error || 'Autentificare eșuată.');
        setSubmitting(false);
        return;
      }

      // Step 2 — upload local cache to server.
      setProgress({ done: 0, total: totalItems, label: totalItems ? 'Pregătesc datele…' : 'Nu am ce migra' });
      const stats = await migrateGuestData((p) => setProgress(p));
      setProgress({ done: stats.total, total: stats.total, label: 'Gata!' });

      setTimeout(() => {
        Alert.alert(
          'Migrare completă',
          `${stats.migrated} înregistrări mutate pe server.${stats.failed ? ` ${stats.failed} au eșuat.` : ''}`,
          [{ text: 'OK', onPress: () => navigation.popToTop?.() || navigation.goBack() }]
        );
      }, 400);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Eroare neașteptată.');
      setSubmitting(false);
      setProgress(null);
    }
  };

  if (progress) {
    const pct = progress.total > 0 ? Math.min(100, (progress.done / progress.total) * 100) : 0;
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.progressWrap}>
          <Text style={styles.progressEmoji}>☁️</Text>
          <Text style={[styles.progressTitle, display(700)]}>Salvez datele tale pe server</Text>
          <Text style={styles.progressLabel}>{progress.label}</Text>

          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${pct}%` }]} />
          </View>
          <Text style={styles.progressCount}>
            {progress.done} / {progress.total || '—'} înregistrări
          </Text>
          <ActivityIndicator color={T.brand} style={{ marginTop: 20 }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, display(700)]}>Creează cont</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Value proposition card */}
          <View style={styles.intro}>
            <Text style={styles.introIcon}>☁️</Text>
            <Text style={[styles.introTitle, display(700)]}>Salvează totul în cloud</Text>
            <Text style={styles.introSub}>
              Acum aplicația ține totul doar pe acest telefon. Cu un cont, datele
              tale ajung pe server și poți accesa de pe orice telefon.
            </Text>

            {totalItems > 0 && (
              <View style={styles.summary}>
                <Text style={styles.summaryTitle}>Pregătit pentru upload:</Text>
                <View style={styles.summaryRow}>
                  {counts.vehicles  > 0 && <Pill emoji="🚗" label="vehicule"  n={counts.vehicles}  />}
                  {counts.invoices  > 0 && <Pill emoji="🧾" label="facturi"   n={counts.invoices}  />}
                  {counts.fuel      > 0 && <Pill emoji="⛽" label="alimentări" n={counts.fuel}      />}
                  {counts.services  > 0 && <Pill emoji="🔧" label="service"   n={counts.services}  />}
                  {counts.households > 0 && <Pill emoji="🏠" label="locuințe" n={counts.households} />}
                  {counts.expenses  > 0 && <Pill emoji="💸" label="cheltuieli" n={counts.expenses} />}
                  {counts.incomes   > 0 && <Pill emoji="💰" label="venituri"  n={counts.incomes}   />}
                  {counts.bills     > 0 && <Pill emoji="📄" label="facturi recurente" n={counts.bills} />}
                  {counts.budgets   > 0 && <Pill emoji="📊" label="bugete"    n={counts.budgets}   />}
                  {counts.docs      > 0 && <Pill emoji="📁" label="documente" n={counts.docs}      />}
                  {counts.attachments > 0 && <Pill emoji="📎" label="fișiere atașate" n={counts.attachments} />}
                </View>
                <Text style={styles.summaryTotal}>
                  Total: {totalItems} înregistrări
                  {counts.attachments > 0 ? ` + ${counts.attachments} fișiere` : ''}
                </Text>
              </View>
            )}
          </View>

          {/* Tab switcher */}
          <View style={styles.card}>
            <View style={styles.tabBar}>
              <TouchableOpacity
                style={[styles.tabBtn, tab === 0 && styles.tabBtnActive]}
                onPress={() => setTab(0)}
              >
                <Text style={[styles.tabLabel, tab === 0 && styles.tabLabelActive]}>Conectare</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabBtn, tab === 1 && styles.tabBtnActive]}
                onPress={() => setTab(1)}
              >
                <Text style={[styles.tabLabel, tab === 1 && styles.tabLabelActive]}>Cont nou</Text>
              </TouchableOpacity>
            </View>

            {tab === 1 && (
              <>
                <Field label="Nume complet" value={name} onChange={setName} placeholder="Ion Popescu" />
                <Field label="Telefon" value={phone} onChange={setPhone} placeholder="07XX XXX XXX" keyboardType="phone-pad" />
              </>
            )}
            <Field label="Email" value={email} onChange={setEmail} placeholder="email@exemplu.ro" keyboardType="email-address" autoCapitalize="none" />
            <Field
              label="Parolă"
              value={password}
              onChange={setPassword}
              placeholder="minim 6 caractere"
              secureTextEntry={!showPass}
              right={
                <TouchableOpacity onPress={() => setShowPass(s => !s)}>
                  <Text style={{ fontSize: 18 }}>{showPass ? '🙈' : '👁'}</Text>
                </TouchableOpacity>
              }
            />

            {error !== '' && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity
              style={[styles.submit, submitting && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitText}>
                    {tab === 0 ? 'Conectează-te și sincronizează' : 'Creează cont și salvează'}
                  </Text>}
            </TouchableOpacity>
            <Text style={styles.disclaimer}>
              Datele tale locale rămân pe telefon până la sfârșitul procesului. Dacă ceva eșuează, le poți încerca din nou.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChange, placeholder, secureTextEntry, keyboardType, autoCapitalize, right }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.input}>
        <TextInput
          style={styles.inputText}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={T.ink4}
          secureTextEntry={!!secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
        />
        {right}
      </View>
    </View>
  );
}

function Pill({ emoji, label, n }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{emoji} {n} {label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 12,
    backgroundColor: T.card, borderBottomWidth: 1, borderBottomColor: T.line,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backArrow: { color: T.brand, fontSize: 30, lineHeight: 32 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, color: T.ink, fontWeight: FONTS.bold },

  scroll: { padding: 16, paddingBottom: 60, gap: 14 },

  intro: { backgroundColor: T.card, borderRadius: RADIUS.xl, padding: 18, alignItems: 'center', ...SHADOW.sm },
  introIcon: { fontSize: 44, marginBottom: 8 },
  introTitle: { fontSize: 20, color: T.ink, fontWeight: FONTS.bold, textAlign: 'center' },
  introSub: { fontSize: 13, color: T.ink3, marginTop: 8, textAlign: 'center', lineHeight: 18 },

  summary: { marginTop: 14, alignSelf: 'stretch' },
  summaryTitle: { fontSize: 11, color: T.ink3, fontWeight: FONTS.semibold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { backgroundColor: T.brandTint, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  pillText: { fontSize: 11, color: T.brandDark, fontWeight: FONTS.semibold },
  summaryTotal: { fontSize: 12, color: T.ink, fontWeight: FONTS.bold, marginTop: 8 },

  card: { backgroundColor: T.card, borderRadius: RADIUS.lg, padding: 16, ...SHADOW.sm },

  tabBar: { flexDirection: 'row', backgroundColor: T.line2, borderRadius: 999, padding: 4, marginBottom: 16 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 999 },
  tabBtnActive: { backgroundColor: T.brand },
  tabLabel: { fontSize: 13, color: T.ink2, fontWeight: FONTS.semibold },
  tabLabelActive: { color: '#fff', fontWeight: FONTS.bold },

  label: { fontSize: 12, color: T.ink2, fontWeight: FONTS.semibold, marginBottom: 6 },
  input: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: T.bgSoft, borderWidth: 1, borderColor: T.line,
    borderRadius: 14, paddingHorizontal: 14, height: 50,
  },
  inputText: { flex: 1, fontSize: 14, color: T.ink },

  error: { fontSize: 12, color: T.danger, marginBottom: 8, textAlign: 'center', fontWeight: FONTS.semibold },

  submit: {
    backgroundColor: T.brand, paddingVertical: 14, borderRadius: 16,
    alignItems: 'center', marginTop: 6, ...SHADOW.md,
  },
  submitText: { color: '#fff', fontSize: 15, fontWeight: FONTS.bold },
  disclaimer: { fontSize: 11, color: T.ink4, marginTop: 12, textAlign: 'center', lineHeight: 15 },

  // Progress overlay
  progressWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  progressEmoji: { fontSize: 60 },
  progressTitle: { fontSize: 20, color: T.ink, fontWeight: FONTS.bold, marginTop: 16, textAlign: 'center' },
  progressLabel: { fontSize: 13, color: T.ink3, marginTop: 8, textAlign: 'center' },
  progressBarTrack: {
    marginTop: 30, height: 10, width: '100%', backgroundColor: T.line2,
    borderRadius: 5, overflow: 'hidden',
  },
  progressBarFill: { height: '100%', backgroundColor: T.brand, borderRadius: 5 },
  progressCount: { fontSize: 12, color: T.ink3, marginTop: 8, fontWeight: FONTS.semibold },
});
