import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Image, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useStore from '../store';
import { T, RADIUS, SHADOW, FONTS, SPACING, useResponsive, HIT_SLOP, HIT_SLOP_LG, TOUCH_TARGET } from '../theme';
import { getApiUrl } from '../api/client';
import { LoadingView } from '../components/ui';

function Avatar({ name, uri, size = 44 }) {
  const initials = (name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      {uri ? <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} /> :
        <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>{initials}</Text>}
    </View>
  );
}

export default function ShareHouseholdScreen({ navigation, route }) {
  const { householdId } = route.params || {};
  const user = useStore(s => s.user);
  const households = useStore(s => s.households);
  const friends = useStore(s => s.friends);
  const householdMembersById = useStore(s => s.householdMembersById);
  const fetchFriends = useStore(s => s.fetchFriends);
  const fetchHouseholdMembers = useStore(s => s.fetchHouseholdMembers);
  const addHouseholdMember = useStore(s => s.addHouseholdMember);
  const removeHouseholdMember = useStore(s => s.removeHouseholdMember);

  const { isTablet, hPad, maxContentWidth } = useResponsive();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addingFriendId, setAddingFriendId] = useState(null);

  const household = (households || []).find(h => h.id === householdId);
  const membersData = householdMembersById[householdId];
  const isOwner = household?.isOwner !== false && household?.userId === user?.id;
  const apiUrl = getApiUrl();

  const loadAll = useCallback(async () => {
    await Promise.all([fetchFriends(), fetchHouseholdMembers(householdId)]);
  }, [fetchFriends, fetchHouseholdMembers, householdId]);

  useEffect(() => { (async () => { await loadAll(); setLoading(false); })(); }, []);
  const onRefresh = useCallback(async () => { setRefreshing(true); await loadAll(); setRefreshing(false); }, [loadAll]);

  const memberUserIds = new Set((membersData?.members || []).map(m => m.user.id));
  const availableFriends = (friends || []).filter(f => !memberUserIds.has(f.friend.id));
  const avatarUri = (a) => a ? (a.startsWith('http') ? a : `${apiUrl}${a}`) : null;

  const handleAdd = async (friend) => {
    setAddingFriendId(friend.id);
    try {
      await addHouseholdMember(householdId, { userId: friend.friend.id });
      Alert.alert('Adăugat', `${friend.friend.name} are acum acces.`);
    } catch (e) {
      Alert.alert('Eroare', e?.response?.data?.error || 'Nu s-a putut adăuga.');
    } finally { setAddingFriendId(null); }
  };

  const handleRemove = (member) => {
    Alert.alert('Elimină acces', `Sigur elimini accesul lui ${member.user.name}?`, [
      { text: 'Anulează', style: 'cancel' },
      { text: 'Elimină', style: 'destructive', onPress: () => removeHouseholdMember(householdId, member.user.id).catch(() => {}) },
    ]);
  };

  const handleLeave = () => {
    Alert.alert('Ieși din locuință', `Sigur vrei să ieși din ${household?.name}?`, [
      { text: 'Anulează', style: 'cancel' },
      { text: 'Ieși', style: 'destructive', onPress: async () => {
        try { await removeHouseholdMember(householdId, user.id); navigation.goBack(); }
        catch { Alert.alert('Eroare', 'Nu s-a putut.'); }
      }},
    ]);
  };

  if (loading) return <LoadingView />;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.header} edges={['top']}>
        <View style={[styles.headerContent, { paddingHorizontal: hPad }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={HIT_SLOP_LG} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Înapoi</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Partajare</Text>
          <View style={{ flex: 1 }} />
        </View>
        <View style={[styles.banner, { paddingHorizontal: hPad }]}>
          <Text style={styles.bannerSub}>🏠 LOCUINȚĂ</Text>
          <Text style={styles.bannerName}>{household?.name}</Text>
        </View>
      </SafeAreaView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          { padding: hPad, gap: SPACING.lg },
          isTablet && { alignSelf: 'center', width: '100%', maxWidth: maxContentWidth },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.brand} />}
      >
        {/* Owner */}
        {membersData?.owner && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Proprietar</Text>
            <View style={styles.row}>
              <Avatar name={membersData.owner.name} uri={avatarUri(membersData.owner.avatar)} />
              <View style={{ flex: 1, marginLeft: SPACING.md }}>
                <Text style={styles.name} numberOfLines={1}>
                  {membersData.owner.name}{membersData.owner.id === user?.id && <Text style={styles.you}> (tu)</Text>}
                </Text>
                <Text style={styles.email}>{membersData.owner.email}</Text>
              </View>
              <View style={styles.ownerBadge}><Text>👑</Text></View>
            </View>
          </View>
        )}

        {/* Members */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Membri ({membersData?.members?.length || 0})</Text>
          {!membersData?.members?.length ? (
            <Text style={styles.empty}>{isOwner ? 'Niciun membru. Adaugă din lista de prieteni.' : 'Doar tu și proprietarul aveți acces.'}</Text>
          ) : (
            membersData.members.map((m, i) => (
              <View key={m.id}>
                {i > 0 && <View style={styles.div} />}
                <View style={styles.row}>
                  <Avatar name={m.user.name} uri={avatarUri(m.user.avatar)} />
                  <View style={{ flex: 1, marginLeft: SPACING.md }}>
                    <Text style={styles.name} numberOfLines={1}>
                      {m.user.name}{m.user.id === user?.id && <Text style={styles.you}> (tu)</Text>}
                    </Text>
                    <Text style={styles.email}>{m.user.email}</Text>
                  </View>
                  {(isOwner || m.user.id === user?.id) && (
                    <TouchableOpacity onPress={() => m.user.id === user?.id ? handleLeave() : handleRemove(m)} style={styles.removeBtn} hitSlop={HIT_SLOP}>
                      <Text style={styles.removeBtnText}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))
          )}
        </View>

        {/* Add from friends */}
        {isOwner && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Adaugă din prieteni</Text>
            {availableFriends.length === 0 ? (
              <View>
                <Text style={styles.empty}>
                  {friends.length === 0 ? 'Nu ai prieteni încă.' : 'Toți prietenii sunt deja membri.'}
                </Text>
                <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate('Friends')}>
                  <Text style={styles.linkBtnText}>→ Ecranul Prieteni</Text>
                </TouchableOpacity>
              </View>
            ) : (
              availableFriends.map((f, i) => (
                <View key={f.id}>
                  {i > 0 && <View style={styles.div} />}
                  <View style={styles.row}>
                    <Avatar name={f.friend.name} uri={avatarUri(f.friend.avatar)} />
                    <View style={{ flex: 1, marginLeft: SPACING.md }}>
                      <Text style={styles.name}>{f.friend.name}</Text>
                      <Text style={styles.email}>{f.friend.email}</Text>
                    </View>
                    <TouchableOpacity style={[styles.addBtn, addingFriendId === f.id && { opacity: 0.5 }]} onPress={() => handleAdd(f)} disabled={addingFriendId === f.id}>
                      {addingFriendId === f.id ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.addBtnText}>+ Adaugă</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Ce poate face un membru?</Text>
          <Text style={styles.infoBody}>
            ✓ Vede cheltuieli, venituri, evenimente{'\n'}
            ✓ Adaugă cheltuieli/venituri/evenimente{'\n'}
            ✓ Primește notificări{'\n'}
            ✗ Nu poate edita detaliile locuinței{'\n'}
            ✗ Nu poate adăuga/elimina alți membri
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  header: { backgroundColor: T.brand, paddingBottom: SPACING.lg },
  headerContent: { flexDirection: 'row', alignItems: 'center', paddingTop: SPACING.sm, paddingBottom: SPACING.sm, minHeight: TOUCH_TARGET },
  backBtn: { flex: 1 },
  backBtnText: { color: '#fff', fontSize: 14, fontWeight: FONTS.medium },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: FONTS.bold },
  banner: { marginTop: SPACING.sm },
  bannerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 11, letterSpacing: 1, fontWeight: FONTS.semibold },
  bannerName: { color: '#fff', fontSize: 22, fontWeight: FONTS.bold, marginTop: 2 },

  card: { backgroundColor: T.card, borderRadius: RADIUS.lg, padding: SPACING.lg, ...SHADOW.sm },
  cardTitle: { fontSize: 13, fontWeight: FONTS.bold, color: T.ink, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.md },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm },
  div: { height: 1, backgroundColor: T.line2 },
  avatar: { backgroundColor: T.brand, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarText: { color: '#fff', fontWeight: FONTS.bold },
  name: { fontSize: 15, fontWeight: FONTS.semibold, color: T.ink },
  email: { fontSize: 12, color: T.ink3, marginTop: 2 },
  you: { color: T.brand, fontSize: 12, fontWeight: FONTS.regular },
  ownerBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: T.warnTint, alignItems: 'center', justifyContent: 'center' },
  empty: { fontSize: 13, color: T.ink3, textAlign: 'center', paddingVertical: SPACING.md, lineHeight: 18 },
  removeBtn: { width: TOUCH_TARGET, height: TOUCH_TARGET, alignItems: 'center', justifyContent: 'center', backgroundColor: T.line2, borderRadius: RADIUS.md },
  removeBtnText: { fontSize: 16, color: T.ink2, fontWeight: FONTS.bold },
  addBtn: { backgroundColor: T.brand, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, minHeight: TOUCH_TARGET, minWidth: 100, justifyContent: 'center', alignItems: 'center' },
  addBtnText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 13 },
  linkBtn: { paddingVertical: SPACING.md, alignItems: 'center' },
  linkBtnText: { color: T.brand, fontWeight: FONTS.semibold, fontSize: 14 },
  infoCard: { backgroundColor: T.brandTint, borderRadius: RADIUS.lg, padding: SPACING.lg, borderWidth: 1, borderColor: T.brandTint2 },
  infoTitle: { fontSize: 13, fontWeight: FONTS.bold, color: T.brandDark, marginBottom: 8 },
  infoBody: { fontSize: 13, color: T.ink2, lineHeight: 20 },
});
