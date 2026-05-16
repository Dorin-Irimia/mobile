import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Animated,
  FlatList,
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
  HIT_SLOP_LG,
  TOUCH_TARGET,
} from '../theme';

const MONTH_NAMES = [
  'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
  'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie',
];
const MONTH_SHORT = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Noi', 'Dec'];
const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const DAY_NAMES_LONG = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'];

// Categories cu culori și iconițe
const EVENT_CATEGORY = {
  itp:        { color: '#3B82F6', bg: '#EFF6FF', icon: '🔧', label: 'ITP' },
  rca:        { color: '#10B981', bg: '#ECFDF5', icon: '🛡️', label: 'RCA' },
  casco:      { color: '#8B5CF6', bg: '#F5F3FF', icon: '🔰', label: 'CASCO' },
  rovinieta:  { color: '#F59E0B', bg: '#FFFBEB', icon: '🛣️', label: 'Rovinietă' },
  service:    { color: '#EF4444', bg: '#FEF2F2', icon: '🔧', label: 'Service' },
  reminder:   { color: T.brand, bg: T.brandTint, icon: '🔔', label: 'Reminder' },
  altele:     { color: T.ink3, bg: T.line2, icon: '📌', label: 'Altele' },
};

function getCatMeta(type) {
  const key = String(type || '').toLowerCase();
  if (EVENT_CATEGORY[key]) return EVENT_CATEGORY[key];
  if (key.startsWith('rovin')) return EVENT_CATEGORY.rovinieta;
  return EVENT_CATEGORY.reminder;
}

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

function buildEventMap(reminders, vehicles) {
  // map: ymd → events[]
  const map = new Map();
  const push = (ymd, ev) => {
    if (!map.has(ymd)) map.set(ymd, []);
    map.get(ymd).push(ev);
  };

  reminders.forEach(r => {
    if (!r.dueDate) return;
    const ymd = r.dueDate.slice(0, 10);
    push(ymd, {
      id: `r-${r.id}`,
      type: r.type || 'reminder',
      title: r.title,
      source: 'reminder',
      reminder: r,
      isDone: !!r.isDone,
      vehicleId: r.vehicleId,
    });
  });

  vehicles.forEach(v => {
    const fields = [
      { field: 'itpDate', type: 'itp', name: 'ITP' },
      { field: 'rcaDate', type: 'rca', name: 'RCA' },
      { field: 'cascoDate', type: 'casco', name: 'CASCO' },
      { field: 'rovDate', type: 'rovinieta', name: 'Rovinietă' },
    ];
    fields.forEach(f => {
      if (v[f.field]) {
        const ymd = v[f.field].slice(0, 10);
        push(ymd, {
          id: `v-${v.id}-${f.field}`,
          type: f.type,
          title: `${f.name} – ${v.plate}`,
          subtitle: `${v.brand || ''} ${v.model || ''}`.trim(),
          source: 'vehicle',
          vehicleId: v.id,
          isDone: false,
        });
      }
    });
  });

  return map;
}

function CalendarDayCell({ day, ymd, events, isToday, isSelected, isWeekend, onPress }) {
  const eventTypes = (events || []).slice(0, 3).map(e => getCatMeta(e.type));
  const hasUrgent = (events || []).some(e => {
    const d = daysUntil(ymd);
    return d !== null && d <= 7 && !e.isDone;
  });

  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.dayCell}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.dayCircle,
          isToday && !isSelected && styles.dayCircleToday,
          isSelected && styles.dayCircleSelected,
        ]}
      >
        <Text
          style={[
            styles.dayNum,
            isToday && !isSelected && styles.dayNumToday,
            isSelected && styles.dayNumSelected,
            isWeekend && !isToday && !isSelected && styles.dayNumWeekend,
          ]}
        >
          {day}
        </Text>
      </View>
      {eventTypes.length > 0 && (
        <View style={styles.eventDotsRow}>
          {eventTypes.map((meta, i) => (
            <View
              key={i}
              style={[
                styles.eventDot,
                { backgroundColor: meta.color },
                isSelected && { borderColor: '#fff' },
              ]}
            />
          ))}
        </View>
      )}
      {hasUrgent && !isSelected && (
        <View style={styles.urgentMark} />
      )}
    </TouchableOpacity>
  );
}

