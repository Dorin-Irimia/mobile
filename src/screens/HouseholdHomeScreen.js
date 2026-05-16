import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import useStore from '../store';
import {
  T, RADIUS, SHADOW, FONTS, SPACING,
  formatDate, formatCurrency, daysUntil,
  useResponsive, HIT_SLOP,
} from '../theme';
import { getApiUrl } from '../api/client';
import { OnlineDot } from '../components/NetworkBadge';
import ModePill from '../components/ModePill';
import { MonthlyBarChart, CategoryBreakdown } from '../components/Charts';
import { getCategoryMeta } from '../utils/categories';
import { showOfflineAlert } from '../utils/onlineGate';
import MonthPicker from '../components/MonthPicker';
import {
  startOfBillingMonth,
  isInBillingMonth,
  billingMonthLabel,
} from '../utils/monthRange';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bună dimineața';
  if (h < 18) return 'Bună ziua';
  return 'Bună seara';
}

function getInitials(name) {
  return (name || '')
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase() || '?';
}

function ProfilePill({ user, onPress }) {
  const apiUrl = getApiUrl();
  const avatarUri = user?.avatar
    ? (user.avatar.startsWith('http') ? user.avatar : `${apiUrl}${user.avatar}`)
    : null;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      style={styles.profilePill}
      hitSlop={HIT_SLOP}
    >
      <View style={styles.profileAvatar}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.profileAvatarImg} />
        ) : (
          <Text style={styles.profileAvatarInitials}>{getInitials(user?.name)}</Text>
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.profilePillName} numberOfLines={1}>
          {user?.name || 'Profil'}
        </Text>
        <Text style={styles.profilePillSub} numberOfLines={1}>
          {user?.email || 'Vezi profilul →'}
        </Text>
      </View>
      <Text style={styles.profilePillChev}>›</Text>
    </TouchableOpacity>
  );
}

