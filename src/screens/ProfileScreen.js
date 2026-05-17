import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  ActivityIndicator,
  Switch,
  Image,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Notifications from 'expo-notifications';
import useStore from '../store';
import {
  T,
  RADIUS,
  SHADOW,
  FONTS,
  SPACING,
  formatDate,
  formatCurrency,
  useResponsive,
  HIT_SLOP,
  HIT_SLOP_LG,
  TOUCH_TARGET,
  IS_IOS,
  display,
} from '../theme';
import { getApiUrl } from '../api/client';
import packageJson from '../../package.json';
import {
  QUICK_ACTIONS,
  MAX_HOME_QUICK_ACTIONS,
  normalizeQuickActionIds,
} from '../utils/quickActions';
import { sendTestLocalNotification } from '../hooks/usePushNotifications';
import { showOfflineAlert } from '../utils/onlineGate';

const APP_VERSION = packageJson.version || '1.0.0';

function Avatar({ name, uri, size = 96, onPress }) {
  const initials = (name || '')
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase() || '?';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.85 : 1}
      disabled={!onPress}
    >
      <View
        style={[
          styles.avatar,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
      >
        {uri ? (
          <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
        ) : (
          <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>{initials}</Text>
        )}
        {onPress && (
          <View style={styles.avatarEditBadge}>
            <Text style={styles.avatarEditIcon}>📷</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function Card({ title, children, style }) {
  return (
    <View style={[styles.card, style]}>
      {title && <Text style={styles.cardTitle}>{title}</Text>}
      {children}
    </View>
  );
}

function StatCol({ icon, label, value }) {
  return (
    <View style={styles.statCol}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({ label, value, danger }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text
        style={[styles.infoValue, danger && { color: T.danger }]}
        numberOfLines={1}
        ellipsizeMode="middle"
      >
        {value}
      </Text>
    </View>
  );
}

function ActionRow({ icon, label, sub, onPress, color = T.ink, arrow = true }) {
  return (
    <TouchableOpacity
      style={styles.actionRow}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.actionIcon, { color }]}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.actionLabel, { color }]}>{label}</Text>
        {sub && <Text style={styles.actionSub}>{sub}</Text>}
      </View>
      {arrow && <Text style={styles.actionArrow}>›</Text>}
    </TouchableOpacity>
  );
}

function ToggleRow({ icon, label, sub, value, onValueChange, disabled }) {
  return (
    <View style={styles.actionRow}>
      <Text style={styles.actionIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.actionLabel}>{label}</Text>
        {sub && <Text style={styles.actionSub}>{sub}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: T.line, true: T.brand }}
        thumbColor={IS_IOS ? undefined : '#fff'}
      />
    </View>
  );
}

function QuickActionOption({ action, selected, order, onToggle, onMoveUp, onMoveDown, canMoveUp, canMoveDown }) {
  return (
    <View style={[styles.quickActionOption, selected && styles.quickActionOptionActive]}>
      <Text style={styles.quickActionOptionIcon}>{action.icon}</Text>
      <View style={styles.quickActionOptionText}>
        <Text style={styles.quickActionOptionLabel}>{action.label}</Text>
        <Text style={styles.quickActionOptionSub}>{action.description}</Text>
      </View>
      {selected && (
        <View style={styles.quickActionOrder}>
          <Text style={styles.quickActionOrderText}>{order}</Text>
          <TouchableOpacity
            style={[styles.quickActionOrderBtn, !canMoveUp && styles.quickActionOrderBtnDisabled]}
            onPress={onMoveUp}
            disabled={!canMoveUp}
            hitSlop={HIT_SLOP}
          >
            <Text style={styles.quickActionOrderBtnText}>↑</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickActionOrderBtn, !canMoveDown && styles.quickActionOrderBtnDisabled]}
            onPress={onMoveDown}
            disabled={!canMoveDown}
            hitSlop={HIT_SLOP}
          >
            <Text style={styles.quickActionOrderBtnText}>↓</Text>
          </TouchableOpacity>
        </View>
      )}
      <TouchableOpacity
        style={[styles.quickActionToggle, selected && styles.quickActionToggleActive]}
        onPress={onToggle}
        activeOpacity={0.8}
        hitSlop={HIT_SLOP}
      >
        {selected && <Text style={styles.quickActionCheck}>✓</Text>}
      </TouchableOpacity>
    </View>
  );
}

