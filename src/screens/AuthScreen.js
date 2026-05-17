import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Animated,
  ActivityIndicator,
  Dimensions,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useStore from '../store';
import { T, RADIUS, SHADOW, FONTS, useResponsive, display } from '../theme';
import ServerConfigScreen from './ServerConfigScreen';

const TALON_MARK = require('../../assets/talon-login-mark.png');

export default function AuthScreen() {
  const { isTablet, hPad } = useResponsive();
  const login = useStore(s => s.login);
  const register = useStore(s => s.register);

  const [showServerConfig, setShowServerConfig] = useState(false);
  const [tab, setTab] = useState(0);
  const tabAnim = useRef(new Animated.Value(0)).current;
  const errorAnim = useRef(new Animated.Value(0)).current;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const emailRef = useRef(null);
  const passRef = useRef(null);
  const nameRef = useRef(null);
  const phoneRef = useRef(null);

  const switchTab = (index) => {
    setTab(index);
    setError('');
    setEmail('');
    setPassword('');
    setName('');
    setPhone('');
    Animated.spring(tabAnim, {
      toValue: index,
      useNativeDriver: true,
      speed: 20,
      bounciness: 0,
    }).start();
  };

  const showError = (msg) => {
    setError(msg);
    errorAnim.setValue(0);
    Animated.timing(errorAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const validate = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      showError('Adresa de email nu este validă.');
      return false;
    }
    if (password.length < 6) {
      showError('Parola trebuie să aibă minim 6 caractere.');
      return false;
    }
    if (tab === 1) {
      if (name.trim().length < 2) {
        showError('Introdu un nume valid.');
        return false;
      }
      if (phone.trim().length < 10) {
        showError('Introdu un număr de telefon valid.');
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    setError('');
    try {
      if (tab === 0) {
        const res = await login(email.trim(), password);
        if (!res.success) showError(res.error || 'Eroare la autentificare.');
      } else {
        const res = await register(email.trim(), password, name.trim(), phone.trim());
        if (!res.success) showError(res.error || 'Eroare la înregistrare.');
      }
    } catch (e) {
      showError('A apărut o eroare neașteptată.');
    } finally {
      setLoading(false);
    }
  };

  const screenWidth = Dimensions.get('window').width;
  const cardMax = isTablet ? 480 : screenWidth;
  const INNER_WIDTH = Math.min(cardMax, screenWidth) - hPad * 2 - 56;
  const tabIndicatorTranslate = tabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [5, INNER_WIDTH / 2 + 5],
  });

  const fieldStyle = (field) => [
    styles.input,
    focusedField === field && styles.inputFocused,
  ];

  if (showServerConfig) {
    return <ServerConfigScreen navigation={{ goBack: () => setShowServerConfig(false) }} />;
  }

  return (
    <View style={styles.root}>
      <View style={styles.bgGlowPrimary} />
      <View style={styles.bgGlowSecondary} />
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scroll,
              { paddingHorizontal: hPad },
              isTablet && { maxWidth: 480, alignSelf: 'center', width: '100%' },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.hero}>
              <View style={styles.logoWrap}>
                <Image source={TALON_MARK} style={styles.logoImage} resizeMode="contain" />
              </View>
              <Text style={styles.appTitle}>talon.</Text>
              <Text style={styles.appSub}>Mașini și locuințe într-un singur loc</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.tabBar}>
                <Animated.View
                  style={[
                    styles.tabIndicator,
                    { transform: [{ translateX: tabIndicatorTranslate }] },
                  ]}
                />
                <TouchableOpacity
                  style={styles.tabBtn}
                  onPress={() => switchTab(0)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tabLabel, tab === 0 && styles.tabLabelActive]}>
                    Conectare
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.tabBtn}
                  onPress={() => switchTab(1)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tabLabel, tab === 1 && styles.tabLabelActive]}>
                    Cont nou
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.form}>
                {tab === 1 && (
                  <>
                    <Text style={styles.label}>Nume complet</Text>
                    <View style={fieldStyle('name')}>
                      <Text style={styles.inputIcon}>👤</Text>
                      <TextInput
                        ref={nameRef}
                        style={styles.inputText}
                        placeholder="Ion Popescu"
                        placeholderTextColor={T.ink4}
                        value={name}
                        onChangeText={setName}
                        autoCapitalize="words"
                        returnKeyType="next"
                        onFocus={() => setFocusedField('name')}
                        onBlur={() => setFocusedField(null)}
                        onSubmitEditing={() => phoneRef.current?.focus()}
                      />
                    </View>

                    <Text style={styles.label}>Telefon</Text>
                    <View style={fieldStyle('phone')}>
                      <Text style={styles.inputIcon}>📱</Text>
                      <TextInput
                        ref={phoneRef}
                        style={styles.inputText}
                        placeholder="07XX XXX XXX"
                        placeholderTextColor={T.ink4}
                        value={phone}
                        onChangeText={setPhone}
                        keyboardType="phone-pad"
                        returnKeyType="next"
                        onFocus={() => setFocusedField('phone')}
                        onBlur={() => setFocusedField(null)}
                        onSubmitEditing={() => emailRef.current?.focus()}
                      />
                    </View>
                  </>
                )}

                <Text style={styles.label}>Email</Text>
                <View style={fieldStyle('email')}>
                  <Text style={styles.inputIcon}>✉️</Text>
                  <TextInput
                    ref={emailRef}
                    style={styles.inputText}
                    placeholder="email@exemplu.ro"
                    placeholderTextColor={T.ink4}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    onSubmitEditing={() => passRef.current?.focus()}
                  />
                </View>

                <Text style={styles.label}>Parolă</Text>
                <View style={fieldStyle('pass')}>
                  <Text style={styles.inputIcon}>🔒</Text>
                  <TextInput
                    ref={passRef}
                    style={styles.inputText}
                    placeholder="minim 6 caractere"
                    placeholderTextColor={T.ink4}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPass}
                    returnKeyType="done"
                    onFocus={() => setFocusedField('pass')}
                    onBlur={() => setFocusedField(null)}
                    onSubmitEditing={handleSubmit}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPass(v => !v)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.eyeIcon}>{showPass ? '🙈' : '👁'}</Text>
                  </TouchableOpacity>
                </View>

                {error !== '' && (
                  <Animated.Text style={[styles.errorText, { opacity: errorAnim }]}>
                    {error}
                  </Animated.Text>
                )}

                <TouchableOpacity
                  style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                  onPress={handleSubmit}
                  activeOpacity={0.85}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitLabel}>
                      {tab === 0 ? 'Conectare' : 'Creează cont'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.footer}>Talon. © 2026</Text>
            <TouchableOpacity onPress={() => setShowServerConfig(true)} style={styles.serverConfigBtn}>
              <Text style={styles.serverConfigText}>⚙️ Configurare server</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F7F4EF',
  },
  bgGlowPrimary: {
    position: 'absolute',
    top: -140,
    right: -90,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(255, 107, 26, 0.14)',
  },
  bgGlowSecondary: {
    position: 'absolute',
    top: 120,
    left: -70,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255, 184, 141, 0.18)',
  },
  safe: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 40,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoWrap: {
    width: 108,
    height: 108,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.88)',
    marginBottom: 18,
    ...SHADOW.md,
    shadowOpacity: 0.08,
    shadowRadius: 18,
  },
  logoImage: {
    width: 88,
    height: 88,
  },
  appTitle: {
    fontSize: 48,
    color: '#0E1116',
    marginBottom: 8,
    ...display(700, { letterSpacing: -1.4 }),
  },
  appSub: {
    fontSize: 17,
    fontWeight: FONTS.regular,
    color: '#6E7582',
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 24,
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 34,
    padding: 28,
    ...SHADOW.md,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ECEEF2',
    borderRadius: 22,
    marginBottom: 24,
    height: 56,
    position: 'relative',
    overflow: 'hidden',
    padding: 5,
  },
  tabIndicator: {
    position: 'absolute',
    top: 5,
    left: 0,
    width: '50%',
    height: 46,
    backgroundColor: T.brand,
    borderRadius: 18,
  },
  tabBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  tabLabel: {
    fontSize: 16,
    fontWeight: FONTS.medium,
    color: '#6E7582',
  },
  tabLabelActive: {
    color: '#fff',
    fontWeight: FONTS.semibold,
  },
  form: {
    gap: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: FONTS.semibold,
    color: T.ink2,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E1E4EA',
    borderRadius: 18,
    backgroundColor: '#FBFBFC',
    paddingHorizontal: 16,
    height: 58,
  },
  inputFocused: {
    borderColor: T.brand,
    backgroundColor: '#FFF5EE',
  },
  inputIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  inputText: {
    flex: 1,
    fontSize: 15,
    fontWeight: FONTS.regular,
    color: T.ink,
  },
  eyeIcon: {
    fontSize: 18,
    paddingLeft: 8,
  },
  errorText: {
    fontSize: 13,
    fontWeight: FONTS.medium,
    color: T.danger,
    marginTop: 10,
    textAlign: 'center',
  },
  submitBtn: {
    marginTop: 24,
    height: 56,
    borderRadius: 20,
    backgroundColor: T.brand,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOW.md,
    shadowColor: T.brand,
    shadowOpacity: 0.4,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitLabel: {
    fontSize: 16,
    fontWeight: FONTS.bold,
    color: '#fff',
    letterSpacing: 0.3,
  },
  footer: {
    marginTop: 32,
    fontSize: 12,
    color: '#6E7582',
    opacity: 0.92,
  },
  serverConfigBtn: {
    marginTop: 12,
    paddingVertical: 6,
  },
  serverConfigText: {
    fontSize: 12,
    color: T.brand,
    opacity: 0.9,
    fontWeight: FONTS.medium,
  },
});