export default function HouseholdHomeScreen({ navigation }) {
  const user = useStore(s => s.user);
  const fetchMe = useStore(s => s.fetchMe);
  const households = useStore(s => s.households);
  const selectedHouseholdId = useStore(s => s.selectedHouseholdId);
  const setSelectedHousehold = useStore(s => s.setSelectedHousehold);
  const fetchHouseholds = useStore(s => s.fetchHouseholds);
  const householdExpenses = useStore(s => s.householdExpenses);
  const householdIncomes = useStore(s => s.householdIncomes);
  const householdEvents = useStore(s => s.householdEvents);
  const fetchHouseholdExpenses = useStore(s => s.fetchHouseholdExpenses);
  const fetchHouseholdIncomes = useStore(s => s.fetchHouseholdIncomes);
  const fetchHouseholdEvents = useStore(s => s.fetchHouseholdEvents);
  const notifications = useStore(s => s.notifications);
  const fetchNotifications = useStore(s => s.fetchNotifications);
  const customCategories = useStore(s => s.customCategories);
  const loadCustomCategories = useStore(s => s.loadCustomCategories);
  const isOnline = useStore(s => s.isOnline);
  const monthStartDay = useStore(s => s.monthStartDay);
  const loadMonthStartDay = useStore(s => s.loadMonthStartDay);

  const [monthAnchor, setMonthAnchor] = useState(() => startOfBillingMonth(new Date(), monthStartDay));

  const goOnline = (route, params, label) => () => {
    if (!isOnline) {
      showOfflineAlert(`${label} necesită internet`);
      return;
    }
    navigation.navigate(route, params);
  };

  const { isTablet, hPad, maxContentWidth } = useResponsive();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const selectedHousehold = households.find(h => h.id === selectedHouseholdId) || households[0];
  const firstName = user?.name?.split(' ')[0] || 'utilizator';
  const unreadCount = (notifications || []).filter(n => !n.isRead).length;

  const loadAll = useCallback(async () => {
    await Promise.all([
      fetchHouseholds(),
      fetchHouseholdExpenses(),
      fetchHouseholdIncomes(),
      fetchHouseholdEvents(),
      fetchNotifications(),
      loadCustomCategories(),
      loadMonthStartDay(),
    ]);
  }, [fetchHouseholds, fetchHouseholdExpenses, fetchHouseholdIncomes, fetchHouseholdEvents, fetchNotifications, loadCustomCategories, loadMonthStartDay]);

  useEffect(() => {
    (async () => { setLoading(true); await loadAll(); setLoading(false); })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchMe().catch(() => {});
    }, [fetchMe]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  // Stats for selected household, selected billing month
  const filteredExpenses = useMemo(() => {
    if (!selectedHousehold) return [];
    return householdExpenses.filter(e => e.householdId === selectedHousehold.id);
  }, [householdExpenses, selectedHousehold]);

  const filteredIncomes = useMemo(() => {
    if (!selectedHousehold) return [];
    return householdIncomes.filter(i => i.householdId === selectedHousehold.id);
  }, [householdIncomes, selectedHousehold]);

  const filteredEvents = useMemo(() => {
    if (!selectedHousehold) return [];
    return householdEvents.filter(e => e.householdId === selectedHousehold.id && !e.isDone);
  }, [householdEvents, selectedHousehold]);

  const monthExpenses = filteredExpenses
    .filter(e => isInBillingMonth(e.date, monthAnchor, monthStartDay))
    .reduce((s, e) => s + Number(e.amount || 0), 0);

  const monthIncomes = filteredIncomes
    .filter(i => isInBillingMonth(i.date, monthAnchor, monthStartDay))
    .reduce((s, i) => s + Number(i.amount || 0), 0);

  const balance = monthIncomes - monthExpenses;
  const budgetUsed = selectedHousehold?.monthlyBudget
    ? (monthExpenses / selectedHousehold.monthlyBudget) * 100
    : null;
  const periodLabel = billingMonthLabel(monthAnchor, monthStartDay);

  const upcomingEvents = filteredEvents
    .filter(e => {
      const d = daysUntil(e.startDate);
      return d !== null && d >= 0 && d <= 30;
    })
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, 5);

  if (loading) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={T.brand} />
      </View>
    );
  }

  if (households.length === 0) {
    return (
      <View style={styles.root}>
        <SafeAreaView edges={['top']} style={styles.header}>
          <View style={[styles.headerRow, { paddingHorizontal: hPad }]}>
            <Text style={[styles.headerGreeting, { flex: 1 }]}>{getGreeting()}, {firstName}!</Text>
            <OnlineDot />
          </View>
          <View style={[styles.modeRow, { paddingHorizontal: hPad }]}>
            <ModePill />
          </View>
        </SafeAreaView>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyIcon}>🏠</Text>
          <Text style={styles.emptyTitle}>Nicio locuință încă</Text>
          <Text style={styles.emptyBody}>
            Adaugă prima ta locuință pentru a începe să urmărești cheltuielile, veniturile și evenimentele.
          </Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => navigation.navigate('AddHousehold')}
            activeOpacity={0.85}
          >
            <Text style={styles.emptyBtnText}>+ Adaugă locuință</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={[styles.headerRow, { paddingHorizontal: hPad }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerGreeting}>{getGreeting()}, {firstName}!</Text>
            <Text style={styles.headerSub}>
              {new Date().toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>
          <OnlineDot />
          <TouchableOpacity
            onPress={() => navigation.navigate('Notifications')}
            hitSlop={HIT_SLOP}
            style={styles.iconBtn}
          >
            <Text style={styles.iconBtnText}>🔔</Text>
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={[styles.modeRow, { paddingHorizontal: hPad }]}>
          <ModePill />
        </View>

        {households.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: hPad, gap: 8, paddingBottom: SPACING.sm }}
          >
            {households.map(h => (
              <TouchableOpacity
                key={h.id}
                onPress={() => setSelectedHousehold(h.id)}
                style={[styles.hhChip, selectedHouseholdId === h.id && styles.hhChipActive]}
              >
                <Text style={[styles.hhChipText, selectedHouseholdId === h.id && styles.hhChipTextActive]}>
                  🏠 {h.name}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => navigation.navigate('AddHousehold')}
              style={[styles.hhChip, { borderStyle: 'dashed' }]}
            >
              <Text style={styles.hhChipText}>+ Adaugă</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </SafeAreaView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          { padding: hPad, gap: SPACING.lg, paddingBottom: 100 },
          isTablet && { alignSelf: 'center', width: '100%', maxWidth: maxContentWidth },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.brand} />}
      >
        <ProfilePill user={user} onPress={() => navigation.navigate('HouseholdProfile')} />

        {/* Household card */}
        {selectedHousehold && (
          <TouchableOpacity
            style={styles.hhCard}
            onPress={() => navigation.navigate('EditHousehold', { householdId: selectedHousehold.id })}
            activeOpacity={0.85}
          >
            <View style={styles.hhCardLeft}>
              <Text style={styles.hhCardIcon}>🏠</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.hhCardName}>{selectedHousehold.name}</Text>
              <Text style={styles.hhCardSub}>
                {selectedHousehold.type} · {selectedHousehold.rooms ? `${selectedHousehold.rooms} cam` : ''} {selectedHousehold.surface ? `· ${selectedHousehold.surface} m²` : ''}
              </Text>
              {selectedHousehold.address && (
                <Text style={styles.hhCardAddr} numberOfLines={1}>📍 {selectedHousehold.address}</Text>
              )}
              <View style={styles.hhCardBadgeRow}>
                {selectedHousehold.isOwner && (
                  <View style={styles.hhCardBadge}>
                    <Text style={styles.hhCardBadgeText}>👑 Owner </Text>
                  </View>
                )}
                {selectedHousehold.memberCount > 0 && (
                  <View style={styles.hhCardBadge}>
                    <Text style={styles.hhCardBadgeText}>👥 {selectedHousehold.memberCount}</Text>
                  </View>
                )}
              </View>
            </View>
            <Text style={styles.hhCardChev}>›</Text>
          </TouchableOpacity>
        )}

        {/* Month picker */}
        <MonthPicker value={monthAnchor} onChange={setMonthAnchor} />

        {/* Balance card */}
        <View style={[styles.balanceCard, balance >= 0 ? styles.balancePositive : styles.balanceNegative]}>
          <Text style={styles.balanceLabel}>Balanță · {periodLabel}</Text>
          <Text style={styles.balanceValue}>
            {balance >= 0 ? '+' : ''}{formatCurrency(balance, 'RON')}
          </Text>
          <View style={styles.balanceRow}>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceItemLabel}>💰 Venituri</Text>
              <Text style={[styles.balanceItemVal, { color: 'rgba(255,255,255,0.95)' }]}>
                {formatCurrency(monthIncomes, 'RON')}
              </Text>
            </View>
            <View style={styles.balanceDivider} />
            <View style={styles.balanceItem}>
              <Text style={styles.balanceItemLabel}>💸 Cheltuieli</Text>
              <Text style={[styles.balanceItemVal, { color: 'rgba(255,255,255,0.95)' }]}>
                {formatCurrency(monthExpenses, 'RON')}
              </Text>
            </View>
          </View>
          {budgetUsed !== null && (
            <View style={styles.budgetRow}>
              <View style={styles.budgetBarBg}>
                <View
                  style={[
                    styles.budgetBarFill,
                    { width: `${Math.min(100, budgetUsed)}%`, backgroundColor: budgetUsed > 100 ? T.danger : '#fff' },
                  ]}
                />
              </View>
              <Text style={styles.budgetText}>
                {budgetUsed.toFixed(0)}% din buget ({formatCurrency(selectedHousehold.monthlyBudget, 'RON')})
              </Text>
            </View>
          )}
        </View>

        {/* Quick actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionTile}
            onPress={() => navigation.navigate('AddHouseholdExpense', { householdId: selectedHouseholdId })}
            activeOpacity={0.85}
          >
            <Text style={styles.actionIcon}>💸</Text>
            <Text style={styles.actionLabel}>Cheltuială</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionTile}
            onPress={() => navigation.navigate('AddHouseholdIncome', { householdId: selectedHouseholdId })}
            activeOpacity={0.85}
          >
            <Text style={styles.actionIcon}>💰</Text>
            <Text style={styles.actionLabel}>Venit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionTile}
            onPress={() => navigation.navigate('AddHouseholdEvent', { householdId: selectedHouseholdId })}
            activeOpacity={0.85}
          >
            <Text style={styles.actionIcon}>📅</Text>
            <Text style={styles.actionLabel}>Eveniment</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionTile, !isOnline && styles.actionTileDisabled]}
            onPress={goOnline('AIChat', undefined, 'Asistentul AI')}
            activeOpacity={0.85}
          >
            <Text style={styles.actionIcon}>🤖</Text>
            <Text style={styles.actionLabel}>AI</Text>
            {!isOnline && <Text style={styles.actionLockBadge}>offline</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionTile, !isOnline && styles.actionTileDisabled]}
            onPress={goOnline('ShareHousehold', { householdId: selectedHouseholdId }, 'Partajarea locuinței')}
            activeOpacity={0.85}
          >
            <Text style={styles.actionIcon}>👥</Text>
            <Text style={styles.actionLabel}>Membri</Text>
            {!isOnline && <Text style={styles.actionLockBadge}>offline</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionTile}
            onPress={() => navigation.navigate('HouseholdExpenses')}
            activeOpacity={0.85}
          >
            <Text style={styles.actionIcon}>📊</Text>
            <Text style={styles.actionLabel}>Rapoarte</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionTile}
            onPress={() => navigation.navigate('HouseholdCalendar')}
            activeOpacity={0.85}
          >
            <Text style={styles.actionIcon}>🗓</Text>
            <Text style={styles.actionLabel}>Calendar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionTile, !isOnline && styles.actionTileDisabled]}
            onPress={goOnline('Friends', undefined, 'Prieteni')}
            activeOpacity={0.85}
          >
            <Text style={styles.actionIcon}>🧑‍🤝‍🧑</Text>
            <Text style={styles.actionLabel}>Prieteni</Text>
            {!isOnline && <Text style={styles.actionLockBadge}>offline</Text>}
          </TouchableOpacity>
        </View>

        {/* Charts: trend + category breakdown */}
        {(filteredExpenses.length > 0 || filteredIncomes.length > 0) && (
          <View style={{ gap: SPACING.lg }}>
            <MonthlyBarChart
              expenses={filteredExpenses}
              incomes={filteredIncomes}
              months={6}
              currency="RON"
              startDay={monthStartDay}
              anchor={monthAnchor}
            />
            <CategoryBreakdown
              items={filteredExpenses.filter(e => isInBillingMonth(e.date, monthAnchor, monthStartDay))}
              currency="RON"
              title={`🥧 Cheltuieli · ${periodLabel}`}
              emptyHint={`Fără cheltuieli pentru ${periodLabel}.`}
              getMeta={(key) => getCategoryMeta(key, 'expense', customCategories)}
            />
            {filteredIncomes.length > 0 && (
              <CategoryBreakdown
                items={filteredIncomes.filter(i => isInBillingMonth(i.date, monthAnchor, monthStartDay))}
                currency="RON"
                title={`💰 Venituri · ${periodLabel}`}
                emptyHint={`Fără venituri pentru ${periodLabel}.`}
                getMeta={(key) => getCategoryMeta(key, 'income', customCategories)}
              />
            )}
          </View>
        )}

        {/* Upcoming events */}
        {upcomingEvents.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>📅 Evenimente apropiate</Text>
            <View style={{ gap: SPACING.sm }}>
              {upcomingEvents.map(ev => {
                const d = daysUntil(ev.startDate);
                return (
                  <View key={ev.id} style={styles.evCard}>
                    <View style={styles.evDateBox}>
                      <Text style={styles.evDateDay}>{new Date(ev.startDate).getDate()}</Text>
                      <Text style={styles.evDateMonth}>
                        {new Date(ev.startDate).toLocaleDateString('ro-RO', { month: 'short' })}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.evTitle} numberOfLines={1}>{ev.title}</Text>
                      <Text style={styles.evSub}>
                        {ev.startTime ? `🕐 ${ev.startTime}` : ''}
                        {ev.location ? ` · 📍 ${ev.location}` : ''}
                      </Text>
                    </View>
                    <Text style={styles.evDays}>
                      {d === 0 ? 'Azi' : d === 1 ? 'Mâine' : `${d}z`}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Recent expenses */}
        {filteredExpenses.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>💸 Cheltuieli recente</Text>
            <View style={{ gap: SPACING.sm }}>
              {filteredExpenses.slice(0, 5).map(e => (
                <View key={e.id} style={styles.expCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.expTitle} numberOfLines={1}>{e.title}</Text>
                    <Text style={styles.expSub}>{e.category} · {formatDate(e.date)}</Text>
                  </View>
                  <Text style={styles.expAmount}>{formatCurrency(e.amount, e.currency || 'RON')}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  header: { backgroundColor: T.card, borderBottomWidth: 1, borderBottomColor: T.line },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingTop: SPACING.sm, paddingBottom: SPACING.sm, gap: SPACING.md },
  modeRow: { paddingBottom: SPACING.md },
  headerGreeting: { fontSize: 20, fontWeight: FONTS.bold, color: T.ink },
  headerSub: { fontSize: 12, color: T.ink3, marginTop: 2, textTransform: 'capitalize' },

  profilePill: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: T.card, borderRadius: RADIUS.xl,
    padding: SPACING.md,
    ...SHADOW.sm,
  },
  profileAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: T.brand,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  profileAvatarImg: { width: 44, height: 44, borderRadius: 22 },
  profileAvatarInitials: { color: '#fff', fontSize: 16, fontWeight: FONTS.bold },
  profilePillName: { fontSize: 15, fontWeight: FONTS.bold, color: T.ink },
  profilePillSub: { fontSize: 11, color: T.ink3, marginTop: 2 },
  profilePillChev: { fontSize: 28, color: T.ink4 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: T.brandTint,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnText: { fontSize: 18 },
  badge: {
    position: 'absolute', top: -2, right: -2,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: T.danger,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { fontSize: 10, fontWeight: FONTS.bold, color: '#fff' },

  hhChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: T.bgSoft,
    borderWidth: 1.5, borderColor: T.line,
  },
  hhChipActive: { backgroundColor: T.brand, borderColor: T.brand },
  hhChipText: { fontSize: 13, fontWeight: FONTS.semibold, color: T.ink2 },
  hhChipTextActive: { color: '#fff' },

  hhCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: T.card, borderRadius: RADIUS.xl,
    padding: SPACING.md, gap: SPACING.md,
    ...SHADOW.sm,
  },
  hhCardLeft: {
    width: 60, height: 60, borderRadius: 16,
    backgroundColor: T.brandTint,
    alignItems: 'center', justifyContent: 'center',
  },
  hhCardIcon: { fontSize: 32 },
  hhCardName: { fontSize: 17, fontWeight: FONTS.bold, color: T.ink },
  hhCardSub: { fontSize: 12, color: T.ink3, marginTop: 2, textTransform: 'capitalize' },
  hhCardAddr: { fontSize: 11, color: T.ink4, marginTop: 4 },
  hhCardBadgeRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  hhCardBadge: {
    backgroundColor: T.brandTint,
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  hhCardBadgeText: { fontSize: 10, color: T.brand, fontWeight: FONTS.bold },
  hhCardChev: { fontSize: 28, color: T.ink4 },

  balanceCard: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOW.md,
  },
  balancePositive: { backgroundColor: '#10B981' },
  balanceNegative: { backgroundColor: T.brand },
  balanceLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: FONTS.semibold, letterSpacing: 1 },
  balanceValue: { color: '#fff', fontSize: 32, fontWeight: FONTS.bold, marginTop: 4 },
  balanceRow: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.md },
  balanceItem: { flex: 1 },
  balanceItemLabel: { fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: FONTS.medium },
  balanceItemVal: { fontSize: 15, fontWeight: FONTS.bold, marginTop: 2 },
  balanceDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.25)', marginHorizontal: SPACING.md },
  budgetRow: { marginTop: SPACING.md },
  budgetBarBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 3, overflow: 'hidden' },
  budgetBarFill: { height: '100%', borderRadius: 3 },
  budgetText: { color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 4 },

  actionsRow: { flexDirection: 'row', gap: SPACING.sm },
  actionTile: {
    flex: 1, alignItems: 'center', gap: 4,
    backgroundColor: T.card, borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    ...SHADOW.sm,
  },
  actionTileDisabled: { opacity: 0.45 },
  actionIcon: { fontSize: 28 },
  actionLabel: { fontSize: 11, fontWeight: FONTS.semibold, color: T.ink2 },
  actionLockBadge: {
    fontSize: 9, fontWeight: FONTS.bold, color: '#B91C1C',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6, paddingVertical: 1,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
    marginTop: 2,
    letterSpacing: 0.4,
  },

  sectionTitle: {
    fontSize: 14, fontWeight: FONTS.bold, color: T.ink,
    marginBottom: SPACING.sm, letterSpacing: 0.3,
  },

  evCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: T.card, borderRadius: RADIUS.lg,
    padding: SPACING.md,
    ...SHADOW.sm,
  },
  evDateBox: {
    width: 48, height: 48,
    backgroundColor: T.brandTint,
    borderRadius: RADIUS.md,
    alignItems: 'center', justifyContent: 'center',
  },
  evDateDay: { fontSize: 18, fontWeight: FONTS.bold, color: T.brand },
  evDateMonth: { fontSize: 9, color: T.brand, textTransform: 'uppercase', fontWeight: FONTS.semibold },
  evTitle: { fontSize: 14, fontWeight: FONTS.semibold, color: T.ink },
  evSub: { fontSize: 11, color: T.ink3, marginTop: 2 },
  evDays: {
    fontSize: 12, fontWeight: FONTS.bold, color: T.brand,
    backgroundColor: T.brandTint,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: RADIUS.full,
  },

  expCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: T.card, borderRadius: RADIUS.lg,
    padding: SPACING.md,
    ...SHADOW.sm,
  },
  expTitle: { fontSize: 14, fontWeight: FONTS.semibold, color: T.ink },
  expSub: { fontSize: 11, color: T.ink3, marginTop: 2, textTransform: 'capitalize' },
  expAmount: { fontSize: 15, fontWeight: FONTS.bold, color: T.danger },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  emptyIcon: { fontSize: 80, marginBottom: SPACING.lg },
  emptyTitle: { fontSize: 18, fontWeight: FONTS.bold, color: T.ink, marginBottom: SPACING.sm },
  emptyBody: { fontSize: 13, color: T.ink3, textAlign: 'center', lineHeight: 18, marginBottom: SPACING.xl, paddingHorizontal: SPACING.lg },
  emptyBtn: {
    backgroundColor: T.brand, paddingHorizontal: SPACING.xxl, paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg, ...SHADOW.md,
  },
  emptyBtnText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 15 },
});
