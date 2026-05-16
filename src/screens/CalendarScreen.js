import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useStore from '../store';
import {
  T,
  FONTS,
  RADIUS,
  SHADOW,
  SPACING,
  formatDate,
  daysUntil,
  useResponsive,
  HIT_SLOP,
  TOUCH_TARGET,
} from '../theme';
import { Card, Pill, SectionHeader } from '../components/ui';

const MONTH_NAMES = [
  'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
  'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie',
];
const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function toYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1);
  const totalDays = new Date(year, month + 1, 0).getDate();
  let startDow = firstDay.getDay();
  if (startDow === 0) startDow = 7;
  const blanks = startDow - 1;
  const days = [];
  for (let i = 0; i < blanks; i++) days.push(null);
  for (let d = 1; d <= totalDays; d++) days.push(d);
  return days;
}

function getEventDates(reminders, vehicles) {
  const dates = new Set();
  reminders.forEach(r => {
    if (r.dueDate) dates.add(r.dueDate.slice(0, 10));
  });
  vehicles.forEach(v => {
    ['itpDate', 'rcaDate', 'cascoDate', 'rovDate'].forEach(field => {
      if (v[field]) dates.add(v[field].slice(0, 10));
    });
  });
  return dates;
}

function getEventsForDay(dateStr, reminders, vehicles) {
  const events = [];
  reminders.forEach(r => {
    if (r.dueDate && r.dueDate.slice(0, 10) === dateStr) {
      events.push({ id: `r-${r.id}`, title: r.title, type: r.type || 'Reminder', source: 'reminder', reminder: r });
    }
  });
  vehicles.forEach(v => {
    const label = `${v.make} ${v.model} · ${v.plate}`;
    const checks = [
      { field: 'itpDate', name: 'ITP' },
      { field: 'rcaDate', name: 'RCA' },
      { field: 'cascoDate', name: 'CASCO' },
      { field: 'rovDate', name: 'Rovinietă' },
    ];
    checks.forEach(c => {
      if (v[c.field] && v[c.field].slice(0, 10) === dateStr) {
        events.push({ id: `v-${v.id}-${c.field}`, title: `${c.name} – ${label}`, type: c.name, source: 'vehicle' });
      }
    });
  });
  return events;
}

