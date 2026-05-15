import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  RefreshControl,
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
} from '../theme';
import { getApiUrl } from '../api/client';
import { EmptyState, LoadingView } from '../components/ui';

function Avatar({ name, uri, size = 44 }) {
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

export default function ShareVehicleScreen({ navigation, route }) {
  const { vehicleId } = route.params || {};
  const user = useStore(s => s.user);
  const vehicles = useStore(s => s.vehicles);
  const friends = useStore(s => s.friends);
  const vehicleMembersById = useStore(s => s.vehicleMembersById);
  const fetchFriends = useStore(s => s.fetchFriends);
  const fetchVehicleMembers = useStore(s => s.fetchVehicleMembers);
  const addVehicleMember = useStore(s => s.addVehicleMember);
  const removeVehicleMember = useStore(s => s.removeVehicleMember);

  const { isTablet, hPad, maxContentWidth } = useResponsive();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addingFriendId, setAddingFriendId] = useState(null);

  const vehicle = (vehicles || []).find(v => v.id === vehicleId);
  const membersData = vehicleMembersById[vehicleId];
  const isOwner = vehicle?.isOwner !== false && vehicle?.userId === user?.id;
  const apiUrl = getApiUrl();

  const loadAll = useCallback(async () => {
    await Promise.all([fetchFriends(), fetchVehicleMembers(vehicleId)]);
  }, [fetchFriends, fetchVehicleMembers, vehicleId]);

  useEffect(() => {
    (async () => {
      await loadAll();
      setLoading(false);
    })();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  const memberUserIds = new Set((membersData?.members || []).map(m => m.user.id));
  const availableFriends = (friends || []).filter(f => !memberUserIds.has(f.friend.id));

  const avatarUri = (avatar) =>
    avatar ? (avatar.startsWith('http') ? avatar : `${apiUrl}${avatar}`) : null;

  const handleAdd = async (friend) => {
    setAddingFriendId(friend.id);
    try {
      await addVehicleMember(vehicleId, { userId: friend.friend.id });
      Alert.alert('Adăugat', `${friend.friend.name} are acum acces la vehicul.`);
    } catch (e) {
      Alert.alert('Eroare', e?.response?.data?.error || 'Nu s-a putut adăuga.');
    } finally {
      setAddingFriendId(null);
    }
  };

  const handleRemove = (member) => {
    Alert.alert(
      'Elimină acces',
      `Sigur elimini accesul lui ${member.user.name}? Nu va mai vedea acest vehicul.`,
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Elimină',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeVehicleMember(vehicleId, member.user.id);
            } catch (e) {
              Alert.alert('Eroare', 'Nu s-a putut elimina.');
            }
          },
        },
      ],
    );
  };

  const handleLeave = () => {
    Alert.alert(
      'Ieși din vehicul',
      `Sigur vrei să ieși din ${vehicle?.brand} ${vehicle?.model}? Nu vei mai avea acces la datele lui.`,
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Ieși',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeVehicleMember(vehicleId, user.id);
              navigation.goBack();
            } catch {
              Alert.alert('Eroare', 'Nu s-a putut elimina.');
            }
          },
        },
      ],
    );
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
          <Text style={styles.headerTitle}>Partajare</Text>
          <View style={{ flex: 1 }} />
        </View>
        <View style={[styles.vehicleBanner, { paddingHorizontal: hPad }]}>
          <Text style={styles.vehiclePlate}>{vehicle?.plate || '—'}</Text>
          <Text style={styles.vehicleName}>
            {vehicle?.brand} {vehicle?.model} {vehicle?.year ? `· ${vehicle.year}` : ''}
          </Text>
        </View>
      </SafeAreaView>

      {loading ? (
        <LoadingView />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            { paddingHorizontal: hPad, paddingVertical: SPACING.lg, gap: SPACING.lg },
            isTablet && { alignSelf: 'center', width: '100%', maxWidth: maxContentWidth },
          ]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.brand} />}
        >
          {/* Owner card */}
          {membersData?.owner && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Proprietar</Text>
              <View style={styles.memberRow}>
                <Avatar name={membersData.owner.name} uri={avatarUri(membersData.owner.avatar)} />
                <View style={{ flex: 1, marginLeft: SPACING.md }}>
                  <Text style={styles.memberName} numberOfLines={1}>
                    {membersData.owner.name}
                    {membersData.owner.id === user?.id && (
                      <Text style={styles.youTag}> (tu)</Text>
                    )}
                  </Text>
                  <Text style={styles.memberEmail} numberOfLines={1}>
                    {membersData.owner.email}
                  </Text>
                </View>
                <View style={styles.ownerBadge}>
                  <Text style={styles.ownerBadgeText}>👑</Text>
                </View>
              </View>
            </View>
          )}

          {/* Members card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              Membri cu acces ({membersData?.members?.length || 0})
            </Text>
            {!membersData?.members || membersData.members.length === 0 ? (
              <Text style={styles.emptyInline}>
                {isOwner
                  ? 'Niciun membru încă. Adaugă un prieten mai jos.'
                  : 'Doar tu și proprietarul aveți acces.'}
              </Text>
            ) : (
              membersData.members.map((m, idx) => (
                <View key={m.id}>
                  {idx > 0 && <View style={styles.divider} />}
                  <View style={styles.memberRow}>
                    <Avatar name={m.user.name} uri={avatarUri(m.user.avatar)} />
                    <View style={{ flex: 1, marginLeft: SPACING.md }}>
                      <Text style={styles.memberName} numberOfLines={1}>
                        {m.user.name}
                        {m.user.id === user?.id && <Text style={styles.youTag}> (tu)</Text>}
                      </Text>
                      <Text style={styles.memberEmail} numberOfLines={1}>{m.user.email}</Text>
                      {m.addedBy && m.addedBy.id !== membersData.owner.id && (
                        <Text style={styles.memberMeta}>Adăugat de {m.addedBy.name}</Text>
                      )}
                    </View>
                    {(isOwner || m.user.id === user?.id) && (
                      <TouchableOpacity
                        style={styles.removeBtn}
                        onPress={() => m.user.id === user?.id ? handleLeave() : handleRemove(m)}
                        hitSlop={HIT_SLOP}
                      >
                        <Text style={styles.removeBtnText}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Add from friends (owner only) */}
          {isOwner && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Adaugă din prieteni</Text>
              {availableFriends.length === 0 ? (
                <View>
                  <Text style={styles.emptyInline}>
                    {friends.length === 0
                      ? 'Nu ai încă prieteni. Adaugă-i din ecranul Prieteni.'
                      : 'Toți prietenii tăi au deja acces la acest vehicul.'}
                  </Text>
                  <TouchableOpacity
                    style={styles.linkBtn}
                    onPress={() => navigation.navigate('Friends')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.linkBtnText}>→ Ecranul Prieteni</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                availableFriends.map((f, idx) => (
                  <View key={f.id}>
                    {idx > 0 && <View style={styles.divider} />}
                    <View style={styles.memberRow}>
                      <Avatar name={f.friend.name} uri={avatarUri(f.friend.avatar)} />
                      <View style={{ flex: 1, marginLeft: SPACING.md }}>
                        <Text style={styles.memberName} numberOfLines={1}>{f.friend.name}</Text>
                        <Text style={styles.memberEmail} numberOfLines={1}>{f.friend.email}</Text>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.addBtn,
                          addingFriendId === f.id && styles.addBtnDisabled,
                        ]}
                        onPress={() => handleAdd(f)}
                        disabled={addingFriendId === f.id}
                        activeOpacity={0.85}
                      >
                        {addingFriendId === f.id ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text style={styles.addBtnText}>+ Adaugă</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {/* Info card */}
          <View style={[styles.card, styles.infoCard]}>
            <Text style={styles.infoTitle}>Ce poate face un membru?</Text>
            <Text style={styles.infoBody}>
              ✓ Vede toate datele despre vehicul, documente, facturi, combustibil{'\n'}
              ✓ Adaugă cheltuieli noi, log-uri combustibil, remindere{'\n'}
              ✓ Primește notificări pentru termene scadente{'\n'}
              ✗ Nu poate edita sau șterge vehiculul{'\n'}
              ✗ Nu poate adăuga/elimina alți membri
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  header: { backgroundColor: T.brand, paddingBottom: SPACING.lg },
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
  vehicleBanner: { marginTop: SPACING.sm },
  vehiclePlate: { fontSize: 14, color: 'rgba(255,255,255,0.85)', letterSpacing: 1 },
  vehicleName: { fontSize: 20, fontWeight: FONTS.bold, color: '#fff', marginTop: 2 },
  scroll: { flex: 1 },
  card: {
    backgroundColor: T.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOW.sm,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: FONTS.bold,
    color: T.ink,
    marginBottom: SPACING.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  avatar: {
    backgroundColor: T.brand,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarText: { color: '#fff', fontWeight: FONTS.bold },
  memberName: { fontSize: 15, fontWeight: FONTS.semibold, color: T.ink },
  memberEmail: { fontSize: 12, color: T.ink3, marginTop: 2 },
  memberMeta: { fontSize: 11, color: T.ink4, marginTop: 2 },
  youTag: { color: T.brand, fontSize: 12, fontWeight: FONTS.regular },
  ownerBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: T.warnTint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ownerBadgeText: { fontSize: 16 },
  divider: { height: 1, backgroundColor: T.line2, marginVertical: 4 },
  removeBtn: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.line2,
    borderRadius: RADIUS.md,
  },
  removeBtnText: { fontSize: 16, color: T.ink2, fontWeight: FONTS.bold },
  addBtn: {
    backgroundColor: T.brand,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    minHeight: TOUCH_TARGET,
    minWidth: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtnDisabled: { opacity: 0.6 },
  addBtnText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 13 },
  emptyInline: {
    fontSize: 13,
    color: T.ink3,
    textAlign: 'center',
    paddingVertical: SPACING.md,
    lineHeight: 18,
  },
  linkBtn: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  linkBtnText: { color: T.brand, fontWeight: FONTS.semibold, fontSize: 14 },
  infoCard: {
    backgroundColor: T.brandTint,
    borderWidth: 1,
    borderColor: T.brandTint2,
  },
  infoTitle: { fontSize: 13, fontWeight: FONTS.bold, color: T.brandDark, marginBottom: 8 },
  infoBody: { fontSize: 13, color: T.ink2, lineHeight: 20 },
});