function ModeSwitcher() {
  const appMode = useStore(s => s.appMode);
  const setAppMode = useStore(s => s.setAppMode);

  const options = [
    { key: 'vehicle', icon: '🚗', label: 'Mașini', desc: 'Vehicule, documente, scadențe, facturi' },
    { key: 'household', icon: '🏠', label: 'Casă', desc: 'Cheltuieli, venituri, evenimente locuință' },
  ];

  return (
    <View style={{ gap: 8 }}>
      {options.map(opt => {
        const active = appMode === opt.key;
        return (
          <TouchableOpacity
            key={opt.key}
            onPress={() => setAppMode(opt.key)}
            activeOpacity={0.85}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: SPACING.md,
              padding: SPACING.md,
              borderRadius: RADIUS.md,
              backgroundColor: active ? T.brandTint : T.bgSoft,
              borderWidth: 1.5,
              borderColor: active ? T.brand : T.line,
            }}
          >
            <Text style={{ fontSize: 28 }}>{opt.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: FONTS.bold, color: active ? T.brand : T.ink }}>
                {opt.label}
              </Text>
              <Text style={{ fontSize: 11, color: T.ink3, marginTop: 2 }}>{opt.desc}</Text>
            </View>
            <View style={{
              width: 22, height: 22, borderRadius: 11,
              borderWidth: 2,
              borderColor: active ? T.brand : T.line,
              alignItems: 'center', justifyContent: 'center',
            }}>
              {active && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: T.brand }} />}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function ProfileScreen({ navigation }) {
  const user = useStore(s => s.user);
  const vehicles = useStore(s => s.vehicles);
  const documents = useStore(s => s.documents);
  const invoices = useStore(s => s.invoices);
  const fuelLogs = useStore(s => s.fuelLogs);
  const reminders = useStore(s => s.reminders);
  const updateProfile = useStore(s => s.updateProfile);
  const logout = useStore(s => s.logout);
  const fetchMe = useStore(s => s.fetchMe);
  const uploadAvatar = useStore(s => s.uploadAvatar);
  const removeAvatar = useStore(s => s.removeAvatar);
  const setPushToken = useStore(s => s.setPushToken);
  const exportData = useStore(s => s.exportData);
  const deleteAccount = useStore(s => s.deleteAccount);
  const fetchVehicles = useStore(s => s.fetchVehicles);
  const fetchInvoices = useStore(s => s.fetchInvoices);
  const fetchDocuments = useStore(s => s.fetchDocuments);
  const fetchFuelLogs = useStore(s => s.fetchFuelLogs);
  const quickActionIds = useStore(s => s.quickActionIds);
  const loadQuickActions = useStore(s => s.loadQuickActions);
  const saveQuickActions = useStore(s => s.saveQuickActions);
  const appMode = useStore(s => s.appMode);
  const isOnline = useStore(s => s.isOnline);
  const households = useStore(s => s.households);
  const householdExpenses = useStore(s => s.householdExpenses);
  const householdIncomes = useStore(s => s.householdIncomes);
  const householdEvents = useStore(s => s.householdEvents);
  const fetchHouseholds = useStore(s => s.fetchHouseholds);
  const fetchHouseholdExpenses = useStore(s => s.fetchHouseholdExpenses);
  const fetchHouseholdIncomes = useStore(s => s.fetchHouseholdIncomes);
  const fetchHouseholdEvents = useStore(s => s.fetchHouseholdEvents);
  const monthStartDay = useStore(s => s.monthStartDay);
  const setMonthStartDay = useStore(s => s.setMonthStartDay);
  const loadMonthStartDay = useStore(s => s.loadMonthStartDay);
  const isHouseholdMode = appMode === 'household';

  useEffect(() => { loadMonthStartDay(); }, [loadMonthStartDay]);
  const [monthStartModalOpen, setMonthStartModalOpen] = useState(false);

  const guardOnline = (label, handler) => () => {
    if (!isOnline) {
      showOfflineAlert(`${label} necesită internet`);
      return;
    }
    handler?.();
  };
  const offlineDim = !isOnline ? { opacity: 0.55 } : null;

  const { isTablet, hPad, maxContentWidth } = useResponsive();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [saving, setSaving] = useState(false);
  const [loadingMe, setLoadingMe] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);

  const [passModalVisible, setPassModalVisible] = useState(false);
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [passLoading, setPassLoading] = useState(false);

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletePass, setDeletePass] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const [pushEnabled, setPushEnabled] = useState(!!user?.pushToken);
  const [pushToggling, setPushToggling] = useState(false);

  const apiUrl = getApiUrl();

  const totalKm = (vehicles || []).reduce((s, v) => s + (Number(v.km) || 0), 0);
  const totalSpent = (invoices || []).reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const totalLiters = (fuelLogs || []).reduce((s, f) => s + (Number(f.liters) || 0), 0);
  const totalHouseholdExpense = (householdExpenses || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const totalHouseholdIncome = (householdIncomes || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const householdBalance = totalHouseholdIncome - totalHouseholdExpense;
  const upcomingEventsCount = (householdEvents || []).filter(e => !e.isDone).length;
  const selectedQuickActions = normalizeQuickActionIds(quickActionIds);

  const loadAll = useCallback(async () => {
    if (isHouseholdMode) {
      await Promise.all([
        fetchMe().catch(() => {}),
        fetchHouseholds(),
        fetchHouseholdExpenses(),
        fetchHouseholdIncomes(),
        fetchHouseholdEvents(),
      ]);
    } else {
      await Promise.all([
        fetchMe().catch(() => {}),
        fetchVehicles(),
        fetchInvoices(),
        fetchDocuments(),
        fetchFuelLogs(),
      ]);
    }
  }, [
    isHouseholdMode, fetchMe,
    fetchVehicles, fetchInvoices, fetchDocuments, fetchFuelLogs,
    fetchHouseholds, fetchHouseholdExpenses, fetchHouseholdIncomes, fetchHouseholdEvents,
  ]);

  useEffect(() => {
    (async () => {
      setLoadingMe(true);
      try {
        await loadAll();
      } finally {
        setLoadingMe(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');
      setPushEnabled(!!user.pushToken);
      loadQuickActions();
    }
  }, [user?.id, user?.name, user?.phone, user?.pushToken, loadQuickActions]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  const avatarFullUri = user?.avatar
    ? (user.avatar.startsWith('http') ? user.avatar : `${apiUrl}${user.avatar}`)
    : null;

  const pickAvatar = async () => {
    Alert.alert('Schimbă fotografia', 'Alege sursa', [
      { text: 'Anulează', style: 'cancel' },
      { text: '📷 Cameră', onPress: () => captureAvatar('camera') },
      { text: '🖼 Galerie', onPress: () => captureAvatar('library') },
      ...(user?.avatar ? [{ text: '🗑 Șterge poza', style: 'destructive', onPress: handleRemoveAvatar }] : []),
    ]);
  };

  const captureAvatar = async (source) => {
    try {
      let result;
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permisiune', 'Acordă acces la cameră în setări.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.7,
        });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permisiune', 'Acordă acces la galerie în setări.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.7,
        });
      }
      if (result.canceled || !result.assets?.length) return;
      setAvatarLoading(true);
      await uploadAvatar(result.assets[0]);
    } catch (e) {
      Alert.alert('Eroare', 'Nu s-a putut încărca fotografia.');
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      setAvatarLoading(true);
      await removeAvatar();
    } catch {
      Alert.alert('Eroare', 'Nu s-a putut șterge fotografia.');
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Eroare', 'Numele nu poate fi gol.');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ name: name.trim(), phone: phone.trim() });
      Alert.alert('Succes', 'Profilul a fost actualizat.');
    } catch {
      Alert.alert('Eroare', 'Nu s-a putut salva profilul.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Deconectare', 'Ești sigur că vrei să te deconectezi?', [
      { text: 'Anulează', style: 'cancel' },
      { text: 'Deconectează-mă', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const handleChangePassword = async () => {
    if (!currentPass || !newPass || !confirmPass) {
      Alert.alert('Eroare', 'Completează toate câmpurile.');
      return;
    }
    if (newPass.length < 6) {
      Alert.alert('Eroare', 'Parola nouă trebuie să aibă minim 6 caractere.');
      return;
    }
    if (newPass !== confirmPass) {
      Alert.alert('Eroare', 'Parolele noi nu coincid.');
      return;
    }
    setPassLoading(true);
    try {
      const api = (await import('../api/client')).default;
      await api.put('/auth/change-password', {
        currentPassword: currentPass,
        newPassword: newPass,
      });
      Alert.alert(
        'Succes',
        'Parola a fost schimbată. Vei fi deconectat și va trebui să te autentifici cu noua parolă.',
        [{ text: 'OK', onPress: () => { closePassModal(); logout(); } }],
      );
    } catch (e) {
      Alert.alert('Eroare', e?.response?.data?.error || 'Nu s-a putut schimba parola.');
    } finally {
      setPassLoading(false);
    }
  };

  const closePassModal = () => {
    setPassModalVisible(false);
    setCurrentPass('');
    setNewPass('');
    setConfirmPass('');
  };

  const togglePushNotifications = async (next) => {
    setPushToggling(true);
    try {
      if (next) {
        const { status: existing } = await Notifications.getPermissionsAsync();
        let final = existing;
        if (existing !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          final = status;
        }
        if (final !== 'granted') {
          Alert.alert('Permisiune', 'Activează notificările din setările sistemului.');
          setPushEnabled(false);
          return;
        }
        try {
          const tokenData = await Notifications.getExpoPushTokenAsync();
          await setPushToken(tokenData.data);
          setPushEnabled(true);
        } catch {
          await setPushToken('local-only');
          setPushEnabled(true);
        }
      } else {
        await setPushToken(null);
        setPushEnabled(false);
      }
    } catch {
      Alert.alert('Eroare', 'Nu s-a putut schimba setarea.');
    } finally {
      setPushToggling(false);
    }
  };

  const handleExportData = async () => {
    try {
      const data = await exportData();
      const json = JSON.stringify(data, null, 2);
      const filename = `urbio-auto-export-${new Date().toISOString().slice(0, 10)}.json`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(fileUri, json, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Exportă date Urbio Auto',
        });
      } else {
        Alert.alert('Export reușit', `Fișier salvat: ${fileUri}`);
      }
    } catch (e) {
      Alert.alert('Eroare', 'Nu s-au putut exporta datele.');
    }
  };

  const handleDeleteAccount = async () => {
    if (!deleteConfirm) {
      Alert.alert('Confirmare', 'Bifează că înțelegi că ștergerea e definitivă.');
      return;
    }
    if (!deletePass) {
      Alert.alert('Parolă', 'Introdu parola pentru a confirma.');
      return;
    }
    setDeleteLoading(true);
    try {
      await deleteAccount(deletePass);
      Alert.alert('Cont șters', 'Contul tău și toate datele au fost șterse definitiv.');
    } catch (e) {
      Alert.alert('Eroare', e?.response?.data?.error || 'Nu s-a putut șterge contul.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const closeDeleteModal = () => {
    setDeleteModalVisible(false);
    setDeletePass('');
    setDeleteConfirm(false);
  };

  const toggleQuickAction = async (id) => {
    const current = normalizeQuickActionIds(quickActionIds);
    const exists = current.includes(id);
    let next;

    if (exists) {
      if (current.length === 1) {
        Alert.alert('Acțiuni rapide', 'Păstrează cel puțin o acțiune pe pagina Acasă.');
        return;
      }
      next = current.filter(item => item !== id);
    } else {
      if (current.length >= MAX_HOME_QUICK_ACTIONS) {
        Alert.alert('Acțiuni rapide', `Poți afișa maximum ${MAX_HOME_QUICK_ACTIONS} acțiuni.`);
        return;
      }
      next = [...current, id];
    }

    await saveQuickActions(next);
  };

  const moveQuickAction = async (id, direction) => {
    const current = normalizeQuickActionIds(quickActionIds);
    const index = current.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= current.length) return;

    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    await saveQuickActions(next);
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.header} edges={['top']}>
        <View style={[styles.headerContent, { paddingHorizontal: hPad }]}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            hitSlop={HIT_SLOP_LG}
          >
            <Text style={styles.backBtnText}>← Înapoi</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profil</Text>
          <View style={styles.headerPlaceholder} />
        </View>
        <View style={styles.avatarSection}>
          {avatarLoading ? (
            <View style={[styles.avatar, { width: 96, height: 96, borderRadius: 48 }]}>
              <ActivityIndicator color="#fff" />
            </View>
          ) : (
            <Avatar
              name={name || user?.name}
              uri={avatarFullUri}
              size={96}
              onPress={pickAvatar}
            />
          )}
          <Text style={styles.headerName} numberOfLines={1}>
            {user?.name || '—'}
          </Text>
          <Text style={styles.headerEmail} numberOfLines={1}>
            {user?.email || ''}
          </Text>
        </View>
      </SafeAreaView>

      {loadingMe && !user ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={T.brand} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingHorizontal: hPad },
            isTablet && { alignSelf: 'center', width: '100%', maxWidth: maxContentWidth },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={T.brand}
              colors={[T.brand]}
            />
          }
        >
          {/* Informații personale */}
          <Card title="Informații personale">
            <Text style={styles.fieldLabel}>Nume complet</Text>
            <View style={styles.fieldWrap}>
              <TextInput
                style={styles.fieldInput}
                value={name}
                onChangeText={setName}
                placeholder="Nume complet"
                placeholderTextColor={T.ink4}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>

            <Text style={styles.fieldLabel}>Email</Text>
            <View style={[styles.fieldWrap, styles.fieldReadonly]}>
              <Text style={styles.fieldReadonlyText} numberOfLines={1}>
                {user?.email || '—'}
              </Text>
            </View>

            <Text style={styles.fieldLabel}>Telefon</Text>
            <View style={styles.fieldWrap}>
              <TextInput
                style={styles.fieldInput}
                value={phone}
                onChangeText={setPhone}
                placeholder="07XX XXX XXX"
                placeholderTextColor={T.ink4}
                keyboardType="phone-pad"
              />
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnLabel}>Salvează modificările</Text>
              )}
            </TouchableOpacity>
          </Card>

          {/* Statistici (mode-aware) */}
          {isHouseholdMode ? (
            <Card title="Statistici locuințe">
              <View style={styles.statsRow}>
                <StatCol icon="🏠" label="Locuințe" value={(households || []).length} />
                <View style={styles.statDivider} />
                <StatCol icon="💸" label="Cheltuieli" value={(householdExpenses || []).length} />
                <View style={styles.statDivider} />
                <StatCol icon="💰" label="Venituri" value={(householdIncomes || []).length} />
              </View>
              <View style={[styles.statsRow, { marginTop: SPACING.lg, borderTopWidth: 1, borderTopColor: T.line2, paddingTop: SPACING.lg }]}>
                <StatCol
                  icon="💸"
                  label="Cheltuit"
                  value={formatCurrency(totalHouseholdExpense, 'RON').replace('RON', '').trim() + ' RON'}
                />
                <View style={styles.statDivider} />
                <StatCol
                  icon="📅"
                  label="Evenimente"
                  value={upcomingEventsCount}
                />
                <View style={styles.statDivider} />
                <StatCol
                  icon={householdBalance >= 0 ? '📈' : '📉'}
                  label="Balanță"
                  value={formatCurrency(householdBalance, 'RON').replace('RON', '').trim() + ' RON'}
                />
              </View>
            </Card>
          ) : (
            <Card title="Statistici mașini">
              <View style={styles.statsRow}>
                <StatCol icon="🚗" label="Vehicule" value={(vehicles || []).length} />
                <View style={styles.statDivider} />
                <StatCol icon="📄" label="Documente" value={(documents || []).length} />
                <View style={styles.statDivider} />
                <StatCol icon="🧾" label="Facturi" value={(invoices || []).length} />
              </View>
              <View style={[styles.statsRow, { marginTop: SPACING.lg, borderTopWidth: 1, borderTopColor: T.line2, paddingTop: SPACING.lg }]}>
                <StatCol
                  icon="💰"
                  label="Cheltuit"
                  value={formatCurrency(totalSpent, 'RON').replace('RON', '').trim() + ' RON'}
                />
                <View style={styles.statDivider} />
                <StatCol
                  icon="📏"
                  label="KM totali"
                  value={totalKm.toLocaleString('ro-RO')}
                />
                <View style={styles.statDivider} />
                <StatCol
                  icon="⛽"
                  label="Litri"
                  value={totalLiters.toFixed(0)}
                />
              </View>
            </Card>
          )}

          {/* Cont */}
          <Card title="Detalii cont">
            <InfoRow label="Email" value={user?.email || '—'} />
            <View style={styles.infoSep} />
            <InfoRow
              label="Rol"
              value={user?.role === 'admin' ? 'Administrator' : 'Utilizator'}
            />
            <View style={styles.infoSep} />
            <InfoRow
              label="ID utilizator"
              value={user?.id ? user.id.slice(0, 8) + '...' : '—'}
            />
            <View style={styles.infoSep} />
            <InfoRow
              label="Înregistrat"
              value={user?.createdAt ? formatDate(user.createdAt) : '—'}
            />
            <View style={styles.infoSep} />
            <InfoRow
              label="Actualizat"
              value={user?.updatedAt ? formatDate(user.updatedAt) : '—'}
            />
          </Card>

          {/* Notificări */}
          <Card title="Notificări">
            <ToggleRow
              icon="🔔"
              label="Notificări push"
              sub={pushEnabled ? 'Primești alerte pentru termene' : 'Dezactivate'}
              value={pushEnabled}
              onValueChange={togglePushNotifications}
              disabled={pushToggling}
            />
            <View style={styles.infoSep} />
            <ActionRow
              icon="📥"
              label="Vezi notificările"
              sub="Istoric alerte primite"
              onPress={() => navigation.navigate('Notifications')}
            />
            <View style={styles.infoSep} />
            <ActionRow
              icon="🧪"
              label="Test notificare"
              sub="Trimite o notificare locală de test (apare în 1s)"
              onPress={async () => {
                const ok = await sendTestLocalNotification();
                if (!ok) {
                  Alert.alert(
                    'Eroare',
                    'Nu s-a putut trimite notificarea. Verifică permisiunile în setările telefonului.',
                  );
                }
              }}
            />
          </Card>

          {/* Acțiuni rapide — doar pentru modul Mașini */}
          {!isHouseholdMode && (
            <Card title="Acțiuni rapide Acasă (mașini)">
              <Text style={styles.quickActionLimit}>
                {selectedQuickActions.length}/{MAX_HOME_QUICK_ACTIONS} active
              </Text>
              <View style={styles.quickActionList}>
                {QUICK_ACTIONS.map(action => {
                  const selected = selectedQuickActions.includes(action.id);
                  const index = selectedQuickActions.indexOf(action.id);
                  return (
                    <QuickActionOption
                      key={action.id}
                      action={action}
                      selected={selected}
                      order={index + 1}
                      canMoveUp={selected && index > 0}
                      canMoveDown={selected && index >= 0 && index < selectedQuickActions.length - 1}
                      onToggle={() => toggleQuickAction(action.id)}
                      onMoveUp={() => moveQuickAction(action.id, -1)}
                      onMoveDown={() => moveQuickAction(action.id, 1)}
                    />
                  );
                })}
              </View>
            </Card>
          )}

          {/* Mode switcher */}
          <Card title="Mod aplicație">
            <ModeSwitcher />
          </Card>

          {/* Luna fiscală — start day */}
          <Card title="Luna fiscală">
            <ActionRow
              icon="🗓"
              label={`Începe pe ziua ${monthStartDay}`}
              sub="Folosit pentru balanțe lunare, grafice și rapoarte"
              onPress={() => setMonthStartModalOpen(true)}
            />
          </Card>

          {/* Categorii custom */}
          <Card title="Categorii custom">
            <ActionRow
              icon="🏷"
              label="Gestionează categoriile"
              sub="Nume, emoji și culoare pentru cheltuieli și venituri"
              onPress={() => navigation.navigate('CustomCategories')}
            />
          </Card>

          {/* Prieteni + share */}
          <Card title="Familie & prieteni" style={offlineDim}>
            <ActionRow
              icon="👥"
              label={!isOnline ? 'Prieteni (necesită internet)' : 'Prieteni'}
              sub="Adaugă persoane cu care poți share-ui mașini sau locuințe"
              onPress={guardOnline('Prieteni', () => navigation.navigate('Friends'))}
            />
          </Card>

          {/* Securitate */}
          <Card title="Securitate" style={offlineDim}>
            <ActionRow
              icon="🔑"
              label={!isOnline ? 'Schimbă parola (necesită internet)' : 'Schimbă parola'}
              sub="Recomandat la fiecare 3 luni"
              onPress={guardOnline('Schimbarea parolei', () => setPassModalVisible(true))}
            />
          </Card>

          {/* Aplicație */}
          <Card title="Aplicație">
            <ActionRow
              icon="🌐"
              label="Configurare server"
              sub={apiUrl}
              onPress={() => navigation.navigate('ServerConfig')}
            />
            <View style={styles.infoSep} />
            <InfoRow label="Versiune" value={`v${APP_VERSION}`} />
            <View style={styles.infoSep} />
            <InfoRow label="Platformă" value={IS_IOS ? 'iOS' : 'Android'} />
          </Card>

          {/* Date personale */}
          <Card title="Datele mele" style={offlineDim}>
            <ActionRow
              icon="📤"
              label={!isOnline ? 'Exportă datele (necesită internet)' : 'Exportă datele'}
              sub="Descarcă tot ca fișier JSON"
              onPress={guardOnline('Exportul datelor', handleExportData)}
            />
          </Card>

          {/* Zonă periculoasă */}
          <Card title="Zonă periculoasă" style={{ borderWidth: 1, borderColor: T.dangerTint }}>
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={handleLogout}
              activeOpacity={0.85}
            >
              <Text style={styles.logoutIcon}>🚪</Text>
              <Text style={styles.logoutLabel}>Deconectare</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.logoutBtn, styles.deleteAccountBtn, !isOnline && { opacity: 0.55 }]}
              onPress={guardOnline('Ștergerea contului', () => setDeleteModalVisible(true))}
              activeOpacity={0.85}
            >
              <Text style={styles.logoutIcon}>⚠️</Text>
              <Text style={styles.deleteAccountLabel}>
                {!isOnline ? 'Șterge cont (online)' : 'Șterge contul definitiv'}
              </Text>
            </TouchableOpacity>
          </Card>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}

      {/* Modal: ziua de început a lunii fiscale */}
      <Modal
        visible={monthStartModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setMonthStartModalOpen(false)}
      >
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Începutul lunii fiscale</Text>
            <TouchableOpacity onPress={() => setMonthStartModalOpen(false)} hitSlop={HIT_SLOP}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalIntro}>
              Alege ziua din calendar pe care vrei să înceapă luna fiscală.
              Toate balanțele, graficele și rapoartele vor folosi acest interval.
              Pentru a evita săriri în lunile scurte (februarie), valoarea este limitată la 28.
            </Text>
            <View style={styles.daysGrid}>
              {Array.from({ length: 28 }, (_, i) => i + 1).map(d => {
                const active = d === monthStartDay;
                return (
                  <TouchableOpacity
                    key={d}
                    onPress={async () => {
                      await setMonthStartDay(d);
                      setMonthStartModalOpen(false);
                    }}
                    style={[styles.dayTile, active && styles.dayTileActive]}
                  >
                    <Text style={[styles.dayTileText, active && styles.dayTileTextActive]}>{d}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Modal: schimbă parola */}
      <Modal
        visible={passModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closePassModal}
      >
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Schimbă parola</Text>
            <TouchableOpacity onPress={closePassModal} hitSlop={HIT_SLOP}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalIntro}>
              După schimbarea parolei vei fi deconectat și va trebui să te autentifici din nou.
            </Text>

            <Text style={styles.fieldLabel}>Parola curentă</Text>
            <View style={styles.passFieldWrap}>
              <TextInput
                style={[styles.fieldInput, { flex: 1 }]}
                value={currentPass}
                onChangeText={setCurrentPass}
                secureTextEntry={!showCurrentPass}
                placeholder="Parola curentă"
                placeholderTextColor={T.ink4}
              />
              <TouchableOpacity onPress={() => setShowCurrentPass(v => !v)} hitSlop={HIT_SLOP}>
                <Text style={styles.passEye}>{showCurrentPass ? '🙈' : '👁'}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Parola nouă</Text>
            <View style={styles.passFieldWrap}>
              <TextInput
                style={[styles.fieldInput, { flex: 1 }]}
                value={newPass}
                onChangeText={setNewPass}
                secureTextEntry={!showNewPass}
                placeholder="Minim 6 caractere"
                placeholderTextColor={T.ink4}
              />
              <TouchableOpacity onPress={() => setShowNewPass(v => !v)} hitSlop={HIT_SLOP}>
                <Text style={styles.passEye}>{showNewPass ? '🙈' : '👁'}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Confirmă parola nouă</Text>
            <View style={styles.passFieldWrap}>
              <TextInput
                style={[styles.fieldInput, { flex: 1 }]}
                value={confirmPass}
                onChangeText={setConfirmPass}
                secureTextEntry={!showConfirmPass}
                placeholder="Repetă parola nouă"
                placeholderTextColor={T.ink4}
              />
              <TouchableOpacity onPress={() => setShowConfirmPass(v => !v)} hitSlop={HIT_SLOP}>
                <Text style={styles.passEye}>{showConfirmPass ? '🙈' : '👁'}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, passLoading && styles.saveBtnDisabled, { marginTop: 24 }]}
              onPress={handleChangePassword}
              disabled={passLoading}
              activeOpacity={0.85}
            >
              {passLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnLabel}>Salvează parola nouă</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Modal: șterge cont */}
      <Modal
        visible={deleteModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeDeleteModal}
      >
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: T.danger }]}>Șterge cont</Text>
            <TouchableOpacity onPress={closeDeleteModal} hitSlop={HIT_SLOP}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <View style={styles.dangerBox}>
              <Text style={styles.dangerIcon}>⚠️</Text>
              <Text style={styles.dangerTitle}>Această acțiune este definitivă</Text>
              <Text style={styles.dangerBody}>
                Vei pierde toate vehiculele, documentele, facturile, reminderele și logurile de combustibil.
                Datele NU pot fi recuperate.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.confirmRow}
              onPress={() => setDeleteConfirm(v => !v)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, deleteConfirm && styles.checkboxOn]}>
                {deleteConfirm && <Text style={styles.checkboxMark}>✓</Text>}
              </View>
              <Text style={styles.confirmText}>
                Înțeleg că datele mele vor fi șterse definitiv.
              </Text>
            </TouchableOpacity>

            <Text style={styles.fieldLabel}>Confirmă cu parola</Text>
            <View style={styles.passFieldWrap}>
              <TextInput
                style={[styles.fieldInput, { flex: 1 }]}
                value={deletePass}
                onChangeText={setDeletePass}
                secureTextEntry
                placeholder="Parola contului"
                placeholderTextColor={T.ink4}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.dangerBtn,
                (!deleteConfirm || !deletePass || deleteLoading) && styles.saveBtnDisabled,
                { marginTop: 24 },
              ]}
              onPress={handleDeleteAccount}
              disabled={!deleteConfirm || !deletePass || deleteLoading}
              activeOpacity={0.85}
            >
              {deleteLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnLabel}>Șterge contul definitiv</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cancelBtn, { marginTop: 12 }]}
              onPress={closeDeleteModal}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnLabel}>Anulează</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  header: { backgroundColor: T.brand, paddingBottom: SPACING.xxl },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
    minHeight: TOUCH_TARGET,
  },
  backBtn: { flex: 1 },
  backBtnText: { fontSize: 15, fontWeight: FONTS.medium, color: '#fff' },
  headerTitle: { fontSize: 18, fontWeight: FONTS.bold, color: '#fff' },
  headerPlaceholder: { flex: 1 },
  avatarSection: { alignItems: 'center', gap: 8 },
  avatar: {
    backgroundColor: T.brandDark,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
    overflow: 'hidden',
  },
  avatarText: { fontWeight: FONTS.bold, color: '#fff' },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: T.brand,
  },
  avatarEditIcon: { fontSize: 14 },
  headerName: {
    fontSize: 22,
    color: '#fff',
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    ...display(700),
  },
  headerEmail: {
    fontSize: 13,
    fontWeight: FONTS.regular,
    color: 'rgba(255,255,255,0.85)',
    paddingHorizontal: SPACING.lg,
  },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: {
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xxxl,
    gap: SPACING.lg,
  },
  card: {
    backgroundColor: T.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    ...SHADOW.sm,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: FONTS.bold,
    color: T.ink,
    marginBottom: SPACING.lg,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: FONTS.semibold,
    color: T.ink2,
    marginBottom: 6,
    marginTop: SPACING.md,
  },
  fieldWrap: {
    borderWidth: 1.5,
    borderColor: T.line,
    borderRadius: RADIUS.md,
    backgroundColor: T.bgSoft,
    paddingHorizontal: SPACING.md,
    height: 48,
    justifyContent: 'center',
  },
  fieldReadonly: { backgroundColor: T.line2, borderColor: T.line },
  fieldInput: { fontSize: 15, fontWeight: FONTS.regular, color: T.ink },
  fieldReadonlyText: { fontSize: 15, fontWeight: FONTS.regular, color: T.ink3 },
  saveBtn: {
    marginTop: SPACING.xl,
    height: 50,
    borderRadius: RADIUS.lg,
    backgroundColor: T.brand,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOW.sm,
  },
  saveBtnDisabled: { opacity: 0.55 },
  saveBtnLabel: { fontSize: 15, fontWeight: FONTS.bold, color: '#fff' },
  statsRow: { flexDirection: 'row', alignItems: 'stretch' },
  statCol: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: SPACING.sm },
  statIcon: { fontSize: 26 },
  statValue: {
    fontSize: 18,
    fontWeight: FONTS.bold,
    color: T.ink,
    marginTop: 2,
    paddingHorizontal: 4,
  },
  statLabel: { fontSize: 11, fontWeight: FONTS.regular, color: T.ink3 },
  statDivider: { width: 1, backgroundColor: T.line, marginVertical: 4 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  infoLabel: { width: 120, fontSize: 14, fontWeight: FONTS.medium, color: T.ink3 },
  infoValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: FONTS.semibold,
    color: T.ink,
    textAlign: 'right',
  },
  infoSep: { height: 1, backgroundColor: T.line2 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.md,
    minHeight: TOUCH_TARGET,
  },
  actionIcon: { fontSize: 22, width: 32, textAlign: 'center' },
  actionLabel: { fontSize: 15, fontWeight: FONTS.semibold, color: T.ink },
  actionSub: { fontSize: 12, fontWeight: FONTS.regular, color: T.ink3, marginTop: 2 },
  actionArrow: { fontSize: 22, color: T.ink4, marginLeft: SPACING.sm },
  quickActionLimit: {
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: FONTS.bold,
    color: '#1E6F51',
    backgroundColor: '#E8F5EE',
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  quickActionList: { gap: SPACING.sm },
  quickActionOption: {
    minHeight: 64,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: T.line,
    backgroundColor: T.bgSoft,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.md,
  },
  quickActionOptionActive: {
    borderColor: '#2F9E6F',
    backgroundColor: '#F8FCF9',
  },
  quickActionOptionIcon: { fontSize: 24, width: 32, textAlign: 'center' },
  quickActionOptionText: { flex: 1, minWidth: 0 },
  quickActionOptionLabel: { fontSize: 14, fontWeight: FONTS.bold, color: T.ink },
  quickActionOptionSub: { fontSize: 12, fontWeight: FONTS.medium, color: T.ink3, marginTop: 2 },
  quickActionOrder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  quickActionOrderText: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#172027',
    color: '#fff',
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 11,
    fontWeight: FONTS.bold,
    paddingTop: IS_IOS ? 4 : 0,
    overflow: 'hidden',
  },
  quickActionOrderBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionOrderBtnDisabled: { opacity: 0.28 },
  quickActionOrderBtnText: { fontSize: 14, fontWeight: FONTS.bold, color: T.ink2 },
  quickActionToggle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: T.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionToggleActive: {
    borderColor: '#2F9E6F',
    backgroundColor: '#2F9E6F',
  },
  quickActionCheck: { color: '#fff', fontSize: 14, fontWeight: FONTS.bold },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.dangerTint,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1.5,
    borderColor: T.danger,
    gap: 10,
  },
  logoutIcon: { fontSize: 20 },
  logoutLabel: { fontSize: 15, fontWeight: FONTS.bold, color: T.danger },
  deleteAccountBtn: {
    marginTop: SPACING.md,
    backgroundColor: T.danger,
    borderColor: T.danger,
  },
  deleteAccountLabel: { fontSize: 15, fontWeight: FONTS.bold, color: '#fff' },
  bottomSpacer: { height: SPACING.xxxl },

  modalSafe: { flex: 1, backgroundColor: T.bg },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
    backgroundColor: T.card,
  },
  modalTitle: { fontSize: 18, fontWeight: FONTS.bold, color: T.ink },
  modalClose: { fontSize: 18, color: T.ink3, padding: 4 },
  modalContent: { padding: SPACING.xl },
  modalIntro: {
    fontSize: 13,
    color: T.ink3,
    marginBottom: SPACING.lg,
    lineHeight: 18,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayTile: {
    width: 50, height: 50,
    borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: T.card,
    borderWidth: 1.5, borderColor: T.line,
  },
  dayTileActive: { backgroundColor: T.brand, borderColor: T.brand },
  dayTileText: { fontSize: 15, fontWeight: FONTS.bold, color: T.ink2 },
  dayTileTextActive: { color: '#fff' },
  passFieldWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: T.line,
    borderRadius: RADIUS.md,
    backgroundColor: T.bgSoft,
    paddingHorizontal: SPACING.md,
    height: 48,
  },
  passEye: { fontSize: 18, paddingLeft: 8 },
  dangerBox: {
    backgroundColor: T.dangerTint,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: T.danger,
    marginBottom: SPACING.lg,
  },
  dangerIcon: { fontSize: 32, textAlign: 'center', marginBottom: SPACING.sm },
  dangerTitle: {
    fontSize: 15,
    fontWeight: FONTS.bold,
    color: T.danger,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  dangerBody: { fontSize: 13, color: T.ink2, textAlign: 'center', lineHeight: 18 },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: T.line,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxOn: { borderColor: T.danger, backgroundColor: T.danger },
  checkboxMark: { color: '#fff', fontWeight: FONTS.bold, fontSize: 14 },
  confirmText: { flex: 1, fontSize: 14, color: T.ink2 },
  dangerBtn: {
    height: 50,
    borderRadius: RADIUS.lg,
    backgroundColor: T.danger,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: {
    height: 50,
    borderRadius: RADIUS.lg,
    backgroundColor: T.line2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnLabel: { fontSize: 15, fontWeight: FONTS.semibold, color: T.ink2 },
});
