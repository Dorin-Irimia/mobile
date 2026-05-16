import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useStore from '../store';
import {
  T, RADIUS, FONTS, SHADOW, SPACING,
  formatDate, daysUntil, useResponsive, useSafeBottomPadding,
} from '../theme';
import { EmptyState, LoadingView } from '../components/ui';

const EVENT_TYPES = {
  curierat:   { color: '#F59E0B', bg: '#FFFBEB', icon: '📦', label: 'Curierat' },
  vizita:     { color: '#8B5CF6', bg: '#F5F3FF', icon: '👋', label: 'Vizită' },
  petrecere:  { color: '#EC4899', bg: '#FDF2F8', icon: '🎉', label: 'Petrecere' },
  intretinere:{ color: '#10B981', bg: '#ECFDF5', icon: '🔧', label: 'Întreținere' },
  utilitati:  { color: '#3B82F6', bg: '#EFF6FF', icon: '💡', label: 'Utilități' },
  medical:    { color: '#EF4444', bg: '#FEF2F2', icon: '🏥', label: 'Medical' },
  scoala:     { color: '#06B6D4', bg: '#ECFEFF', icon: '🎓', label: 'Școală' },
  altele:     { color: T.ink3, bg: T.line2, icon: '📌', label: 'Altele' },
};
function getMeta(t) { return EVENT_TYPES[t] || EVENT_TYPES.altele; }

