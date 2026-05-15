import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = '@urbio:';

export async function saveCache(key, data) {
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

export async function loadCache(key) {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw).data;
  } catch { return null; }
}

export async function clearCache(key) {
  try { await AsyncStorage.removeItem(PREFIX + key); } catch {}
}

const QUEUE_KEY = PREFIX + 'sync_queue';

export async function enqueue(op) {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const queue = raw ? JSON.parse(raw) : [];
    queue.push({ ...op, id: `${Date.now()}-${Math.random()}`, ts: Date.now() });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {}
}

export async function getQueue() {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function removeFromQueue(id) {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const queue = raw ? JSON.parse(raw) : [];
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.filter(op => op.id !== id)));
  } catch {}
}

export async function clearQueue() {
  try { await AsyncStorage.removeItem(QUEUE_KEY); } catch {}
}
