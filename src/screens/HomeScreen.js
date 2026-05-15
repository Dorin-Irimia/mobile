import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
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
import { getVehicleIcon } from '../utils/vehicleCategories';
import { VehiclePhotoSticker } from '../components/VehiclePhotoSticker';

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
    year: 'numeric',
  });
}

function VehicleCard({ vehicle, active, onPress, width, height }) {
  return (
    <TouchableOpacity
      style={[styles.vehicleCard, { width, height }, active && styles.vehicleCardActive]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.vehicleIconWrap}>
        <VehiclePhotoSticker
          photo={vehicle.photo}
          category={vehicle.category}
          size={width * 0.45}
        />
      </View>
      <Text style={styles.vehiclePlate} numberOfLines={1}>
        {vehicle.plate || '—'}
      </Text>
      <Text style={styles.vehicleName} numberOfLines={2}>
        {vehicle.brand} {vehicle.model}
      </Text>
      <Text style={styles.vehicleYear}>{vehicle.year}</Text>
    </TouchableOpacity>
  );
}

function AddVehicleCard({ onPress, width, height }) {
  return (
    <TouchableOpacity
      style={[styles.addVehicleCard, { width, height }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.addVehicleCircle}>
        <Text style={styles.addVehiclePlus}>+</Text>
      </View>
      <Text style={styles.addVehicleLabel}>Adaugă vehicul</Text>
    </TouchableOpacity>
  );
}

function DeadlineRow({ label, dateStr }) {
  const days = daysUntil(dateStr);
  return (
    <View style={styles.deadlineRow}>
      <Text style={styles.deadlineLabel}>{label}</Text>
      <Text style={styles.deadlineDate}>{formatDate(dateStr)}</Text>
      <StatusBadge days={days} />
    </View>
  );
}

function QuickAction({ icon, label, onPress, width }) {
  return (
    <TouchableOpacity
      style={[styles.quickAction, { width }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.quickActionIconWrap}>
        <Text style={styles.quickActionIcon}>{icon}</Text>
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function HomeScreen({ navigation }) {
  const user = useStore(s => s.user);
  const vehicles = useStore(s => s.vehicles);
  const invoices = useStore(s => s.invoices);
  const reminders = useStore(s => s.reminders);
  const notifications = useStore(s => s.notifications);
  const fetchVehicles = useStore(s => s.fetchVehicles);
  const fetchNotifications = useStore(s => s.fetchNotifications);
  const fetchReminders = useStore(s => s.fetchReminders);

  const { width, isTablet, hPad, maxContentWidth } = useResponsive();

  const vehicleCardW = isTablet ? 180 : 140;
  const vehicleCardH = isTablet ? 220 : 180;

  const quickActionGrid = getGridColumns(
    Math.min(width, maxContentWidth),
    isTablet ? 180 : 140,
    SPACING.md,
    hPad,
  );

  const [activeVehicleIndex, setActiveVehicleIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const unreadCount = (notifications || []).filter(n => !n.isRead).length;
  const activeVehicle = (vehicles || [])[activeVehicleIndex] || null;

  const currentMonthTotal = (invoices || [])
    .filter(inv => {
      const d = new Date(inv.date || inv.createdAt);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0);

  const loadAll = useCallback(async () => {
    await Promise.all([
      fetchVehicles(),
      fetchNotifications(),
      fetchReminders && fetchReminders(),
    ]);
  }, [fetchVehicles, fetchNotifications, fetchReminders]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadAll();
      setLoading(false);
    })();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  const getVehicleDeadlines = (v) => {
    if (!v) return [];
    return [
      { label: 'ITP', dateStr: v.itpDate },
      { label: 'RCA', dateStr: v.rcaDate },
      { label: 'CASCO', dateStr: v.cascoDate },
      { label: 'Rovinieta', dateStr: v.rovDate },
    ].filter(d => d.dateStr);
  };

  const firstName = user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'utilizator';

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.header} edges={['top']}>
        <View style={[styles.headerContent, { paddingHorizontal: hPad }]}>
          <View style={styles.headerLeft}>
            <Text style={[styles.greeting, { fontSize: fScale(20) }]}>
              {getGreeting()}, {firstName}!
            </Text>
            <Text style={styles.todayStr}>{getTodayStr()}</Text>
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
            <Text style={[styles.sectionTitle, { paddingHorizontal: hPad }]}>
              Vehiculele mele
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: hPad, gap: SPACING.md }}
            >
              {(vehicles || []).map((v, i) => (
                <VehicleCard
                  key={v._id || v.id || i}
                  vehicle={v}
                  active={i === activeVehicleIndex}
                  width={vehicleCardW}
                  height={vehicleCardH}
                  onPress={() => {
                    setActiveVehicleIndex(i);
                    navigation.navigate('VehicleDetail', { vehicleId: v._id || v.id });
                  }}
                />
              ))}
              <AddVehicleCard
                width={vehicleCardW}
                height={vehicleCardH}
                onPress={() => navigation.navigate('AddVehicle')}
              />
            </ScrollView>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { paddingHorizontal: hPad }]}>
              Termene scadente
            </Text>
            {!vehicles || vehicles.length === 0 ? (
              <EmptyState
                icon="📅"
                title="Niciun vehicul înregistrat"
                subtitle="Adaugă un vehicul pentru a vedea termenele."
              />
            ) : (
              <View style={[styles.deadlineCard, { marginHorizontal: hPad }]}>
                {getVehicleDeadlines(activeVehicle).length === 0 ? (
                  <Text style={styles.noDeadlines}>Nu există termene disponibile.</Text>
                ) : (
                  getVehicleDeadlines(activeVehicle).map((d, i) => (
                    <React.Fragment key={d.label}>
                      <DeadlineRow label={d.label} dateStr={d.dateStr} />
                      {i < getVehicleDeadlines(activeVehicle).length - 1 && (
                        <View style={styles.deadlineDivider} />
                      )}
                    </React.Fragment>
                  ))
                )}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { paddingHorizontal: hPad }]}>
              Acțiuni rapide
            </Text>
            <View style={[styles.quickGrid, { paddingHorizontal: hPad, gap: SPACING.md }]}>
              <QuickAction
                icon="📷"
                label="Scanează Talon"
                width={quickActionGrid.itemWidth}
                onPress={() => navigation.navigate('Camera')}
              />
              <QuickAction
                icon="✍️"
                label="Semnează"
                width={quickActionGrid.itemWidth}
                onPress={() => navigation.navigate('Documents')}
              />
              <QuickAction
                icon="⛽"
                label="Combustibil"
                width={quickActionGrid.itemWidth}
                onPress={() => navigation.navigate('FuelLog')}
              />
              <QuickAction
                icon="🤖"
                label="AI Asistent"
                width={quickActionGrid.itemWidth}
                onPress={() => navigation.navigate('AIChat')}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { paddingHorizontal: hPad }]}>
              Cheltuieli luna curentă
            </Text>
            <View style={[styles.expenseCard, { marginHorizontal: hPad }]}>
              <Text style={styles.expenseIcon}>💳</Text>
              <View style={styles.expenseInfo}>
                <Text style={styles.expenseLabel}>Total facturi</Text>
                <Text style={[styles.expenseAmount, { fontSize: fScale(22) }]}>
                  {formatCurrency(currentMonthTotal, 'RON')}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.expenseLink}
                onPress={() => navigation.navigate('Invoices')}
                activeOpacity={0.8}
              >
                <Text style={styles.expenseLinkText}>Vezi tot →</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  header: { backgroundColor: T.brand },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.lg,
  },
  headerLeft: { flex: 1 },
  greeting: { fontWeight: FONTS.bold, color: '#fff', marginBottom: 2 },
  todayStr: {
    fontSize: 12,
    fontWeight: FONTS.regular,
    color: 'rgba(255,255,255,0.75)',
    textTransform: 'capitalize',
  },
  headerRight: { flexDirection: 'row', gap: SPACING.sm },
  iconBtn: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    borderRadius: TOUCH_TARGET / 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
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
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: SPACING.xl },
  section: { marginBottom: SPACING.xxl },
  sectionTitle: {
    fontSize: 16,
    fontWeight: FONTS.bold,
    color: T.ink,
    marginBottom: SPACING.md,
  },
  vehicleCard: {
    backgroundColor: T.card,
    borderRadius: RADIUS.lg,
    padding: 14,
    ...SHADOW.sm,
    borderWidth: 2,
    borderColor: 'transparent',
    justifyContent: 'flex-end',
  },
  vehicleCardActive: {
    borderColor: T.brand,
    ...SHADOW.md,
    shadowColor: IS_IOS ? T.brand : '#000',
    shadowOpacity: IS_IOS ? 0.25 : undefined,
  },
  vehicleIconWrap: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    alignItems: 'center',
  },
  vehiclePlate: {
    fontSize: 13,
    fontWeight: FONTS.bold,
    color: T.brand,
    marginBottom: 4,
    letterSpacing: 1,
  },
  vehicleName: { fontSize: 13, fontWeight: FONTS.semibold, color: T.ink, lineHeight: 17 },
  vehicleYear: { fontSize: 12, fontWeight: FONTS.regular, color: T.ink3, marginTop: 2 },
  addVehicleCard: {
    backgroundColor: T.brandTint,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    borderColor: T.brandTint2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  addVehicleCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: T.brand,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addVehiclePlus: {
    fontSize: 28,
    fontWeight: FONTS.light,
    color: '#fff',
    lineHeight: 34,
  },
  addVehicleLabel: {
    fontSize: 13,
    fontWeight: FONTS.semibold,
    color: T.brand,
    textAlign: 'center',
  },
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
  deadlineLabel: { width: 80, fontSize: 14, fontWeight: FONTS.semibold, color: T.ink },
  deadlineDate: { flex: 1, fontSize: 13, fontWeight: FONTS.regular, color: T.ink3 },
  deadlineDivider: { height: 1, backgroundColor: T.line2, marginLeft: SPACING.lg },
  noDeadlines: { padding: SPACING.xl, fontSize: 14, color: T.ink4, textAlign: 'center' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  quickAction: {
    backgroundColor: T.brandTint,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    gap: SPACING.sm,
    minHeight: TOUCH_TARGET * 2,
    justifyContent: 'center',
  },
  quickActionIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOW.sm,
  },
  quickActionIcon: { fontSize: 26 },
  quickActionLabel: {
    fontSize: 13,
    fontWeight: FONTS.semibold,
    color: T.brandDark,
    textAlign: 'center',
  },
  expenseCard: {
    backgroundColor: T.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    ...SHADOW.sm,
  },
  expenseIcon: { fontSize: 32, marginRight: 14 },
  expenseInfo: { flex: 1 },
  expenseLabel: { fontSize: 13, fontWeight: FONTS.regular, color: T.ink3, marginBottom: 4 },
  expenseAmount: { fontWeight: FONTS.bold, color: T.ink },
  expenseLink: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: T.brandTint,
    borderRadius: RADIUS.sm,
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
  },
  expenseLinkText: { fontSize: 13, fontWeight: FONTS.semibold, color: T.brand },
  bottomSpacer: { height: 32 },
});
