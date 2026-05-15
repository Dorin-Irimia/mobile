import api from '../api/client';
import { getQueue, removeFromQueue } from './storage';

let isSyncing = false;

export async function processSyncQueue(onProgress) {
  if (isSyncing) return { synced: 0, failed: 0 };
  isSyncing = true;

  const queue = await getQueue();
  let synced = 0;
  let failed = 0;

  for (const op of queue) {
    try {
      if (op.method === 'POST') {
        await api.post(op.endpoint, op.payload, op.isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {});
      } else if (op.method === 'PUT') {
        await api.put(op.endpoint, op.payload);
      } else if (op.method === 'DELETE') {
        await api.delete(op.endpoint);
      }
      await removeFromQueue(op.id);
      synced++;
      onProgress?.(synced, queue.length);
    } catch (e) {
      if (e.response?.status >= 400 && e.response?.status < 500) {
        await removeFromQueue(op.id);
      }
      failed++;
    }
  }

  isSyncing = false;
  return { synced, failed };
}

export function getIsSyncing() {
  return isSyncing;
}
