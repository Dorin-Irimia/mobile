import api from '../api/client';
import { getQueue, saveQueue, getIdMap, saveIdMap } from './storage';

let isSyncing = false;

function resolveValue(value, idMap) {
  if (typeof value === 'string') return idMap[value] || value;
  if (Array.isArray(value)) return value.map(item => resolveValue(item, idMap));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveValue(v, idMap)]));
  }
  return value;
}

function resolveEndpoint(endpoint, idMap) {
  if (!endpoint) return endpoint;
  let resolved = endpoint;
  for (const [localId, serverId] of Object.entries(idMap)) {
    resolved = resolved.split(localId).join(serverId);
  }
  return resolved;
}

function buildRequest(op, idMap) {
  if (op.payloadType === 'formData' || op.isFormData) {
    const fd = new FormData();
    const fields = op.payload?.fields || {};
    const files = op.payload?.files || [];

    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined && value !== null) fd.append(key, String(resolveValue(value, idMap)));
    });
    files.forEach(file => {
      fd.append(file.field, {
        uri: file.uri,
        name: file.name || 'file',
        type: file.type || 'application/octet-stream',
      });
    });

    return {
      payload: fd,
      config: { headers: { 'Content-Type': 'multipart/form-data' } },
    };
  }

  return {
    payload: resolveValue(op.payload, idMap),
    config: {},
  };
}

function shouldDropFailedOperation(op, status) {
  if (!status) return false;
  if (op.method === 'DELETE' && status === 404) return true;
  if (status === 409) return true;
  if (status === 403 || status === 404) return true;
  return false;
}

export async function processSyncQueue(onProgress) {
  if (isSyncing) return { synced: 0, failed: 0 };
  isSyncing = true;

  let queue = await getQueue();
  const idMap = await getIdMap();
  let synced = 0;
  let failed = 0;

  for (const op of [...queue]) {
    try {
      const endpoint = resolveEndpoint(op.endpoint, idMap);
      const { payload, config } = buildRequest(op, idMap);
      let response;

      if (op.method === 'POST') {
        response = await api.post(endpoint, payload, config);
      } else if (op.method === 'PUT') {
        response = await api.put(endpoint, payload, config);
      } else if (op.method === 'DELETE') {
        response = await api.delete(endpoint);
      }

      const serverId = response?.data?.id;
      const localId = op.localId || op.clientId || op.payload?.fields?.clientId || op.payload?.clientId;
      if (localId && serverId && localId !== serverId) {
        idMap[localId] = serverId;
        await saveIdMap(idMap);
      }

      queue = queue.filter(item => item.id !== op.id);
      await saveQueue(queue);
      synced++;
      onProgress?.(synced, synced + queue.length);
    } catch (e) {
      const status = e.response?.status;
      if (shouldDropFailedOperation(op, status)) {
        queue = queue.filter(item => item.id !== op.id);
        await saveQueue(queue);
      } else {
        queue = queue.map(item => (
          item.id === op.id
            ? { ...item, retryCount: (item.retryCount || 0) + 1, lastError: e.response?.data?.error || e.message }
            : item
        ));
        await saveQueue(queue);
      }
      failed++;
      if (status === 401) break;
    }
  }

  isSyncing = false;
  return { synced, failed };
}

export async function pullServerState() {
  const { data } = await api.get('/sync/state');
  return data;
}

export function getIsSyncing() {
  return isSyncing;
}
