import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useStore from '../store';
import {
  T,
  RADIUS,
  SHADOW,
  FONTS,
  SPACING,
  useResponsive,
  HIT_SLOP,
  HIT_SLOP_LG,
  TOUCH_TARGET,
  formatDate,
} from '../theme';
import { getApiUrl } from '../api/client';
import { EmptyState, LoadingView } from '../components/ui';

function Avatar({ name, uri, size = 48 }) {
  const initials = (name || '?')
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>{initials}</Text>
      )}
    </View>
  );
}

export default function FriendsScreen({ navigation }) {
  const friends = useStore(s => s.friends);
  const pendingFriends = useStore(s => s.pendingFriends);
  const sentFriends = useStore(s => s.sentFriends);
  const fetchFriends = useStore(s => s.fetchFriends);
  const sendFriendRequest = useStore(s => s.sendFriendRequest);
  const acceptFriend = useStore(s => s.acceptFriend);
  const declineFriend = useStore(s => s.declineFriend);
  const removeFriend = useStore(s => s.removeFriend);

  const { isTablet, hPad, maxContentWidth } = useResponsive();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('friends');
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [sending, setSending] = useState(false);

  const apiUrl = getApiUrl();

  useEffect(() => {
    (async () => {
      await fetchFriends();
      setLoading(false);
    })();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFriends();
    setRefreshing(false);
  }, [fetchFriends]);

  const avatarUri = (avatar) =>
    avatar ? (avatar.startsWith('http') ? avatar : `${apiUrl}${avatar}`) : null;

  const handleSendRequest = async () => {
    const email = emailInput.trim().toLowerCase();
    if (!email) {
      Alert.alert('Email', 'Introdu un email.');
      return;
    }
    setSending(true);
    try {
      const result = await sendFriendRequest(email);
      if (result.status === 'accepted') {
        Alert.alert('Sunteți prieteni!', `${result.friend.name} avea deja o cerere către tine — acceptată automat.`);
      } else {
        Alert.alert('Cerere trimisă', `Cererea a fost trimisă către ${result.friend.name}.`);
      }
      setEmailInput('');
      setAddModalVisible(false);
    } catch (e) {
      Alert.alert('Eroare', e?.response?.data?.error || 'Nu s-a putut trimite cererea.');
    } finally {
      setSending(false);
    }
  };

  const handleAccept = async (id, name) => {
    try {
      await acceptFriend(id);
      Alert.alert('Acceptat', `${name} este acum prietenul tău.`);
    } catch (e) {
      Alert.alert('Eroare', 'Nu s-a putut accepta cererea.');
    }
  };

  const handleDecline = (id, name) => {
    Alert.alert(
      'Respinge cerere',
      `Sigur respingi cererea de la ${name}?`,
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Respinge',
          style: 'destructive',
          onPress: async () => {
            try {
              await declineFriend(id);
            } catch {
              Alert.alert('Eroare', 'Nu s-a putut respinge.');
            }
          },
        },
      ],
    );
  };

  const handleRemove = (id, name) => {
    Alert.alert(
      'Elimină prieten',
      `Sigur elimini pe ${name} din prieteni? Va trebui să trimiteți o cerere nouă pentru a vă reconecta.`,
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Elimină',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeFriend(id);
            } catch {
              Alert.alert('Eroare', 'Nu s-a putut elimina.');
            }
          },
        },
      ],
    );
  };

  const handleCancelSent = (id, name) => {
    Alert.alert(
      'Anulează cerere',
      `Sigur anulezi cererea către ${name}?`,
      [
        { text: 'Nu', style: 'cancel' },
        {
          text: 'Da, anulează',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeFriend(id);
            } catch {
              Alert.alert('Eroare', 'Nu s-a putut anula.');
            }
          },
        },
      ],
    );
  };

  const renderFriend = ({ item }) => (
    <View style={styles.row}>
      <Avatar name={item.friend.name} uri={avatarUri(item.friend.avatar)} />
      <View style={{ flex: 1, marginLeft: SPACING.md }}>
        <Text style={styles.rowName} numberOfLines={1}>{item.friend.name}</Text>
        <Text style={styles.rowEmail} numberOfLines={1}>{item.friend.email}</Text>
      </View>
      <TouchableOpacity
        style={styles.iconBtn}
        onPress={() => handleRemove(item.id, item.friend.name)}
        hitSlop={HIT_SLOP}
      >
        <Text style={styles.iconBtnTextDanger}>✕</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPending = ({ item }) => (
    <View style={styles.row}>
      <Avatar name={item.friend.name} uri={avatarUri(item.friend.avatar)} />
      <View style={{ flex: 1, marginLeft: SPACING.md }}>
        <Text style={styles.rowName} numberOfLines={1}>{item.friend.name}</Text>
        <Text style={styles.rowEmail} numberOfLines={1}>{item.friend.email}</Text>
        <Text style={styles.rowMeta}>Vrea să-ți fie prieten</Text>
      </View>
      <View style={styles.pendingActions}>
        <TouchableOpacity
          style={styles.acceptBtn}
          onPress={() => handleAccept(item.id, item.friend.name)}
          activeOpacity={0.85}
        >
          <Text style={styles.acceptBtnText}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.declineBtn}
          onPress={() => handleDecline(item.id, item.friend.name)}
          hitSlop={HIT_SLOP}
        >
          <Text style={styles.declineBtnText}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSent = ({ item }) => (
    <View style={styles.row}>
      <Avatar name={item.friend.name} uri={avatarUri(item.friend.avatar)} />
      <View style={{ flex: 1, marginLeft: SPACING.md }}>
        <Text style={styles.rowName} numberOfLines={1}>{item.friend.name}</Text>
        <Text style={styles.rowEmail} numberOfLines={1}>{item.friend.email}</Text>
        <Text style={styles.rowMeta}>În așteptare · trimis {formatDate(item.createdAt)}</Text>
      </View>
      <TouchableOpacity
        style={styles.iconBtn}
        onPress={() => handleCancelSent(item.id, item.friend.name)}
        hitSlop={HIT_SLOP}
      >
        <Text style={styles.iconBtnTextDanger}>✕</Text>
      </TouchableOpacity>
    </View>
  );

  const tabConfig = {
    friends: { data: friends, render: renderFriend, emptyTitle: 'Niciun prieten încă', emptySub: 'Trimite o cerere de prietenie cu butonul +' },
    pending: { data: pendingFriends, render: renderPending, emptyTitle: 'Nicio cerere primită', emptySub: 'Cererile altora vor apărea aici' },
    sent: { data: sentFriends, render: renderSent, emptyTitle: 'Nicio cerere trimisă', emptySub: 'Cererile pe care le trimiți vor apărea aici' },
  };
  const current = tabConfig[tab];

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
          <Text style={styles.headerTitle}>Prieteni</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setAddModalVisible(true)}
            hitSlop={HIT_SLOP}
          >
            <Text style={styles.addBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.tabBar, { paddingHorizontal: hPad }]}>
          <TouchableOpacity
            style={[styles.tab, tab === 'friends' && styles.tabActive]}
            onPress={() => setTab('friends')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabLabel, tab === 'friends' && styles.tabLabelActive]}>
              Prieteni ({friends.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'pending' && styles.tabActive]}
            onPress={() => setTab('pending')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabLabel, tab === 'pending' && styles.tabLabelActive]}>
              Primite{pendingFriends.length > 0 ? ` (${pendingFriends.length})` : ''}
            </Text>
            {pendingFriends.length > 0 && <View style={styles.badge} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'sent' && styles.tabActive]}
            onPress={() => setTab('sent')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabLabel, tab === 'sent' && styles.tabLabelActive]}>
              Trimise{sentFriends.length > 0 ? ` (${sentFriends.length})` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {loading ? (
        <LoadingView />
      ) : (
        <FlatList
          data={current.data}
          keyExtractor={item => item.id}
          renderItem={current.render}
          contentContainerStyle={[
            { paddingHorizontal: hPad, paddingVertical: SPACING.lg, gap: SPACING.md },
            isTablet && { alignSelf: 'center', width: '100%', maxWidth: maxContentWidth },
            current.data.length === 0 && { flex: 1 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={T.brand}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="👥"
              title={current.emptyTitle}
              subtitle={current.emptySub}
            />
          }
        />
      )}

      <Modal
        visible={addModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Adaugă prieten</Text>
            <TouchableOpacity onPress={() => setAddModalVisible(false)} hitSlop={HIT_SLOP}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <Text style={styles.modalIntro}>
              Introdu emailul persoanei pe care vrei să o adaugi. Va primi o cerere și trebuie să accepte.
            </Text>

            <Text style={styles.fieldLabel}>Email</Text>
            <View style={styles.fieldWrap}>
              <TextInput
                style={styles.fieldInput}
                value={emailInput}
                onChangeText={setEmailInput}
                placeholder="adresa@exemplu.ro"
                placeholderTextColor={T.ink4}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="send"
                onSubmitEditing={handleSendRequest}
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, (!emailInput || sending) && styles.primaryBtnDisabled]}
              onPress={handleSendRequest}
              disabled={!emailInput || sending}
              activeOpacity={0.85}
            >
              {sending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Trimite cerere</Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  header: { backgroundColor: T.brand },
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
  addBtn: {
    flex: 1,
    alignItems: 'flex-end',
  },
  addBtnText: { fontSize: 28, color: '#fff', fontWeight: FONTS.light, lineHeight: 32 },
  tabBar: {
    flexDirection: 'row',
    paddingBottom: SPACING.sm,
    gap: SPACING.xs,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderRadius: RADIUS.md,
    position: 'relative',
  },
  tabActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  tabLabel: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: FONTS.medium },
  tabLabelActive: { color: '#fff', fontWeight: FONTS.bold },
  badge: {
    position: 'absolute',
    top: 4,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    ...SHADOW.sm,
  },
  avatar: {
    backgroundColor: T.brand,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarText: { color: '#fff', fontWeight: FONTS.bold },
  rowName: { fontSize: 15, fontWeight: FONTS.semibold, color: T.ink },
  rowEmail: { fontSize: 12, color: T.ink3, marginTop: 2 },
  rowMeta: { fontSize: 11, color: T.brand, marginTop: 4, fontWeight: FONTS.medium },
  iconBtn: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnTextDanger: { fontSize: 20, color: T.ink4 },
  pendingActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  acceptBtn: {
    backgroundColor: T.brand,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
  },
  acceptBtnText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 13 },
  declineBtn: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.line2,
    borderRadius: RADIUS.md,
  },
  declineBtnText: { fontSize: 16, color: T.ink2, fontWeight: FONTS.bold },

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
  fieldLabel: { fontSize: 13, fontWeight: FONTS.semibold, color: T.ink2, marginBottom: 6 },
  fieldWrap: {
    borderWidth: 1.5,
    borderColor: T.line,
    borderRadius: RADIUS.md,
    backgroundColor: T.bgSoft,
    paddingHorizontal: SPACING.md,
    height: 48,
    justifyContent: 'center',
  },
  fieldInput: { fontSize: 15, color: T.ink },
  primaryBtn: {
    marginTop: SPACING.xl,
    height: 50,
    backgroundColor: T.brand,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: { opacity: 0.55 },
  primaryBtnText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 15 },
});
