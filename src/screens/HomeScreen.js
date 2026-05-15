import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useStore from '../store';
import {
  T,
  RADIUS,
  SHADOW,
  FONTS,
  SPACING,
  formatDate,
  formatCurrency,
  daysUntil,
  statusFor,
  useResponsive,
  getGridColumns,
  fScale,
  HIT_SLOP,
  TOUCH_TARGET,
  IS_IOS,
} from '../theme';
import { EmptyState, StatusBadge } from '../components/ui';
import { OnlineDot } from '../components/NetworkBadge';
import { VehiclePhotoSticker } from '../components/VehiclePhotoSticker';
import { getVehicleIcon } from '../utils/vehicleCategories';
import {
  DEFAULT_QUICK_ACTION_IDS,
  getQuickActionById,
  normalizeQuickActionIds,
} from '../utils/quickActions';

const DOUBLE_TAP_MS = 450;

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bună dimineața';
  if (h < 18) return 'Bună ziua';
  return 'Bună seara';
}

function getTodayStr() {
  return new Date().toLocaleDateString('ro-RO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function vehicleIdOf(vehicle) {
  return vehicle?._id || vehicle?.id;
}

function getVehicleDeadlines(v) {
  if (!v) return [];
  return [
    { label: 'ITP', dateStr: v.itpDate },
    { label: 'RCA', dateStr: v.rcaDate },
    { label: 'CASCO', dateStr: v.cascoDate },
    { label: 'Rovinietă', dateStr: v.rovDate },
  ]
    .filter(item => item.dateStr)
    .map(item => ({ ...item, days: daysUntil(item.dateStr) }))
    .sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999));
}

