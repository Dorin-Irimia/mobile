// Lightweight on-device autocomplete + recent-search store. Suggestions are
// grouped by `field` (e.g. 'invoiceTitle', 'merchant', 'location', 'station')
// so each form input only sees relevant past entries. Each entry tracks how
// often it was used; we surface the most-frequent recent matches first.

import AsyncStorage from '@react-native-async-storage/async-storage';

const SUGGESTIONS_KEY = '@urbio:suggestions';
const RECENTS_KEY = '@urbio:recentSearches';
const MAX_PER_FIELD = 40;
const MAX_RECENTS = 12;

function normalize(value) {
  return String(value || '').trim();
}

function lower(value) {
  return normalize(value).toLowerCase();
}

async function readJson(key, fallback) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJson(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export async function loadAllSuggestions() {
  const map = await readJson(SUGGESTIONS_KEY, {});
  return map && typeof map === 'object' ? map : {};
}

export async function saveAllSuggestions(map) {
  await writeJson(SUGGESTIONS_KEY, map || {});
}

// Record (or update) a value for a given field. We track the canonical
// casing the user last typed plus a usage count + last-used timestamp.
export async function recordSuggestion(field, value, existingMap) {
  const clean = normalize(value);
  if (!clean) return existingMap || (await loadAllSuggestions());
  const map = existingMap || (await loadAllSuggestions());
  const list = Array.isArray(map[field]) ? [...map[field]] : [];
  const key = lower(clean);
  const i = list.findIndex(item => lower(item.value) === key);
  const now = Date.now();
  if (i >= 0) {
    const prev = list[i];
    list.splice(i, 1);
    list.unshift({
      value: clean, // keep the latest casing
      count: (prev.count || 0) + 1,
      ts: now,
    });
  } else {
    list.unshift({ value: clean, count: 1, ts: now });
  }
  // Cap size — drop the least-recent entries past the threshold.
  while (list.length > MAX_PER_FIELD) list.pop();
  const next = { ...map, [field]: list };
  await saveAllSuggestions(next);
  return next;
}

// Record several fields at once (e.g. on form submit).
export async function recordSuggestions(entries) {
  if (!entries) return;
  let map = await loadAllSuggestions();
  for (const [field, value] of Object.entries(entries)) {
    if (!value) continue;
    if (Array.isArray(value)) {
      for (const v of value) map = await recordSuggestion(field, v, map);
    } else {
      map = await recordSuggestion(field, value, map);
    }
  }
}

// Pure filter — no IO. Use the in-memory map from the store.
export function pickSuggestions(map, field, query, limit = 6) {
  if (!map) return [];
  const list = map[field];
  if (!Array.isArray(list)) return [];
  const q = lower(query);
  if (!q) {
    return list.slice(0, limit).map(s => s.value);
  }
  return list
    .filter(s => lower(s.value).includes(q) && lower(s.value) !== q)
    .slice(0, limit)
    .map(s => s.value);
}

// ─── Recent searches ───────────────────────────────────────────
export async function loadRecentSearches() {
  const list = await readJson(RECENTS_KEY, []);
  return Array.isArray(list) ? list : [];
}

export async function pushRecentSearch(query) {
  const clean = normalize(query);
  if (!clean || clean.length < 2) return;
  const list = await loadRecentSearches();
  const key = lower(clean);
  const next = [clean, ...list.filter(item => lower(item) !== key)];
  while (next.length > MAX_RECENTS) next.pop();
  await writeJson(RECENTS_KEY, next);
  return next;
}

export async function clearRecentSearches() {
  await writeJson(RECENTS_KEY, []);
  return [];
}

export async function removeRecentSearch(query) {
  const list = await loadRecentSearches();
  const key = lower(query);
  const next = list.filter(item => lower(item) !== key);
  await writeJson(RECENTS_KEY, next);
  return next;
}