export default function CalendarScreen({ navigation }) {
  const { reminders, vehicles, fetchReminders, fetchVehicles } = useStore();
  const selectedVehicleIdGlobal = useStore(s => s.selectedVehicleId);
  const { isTablet, hPad, maxContentWidth } = useResponsive();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [refreshing, setRefreshing] = useState(false);
  const [vehicleFilter, setVehicleFilter] = useState(selectedVehicleIdGlobal || 'all');
  const { updateReminder, deleteReminder } = useStore();

  useEffect(() => {
    fetchReminders();
    if (fetchVehicles) fetchVehicles();
  }, []);

  useEffect(() => {
    if (selectedVehicleIdGlobal) setVehicleFilter(selectedVehicleIdGlobal);
  }, [selectedVehicleIdGlobal]);

  // Filtered lists by selected vehicle
  const filteredVehicles = vehicleFilter === 'all'
    ? vehicles
    : vehicles.filter(v => v.id === vehicleFilter);
  const filteredReminders = vehicleFilter === 'all'
    ? reminders
    : reminders.filter(r => !r.vehicleId || r.vehicleId === vehicleFilter);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchReminders(), fetchVehicles?.()]);
    setRefreshing(false);
  }, []);

  const goToPrevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const goToNextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const calDays = buildCalendarDays(year, month);
  const eventDates = getEventDates(filteredReminders, filteredVehicles);

  const todayStr = toYMD(today);
  const selectedDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
  const selectedEvents = getEventsForDay(selectedDateStr, filteredReminders, filteredVehicles);

  const monthReminders = filteredReminders.filter(r => {
    if (!r.dueDate) return false;
    const d = new Date(r.dueDate);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const toggleDone = async (r) => {
    await updateReminder(r.id, { isDone: !r.isDone });
  };

  const handleDeleteReminder = async (id) => {
    await deleteReminder(id);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={isTablet ? { alignSelf: 'center', width: '100%', maxWidth: maxContentWidth } : undefined}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.brand} />
        }
      >
        <View style={[styles.header, { paddingHorizontal: hPad }]}>
          <Text style={styles.headerTitle}>Calendar & Remindere</Text>
        </View>

        {vehicles.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: hPad, gap: 8, paddingBottom: 12 }}
          >
            <TouchableOpacity
              onPress={() => setVehicleFilter('all')}
              style={[styles.vehChip, vehicleFilter === 'all' && styles.vehChipActive]}
            >
              <Text style={[styles.vehChipText, vehicleFilter === 'all' && styles.vehChipTextActive]}>
                Toate vehiculele
              </Text>
            </TouchableOpacity>
            {vehicles.map(v => (
              <TouchableOpacity
                key={v.id}
                onPress={() => setVehicleFilter(v.id)}
                style={[styles.vehChip, vehicleFilter === v.id && styles.vehChipActive]}
              >
                <Text style={[styles.vehChipText, vehicleFilter === v.id && styles.vehChipTextActive]}>
                  {v.plate}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View style={styles.calCard}>
          <View style={styles.calNav}>
            <TouchableOpacity onPress={goToPrevMonth} style={styles.navBtn} activeOpacity={0.7}>
              <Text style={styles.navArrow}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.calMonthYear}>{MONTH_NAMES[month]} {year}</Text>
            <TouchableOpacity onPress={goToNextMonth} style={styles.navBtn} activeOpacity={0.7}>
              <Text style={styles.navArrow}>›</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.dayLabelsRow}>
            {DAY_LABELS.map((l, i) => (
              <View key={i} style={styles.dayLabelCell}>
                <Text style={[styles.dayLabel, (i === 5 || i === 6) && styles.dayLabelWeekend]}>{l}</Text>
              </View>
            ))}
          </View>

          <View style={styles.calGrid}>
            {calDays.map((day, idx) => {
              if (!day) return <View key={`blank-${idx}`} style={styles.dayCell} />;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isToday = dateStr === todayStr;
              const isSelected = day === selectedDay && `${year}-${String(month + 1).padStart(2, '0')}` === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}` || (selectedDay === day && year === parseInt(selectedDateStr.slice(0, 4)) && month === parseInt(selectedDateStr.slice(5, 7)) - 1);
              const hasEvent = eventDates.has(dateStr);
              const selected = day === selectedDay;
              return (
                <TouchableOpacity
                  key={`day-${day}`}
                  style={styles.dayCell}
                  onPress={() => setSelectedDay(day)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.dayCircle, selected && styles.dayCircleSelected]}>
                    <Text style={[
                      styles.dayNum,
                      isToday && !selected && styles.dayNumToday,
                      selected && styles.dayNumSelected,
                    ]}>
                      {day}
                    </Text>
                  </View>
                  {hasEvent && !selected && <View style={styles.eventDot} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {selectedEvents.length > 0 && (
          <View style={styles.selectedEventsWrap}>
            <Text style={styles.selectedDateLabel}>
              {selectedDay} {MONTH_NAMES[month]}
            </Text>
            {selectedEvents.map(ev => (
              <Card key={ev.id} style={styles.eventCard}>
                <View style={styles.eventCardRow}>
                  <Text style={styles.eventTitle}>{ev.title}</Text>
                  <Pill>{ev.type}</Pill>
                </View>
              </Card>
            ))}
          </View>
        )}

        <View style={styles.remindersSection}>
          <SectionHeader
            title="Remindere"
            action="+"
            onAction={() => navigation.navigate('AddReminder')}
          />

          {monthReminders.length === 0 ? (
            <View style={styles.emptyReminders}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyText}>Niciun reminder în această lună</Text>
            </View>
          ) : (
            monthReminders.map(r => (
              <Card key={r.id} style={[styles.reminderCard, r.isDone && styles.reminderCardDone]}>
                <View style={styles.reminderRow}>
                  <TouchableOpacity
                    onPress={() => toggleDone(r)}
                    style={[styles.checkbox, r.isDone && styles.checkboxDone]}
                    activeOpacity={0.8}
                  >
                    {r.isDone && <Text style={styles.checkmark}>✓</Text>}
                  </TouchableOpacity>
                  <View style={styles.reminderInfo}>
                    <Text style={[styles.reminderTitle, r.isDone && styles.reminderTitleDone]}>
                      {r.title}
                    </Text>
                    <Text style={styles.reminderDate}>{formatDate(r.dueDate)}</Text>
                    {r.type && <Pill style={styles.reminderPill}>{r.type}</Pill>}
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDeleteReminder(r.id)}
                    style={styles.deleteBtn}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.deleteBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  header: { paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { fontSize: 22, fontWeight: FONTS.bold, color: T.ink },
  calCard: {
    backgroundColor: T.card,
    marginHorizontal: 16,
    borderRadius: RADIUS.lg,
    padding: 16,
    ...SHADOW.sm,
    marginBottom: 16,
  },
  calNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  navBtn: { width: TOUCH_TARGET, height: TOUCH_TARGET, alignItems: 'center', justifyContent: 'center', backgroundColor: T.line2, borderRadius: RADIUS.md },
  navArrow: { fontSize: 22, color: T.ink2, lineHeight: 26 },
  vehChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: RADIUS.full, backgroundColor: T.card,
    borderWidth: 1.5, borderColor: T.line,
  },
  vehChipActive: { backgroundColor: T.brand, borderColor: T.brand },
  vehChipText: { fontSize: 13, fontWeight: FONTS.medium, color: T.ink2 },
  vehChipTextActive: { color: '#fff', fontWeight: FONTS.bold },
  calMonthYear: { fontSize: 16, fontWeight: FONTS.bold, color: T.ink },
  dayLabelsRow: { flexDirection: 'row', marginBottom: 8 },
  dayLabelCell: { flex: 1, alignItems: 'center' },
  dayLabel: { fontSize: 12, fontWeight: FONTS.semibold, color: T.ink3 },
  dayLabelWeekend: { color: T.brand },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.285%', alignItems: 'center', marginBottom: 4 },
  dayCircle: { width: 34, height: 34, borderRadius: RADIUS.full, alignItems: 'center', justifyContent: 'center' },
  dayCircleSelected: { backgroundColor: T.brand },
  dayNum: { fontSize: 14, fontWeight: FONTS.regular, color: T.ink },
  dayNumToday: { fontWeight: FONTS.bold, color: T.brand },
  dayNumSelected: { color: '#fff', fontWeight: FONTS.bold },
  eventDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: T.brand, marginTop: 2 },
  selectedEventsWrap: { paddingHorizontal: 16, marginBottom: 16 },
  selectedDateLabel: { fontSize: 15, fontWeight: FONTS.semibold, color: T.ink, marginBottom: 8 },
  eventCard: { padding: 12, marginBottom: 8 },
  eventCardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eventTitle: { fontSize: 14, fontWeight: FONTS.medium, color: T.ink, flex: 1, marginRight: 8 },
  remindersSection: { paddingHorizontal: 16, paddingBottom: 40 },
  emptyReminders: { alignItems: 'center', paddingVertical: 28 },
  emptyIcon: { fontSize: 32, marginBottom: 8 },
  emptyText: { fontSize: 14, color: T.ink3 },
  reminderCard: { padding: 14, marginBottom: 10 },
  reminderCardDone: { opacity: 0.5 },
  reminderRow: { flexDirection: 'row', alignItems: 'center' },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: RADIUS.sm,
    borderWidth: 2,
    borderColor: T.line,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: T.line2,
  },
  checkboxDone: { backgroundColor: T.success, borderColor: T.success },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: FONTS.bold },
  reminderInfo: { flex: 1 },
  reminderTitle: { fontSize: 14, fontWeight: FONTS.semibold, color: T.ink, marginBottom: 2 },
  reminderTitleDone: { textDecorationLine: 'line-through', color: T.ink3 },
  reminderDate: { fontSize: 12, color: T.ink3, marginBottom: 4 },
  reminderPill: { alignSelf: 'flex-start' },
  deleteBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  deleteBtnText: { fontSize: 16, color: T.ink4 },
});
