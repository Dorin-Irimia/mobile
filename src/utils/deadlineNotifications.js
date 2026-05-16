import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@urbio:deadlineNotifIds';
const DEFAULT_LEAD_DAYS = [7, 3, 1];

async function readMap() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function writeMap(map) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map || {}));
  } catch {}
}

// Parse a YYYY-MM-DD date string + optional HH:MM time into a local Date.
function parseLocalDate(dateStr, timeStr = '09:00') {
  if (!dateStr) return null;
  const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number);
  const [hh = 9, mm = 0] = String(timeStr).split(':').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, hh, mm, 0, 0);
}

async function cancelByKey(key) {
  const map = await readMap();
  const ids = map[key];
  if (Array.isArray(ids)) {
    for (const id of ids) {
      try { await Notifications.cancelScheduledNotificationAsync(id); } catch {}
    }
  }
  if (key in map) {
    delete map[key];
    await writeMap(map);
  }
}

// Schedule N notifications for the given deadline. Pass a stable `key`
// (e.g. `vehicle:<id>:itp` or `reminder:<id>`) so old reminders are
// replaced when the deadline date is changed or removed.
export async function scheduleDeadlineNotifications({
  key,
  title,
  body,
  date,           // YYYY-MM-DD or Date
  time,           // optional HH:MM
  leadDays = DEFAULT_LEAD_DAYS,
  data,
}) {
  if (!key) return [];
  await cancelByKey(key);

  if (!date) return [];
  const target = date instanceof Date ? new Date(date) : parseLocalDate(date, time);
  if (!target || isNaN(target.getTime())) return [];

  const now = Date.now();
  const ids = [];
  for (const days of leadDays) {
    const trigger = new Date(target);
    trigger.setDate(trigger.getDate() - Number(days || 0));
    if (trigger.getTime() <= now + 60_000) continue;

    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: title || '⏰ Termen apropiat',
          body: body ? `${body} · în ${days} ${days === 1 ? 'zi' : 'zile'}` : `În ${days} ${days === 1 ? 'zi' : 'zile'}`,
          sound: 'default',
          data: { ...(data || {}), key, daysBefore: days },
        },
        trigger,
      });
      ids.push(id);
    } catch {
      // Skip silently — usually missing permission.
    }
  }

  const map = await readMap();
  if (ids.length) {
    map[key] = ids;
    await writeMap(map);
  }
  return ids;
}

export async function cancelDeadlineNotifications(key) {
  if (!key) return;
  await cancelByKey(key);
}

// Bulk: re-arm everything for a vehicle (ITP / RCA / CASCO / Rovinietă).
export async function scheduleVehicleDeadlines(vehicle) {
  if (!vehicle?.id) return;
  const label = `${vehicle.plate || vehicle.brand || 'Vehicul'}`;
  const entries = [
    { field: 'itpDate', name: 'ITP' },
    { field: 'rcaDate', name: 'RCA' },
    { field: 'cascoDate', name: 'CASCO' },
    { field: 'rovDate', name: 'Rovinietă' },
  ];
  await Promise.all(entries.map(async ({ field, name }) => {
    const key = `vehicle:${vehicle.id}:${field}`;
    if (!vehicle[field]) {
      await cancelDeadlineNotifications(key);
      return;
    }
    await scheduleDeadlineNotifications({
      key,
      title: `⏰ ${name} expiră curând`,
      body: `${label} — ${name}`,
      date: vehicle[field],
      time: '09:00',
      data: { relatedType: 'Vehicle', relatedId: vehicle.id, field },
    });
  }));
}

export const DEADLINE_LEAD_DAYS = DEFAULT_LEAD_DAYS;
