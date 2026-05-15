import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = '@urbio:';
const QUEUE_NAME = 'sync_queue';
const ID_MAP_NAME = 'sync_id_map';

let storageScope = 'anonymous';

export function createClientId(prefix = 'local') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function setStorageScope(scope) {
  storageScope = scope ? String(scope) : 'anonymous';
}

function keyFor(name) {
  return `${PREFIX}${storageScope}:${name}`;
}

function legacyKeyFor(name) {
  return `${PREFIX}${name}`;
}

function isFileLike(value) {
  return value && typeof value === 'object' && typeof value.uri === 'string';
}

export function formDataToObject(formData) {
  const fields = {};
  const files = [];
  const parts = formData?._parts || [];

  for (const [name, value] of parts) {
    if (isFileLike(value)) {
      files.push({
        field: name,
        uri: value.uri,
        name: value.name || value.fileName || value.uri.split('/').pop() || 'file',
        type: value.type || value.mimeType || 'application/octet-stream',
      });
    } else {
      fields[name] = value;
    }
  }

  return { fields, files };
}

function serializePayload(payload) {
  if (payload && typeof payload.append === 'function') {
    const { fields, files } = formDataToObject(payload);
    return { payloadType: 'formData', payload: { fields, files }, isFormData: true };
  }
  return { payloadType: 'json', payload: payload || null, isFormData: false };
}

export async function saveCache(key, data) {
  try {
    await AsyncStorage.setItem(keyFor(key), JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

export async function loadCache(key) {
  try {
    const raw = await AsyncStorage.getItem(keyFor(key)) || await AsyncStorage.getItem(legacyKeyFor(key));
    if (!raw) return null;
    return JSON.parse(raw).data;
  } catch { return null; }
}

export async function clearCache(key) {
  try { await AsyncStorage.removeItem(keyFor(key)); } catch {}
}

export async function enqueue(op) {
  try {
    const queue = await getQueue();
    const serialized = serializePayload(op.payload);
    queue.push({
      ...op,
      ...serialized,
      id: op.id || createClientId('op'),
      ts: Date.now(),
      retryCount: op.retryCount || 0,
    });
    await AsyncStorage.setItem(keyFor(QUEUE_NAME), JSON.stringify(queue));
  } catch {}
}

export async function getQueue() {
  try {
    const raw = await AsyncStorage.getItem(keyFor(QUEUE_NAME)) || await AsyncStorage.getItem(legacyKeyFor(QUEUE_NAME));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function saveQueue(queue) {
  try {
    await AsyncStorage.setItem(keyFor(QUEUE_NAME), JSON.stringify(queue));
  } catch {}
}

export async function removeFromQueue(id) {
  try {
    const queue = await getQueue();
    await saveQueue(queue.filter(op => op.id !== id));
  } catch {}
}

export async function clearQueue() {
  try { await AsyncStorage.removeItem(keyFor(QUEUE_NAME)); } catch {}
}

export async function removePendingCreate(entity, localId) {
  try {
    const queue = await getQueue();
    let removed = false;
    const next = queue.filter(op => {
      const opClientId = op.clientId || op.localId || op.payload?.fields?.clientId || op.payload?.clientId;
      const match = op.entity === entity && op.action === 'create' && opClientId === localId;
      if (match) removed = true;
      return !match;
    });
    if (removed) await saveQueue(next);
    return removed;
  } catch {
    return false;
  }
}

export async function getIdMap() {
  try {
    const raw = await AsyncStorage.getItem(keyFor(ID_MAP_NAME));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function saveIdMap(map) {
  try {
    await AsyncStorage.setItem(keyFor(ID_MAP_NAME), JSON.stringify(map || {}));
  } catch {}
}

export async function rememberServerId(localId, serverId) {
  if (!localId || !serverId || localId === serverId) return;
  const map = await getIdMap();
  map[localId] = serverId;
  await saveIdMap(map);
}