const MONTH_NAMES = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'];
const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function toYMD(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function buildCalendarDays(year, month) {
  const totalDays = new Date(year, month+1, 0).getDate();
  let startDow = new Date(year, month, 1).getDay();
  if (startDow === 0) startDow = 7;
  const days = [];
  for (let i = 0; i < startDow-1; i++) days.push(null);
  for (let d = 1; d <= totalDays; d++) days.push(d);
  return days;
}

export default function HouseholdCalendarScreen({ navigation }) {
  const events = useStore(s => s.householdEvents);
  const households = useStore(s => s.households);
  const selectedHouseholdId = useStore(s => s.selectedHouseholdId);
  const fetchHouseholdEvents = useStore(s => s.fetchHouseholdEvents);
  const fetchHouseholds = useStore(s => s.fetchHouseholds);
  const updateHouseholdEvent = useStore(s => s.updateHouseholdEvent);
  const deleteHouseholdEvent = useStore(s => s.deleteHouseholdEvent);
  const user = useStore(s => s.user);

  const { isTablet, hPad, maxContentWidth } = useResponsive();
  const safeBottom = useSafeBottomPadding ? useSafeBottomPadding(28) : 28;

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [householdFilter, setHouseholdFilter] = useState(selectedHouseholdId || 'all');

  useEffect(() => {
    if (selectedHouseholdId) setHouseholdFilter(selectedHouseholdId);
  }, [selectedHouseholdId]);

  const load = useCallback(async () => {
    await Promise.all([fetchHouseholds(), fetchHouseholdEvents()]);
  }, []);

  useEffect(() => { (async () => { setLoading(true); await load(); setLoading(false); })(); }, []);
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  const filteredEvents = useMemo(() => {
    return events.filter(e => householdFilter === 'all' || e.householdId === householdFilter);
  }, [events, householdFilter]);

  const eventsByDate = useMemo(() => {
    const map = new Map();
    filteredEvents.forEach(e => {
      const ymd = e.startDate.slice(0, 10);
      if (!map.has(ymd)) map.set(ymd, []);
      map.get(ymd).push(e);
    });
    return map;
  }, [filteredEvents]);

  const calDays = buildCalendarDays(year, month);
  const todayStr = toYMD(today);
  const selectedDateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}`;
  const dayEvents = eventsByDate.get(selectedDateStr) || [];

  const upcomingEvents = useMemo(() => {
    return filteredEvents
      .filter(e => !e.isDone && daysUntil(e.startDate) !== null && daysUntil(e.startDate) >= 0)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .slice(0, 8);
  }, [filteredEvents]);

  const toggleDone = async (ev) => {
    try { await updateHouseholdEvent(ev.id, { isDone: !ev.isDone }); } catch {}
  };

  const handleDelete = (ev) => {
    Alert.alert('Șterge', `Ștergi "${ev.title}"?`, [
      { text: 'Anulează', style: 'cancel' },
      { text: 'Șterge', style: 'destructive', onPress: () => deleteHouseholdEvent(ev.id).catch(() => {}) },
    ]);
  };

  const canEdit = (ev) => {
    if (ev.userId === user?.id) return true;
    const h = households.find(x => x.id === ev.householdId);
    return !!h?.isOwner;
  };

  if (loading) return <LoadingView />;

  const monthCount = filteredEvents.filter(e => {
    const d = new Date(e.startDate);
    return d.getMonth() === month && d.getFullYear() === year;
  }).length;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.hero} edges={['top']}>
        <View style={[styles.heroContent, { paddingHorizontal: hPad }]}>
          <View>
            <Text style={styles.heroSub}>CALENDAR LOCUINȚĂ</Text>
            <Text style={styles.heroTitle}>{MONTH_NAMES[month]}</Text>
            <Text style={styles.heroYear}>{year}</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatNum}>{monthCount}</Text>
            <Text style={styles.heroStatLbl}>evenimente</Text>
          </View>
        </View>
        {households.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.filterRow, { paddingHorizontal: hPad }]}>
            <TouchableOpacity onPress={() => setHouseholdFilter('all')} style={[styles.hhChip, householdFilter === 'all' && styles.hhChipActive]}>
              <Text style={[styles.hhChipText, householdFilter === 'all' && styles.hhChipTextActive]}>Toate</Text>
            </TouchableOpacity>
            {households.map(h => (
              <TouchableOpacity key={h.id} onPress={() => setHouseholdFilter(h.id)} style={[styles.hhChip, householdFilter === h.id && styles.hhChipActive]}>
                <Text style={[styles.hhChipText, householdFilter === h.id && styles.hhChipTextActive]}>🏠 {h.name}</Text>
              </TouchableOpacity>
            ))}
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
        {/* Calendar grid */}
        <View style={styles.calCard}>
          <View style={styles.calNav}>
            <TouchableOpacity onPress={() => { if (month === 0) { setMonth(11); setYear(y => y-1); } else setMonth(m => m-1); }} style={styles.navBtn}>
              <Text style={styles.navArrow}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.calMonth}>{MONTH_NAMES[month]} {year}</Text>
            <TouchableOpacity onPress={() => { if (month === 11) { setMonth(0); setYear(y => y+1); } else setMonth(m => m+1); }} style={styles.navBtn}>
              <Text style={styles.navArrow}>›</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.dayLabelsRow}>
            {DAY_LABELS.map((l, i) => <View key={i} style={styles.dayLabelCell}><Text style={[styles.dayLabel, (i === 5 || i === 6) && { color: T.brand }]}>{l}</Text></View>)}
          </View>
          <View style={styles.calGrid}>
            {calDays.map((day, idx) => {
              if (!day) return <View key={`b${idx}`} style={styles.dayCell} />;
              const ymd = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
              const evs = eventsByDate.get(ymd) || [];
              const isToday = ymd === todayStr;
              const isSelected = day === selectedDay;
              return (
                <TouchableOpacity key={`d${day}`} style={styles.dayCell} onPress={() => setSelectedDay(day)} activeOpacity={0.7}>
                  <View style={[
                    styles.dayCircle,
                    isToday && !isSelected && styles.dayCircleToday,
                    isSelected && styles.dayCircleSelected,
                  ]}>
                    <Text style={[
                      styles.dayNum,
                      isToday && !isSelected && { color: T.brand, fontWeight: FONTS.bold },
                      isSelected && { color: '#fff', fontWeight: FONTS.bold },
                    ]}>{day}</Text>
                  </View>
                  {evs.length > 0 && (
                    <View style={styles.dotsRow}>
                      {evs.slice(0, 3).map((e, i) => (
                        <View key={i} style={[styles.dot, { backgroundColor: getMeta(e.type).color }]} />
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Selected day events */}
        <View style={styles.dayEventsCard}>
          <Text style={styles.dayEventsTitle}>
            {selectedDay} {MONTH_NAMES[month]} · {dayEvents.length} {dayEvents.length === 1 ? 'eveniment' : 'evenimente'}
          </Text>
          {dayEvents.length === 0 ? (
            <Text style={styles.emptyText}>✨ Liber în această zi</Text>
          ) : (
            <View style={{ gap: SPACING.sm, marginTop: SPACING.sm }}>
              {dayEvents.map(ev => {
                const meta = getMeta(ev.type);
                return (
                  <TouchableOpacity
                    key={ev.id}
                    style={[styles.evCard, { borderLeftColor: meta.color }]}
                    onPress={() => canEdit(ev) && navigation.navigate('AddHouseholdEvent', { eventId: ev.id })}
                    onLongPress={() => canEdit(ev) && handleDelete(ev)}
                  >
                    <View style={[styles.evIcon, { backgroundColor: meta.bg }]}><Text style={{ fontSize: 20 }}>{meta.icon}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.evTitle, ev.isDone && styles.evTitleDone]} numberOfLines={1}>{ev.title}</Text>
                      <Text style={styles.evSub}>
                        {ev.startTime ? `🕐 ${ev.startTime}` : ''}
                        {ev.location ? ` · 📍 ${ev.location}` : ''}
                      </Text>
                    </View>
                    {canEdit(ev) && (
                      <TouchableOpacity onPress={() => toggleDone(ev)} style={[styles.checkbox, ev.isDone && styles.checkboxDone]}>
                        {ev.isDone && <Text style={styles.checkmark}>✓</Text>}
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Upcoming */}
        {upcomingEvents.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>⏰ Următoarele</Text>
            <View style={{ gap: SPACING.sm }}>
              {upcomingEvents.map(ev => {
                const meta = getMeta(ev.type);
                const d = daysUntil(ev.startDate);
                return (
                  <TouchableOpacity
                    key={ev.id}
                    style={styles.upcoming}
                    onPress={() => {
                      const date = new Date(ev.startDate);
                      setYear(date.getFullYear());
                      setMonth(date.getMonth());
                      setSelectedDay(date.getDate());
                    }}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.upDateBox, { backgroundColor: meta.bg }]}>
                      <Text style={[styles.upDay, { color: meta.color }]}>{new Date(ev.startDate).getDate()}</Text>
                      <Text style={[styles.upMonth, { color: meta.color }]}>{new Date(ev.startDate).toLocaleDateString('ro-RO', { month: 'short' })}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.upTitle}>{meta.icon} {ev.title}</Text>
                      <Text style={styles.upSub}>{formatDate(ev.startDate)}{ev.startTime ? ` · ${ev.startTime}` : ''}</Text>
                    </View>
                    <Text style={[styles.upDays, { color: d <= 7 ? T.danger : d <= 30 ? T.warn : T.success }]}>
                      {d === 0 ? 'Azi' : d === 1 ? 'Mâine' : `${d}z`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, { bottom: safeBottom, right: hPad }]}
        onPress={() => navigation.navigate('AddHouseholdEvent', { householdId: householdFilter !== 'all' ? householdFilter : selectedHouseholdId })}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  hero: { backgroundColor: T.brand },
  heroContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: SPACING.md, paddingBottom: SPACING.md },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: FONTS.bold, letterSpacing: 1.5 },
  heroTitle: { color: '#fff', fontSize: 28, fontWeight: FONTS.bold, lineHeight: 32, marginTop: 2 },
  heroYear: { color: 'rgba(255,255,255,0.85)', fontSize: 14 },
  heroStat: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.lg, alignItems: 'center' },
  heroStatNum: { color: '#fff', fontSize: 22, fontWeight: FONTS.bold },
  heroStatLbl: { color: 'rgba(255,255,255,0.85)', fontSize: 10 },
  filterRow: { gap: 8, paddingBottom: SPACING.md },
  hhChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.full, backgroundColor: 'rgba(255,255,255,0.2)' },
  hhChipActive: { backgroundColor: '#fff' },
  hhChipText: { color: '#fff', fontSize: 12, fontWeight: FONTS.semibold },
  hhChipTextActive: { color: T.brand, fontWeight: FONTS.bold },

  calCard: { backgroundColor: T.card, borderRadius: RADIUS.xl, padding: SPACING.lg, ...SHADOW.md },
  calNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.lg },
  navBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: T.bgSoft, alignItems: 'center', justifyContent: 'center' },
  navArrow: { fontSize: 22, color: T.ink2, fontWeight: FONTS.bold },
  calMonth: { fontSize: 18, fontWeight: FONTS.bold, color: T.ink },
  dayLabelsRow: { flexDirection: 'row', marginBottom: SPACING.sm },
  dayLabelCell: { flex: 1, alignItems: 'center' },
  dayLabel: { fontSize: 11, fontWeight: FONTS.bold, color: T.ink3 },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.285%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dayCircleToday: { backgroundColor: T.brandTint, borderWidth: 2, borderColor: T.brand },
  dayCircleSelected: { backgroundColor: T.brand, ...SHADOW.sm },
  dayNum: { fontSize: 14, color: T.ink },
  dotsRow: { flexDirection: 'row', gap: 2, position: 'absolute', bottom: 2 },
  dot: { width: 4, height: 4, borderRadius: 2 },

  dayEventsCard: { backgroundColor: T.card, borderRadius: RADIUS.xl, padding: SPACING.lg, ...SHADOW.sm },
  dayEventsTitle: { fontSize: 15, fontWeight: FONTS.bold, color: T.ink },
  emptyText: { fontSize: 13, color: T.ink3, fontStyle: 'italic', textAlign: 'center', paddingVertical: SPACING.lg },
  evCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md, backgroundColor: T.bgSoft, borderRadius: RADIUS.md, borderLeftWidth: 4 },
  evIcon: { width: 40, height: 40, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  evTitle: { fontSize: 14, fontWeight: FONTS.semibold, color: T.ink },
  evTitleDone: { color: T.ink4, textDecorationLine: 'line-through' },
  evSub: { fontSize: 11, color: T.ink3, marginTop: 2 },
  checkbox: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: T.line, alignItems: 'center', justifyContent: 'center' },
  checkboxDone: { backgroundColor: T.success, borderColor: T.success },
  checkmark: { color: '#fff', fontWeight: FONTS.bold, fontSize: 13 },

  sectionTitle: { fontSize: 14, fontWeight: FONTS.bold, color: T.ink, marginBottom: SPACING.sm },
  upcoming: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: T.card, borderRadius: RADIUS.lg, padding: SPACING.md, ...SHADOW.sm },
  upDateBox: { width: 46, height: 46, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  upDay: { fontSize: 16, fontWeight: FONTS.bold },
  upMonth: { fontSize: 9, fontWeight: FONTS.semibold, textTransform: 'uppercase' },
  upTitle: { fontSize: 14, fontWeight: FONTS.semibold, color: T.ink },
  upSub: { fontSize: 11, color: T.ink3, marginTop: 2 },
  upDays: { fontSize: 12, fontWeight: FONTS.bold, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: T.line2, borderRadius: RADIUS.full },

  fab: { position: 'absolute', width: 56, height: 56, borderRadius: 28, backgroundColor: T.brand, alignItems: 'center', justifyContent: 'center', ...SHADOW.lg },
  fabIcon: { color: '#fff', fontSize: 30, fontWeight: FONTS.light, lineHeight: 34, marginTop: -2 },
});