function StatTile({ label, value, tone = 'neutral' }) {
  return (
    <View style={[styles.statTile, tone === 'warm' && styles.statTileWarm, tone === 'green' && styles.statTileGreen]}>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function VehicleRailCard({ vehicle, active, onPress, width }) {
  const label = `${vehicle.brand || ''} ${vehicle.model || ''}`.trim() || 'Vehicul';
  return (
    <TouchableOpacity
      style={[styles.vehicleRailCard, { width }, active && styles.vehicleRailCardActive]}
      onPress={onPress}
      activeOpacity={0.86}
    >
      <View style={styles.vehicleRailTop}>
        <VehiclePhotoSticker photo={vehicle.photo} category={vehicle.category} size={54} />
        <View style={[styles.vehicleTypeDot, active && styles.vehicleTypeDotActive]}>
          <Text style={styles.vehicleTypeIcon}>{getVehicleIcon(vehicle.category)}</Text>
        </View>
      </View>
      <Text style={[styles.vehicleRailPlate, active && styles.vehicleRailPlateActive]} numberOfLines={1}>
        {vehicle.plate || '—'}
      </Text>
      <Text style={styles.vehicleRailName} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.vehicleRailMeta}>
        <Text style={styles.vehicleRailMetaText}>{vehicle.year || '—'}</Text>
        {vehicle.role === 'member' && <Text style={styles.sharedMark}>Partajat</Text>}
      </View>
    </TouchableOpacity>
  );
}

function AddVehicleRailCard({ onPress, width }) {
  return (
    <TouchableOpacity
      style={[styles.addVehicleRailCard, { width }]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <View style={styles.addVehicleCircle}>
        <Text style={styles.addVehiclePlus}>+</Text>
      </View>
      <Text style={styles.addVehicleLabel}>Vehicul nou</Text>
    </TouchableOpacity>
  );
}

function QuickAction({ action, width, onPress, disabled }) {
  return (
    <TouchableOpacity
      style={[styles.quickAction, { width }, disabled && styles.quickActionDisabled]}
      onPress={onPress}
      activeOpacity={0.84}
    >
      <Text style={styles.quickActionIcon}>{action.icon}</Text>
      <View style={styles.quickActionText}>
        <Text style={styles.quickActionLabel} numberOfLines={1}>
          {action.label}
        </Text>
        <Text style={styles.quickActionSub} numberOfLines={1}>
          {action.description}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function DeadlineRow({ item }) {
  return (
    <View style={styles.deadlineRow}>
      <View style={styles.deadlineLabelWrap}>
        <Text style={styles.deadlineLabel}>{item.label}</Text>
        <Text style={styles.deadlineDate}>{formatDate(item.dateStr)}</Text>
      </View>
      <StatusBadge days={item.days} />
    </View>
  );
}

export default function HomeScreen({ navigation }) {
  const user = useStore(s => s.user);
  const vehicles = useStore(s => s.vehicles);
  const invoices = useStore(s => s.invoices);
  const reminders = useStore(s => s.reminders);
  const fuelLogs = useStore(s => s.fuelLogs);
  const notifications = useStore(s => s.notifications);
  const quickActionIds = useStore(s => s.quickActionIds);
  const loadQuickActions = useStore(s => s.loadQuickActions);
  const fetchVehicles = useStore(s => s.fetchVehicles);
  const fetchNotifications = useStore(s => s.fetchNotifications);
  const fetchReminders = useStore(s => s.fetchReminders);
  const fetchInvoices = useStore(s => s.fetchInvoices);
  const fetchFuelLogs = useStore(s => s.fetchFuelLogs);

  const { width, isTablet, hPad, maxContentWidth } = useResponsive();
  const railCardW = isTablet ? 184 : 158;
  const quickActionGrid = getGridColumns(
    Math.min(width, maxContentWidth),
    isTablet ? 210 : 158,
    SPACING.md,
    hPad,
  );

  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const lastVehicleTap = useRef({ id: null, at: 0 });

  const vehicleList = vehicles || [];
  const selectedVehicle = useMemo(() => {
    if (!vehicleList.length) return null;
    return vehicleList.find(v => vehicleIdOf(v) === selectedVehicleId) || vehicleList[0];
  }, [vehicleList, selectedVehicleId]);
  const selectedId = vehicleIdOf(selectedVehicle);

  const firstName = user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'utilizator';
  const unreadCount = (notifications || []).filter(n => !n.isRead).length;

  const currentMonthTotal = (invoices || [])
    .filter(inv => {
      const d = new Date(inv.date || inv.createdAt);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0);

  const selectedInvoices = (invoices || []).filter(inv => inv.vehicleId === selectedId);
  const selectedFuelLogs = (fuelLogs || []).filter(log => log.vehicleId === selectedId);
  const selectedSpent = selectedInvoices.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0);
  const selectedFuelTotal = selectedFuelLogs.reduce((sum, log) => sum + (parseFloat(log.liters) || 0), 0);
  const selectedDeadlines = getVehicleDeadlines(selectedVehicle);
  const nextDeadline = selectedDeadlines[0] || null;
  const nextDeadlineStatus = statusFor(nextDeadline?.days ?? null);

  const homeQuickActions = normalizeQuickActionIds(quickActionIds || DEFAULT_QUICK_ACTION_IDS)
    .map(getQuickActionById)
    .filter(Boolean);

  const loadAll = useCallback(async () => {
    await Promise.all([
      fetchVehicles(),
      fetchNotifications(),
      fetchReminders(),
      fetchInvoices(),
      fetchFuelLogs(),
      loadQuickActions(),
    ]);
  }, [fetchVehicles, fetchNotifications, fetchReminders, fetchInvoices, fetchFuelLogs, loadQuickActions]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadAll();
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!selectedVehicleId && vehicleList.length) {
      setSelectedVehicleId(vehicleIdOf(vehicleList[0]));
    }
    if (selectedVehicleId && vehicleList.length && !vehicleList.some(v => vehicleIdOf(v) === selectedVehicleId)) {
      setSelectedVehicleId(vehicleIdOf(vehicleList[0]));
    }
  }, [vehicleList, selectedVehicleId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  const handleVehiclePress = (vehicle) => {
    const id = vehicleIdOf(vehicle);
    const now = Date.now();
    const isDoubleTap = lastVehicleTap.current.id === id && now - lastVehicleTap.current.at < DOUBLE_TAP_MS;

    setSelectedVehicleId(id);
    if (isDoubleTap) {
      lastVehicleTap.current = { id: null, at: 0 };
      navigation.navigate('VehicleDetail', { vehicleId: id });
      return;
    }

    lastVehicleTap.current = { id, at: now };
  };

  const runQuickAction = (action) => {
    if (action.requiresVehicle && !selectedVehicle) {
      Alert.alert('Vehicul', 'Adaugă un vehicul pentru această acțiune.');
      return;
    }
    const params = action.requiresVehicle ? { vehicleId: selectedId } : undefined;
    navigation.navigate(action.route, params);
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.hero} edges={['top']}>
        <View style={[styles.heroContent, { paddingHorizontal: hPad }]}>
          <View style={styles.heroTop}>
            <View style={styles.headerLeft}>
              <Text style={styles.todayStr}>{getTodayStr()}</Text>
              <Text style={[styles.greeting, { fontSize: fScale(24) }]}>
                {getGreeting()}, {firstName}
              </Text>
            </View>
            <View style={styles.headerRight}>
              <OnlineDot />
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => navigation.navigate('Notifications')}
                activeOpacity={0.8}
                hitSlop={HIT_SLOP}
              >
                <Text style={styles.iconBtnText}>🔔</Text>
                {unreadCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => navigation.navigate('Search')}
                activeOpacity={0.8}
                hitSlop={HIT_SLOP}
              >
                <Text style={styles.iconBtnText}>🔍</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.heroStats}>
            <StatTile label="Vehicule" value={vehicleList.length} />
            <StatTile label="Luna curentă" value={formatCurrency(currentMonthTotal, 'RON')} tone="warm" />
            <StatTile label="Reminder-e" value={(reminders || []).length} tone="green" />
          </View>
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={T.brand} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
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
          <View style={styles.section}>
            <View style={[styles.sectionHeader, { paddingHorizontal: hPad }]}>
              <Text style={styles.sectionTitle}>Garaj</Text>
              <Text style={styles.sectionCount}>{vehicleList.length}</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: hPad, gap: SPACING.md }}
            >
              {vehicleList.map((v, i) => {
                const id = vehicleIdOf(v);
                return (
                  <VehicleRailCard
                    key={id || i}
                    vehicle={v}
                    active={id === selectedId}
                    width={railCardW}
                    onPress={() => handleVehiclePress(v)}
                  />
                );
              })}
              <AddVehicleRailCard
                width={railCardW}
                onPress={() => navigation.navigate('AddVehicle')}
              />
            </ScrollView>
          </View>

          {selectedVehicle ? (
            <View style={[styles.vehiclePanel, { marginHorizontal: hPad }]}>
              <View style={styles.vehiclePanelTop}>
                <View style={styles.vehiclePanelPhoto}>
                  <VehiclePhotoSticker
                    photo={selectedVehicle.photo}
                    category={selectedVehicle.category}
                    size={78}
                  />
                </View>
                <View style={styles.vehiclePanelInfo}>
                  <Text style={styles.vehiclePanelPlate} numberOfLines={1}>
                    {selectedVehicle.plate || '—'}
                  </Text>
                  <Text style={styles.vehiclePanelName} numberOfLines={1}>
                    {selectedVehicle.brand} {selectedVehicle.model}
                  </Text>
                  <Text style={styles.vehiclePanelMeta} numberOfLines={1}>
                    {selectedVehicle.year || '—'} · {(Number(selectedVehicle.km) || 0).toLocaleString('ro-RO')} km
                  </Text>
                </View>
                {nextDeadline && (
                  <View style={[styles.nextBadge, { backgroundColor: nextDeadlineStatus.bg }]}>
                    <Text style={[styles.nextBadgeLabel, { color: nextDeadlineStatus.color }]}>
                      {nextDeadline.label}
                    </Text>
                    <Text style={[styles.nextBadgeValue, { color: nextDeadlineStatus.color }]}>
                      {nextDeadlineStatus.label}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.vehiclePanelStats}>
                <View style={styles.vehicleMetric}>
                  <Text style={styles.vehicleMetricValue}>{selectedInvoices.length}</Text>
                  <Text style={styles.vehicleMetricLabel}>Facturi</Text>
                </View>
                <View style={styles.vehicleMetricDivider} />
                <View style={styles.vehicleMetric}>
                  <Text style={styles.vehicleMetricValue}>{formatCurrency(selectedSpent, 'RON')}</Text>
                  <Text style={styles.vehicleMetricLabel}>Total</Text>
                </View>
                <View style={styles.vehicleMetricDivider} />
                <View style={styles.vehicleMetric}>
                  <Text style={styles.vehicleMetricValue}>{selectedFuelTotal.toFixed(0)} L</Text>
                  <Text style={styles.vehicleMetricLabel}>Combustibil</Text>
                </View>
              </View>
            </View>
          ) : (
            <EmptyState
              icon="🚗"
              title="Garaj gol"
              subtitle="Adaugă primul vehicul ca să vezi termene, cheltuieli și acțiuni rapide."
            />
          )}

          <View style={styles.section}>
            <View style={[styles.sectionHeader, { paddingHorizontal: hPad }]}>
              <Text style={styles.sectionTitle}>Acțiuni</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Profile')} hitSlop={HIT_SLOP}>
                <Text style={styles.sectionLink}>Personalizează</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.quickGrid, { paddingHorizontal: hPad, gap: SPACING.md }]}>
              {homeQuickActions.map(action => (
                <QuickAction
                  key={action.id}
                  action={action}
                  width={quickActionGrid.itemWidth}
                  disabled={action.requiresVehicle && !selectedVehicle}
                  onPress={() => runQuickAction(action)}
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <View style={[styles.sectionHeader, { paddingHorizontal: hPad }]}>
              <Text style={styles.sectionTitle}>Scadențe</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Calendar')} hitSlop={HIT_SLOP}>
                <Text style={styles.sectionLink}>Calendar</Text>
              </TouchableOpacity>
            </View>
            {!selectedVehicle ? null : (
              <View style={[styles.deadlineCard, { marginHorizontal: hPad }]}>
                {selectedDeadlines.length === 0 ? (
                  <Text style={styles.noDeadlines}>Nu există termene salvate.</Text>
                ) : (
                  selectedDeadlines.slice(0, 4).map((item, i) => (
                    <React.Fragment key={item.label}>
                      <DeadlineRow item={item} />
                      {i < Math.min(selectedDeadlines.length, 4) - 1 && <View style={styles.deadlineDivider} />}
                    </React.Fragment>
                  ))
                )}
              </View>
            )}
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  hero: {
    backgroundColor: '#172027',
    paddingBottom: SPACING.xl,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroContent: { paddingTop: SPACING.sm },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.lg,
  },
  headerLeft: { flex: 1 },
  greeting: { fontWeight: FONTS.bold, color: '#fff', marginTop: 2 },
  todayStr: {
    fontSize: 12,
    fontWeight: FONTS.semibold,
    color: '#B9C7B2',
    textTransform: 'capitalize',
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  iconBtn: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    borderRadius: TOUCH_TARGET / 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  iconBtnText: { fontSize: 18 },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: T.danger,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { fontSize: 10, fontWeight: FONTS.bold, color: '#fff' },
  heroStats: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xl,
  },
  statTile: {
    flex: 1,
    minHeight: 70,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.09)',
    padding: SPACING.md,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  statTileWarm: { backgroundColor: 'rgba(255,107,26,0.18)', borderColor: 'rgba(255,107,26,0.28)' },
  statTileGreen: { backgroundColor: 'rgba(47,158,111,0.18)', borderColor: 'rgba(47,158,111,0.24)' },
  statValue: { fontSize: 17, fontWeight: FONTS.bold, color: '#fff' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.64)', marginTop: 5, fontWeight: FONTS.medium },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: SPACING.xl },
  section: { marginBottom: SPACING.xxl },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  sectionTitle: { fontSize: 17, fontWeight: FONTS.bold, color: T.ink },
  sectionCount: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E8EFE7',
    color: '#2E5F4D',
    textAlign: 'center',
    textAlignVertical: 'center',
    fontWeight: FONTS.bold,
    fontSize: 12,
    paddingTop: IS_IOS ? 6 : 0,
  },
  sectionLink: { fontSize: 13, fontWeight: FONTS.semibold, color: T.brand },
  vehicleRailCard: {
    minHeight: 170,
    backgroundColor: T.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1.5,
    borderColor: T.line,
    ...SHADOW.sm,
  },
  vehicleRailCardActive: {
    borderColor: '#2F9E6F',
    backgroundColor: '#F8FCF9',
    ...SHADOW.md,
  },
  vehicleRailTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  vehicleTypeDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: T.line2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleTypeDotActive: { backgroundColor: '#E8F5EE' },
  vehicleTypeIcon: { fontSize: 16 },
  vehicleRailPlate: {
    fontSize: 16,
    fontWeight: FONTS.bold,
    color: T.ink,
    marginTop: SPACING.md,
    letterSpacing: 0.5,
  },
  vehicleRailPlateActive: { color: '#1E6F51' },
  vehicleRailName: { fontSize: 13, fontWeight: FONTS.semibold, color: T.ink2, marginTop: 4 },
  vehicleRailMeta: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.sm },
  vehicleRailMetaText: { fontSize: 12, color: T.ink3, fontWeight: FONTS.medium },
  sharedMark: {
    fontSize: 10,
    color: '#1E6F51',
    backgroundColor: '#E8F5EE',
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: 'hidden',
    fontWeight: FONTS.bold,
  },
  addVehicleRailCard: {
    minHeight: 170,
    backgroundColor: '#F3EFE8',
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: '#DAD1C3',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  addVehicleCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#172027',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addVehiclePlus: { fontSize: 28, fontWeight: FONTS.light, color: '#fff', lineHeight: 34 },
  addVehicleLabel: { fontSize: 13, fontWeight: FONTS.bold, color: T.ink2 },
  vehiclePanel: {
    backgroundColor: T.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.xxl,
    ...SHADOW.md,
  },
  vehiclePanelTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  vehiclePanelPhoto: {
    width: 84,
    height: 84,
    borderRadius: RADIUS.lg,
    backgroundColor: T.bgSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehiclePanelInfo: { flex: 1, minWidth: 0 },
  vehiclePanelPlate: { fontSize: 19, fontWeight: FONTS.bold, color: T.ink, letterSpacing: 0.5 },
  vehiclePanelName: { fontSize: 14, fontWeight: FONTS.semibold, color: T.ink2, marginTop: 3 },
  vehiclePanelMeta: { fontSize: 12, color: T.ink3, marginTop: 5, fontWeight: FONTS.medium },
  nextBadge: {
    minWidth: 64,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  nextBadgeLabel: { fontSize: 10, fontWeight: FONTS.bold },
  nextBadgeValue: { fontSize: 13, fontWeight: FONTS.bold, marginTop: 2 },
  vehiclePanelStats: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: T.line2,
    marginTop: SPACING.lg,
    paddingTop: SPACING.lg,
  },
  vehicleMetric: { flex: 1 },
  vehicleMetricValue: { fontSize: 14, fontWeight: FONTS.bold, color: T.ink },
  vehicleMetricLabel: { fontSize: 11, color: T.ink3, marginTop: 4, fontWeight: FONTS.medium },
  vehicleMetricDivider: { width: 1, backgroundColor: T.line2, marginHorizontal: SPACING.md },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  quickAction: {
    minHeight: 76,
    backgroundColor: T.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: T.line,
    ...SHADOW.sm,
  },
  quickActionDisabled: { opacity: 0.48 },
  quickActionIcon: { fontSize: 25, width: 32, textAlign: 'center' },
  quickActionText: { flex: 1, minWidth: 0 },
  quickActionLabel: { fontSize: 14, fontWeight: FONTS.bold, color: T.ink },
  quickActionSub: { fontSize: 11, fontWeight: FONTS.medium, color: T.ink3, marginTop: 3 },
  deadlineCard: {
    backgroundColor: T.card,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    ...SHADOW.sm,
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 14,
  },
  deadlineLabelWrap: { flex: 1 },
  deadlineLabel: { fontSize: 14, fontWeight: FONTS.bold, color: T.ink },
  deadlineDate: { fontSize: 12, fontWeight: FONTS.medium, color: T.ink3, marginTop: 3 },
  deadlineDivider: { height: 1, backgroundColor: T.line2, marginLeft: SPACING.lg },
  noDeadlines: { padding: SPACING.xl, fontSize: 14, color: T.ink4, textAlign: 'center' },
  bottomSpacer: { height: 32 },
});
