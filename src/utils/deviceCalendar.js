import { Platform, Alert } from 'react-native';
import * as Calendar from 'expo-calendar';

const APP_CALENDAR_TITLE = 'Urbio Auto';

async function ensurePermission() {
  const current = await Calendar.getCalendarPermissionsAsync();
  if (current.status === 'granted') return true;
  const next = await Calendar.requestCalendarPermissionsAsync();
  return next.status === 'granted';
}

async function getDefaultCalendarSource() {
  if (Platform.OS === 'ios') {
    const defaultCalendar = await Calendar.getDefaultCalendarAsync();
    return defaultCalendar.source;
  }
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const writable = calendars.find(c => c.allowsModifications && c.source);
  return writable?.source || calendars[0]?.source;
}

async function getOrCreateAppCalendar() {
  const list = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const existing = list.find(c => c.title === APP_CALENDAR_TITLE && c.allowsModifications);
  if (existing) return existing.id;

  const source = await getDefaultCalendarSource();
  if (!source) return null;

  const id = await Calendar.createCalendarAsync({
    title: APP_CALENDAR_TITLE,
    color: '#FF6B1A',
    entityType: Calendar.EntityTypes.EVENT,
    sourceId: Platform.OS === 'ios' ? source.id : undefined,
    source: Platform.OS === 'android' ? {
      isLocalAccount: true,
      name: APP_CALENDAR_TITLE,
      type: source.type,
    } : undefined,
    name: APP_CALENDAR_TITLE,
    ownerAccount: 'personal',
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
  });
  return id;
}

// Parse YYYY-MM-DD (and optional HH:MM) into a local-time Date.
function buildDate(dateStr, timeStr) {
  if (!dateStr) return null;
  const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number);
  let hh = 9;
  let mm = 0;
  if (timeStr) {
    const [a, b] = String(timeStr).split(':').map(Number);
    if (Number.isFinite(a)) hh = a;
    if (Number.isFinite(b)) mm = b;
  }
  return new Date(y, (m || 1) - 1, d || 1, hh, mm, 0, 0);
}

// Create an event on the device calendar. Returns the created event id, or
// null if anything goes wrong (permission denied, no calendar etc.).
export async function addEventToDeviceCalendar({
  title,
  notes,
  location,
  startDate,
  endDate,
  startTime,
  endTime,
  allDay,
  alarmsMinutesBefore = [60 * 24], // default: 1 day before
}) {
  try {
    const granted = await ensurePermission();
    if (!granted) return { ok: false, reason: 'permission' };

    const calendarId = await getOrCreateAppCalendar();
    if (!calendarId) return { ok: false, reason: 'no-calendar' };

    const start = buildDate(startDate, startTime);
    if (!start) return { ok: false, reason: 'invalid-date' };

    let end = buildDate(endDate || startDate, endTime || startTime);
    if (!end || end <= start) {
      end = new Date(start);
      if (allDay) end.setDate(end.getDate() + 1);
      else end.setHours(end.getHours() + 1);
    }

    const eventId = await Calendar.createEventAsync(calendarId, {
      title: title || 'Eveniment',
      notes: notes || undefined,
      location: location || undefined,
      startDate: start,
      endDate: end,
      allDay: !!allDay,
      timeZone: undefined,
      alarms: (alarmsMinutesBefore || [])
        .filter(n => Number.isFinite(n) && n >= 0)
        .map(n => ({ relativeOffset: -Number(n) })),
    });

    return { ok: true, eventId };
  } catch (e) {
    return { ok: false, reason: 'error', error: e?.message || String(e) };
  }
}

// Convenience: ask the user (Alert) whether to also add to phone calendar,
// then call `addEventToDeviceCalendar`. Returns a Promise that resolves
// after the user picks.
export function promptAddToDeviceCalendar(payload, opts = {}) {
  return new Promise((resolve) => {
    const title = opts.title || 'Calendarul telefonului';
    const message = opts.message || 'Vrei să adăugăm acest element și în calendarul telefonului?';
    Alert.alert(title, message, [
      { text: 'Nu', style: 'cancel', onPress: () => resolve({ added: false }) },
      {
        text: 'Adaugă',
        onPress: async () => {
          const res = await addEventToDeviceCalendar(payload);
          if (!res.ok) {
            const why = res.reason === 'permission'
              ? 'Permisiunea pentru calendar a fost refuzată.'
              : 'Nu am putut adăuga evenimentul în calendarul telefonului.';
            Alert.alert('Calendar telefon', why);
          }
          resolve({ added: !!res.ok, ...res });
        },
      },
    ]);
  });
}
