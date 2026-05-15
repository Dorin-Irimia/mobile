import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';
import { getApiUrl, saveApiUrl, DEFAULT_API_URL } from '../api/client';
import { T, RADIUS, FONTS, SHADOW } from '../theme';

export default function ServerConfigScreen({ navigation }) {
  const [url, setUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => { setUrl(getApiUrl()); }, []);

  const test = async (testUrl) => {
    setTesting(true);
    setStatus(null);
    try {
      const res = await axios.get(`${testUrl}/api/health`, { timeout: 5000 });
      if (res.data?.status === 'ok') {
        setStatus('ok');
        return true;
      }
    } catch {
      setStatus('error');
      return false;
    } finally { setTesting(false); }
  };

  const save = async () => {
    const cleaned = url.trim().replace(/\/$/, '');
    const ok = await test(cleaned);
    if (ok) {
      await saveApiUrl(cleaned);
      Alert.alert('✓ Salvat', 'Serverul a fost configurat cu succes!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } else {
      Alert.alert('Eroare', 'Nu pot ajunge la server. Verifică IP-ul și că backend-ul rulează.');
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹ Înapoi</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Configurare Server</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>📡 Cum găsești IP-ul laptopului?</Text>
          <Text style={styles.infoText}>Pe Mac, deschide Terminal și scrie:{'\n'}
            <Text style={styles.code}>ipconfig getifaddr en0</Text>
            {'\n\n'}Formatul adresei:{'\n'}
            <Text style={styles.code}>http://192.168.X.X:3001</Text>
          </Text>
        </View>

        <Text style={styles.label}>Adresa serverului</Text>
        <TextInput
          style={[styles.input, status === 'error' && styles.inputError, status === 'ok' && styles.inputOk]}
          value={url}
          onChangeText={v => { setUrl(v); setStatus(null); }}
          placeholder="http://192.168.1.XXX:3001"
          placeholderTextColor={T.ink4}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        {status === 'ok' && <Text style={styles.okText}>✓ Server accesibil</Text>}
        {status === 'error' && <Text style={styles.errText}>✗ Server inaccesibil</Text>}

        <TouchableOpacity style={styles.testBtn} onPress={() => test(url.trim())} disabled={testing}>
          {testing ? <ActivityIndicator color={T.brand} size="small" /> : <Text style={styles.testBtnText}>Testează conexiunea</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={testing || !url.trim()}>
          <Text style={styles.saveBtnText}>Salvează și conectează</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.resetBtn} onPress={() => { setUrl(DEFAULT_API_URL); setStatus(null); }}>
          <Text style={styles.resetBtnText}>Resetează la implicit ({DEFAULT_API_URL})</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: T.card, borderBottomWidth: 1, borderBottomColor: T.line },
  back: { fontSize: 17, color: T.brand, fontWeight: FONTS.medium },
  title: { fontSize: 16, fontWeight: FONTS.semibold, color: T.ink },
  content: { padding: 20 },
  infoBox: { backgroundColor: T.brandTint, borderRadius: RADIUS.lg, padding: 16, marginBottom: 24, borderLeftWidth: 4, borderLeftColor: T.brand },
  infoTitle: { fontSize: 14, fontWeight: FONTS.semibold, color: T.brandDark, marginBottom: 8 },
  infoText: { fontSize: 13, color: T.ink2, lineHeight: 20 },
  code: { fontFamily: 'monospace', backgroundColor: 'rgba(0,0,0,0.08)', color: T.brandDark },
  label: { fontSize: 13, fontWeight: FONTS.medium, color: T.ink2, marginBottom: 8 },
  input: { backgroundColor: T.card, borderRadius: RADIUS.md, padding: 14, fontSize: 15, color: T.ink, borderWidth: 1.5, borderColor: T.line, marginBottom: 8 },
  inputError: { borderColor: T.danger },
  inputOk: { borderColor: T.success },
  okText: { fontSize: 13, color: T.success, fontWeight: FONTS.medium, marginBottom: 12 },
  errText: { fontSize: 13, color: T.danger, fontWeight: FONTS.medium, marginBottom: 12 },
  testBtn: { borderWidth: 1.5, borderColor: T.brand, borderRadius: RADIUS.md, paddingVertical: 12, alignItems: 'center', marginBottom: 12 },
  testBtnText: { color: T.brand, fontWeight: FONTS.semibold, fontSize: 15 },
  saveBtn: { backgroundColor: T.brand, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center', marginBottom: 12, ...SHADOW.md },
  saveBtnText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 16 },
  resetBtn: { alignItems: 'center', paddingVertical: 8 },
  resetBtnText: { color: T.ink3, fontSize: 12 },
});