function EventCard({ event, vehicle, onPress, onToggleDone, onDelete }) {
  const meta = getCatMeta(event.type);
  const days = event.reminder?.dueDate ? daysUntil(event.reminder.dueDate) : null;

  return (
    <TouchableOpacity
      style={[styles.eventCard, { borderLeftColor: meta.color }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={[styles.eventIconWrap, { backgroundColor: meta.bg }]}>
        <Text style={styles.eventIcon}>{meta.icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.eventTitle, event.isDone && styles.eventTitleDone]} numberOfLines={1}>
          {event.title}
        </Text>
        <View style={styles.eventMetaRow}>
          <Text style={[styles.eventTypeBadge, { color: meta.color, backgroundColor: meta.bg }]}>
            {meta.label}
          </Text>
          {vehicle && <Text style={styles.eventVehicle}>{vehicle.plate}</Text>}
        </View>
      </View>
      {event.source === 'reminder' && onToggleDone && (
        <TouchableOpacity
          onPress={onToggleDone}
          style={[styles.checkBox, event.isDone && styles.checkBoxDone]}
          hitSlop={HIT_SLOP}
        >
          {event.isDone && <Text style={styles.checkBoxMark}>✓</Text>}
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

function UpcomingCard({ event, vehicle, days, onPress }) {
  const meta = getCatMeta(event.type);
  let label = '';
  let labelColor = T.ink3;
  if (days === 0) { label = 'Astăzi'; labelColor = T.brand; }
  else if (days === 1) { label = 'Mâine'; labelColor = T.warn; }
  else if (days < 0) { label = `acum ${Math.abs(days)} zile`; labelColor = T.danger; }
  else { label = `în ${days} zile`; labelColor = days <= 7 ? T.danger : days <= 30 ? T.warn : T.success; }

  return (
    <TouchableOpacity style={styles.upcomingCard} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.upcomingTopStripe, { backgroundColor: meta.color }]} />
      <View style={styles.upcomingBody}>
        <Text style={styles.upcomingIcon}>{meta.icon}</Text>
        <Text style={styles.upcomingType}>{meta.label}</Text>
        <Text style={styles.upcomingTitle} numberOfLines={2}>{event.title}</Text>
        {vehicle && (
          <View style={styles.upcomingVehiclePill}>
            <Text style={styles.upcomingVehiclePillText}>{vehicle.plate}</Text>
          </View>
        )}
        <Text style={[styles.upcomingDays, { color: labelColor }]}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function CalendarScreen({ navigation }) {
  const { reminders, vehicles, fetchReminders, fetchVehicles, updateReminder, deleteReminder } = useStore();
  const selectedVehicleIdGlobal = useStore(s => s.selectedVehicleId);
  const { isTablet, hPad, maxContentWidth } = useResponsive();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [selectedMonthForDay, setSelectedMonthForDay] = useState(today.getMonth());
  const [selectedYearForDay, setSelectedYearForDay] = useState(today.getFullYear());
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'agenda'
  const [vehicleFilter, setVehicleFilter] = useState(selectedVehicleIdGlobal || 'all');
  const [refreshing, setRefreshing] = useState(false);

  // Animation for the month transition
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchReminders();
    if (fetchVehicles) fetchVehicles();
  }, []);

  useEffect(() => {
    if (selectedVehicleIdGlobal) setVehicleFilter(selectedVehicleIdGlobal);
  }, [selectedVehicleIdGlobal]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchReminders(), fetchVehicles?.()]);
    setRefreshing(false);
  }, []);

  const filteredVehicles = useMemo(() => {
    if (vehicleFilter === 'all') return vehicles;
    return vehicles.filter(v => v.id === vehicleFilter);
  }, [vehicles, vehicleFilter]);

  const filteredReminders = useMemo(() => {
    if (vehicleFilter === 'all') return reminders;
    return reminders.filter(r => !r.vehicleId || r.vehicleId === vehicleFilter);
  }, [reminders, vehicleFilter]);

  const eventMap = useMemo(
    () => buildEventMap(filteredReminders, filteredVehicles),
    [filteredReminders, filteredVehicles],
  );

  const calDays = buildCalendarDays(year, month);
  const todayStr = toYMD(today);

  const selectedDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
  const selectedDate = new Date(year, month, selectedDay);
  const selectedDayEvents = eventMap.get(selectedDateStr) || [];

  // Month stats
  const monthEvents = useMemo(() => {
    const list = [];
    for (const [ymd, evs] of eventMap.entries()) {
      const d = new Date(ymd);
      if (d.getFullYear() === year && d.getMonth() === month) {
        evs.forEach(ev => list.push({ ymd, ...ev }));
      }
    }
    return list;
  }, [eventMap, year, month]);

  const urgentEvents = monthEvents.filter(ev => {
    const d = daysUntil(ev.ymd);
    return d !== null && d >= 0 && d <= 7 && !ev.isDone;
  });

  const expiredEvents = monthEvents.filter(ev => {
    const d = daysUntil(ev.ymd);
    return d !== null && d < 0;
  });

  // Upcoming events (next 30 days, sorted by date)
  const upcomingEvents = useMemo(() => {
    const list = [];
    for (const [ymd, evs] of eventMap.entries()) {
      const d = daysUntil(ymd);
      if (d !== null && d >= 0 && d <= 60) {
        evs.forEach(ev => { if (!ev.isDone) list.push({ ymd, days: d, ...ev }); });
      }
    }
    list.sort((a, b) => a.days - b.days);
    return list.slice(0, 10);
  }, [eventMap]);

  const animateMonth = (direction) => {
    slideAnim.setValue(direction === 'next' ? 50 : -50);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      friction: 8,
      tension: 50,
    }).start();
  };

  const goToPrevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
    animateMonth('prev');
  };
  const goToNextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
    animateMonth('next');
  };
  const goToToday = () => {
    const t = new Date();
    setYear(t.getFullYear());
    setMonth(t.getMonth());
    setSelectedDay(t.getDate());
    setSelectedMonthForDay(t.getMonth());
    setSelectedYearForDay(t.getFullYear());
    animateMonth('next');
  };

  const handleDayPick = (day) => {
    if (!day) return;
    setSelectedDay(day);
    setSelectedMonthForDay(month);
    setSelectedYearForDay(year);
  };

  const handleToggleReminder = async (event) => {
    if (event.source !== 'reminder') return;
    try {
      await updateReminder(event.reminder.id, { isDone: !event.isDone });
    } catch {}
  };

  const handleEventPress = (event) => {
    if (event.source === 'vehicle' && event.vehicleId) {
      navigation.navigate('VehicleDetail', { vehicleId: event.vehicleId });
    }
  };

  const handleUpcomingPress = (event) => {
    // Navigate to the day in the calendar
    const d = new Date(event.ymd);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    setSelectedDay(d.getDate());
    setSelectedMonthForDay(d.getMonth());
    setSelectedYearForDay(d.getFullYear());
  };

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  return (
    <View style={styles.root}>
      {/* Hero header */}
      <SafeAreaView style={styles.heroSafe} edges={['top']}>
        <View style={[styles.heroContent, { paddingHorizontal: hPad }]}>
          <View>
            <Text style={styles.heroSubtitle}>Calendar</Text>
            <Text style={styles.heroTitle}>{MONTH_NAMES[month]}</Text>
            <Text style={styles.heroYear}>{year}</Text>
          </View>
          <View style={styles.heroStats}>
            <View style={styles.heroStatBox}>
              <Text style={styles.heroStatNum}>{monthEvents.length}</Text>
              <Text style={styles.heroStatLbl}>evenimente</Text>
            </View>
            {urgentEvents.length > 0 && (
              <View style={[styles.heroStatBox, styles.heroStatUrgent]}>
                <Text style={styles.heroStatNum}>{urgentEvents.length}</Text>
                <Text style={styles.heroStatLbl}>urgente</Text>
              </View>
            )}
            {expiredEvents.length > 0 && (
              <View style={[styles.heroStatBox, styles.heroStatExpired]}>
                <Text style={styles.heroStatNum}>{expiredEvents.length}</Text>
                <Text style={styles.heroStatLbl}>expirate</Text>
              </View>
            )}
          </View>
        </View>

        {/* Vehicle filter */}
        {vehicles.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.vehFilterRow, { paddingHorizontal: hPad }]}
          >
            <TouchableOpacity
              onPress={() => setVehicleFilter('all')}
              style={[styles.vehChip, vehicleFilter === 'all' && styles.vehChipActive]}
            >
              <Text style={[styles.vehChipText, vehicleFilter === 'all' && styles.vehChipTextActive]}>
                🚗 Toate
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

        {/* View mode toggle */}
        <View style={[styles.viewToggle, { marginHorizontal: hPad }]}>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'month' && styles.toggleBtnActive]}
            onPress={() => setViewMode('month')}
            activeOpacity={0.85}
          >
            <Text style={[styles.toggleText, viewMode === 'month' && styles.toggleTextActive]}>
              📅 Lună
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'agenda' && styles.toggleBtnActive]}
            onPress={() => setViewMode('agenda')}
            activeOpacity={0.85}
          >
            <Text style={[styles.toggleText, viewMode === 'agenda' && styles.toggleTextActive]}>
              📋 Agendă
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          isTablet && { alignSelf: 'center', width: '100%', maxWidth: maxContentWidth },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.brand} />}
      >
        {viewMode === 'month' ? (
          <>
            {/* Calendar Grid */}
            <View style={[styles.calCard, { marginHorizontal: hPad }]}>
              {/* Nav */}
              <View style={styles.calNav}>
                <TouchableOpacity onPress={goToPrevMonth} style={styles.navBtn} hitSlop={HIT_SLOP}>
                  <Text style={styles.navArrow}>‹</Text>
                </TouchableOpacity>
                <View style={styles.calMonthYearWrap}>
                  <Text style={styles.calMonthYear}>{MONTH_NAMES[month]}</Text>
                  <Text style={styles.calYear}>{year}</Text>
                </View>
                <TouchableOpacity onPress={goToNextMonth} style={styles.navBtn} hitSlop={HIT_SLOP}>
                  <Text style={styles.navArrow}>›</Text>
                </TouchableOpacity>
              </View>

              {!isCurrentMonth && (
                <TouchableOpacity onPress={goToToday} style={styles.todayBtn} activeOpacity={0.85}>
                  <Text style={styles.todayBtnText}>↺ Înapoi la azi</Text>
                </TouchableOpacity>
              )}

              {/* Day labels */}
              <View style={styles.dayLabelsRow}>
                {DAY_LABELS.map((l, i) => (
                  <View key={i} style={styles.dayLabelCell}>
                    <Text style={[
                      styles.dayLabel,
                      (i === 5 || i === 6) && styles.dayLabelWeekend,
                    ]}>{l}</Text>
                  </View>
                ))}
              </View>

              {/* Grid */}
              <Animated.View
                style={[styles.calGrid, { transform: [{ translateX: slideAnim }] }]}
              >
                {calDays.map((day, idx) => {
                  if (!day) return <View key={`blank-${idx}`} style={styles.dayCell} />;
                  const ymd = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const isToday = ymd === todayStr;
                  const isSelected =
                    day === selectedDay &&
                    month === selectedMonthForDay &&
                    year === selectedYearForDay;
                  const dow = (idx % 7);
                  const isWeekend = dow === 5 || dow === 6;
                  const events = eventMap.get(ymd) || [];
                  return (
                    <CalendarDayCell
                      key={`day-${day}`}
                      day={day}
                      ymd={ymd}
                      events={events}
                      isToday={isToday}
                      isSelected={isSelected}
                      isWeekend={isWeekend}
                      onPress={() => handleDayPick(day)}
                    />
                  );
                })}
              </Animated.View>

              {/* Legend */}
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: EVENT_CATEGORY.itp.color }]} />
                  <Text style={styles.legendText}>ITP</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: EVENT_CATEGORY.rca.color }]} />
                  <Text style={styles.legendText}>RCA</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: EVENT_CATEGORY.casco.color }]} />
                  <Text style={styles.legendText}>CASCO</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: EVENT_CATEGORY.rovinieta.color }]} />
                  <Text style={styles.legendText}>Rov.</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: EVENT_CATEGORY.reminder.color }]} />
                  <Text style={styles.legendText}>Reminder</Text>
                </View>
              </View>
            </View>

            {/* Selected day events */}
            <View style={[styles.selectedDayCard, { marginHorizontal: hPad }]}>
              <View style={styles.selectedDayHeader}>
                <View>
                  <Text style={styles.selectedDayName}>{DAY_NAMES_LONG[selectedDate.getDay()]}</Text>
                  <Text style={styles.selectedDayDate}>
                    {selectedDay} {MONTH_NAMES[selectedMonthForDay]} {selectedYearForDay}
                  </Text>
                </View>
                <View style={styles.selectedDayCountWrap}>
                  <Text style={styles.selectedDayCount}>{selectedDayEvents.length}</Text>
                  <Text style={styles.selectedDayCountLbl}>
                    {selectedDayEvents.length === 1 ? 'eveniment' : 'evenimente'}
                  </Text>
                </View>
              </View>

              {selectedDayEvents.length === 0 ? (
                <View style={styles.emptyDay}>
                  <Text style={styles.emptyDayIcon}>✨</Text>
                  <Text style={styles.emptyDayText}>Liber în această zi</Text>
                </View>
              ) : (
                <View style={{ gap: SPACING.sm, marginTop: SPACING.md }}>
                  {selectedDayEvents.map(ev => (
                    <EventCard
                      key={ev.id}
                      event={ev}
                      vehicle={vehicles.find(v => v.id === ev.vehicleId)}
                      onPress={() => handleEventPress(ev)}
                      onToggleDone={() => handleToggleReminder(ev)}
                    />
                  ))}
                </View>
              )}
            </View>

            {/* Upcoming horizontal scroll */}
            {upcomingEvents.length > 0 && (
              <View style={{ marginTop: SPACING.xl }}>
                <View style={[styles.sectionRow, { paddingHorizontal: hPad }]}>
                  <Text style={styles.sectionTitle}>⏰ Următoarele</Text>
                  <Text style={styles.sectionSub}>{upcomingEvents.length} evenimente</Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: hPad, gap: SPACING.md, paddingVertical: SPACING.sm }}
                >
                  {upcomingEvents.map(ev => (
                    <UpcomingCard
                      key={ev.id}
                      event={ev}
                      vehicle={vehicles.find(v => v.id === ev.vehicleId)}
                      days={ev.days}
                      onPress={() => handleUpcomingPress(ev)}
                    />
                  ))}
                </ScrollView>
              </View>
            )}
          </>
        ) : (
          // Agenda view
          <View style={{ paddingHorizontal: hPad }}>
            {upcomingEvents.length === 0 && expiredEvents.length === 0 ? (
              <View style={styles.agendaEmpty}>
                <Text style={styles.agendaEmptyIcon}>📭</Text>
                <Text style={styles.agendaEmptyTitle}>Nicio scadență</Text>
                <Text style={styles.agendaEmptySub}>
                  Adaugă remindere sau setează date ITP/RCA pentru a le vedea aici.
                </Text>
              </View>
            ) : (
              <>
                {expiredEvents.length > 0 && (
                  <View style={styles.agendaSection}>
                    <View style={styles.agendaSectionHeader}>
                      <Text style={[styles.agendaSectionTitle, { color: T.danger }]}>⚠️ Expirate</Text>
                      <Text style={styles.agendaSectionCount}>{expiredEvents.length}</Text>
                    </View>
                    {expiredEvents.map(ev => (
                      <EventCard
                        key={ev.id}
                        event={ev}
                        vehicle={vehicles.find(v => v.id === ev.vehicleId)}
                        onPress={() => handleEventPress(ev)}
                        onToggleDone={() => handleToggleReminder(ev)}
                      />
                    ))}
                  </View>
                )}

                {upcomingEvents.length > 0 && (
                  <View style={styles.agendaSection}>
                    <View style={styles.agendaSectionHeader}>
                      <Text style={styles.agendaSectionTitle}>📅 Următoarele</Text>
                      <Text style={styles.agendaSectionCount}>{upcomingEvents.length}</Text>
                    </View>
                    {upcomingEvents.map(ev => {
                      const isPast = ev.days < 0;
                      return (
                        <View key={ev.id}>
                          <View style={styles.agendaDayLabel}>
                            <Text style={styles.agendaDayLabelText}>
                              {ev.days === 0 ? 'Astăzi' :
                                ev.days === 1 ? 'Mâine' :
                                  `În ${ev.days} zile · ${formatDate(ev.ymd)}`}
                            </Text>
                          </View>
                          <EventCard
                            event={ev}
                            vehicle={vehicles.find(v => v.id === ev.vehicleId)}
                            onPress={() => handleEventPress(ev)}
                            onToggleDone={() => handleToggleReminder(ev)}
                          />
                        </View>
                      );
                    })}
                  </View>
                )}
              </>
            )}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB pentru reminder nou */}
      <TouchableOpacity
        style={[styles.fab, { right: hPad }]}
        onPress={() => navigation.navigate('AddReminder')}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },

  // Hero
  heroSafe: { backgroundColor: T.brand },
  heroContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  heroSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: FONTS.semibold, textTransform: 'uppercase', letterSpacing: 1 },
  heroTitle: { color: '#fff', fontSize: 36, fontWeight: FONTS.bold, lineHeight: 40, marginTop: 2 },
  heroYear: { color: 'rgba(255,255,255,0.85)', fontSize: 18, fontWeight: FONTS.regular },
  heroStats: { flexDirection: 'row', gap: 8 },
  heroStatBox: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    minWidth: 70,
  },
  heroStatUrgent: { backgroundColor: 'rgba(224,165,44,0.35)' },
  heroStatExpired: { backgroundColor: 'rgba(224,67,44,0.35)' },
  heroStatNum: { color: '#fff', fontSize: 20, fontWeight: FONTS.bold, lineHeight: 22 },
  heroStatLbl: { color: 'rgba(255,255,255,0.85)', fontSize: 10, marginTop: 2 },

  // Vehicle filter
  vehFilterRow: { gap: 8, paddingBottom: SPACING.md },
  vehChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  vehChipActive: { backgroundColor: '#fff' },
  vehChipText: { color: '#fff', fontSize: 13, fontWeight: FONTS.medium },
  vehChipTextActive: { color: T.brand, fontWeight: FONTS.bold },

  // View toggle
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: RADIUS.full,
    padding: 4,
    marginBottom: SPACING.md,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: RADIUS.full,
  },
  toggleBtnActive: { backgroundColor: '#fff' },
  toggleText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: FONTS.semibold },
  toggleTextActive: { color: T.brand, fontWeight: FONTS.bold },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: SPACING.lg, gap: SPACING.lg },

  // Calendar card
  calCard: {
    backgroundColor: T.card,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOW.md,
  },
  calNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  navBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: T.bgSoft,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: T.line,
  },
  navArrow: { fontSize: 22, color: T.ink2, fontWeight: FONTS.bold, lineHeight: 26 },
  calMonthYearWrap: { alignItems: 'center' },
  calMonthYear: { fontSize: 20, fontWeight: FONTS.bold, color: T.ink },
  calYear: { fontSize: 12, color: T.ink3, fontWeight: FONTS.medium, marginTop: 2 },

  todayBtn: {
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: T.brandTint,
    borderRadius: RADIUS.full,
    marginBottom: SPACING.md,
  },
  todayBtnText: { color: T.brand, fontSize: 12, fontWeight: FONTS.bold },

  dayLabelsRow: { flexDirection: 'row', marginBottom: SPACING.sm },
  dayLabelCell: { flex: 1, alignItems: 'center' },
  dayLabel: { fontSize: 11, fontWeight: FONTS.bold, color: T.ink3, letterSpacing: 0.5 },
  dayLabelWeekend: { color: T.brand },

  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: '14.285%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  dayCircle: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  dayCircleToday: {
    backgroundColor: T.brandTint,
    borderWidth: 2, borderColor: T.brand,
  },
  dayCircleSelected: { backgroundColor: T.brand, ...SHADOW.sm },
  dayNum: { fontSize: 14, fontWeight: FONTS.medium, color: T.ink },
  dayNumToday: { color: T.brand, fontWeight: FONTS.bold },
  dayNumSelected: { color: '#fff', fontWeight: FONTS.bold },
  dayNumWeekend: { color: T.ink3 },

  eventDotsRow: {
    flexDirection: 'row', gap: 2,
    position: 'absolute', bottom: 2,
  },
  eventDot: {
    width: 5, height: 5, borderRadius: 3,
    borderWidth: 1, borderColor: 'transparent',
  },
  urgentMark: {
    position: 'absolute',
    top: 3, right: 6,
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: T.danger,
    borderWidth: 1.5, borderColor: '#fff',
  },

  legend: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: SPACING.md,
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1, borderTopColor: T.line2,
    justifyContent: 'center',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: T.ink3, fontWeight: FONTS.medium },

  // Selected day card
  selectedDayCard: {
    backgroundColor: T.card,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOW.sm,
  },
  selectedDayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedDayName: {
    fontSize: 12, fontWeight: FONTS.bold,
    color: T.brand, textTransform: 'uppercase', letterSpacing: 1,
  },
  selectedDayDate: { fontSize: 20, fontWeight: FONTS.bold, color: T.ink, marginTop: 2 },
  selectedDayCountWrap: { alignItems: 'center', backgroundColor: T.brandTint, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.lg },
  selectedDayCount: { fontSize: 22, fontWeight: FONTS.bold, color: T.brand },
  selectedDayCountLbl: { fontSize: 10, color: T.brand, fontWeight: FONTS.medium },

  emptyDay: { alignItems: 'center', paddingVertical: SPACING.xl },
  emptyDayIcon: { fontSize: 36, marginBottom: SPACING.sm },
  emptyDayText: { fontSize: 13, color: T.ink3, fontStyle: 'italic' },

  // Event card
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: T.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: T.line2,
  },
  eventIconWrap: {
    width: 44, height: 44, borderRadius: RADIUS.md,
    alignItems: 'center', justifyContent: 'center',
  },
  eventIcon: { fontSize: 20 },
  eventTitle: { fontSize: 14, fontWeight: FONTS.semibold, color: T.ink },
  eventTitleDone: { color: T.ink4, textDecorationLine: 'line-through' },
  eventMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  eventTypeBadge: {
    fontSize: 10, fontWeight: FONTS.bold,
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  eventVehicle: { fontSize: 11, color: T.ink3, fontWeight: FONTS.medium },
  checkBox: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 2, borderColor: T.line,
    alignItems: 'center', justifyContent: 'center',
  },
  checkBoxDone: { backgroundColor: T.success, borderColor: T.success },
  checkBoxMark: { color: '#fff', fontSize: 14, fontWeight: FONTS.bold, lineHeight: 16 },

  // Section
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: SPACING.sm },
  sectionTitle: { fontSize: 16, fontWeight: FONTS.bold, color: T.ink },
  sectionSub: { fontSize: 12, color: T.ink3, fontWeight: FONTS.medium },

  // Upcoming horizontal card
  upcomingCard: {
    width: 160,
    backgroundColor: T.card,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    ...SHADOW.sm,
  },
  upcomingTopStripe: { height: 4 },
  upcomingBody: { padding: SPACING.md, gap: 4 },
  upcomingIcon: { fontSize: 22 },
  upcomingType: { fontSize: 11, fontWeight: FONTS.bold, color: T.ink3, textTransform: 'uppercase', letterSpacing: 0.5 },
  upcomingTitle: { fontSize: 13, fontWeight: FONTS.semibold, color: T.ink, lineHeight: 17, marginTop: 2 },
  upcomingVehiclePill: {
    backgroundColor: T.brandTint,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  upcomingVehiclePillText: { fontSize: 10, color: T.brand, fontWeight: FONTS.bold },
  upcomingDays: { fontSize: 12, fontWeight: FONTS.bold, marginTop: 6 },

  // Agenda
  agendaEmpty: { alignItems: 'center', paddingVertical: 60 },
  agendaEmptyIcon: { fontSize: 56, marginBottom: SPACING.md },
  agendaEmptyTitle: { fontSize: 17, fontWeight: FONTS.bold, color: T.ink, marginBottom: 4 },
  agendaEmptySub: { fontSize: 13, color: T.ink3, textAlign: 'center', paddingHorizontal: SPACING.lg },

  agendaSection: { marginBottom: SPACING.xl },
  agendaSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  agendaSectionTitle: { fontSize: 15, fontWeight: FONTS.bold, color: T.ink },
  agendaSectionCount: {
    backgroundColor: T.line2,
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: RADIUS.full,
    fontSize: 12, color: T.ink2, fontWeight: FONTS.bold,
    overflow: 'hidden',
  },
  agendaDayLabel: { marginVertical: SPACING.sm },
  agendaDayLabelText: { fontSize: 12, color: T.ink3, fontWeight: FONTS.bold, letterSpacing: 0.5 },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 28,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: T.brand,
    alignItems: 'center', justifyContent: 'center',
    ...SHADOW.lg,
  },
  fabIcon: { color: '#fff', fontSize: 30, fontWeight: FONTS.light, lineHeight: 34, marginTop: -2 },
});
