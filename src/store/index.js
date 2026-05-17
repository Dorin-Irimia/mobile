import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import api from '../api/client';
import {
  saveCache,
  loadCache,
  enqueue,
  getQueue,
  setStorageScope,
  createClientId,
  formDataToObject,
  removePendingCreate,
} from '../utils/storage';
import { processSyncQueue, pullServerState } from '../utils/syncManager';
import { DEFAULT_QUICK_ACTION_IDS, normalizeQuickActionIds } from '../utils/quickActions';
import { OfflineActionError } from '../utils/onlineGate';
import { cancelDeadlineNotifications } from '../utils/deadlineNotifications';
import {
  loadAllSuggestions, recordSuggestions as recordSuggestionsToDisk,
  loadRecentSearches, pushRecentSearch, clearRecentSearches, removeRecentSearch,
} from '../utils/suggestionsStore';

const PENDING_REGISTRATION_KEY = 'pendingRegistration';

async function saveAuth(key, value) {
  try { await SecureStore.setItemAsync(key, typeof value === 'string' ? value : JSON.stringify(value)); } catch {}
}
async function loadAuth(key) {
  try { return await SecureStore.getItemAsync(key); } catch { return null; }
}
async function removeAuth(key) {
  try { await SecureStore.deleteItemAsync(key); } catch {}
}

async function savePendingRegistration(data) {
  try { await SecureStore.setItemAsync(PENDING_REGISTRATION_KEY, JSON.stringify(data)); } catch {}
}

async function loadPendingRegistration() {
  try {
    const raw = await SecureStore.getItemAsync(PENDING_REGISTRATION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function removePendingRegistration() {
  try { await SecureStore.deleteItemAsync(PENDING_REGISTRATION_KEY); } catch {}
}

function scopeForUser(user) {
  return user?.email ? user.email.trim().toLowerCase() : user?.id;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isNetworkError(e) {
  return !e.response;
}

function isFormData(payload) {
  return payload && typeof payload.append === 'function';
}

function ensureClientId(payload, clientId) {
  if (isFormData(payload)) {
    payload.append('clientId', clientId);
    return payload;
  }
  return { ...(payload || {}), clientId };
}

function payloadSnapshot(payload) {
  if (isFormData(payload)) return formDataToObject(payload);
  return { fields: payload || {}, files: [] };
}

function parseMaybeNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCustomFields(value, fallback = null) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function mergeWithOfflineQueue(serverList = [], localList = [], entity) {
  if (!Array.isArray(serverList)) return localList || [];
  const queue = await getQueue();
  const serverClientIds = new Set(serverList.map(i => i.clientId).filter(Boolean));
  const serverIds = new Set(serverList.map(i => i.id));
  const pendingClientIds = new Set(
    queue
      .filter(op => op.entity === entity && op.action === 'create')
      .map(op => op.localId || op.clientId)
      .filter(Boolean),
  );
  const preservedLocal = (localList || []).filter(item => {
    if (!item || !item._offline) return false;
    if (serverIds.has(item.id)) return false;
    const cid = item.clientId || item.id;
    if (cid && serverClientIds.has(cid)) return false;
    if (cid && !pendingClientIds.has(cid)) return false;
    return true;
  });
  return [...preservedLocal, ...serverList];
}

function optimisticAttachments(files) {
  return (files || []).map((file, index) => ({
    id: createClientId('att'),
    fileName: file.name || `file-${index}`,
    fileUrl: file.uri,
    mimeType: file.type || 'application/octet-stream',
    fileSize: 0,
    kind: (file.type || '').startsWith('image/') ? 'image' : file.type === 'application/pdf' ? 'pdf' : 'other',
    _offline: true,
  }));
}

function invoiceFromPayload(fields, files, clientId) {
  return {
    id: clientId,
    clientId,
    vehicleId: fields.vehicleId,
    title: fields.title,
    amount: parseMaybeNumber(fields.amount) || 0,
    currency: fields.currency || 'RON',
    category: fields.category || 'altele',
    date: fields.date,
    time: fields.time || null,
    km: parseMaybeNumber(fields.km),
    merchant: fields.merchant || null,
    location: fields.location || null,
    notes: fields.notes || null,
    customFields: parseCustomFields(fields.customFields),
    attachments: optimisticAttachments(files),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _offline: true,
  };
}

function fuelFromPayload(fields, files, clientId) {
  const liters = parseMaybeNumber(fields.liters) || 0;
  const pricePerL = parseMaybeNumber(fields.pricePerL) || 0;
  return {
    id: clientId,
    clientId,
    vehicleId: fields.vehicleId,
    date: fields.date,
    time: fields.time || null,
    liters,
    pricePerL,
    total: liters * pricePerL,
    km: parseMaybeNumber(fields.km) || 0,
    station: fields.station || null,
    location: fields.location || null,
    fuelType: fields.fuelType || null,
    fullTank: fields.fullTank !== 'false',
    notes: fields.notes || null,
    customFields: parseCustomFields(fields.customFields),
    attachments: optimisticAttachments(files),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _offline: true,
  };
}

function documentFromPayload(fields, files, clientId) {
  const firstFile = files?.[0];
  return {
    id: clientId,
    clientId,
    name: fields.name,
    type: fields.type,
    vehicleId: fields.vehicleId || null,
    expiryDate: fields.expiryDate || null,
    fileUrl: firstFile?.uri || null,
    isSigned: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _offline: true,
  };
}

function householdExpenseFromPayload(fields, files, clientId) {
  return {
    id: clientId,
    clientId,
    householdId: fields.householdId,
    title: fields.title,
    amount: parseMaybeNumber(fields.amount) || 0,
    currency: fields.currency || 'RON',
    category: fields.category || 'altele',
    date: fields.date,
    time: fields.time || null,
    merchant: fields.merchant || null,
    location: fields.location || null,
    notes: fields.notes || null,
    splitMode: fields.splitMode || 'single',
    customFields: parseCustomFields(fields.customFields),
    attachments: optimisticAttachments(files),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _offline: true,
  };
}

const useStore = create((set, get) => ({
  user: null,
  vehicles: [],
  invoices: [],
  reminders: [],
  documents: [],
  fuelLogs: [],
  notifications: [],
  friends: [],
  pendingFriends: [],
  sentFriends: [],
  vehicleMembersById: {},
  folders: [],
  selectedVehicleId: null,
  appMode: null, // null | 'vehicle' | 'household'
  households: [],
  selectedHouseholdId: null,
  householdExpenses: [],
  householdIncomes: [],
  householdEvents: [],
  householdMembersById: {},
  quickActionIds: DEFAULT_QUICK_ACTION_IDS,
  customCategories: [],
  monthStartDay: 1, // 1..28 (calendar day on which a billing month begins)
  suggestions: {},           // { [field]: [{ value, count, ts }] }
  recentSearches: [],        // recent query strings, newest first
  isLoading: false,
  isOnline: true,
  isSyncing: false,
  pendingCount: 0,
  error: null,

  setSelectedVehicle: (id) => {
    set({ selectedVehicleId: id || null });
    saveCache('selectedVehicleId', id || null).catch(() => {});
  },

  setAppMode: (mode) => {
    set({ appMode: mode || null });
    saveCache('appMode', mode || null).catch(() => {});
  },

  setSelectedHousehold: (id) => {
    set({ selectedHouseholdId: id || null });
    saveCache('selectedHouseholdId', id || null).catch(() => {});
  },

  // ── Households ─────────────────────────────────────────────────────────────
  fetchHouseholds: async () => {
    const { isOnline } = get();
    if (!isOnline) {
      const cached = await loadCache('households');
      if (cached) {
        const merged = await mergeWithOfflineQueue(cached, get().households, 'households');
        set({ households: merged });
        const { selectedHouseholdId } = get();
        if (!selectedHouseholdId && merged.length > 0) {
          get().setSelectedHousehold(merged[0].id);
        }
        return merged;
      }
      return get().households;
    }
    try {
      const { data } = await api.get('/households');
      const merged = await mergeWithOfflineQueue(data, get().households, 'households');
      set({ households: merged });
      await saveCache('households', merged);
      const { selectedHouseholdId } = get();
      if (!selectedHouseholdId && merged.length > 0) {
        get().setSelectedHousehold(merged[0].id);
      }
      return merged;
    } catch (e) {
      const cached = await loadCache('households');
      if (cached) set({ households: cached });
      return cached || [];
    }
  },

  addHousehold: async (payload) => {
    const { isOnline, user } = get();
    const clientId = createClientId('household');
    const body = { ...payload, clientId };

    if (!isOnline) {
      const optimistic = {
        ...payload,
        id: clientId,
        clientId,
        userId: user?.id,
        isOwner: true,
        memberCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _offline: true,
      };
      set(s => ({ households: [optimistic, ...s.households] }));
      await saveCache('households', get().households);
      const { selectedHouseholdId } = get();
      if (!selectedHouseholdId) get().setSelectedHousehold(clientId);
      await enqueue({
        entity: 'households',
        action: 'create',
        method: 'POST',
        endpoint: '/households',
        payload: body,
        localId: clientId,
        clientId,
      });
      const queue = await getQueue();
      set({ pendingCount: queue.length });
      return optimistic;
    }

    const { data } = await api.post('/households', body);
    set(s => ({ households: [data, ...s.households] }));
    await saveCache('households', get().households);
    return data;
  },

  updateHousehold: async (id, patch) => {
    const { isOnline } = get();
    set(s => ({
      households: s.households.map(h => h.id === id ? { ...h, ...patch, updatedAt: new Date().toISOString() } : h),
    }));
    await saveCache('households', get().households);

    if (!isOnline) {
      await enqueue({
        entity: 'households',
        action: 'update',
        method: 'PUT',
        endpoint: `/households/${id}`,
        payload: patch,
        localId: id,
      });
      const queue = await getQueue();
      set({ pendingCount: queue.length });
      return get().households.find(h => h.id === id);
    }

    const { data } = await api.put(`/households/${id}`, patch);
    set(s => ({ households: s.households.map(h => h.id === id ? data : h) }));
    await saveCache('households', get().households);
    return data;
  },

  deleteHousehold: async (id) => {
    if (!get().isOnline) throw new OfflineActionError();
    await api.delete(`/households/${id}`);
    set(s => ({
      households: s.households.filter(h => h.id !== id),
      selectedHouseholdId: s.selectedHouseholdId === id ? null : s.selectedHouseholdId,
    }));
    await saveCache('households', get().households);
  },

  fetchHouseholdMembers: async (householdId) => {
    const { data } = await api.get(`/households/${householdId}/members`);
    set(s => ({
      householdMembersById: { ...s.householdMembersById, [householdId]: data },
    }));
    return data;
  },

  addHouseholdMember: async (householdId, payload) => {
    const { data } = await api.post(`/households/${householdId}/members`, payload);
    set(s => {
      const existing = s.householdMembersById[householdId];
      if (!existing) return s;
      return {
        householdMembersById: {
          ...s.householdMembersById,
          [householdId]: { ...existing, members: [...existing.members, data] },
        },
      };
    });
    return data;
  },

  removeHouseholdMember: async (householdId, userId) => {
    if (!get().isOnline) throw new OfflineActionError();
    await api.delete(`/households/${householdId}/members/${userId}`);
    set(s => {
      const existing = s.householdMembersById[householdId];
      if (!existing) return s;
      return {
        householdMembersById: {
          ...s.householdMembersById,
          [householdId]: {
            ...existing,
            members: existing.members.filter(m => m.user.id !== userId),
          },
        },
      };
    });
  },

  // ── Household Expenses ─────────────────────────────────────────────────────
  fetchHouseholdExpenses: async (householdId) => {
    const { isOnline } = get();
    if (!isOnline) {
      const cached = await loadCache('householdExpenses');
      if (cached) {
        const merged = await mergeWithOfflineQueue(cached, get().householdExpenses, 'householdExpenses');
        set({ householdExpenses: merged });
        return merged;
      }
      return get().householdExpenses;
    }
    try {
      const params = householdId ? { householdId } : {};
      const { data } = await api.get('/household-expenses', { params });
      const merged = await mergeWithOfflineQueue(data, get().householdExpenses, 'householdExpenses');
      set({ householdExpenses: merged });
      await saveCache('householdExpenses', merged);
      return merged;
    } catch (e) {
      const cached = await loadCache('householdExpenses');
      if (cached) set({ householdExpenses: cached });
      return cached || [];
    }
  },

  addHouseholdExpense: async (formData) => {
    const { isOnline } = get();
    const clientId = createClientId('hexp');
    if (formData?.append) formData.append('clientId', clientId);
    const { fields, files } = payloadSnapshot(formData);

    if (!isOnline) {
      const optimistic = householdExpenseFromPayload(fields, files, clientId);
      set(s => ({ householdExpenses: [optimistic, ...s.householdExpenses] }));
      await saveCache('householdExpenses', get().householdExpenses);
      await enqueue({
        entity: 'householdExpenses',
        action: 'create',
        method: 'POST',
        endpoint: '/household-expenses',
        payload: formData,
        localId: clientId,
        clientId,
      });
      const queue = await getQueue();
      set({ pendingCount: queue.length });
      return optimistic;
    }

    const { data } = await api.post('/household-expenses', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    set(s => ({ householdExpenses: [data, ...s.householdExpenses] }));
    await saveCache('householdExpenses', get().householdExpenses);
    return data;
  },

  updateHouseholdExpense: async (id, formData) => {
    const { isOnline } = get();
    const { fields, files } = payloadSnapshot(formData);

    if (!isOnline) {
      set(s => ({
        householdExpenses: s.householdExpenses.map(e => {
          if (e.id !== id) return e;
          return {
            ...e,
            ...fields,
            amount: fields.amount !== undefined ? parseMaybeNumber(fields.amount) || e.amount : e.amount,
            customFields: parseCustomFields(fields.customFields, e.customFields),
            attachments: [...(e.attachments || []), ...optimisticAttachments(files)],
            updatedAt: new Date().toISOString(),
            _offline: true,
          };
        }),
      }));
      await saveCache('householdExpenses', get().householdExpenses);
      await enqueue({
        entity: 'householdExpenses',
        action: 'update',
        method: 'PUT',
        endpoint: `/household-expenses/${id}`,
        payload: formData,
        localId: id,
      });
      const queue = await getQueue();
      set({ pendingCount: queue.length });
      return get().householdExpenses.find(e => e.id === id);
    }

    const { data } = await api.put(`/household-expenses/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    set(s => ({ householdExpenses: s.householdExpenses.map(e => e.id === id ? data : e) }));
    await saveCache('householdExpenses', get().householdExpenses);
    return data;
  },

  deleteHouseholdExpense: async (id) => {
    if (!get().isOnline) throw new OfflineActionError();
    await api.delete(`/household-expenses/${id}`);
    set(s => ({ householdExpenses: s.householdExpenses.filter(e => e.id !== id) }));
    await saveCache('householdExpenses', get().householdExpenses);
  },

  // ── Household Incomes ──────────────────────────────────────────────────────
  fetchHouseholdIncomes: async (householdId) => {
    const { isOnline } = get();
    if (!isOnline) {
      const cached = await loadCache('householdIncomes');
      if (cached) {
        const merged = await mergeWithOfflineQueue(cached, get().householdIncomes, 'householdIncomes');
        set({ householdIncomes: merged });
        return merged;
      }
      return get().householdIncomes;
    }
    try {
      const params = householdId ? { householdId } : {};
      const { data } = await api.get('/household-incomes', { params });
      const merged = await mergeWithOfflineQueue(data, get().householdIncomes, 'householdIncomes');
      set({ householdIncomes: merged });
      await saveCache('householdIncomes', merged);
      return merged;
    } catch (e) {
      const cached = await loadCache('householdIncomes');
      if (cached) set({ householdIncomes: cached });
      return cached || [];
    }
  },

  addHouseholdIncome: async (payload) => {
    const { isOnline } = get();
    const clientId = createClientId('hinc');
    const body = { ...payload, clientId };

    if (!isOnline) {
      const optimistic = {
        ...payload,
        id: clientId,
        clientId,
        amount: parseMaybeNumber(payload.amount) || 0,
        currency: payload.currency || 'RON',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _offline: true,
      };
      set(s => ({ householdIncomes: [optimistic, ...s.householdIncomes] }));
      await saveCache('householdIncomes', get().householdIncomes);
      await enqueue({
        entity: 'householdIncomes',
        action: 'create',
        method: 'POST',
        endpoint: '/household-incomes',
        payload: body,
        localId: clientId,
        clientId,
      });
      const queue = await getQueue();
      set({ pendingCount: queue.length });
      return optimistic;
    }

    const { data } = await api.post('/household-incomes', body);
    set(s => ({ householdIncomes: [data, ...s.householdIncomes] }));
    await saveCache('householdIncomes', get().householdIncomes);
    return data;
  },

  updateHouseholdIncome: async (id, patch) => {
    const { isOnline } = get();
    set(s => ({
      householdIncomes: s.householdIncomes.map(i => i.id === id ? { ...i, ...patch, updatedAt: new Date().toISOString() } : i),
    }));
    await saveCache('householdIncomes', get().householdIncomes);

    if (!isOnline) {
      await enqueue({
        entity: 'householdIncomes',
        action: 'update',
        method: 'PUT',
        endpoint: `/household-incomes/${id}`,
        payload: patch,
        localId: id,
      });
      const queue = await getQueue();
      set({ pendingCount: queue.length });
      return get().householdIncomes.find(i => i.id === id);
    }

    const { data } = await api.put(`/household-incomes/${id}`, patch);
    set(s => ({ householdIncomes: s.householdIncomes.map(i => i.id === id ? data : i) }));
    await saveCache('householdIncomes', get().householdIncomes);
    return data;
  },

  deleteHouseholdIncome: async (id) => {
    if (!get().isOnline) throw new OfflineActionError();
    await api.delete(`/household-incomes/${id}`);
    set(s => ({ householdIncomes: s.householdIncomes.filter(i => i.id !== id) }));
    await saveCache('householdIncomes', get().householdIncomes);
  },

  // ── Household Events ───────────────────────────────────────────────────────
  fetchHouseholdEvents: async (householdId) => {
    const { isOnline } = get();
    if (!isOnline) {
      const cached = await loadCache('householdEvents');
      if (cached) {
        const merged = await mergeWithOfflineQueue(cached, get().householdEvents, 'householdEvents');
        set({ householdEvents: merged });
        return merged;
      }
      return get().householdEvents;
    }
    try {
      const params = householdId ? { householdId } : {};
      const { data } = await api.get('/household-events', { params });
      const merged = await mergeWithOfflineQueue(data, get().householdEvents, 'householdEvents');
      set({ householdEvents: merged });
      await saveCache('householdEvents', merged);
      return merged;
    } catch (e) {
      const cached = await loadCache('householdEvents');
      if (cached) set({ householdEvents: cached });
      return cached || [];
    }
  },

  addHouseholdEvent: async (payload) => {
    const { isOnline } = get();
    const clientId = createClientId('hev');
    const body = { ...payload, clientId };

    if (!isOnline) {
      const optimistic = {
        ...payload,
        id: clientId,
        clientId,
        isDone: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _offline: true,
      };
      set(s => ({ householdEvents: [optimistic, ...s.householdEvents] }));
      await saveCache('householdEvents', get().householdEvents);
      await enqueue({
        entity: 'householdEvents',
        action: 'create',
        method: 'POST',
        endpoint: '/household-events',
        payload: body,
        localId: clientId,
        clientId,
      });
      const queue = await getQueue();
      set({ pendingCount: queue.length });
      return optimistic;
    }

    const { data } = await api.post('/household-events', body);
    set(s => ({ householdEvents: [data, ...s.householdEvents] }));
    await saveCache('householdEvents', get().householdEvents);
    return data;
  },

  updateHouseholdEvent: async (id, patch) => {
    const { isOnline } = get();
    set(s => ({
      householdEvents: s.householdEvents.map(e => e.id === id ? { ...e, ...patch, updatedAt: new Date().toISOString() } : e),
    }));
    await saveCache('householdEvents', get().householdEvents);

    if (!isOnline) {
      await enqueue({
        entity: 'householdEvents',
        action: 'update',
        method: 'PUT',
        endpoint: `/household-events/${id}`,
        payload: patch,
        localId: id,
      });
      const queue = await getQueue();
      set({ pendingCount: queue.length });
      return get().householdEvents.find(e => e.id === id);
    }

    const { data } = await api.put(`/household-events/${id}`, patch);
    set(s => ({ householdEvents: s.householdEvents.map(e => e.id === id ? data : e) }));
    await saveCache('householdEvents', get().householdEvents);
    return data;
  },

  deleteHouseholdEvent: async (id) => {
    if (!get().isOnline) throw new OfflineActionError();
    await api.delete(`/household-events/${id}`);
    set(s => ({ householdEvents: s.householdEvents.filter(e => e.id !== id) }));
    await saveCache('householdEvents', get().householdEvents);
    cancelDeadlineNotifications(`householdEvent:${id}`).catch(() => {});
  },

  setOnline: (isOnline) => set({ isOnline }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  loadQuickActions: async () => {
    const saved = await loadCache('quickActions');
    const quickActionIds = normalizeQuickActionIds(saved || DEFAULT_QUICK_ACTION_IDS);
    set({ quickActionIds });
    return quickActionIds;
  },

  saveQuickActions: async (ids) => {
    const quickActionIds = normalizeQuickActionIds(ids);
    set({ quickActionIds });
    await saveCache('quickActions', quickActionIds);
    return quickActionIds;
  },

  loadCustomCategories: async () => {
    const saved = await loadCache('customCategories');
    const list = Array.isArray(saved) ? saved : [];
    set({ customCategories: list });
    return list;
  },

  saveCustomCategories: async (list) => {
    const clean = Array.isArray(list) ? list : [];
    set({ customCategories: clean });
    await saveCache('customCategories', clean);
    return clean;
  },

  addCustomCategory: async (cat) => {
    const list = [...get().customCategories, cat];
    set({ customCategories: list });
    await saveCache('customCategories', list);
    return list;
  },

  updateCustomCategory: async (key, patch) => {
    const list = get().customCategories.map(c => c.key === key ? { ...c, ...patch } : c);
    set({ customCategories: list });
    await saveCache('customCategories', list);
    return list;
  },

  removeCustomCategory: async (key) => {
    const list = get().customCategories.filter(c => c.key !== key);
    set({ customCategories: list });
    await saveCache('customCategories', list);
    return list;
  },

  loadMonthStartDay: async () => {
    const saved = await loadCache('monthStartDay');
    const day = Math.min(28, Math.max(1, Number(saved) || 1));
    set({ monthStartDay: day });
    return day;
  },

  setMonthStartDay: async (day) => {
    const clean = Math.min(28, Math.max(1, Number(day) || 1));
    set({ monthStartDay: clean });
    await saveCache('monthStartDay', clean);
    return clean;
  },

  // ── Suggestions + recent searches ─────────────────────────────────────────
  loadSuggestionsAndRecents: async () => {
    const [suggestions, recentSearches] = await Promise.all([
      loadAllSuggestions(),
      loadRecentSearches(),
    ]);
    set({ suggestions, recentSearches });
    return { suggestions, recentSearches };
  },

  recordSuggestions: async (entries) => {
    await recordSuggestionsToDisk(entries);
    const fresh = await loadAllSuggestions();
    set({ suggestions: fresh });
    return fresh;
  },

  pushRecentSearch: async (query) => {
    const updated = await pushRecentSearch(query);
    if (updated) set({ recentSearches: updated });
    return updated;
  },

  removeRecentSearch: async (query) => {
    const updated = await removeRecentSearch(query);
    set({ recentSearches: updated });
    return updated;
  },

  clearRecentSearches: async () => {
    const updated = await clearRecentSearches();
    set({ recentSearches: updated });
    return updated;
  },

  importHouseholdIncomes: async (items, householdId) => {
    const arr = Array.isArray(items) ? items : [];
    let imported = 0;
    let skipped = 0;
    for (const raw of arr) {
      const title = raw.title || raw.name || raw.Title;
      const amount = Number(raw.amount ?? raw.Amount);
      const date = raw.date || raw.Date || new Date().toISOString().slice(0, 10);
      if (!title || !Number.isFinite(amount) || amount <= 0) { skipped++; continue; }
      const payload = {
        householdId: raw.householdId || householdId,
        title: String(title),
        amount,
        currency: String(raw.currency || 'RON'),
        category: String(raw.category || 'altele'),
        date: String(date),
        source: raw.source ? String(raw.source) : null,
        recurring: raw.recurring ? String(raw.recurring) : 'none',
        notes: raw.notes ? String(raw.notes) : null,
      };
      try {
        await get().addHouseholdIncome(payload);
        imported++;
      } catch {
        skipped++;
      }
    }
    return { imported, skipped };
  },

  importHouseholdExpenses: async (items, householdId) => {
    const arr = Array.isArray(items) ? items : [];
    let imported = 0;
    let skipped = 0;
    for (const raw of arr) {
      const title = raw.title || raw.name || raw.Title;
      const amount = Number(raw.amount ?? raw.Amount);
      const date = raw.date || raw.Date || new Date().toISOString().slice(0, 10);
      if (!title || !Number.isFinite(amount) || amount <= 0) { skipped++; continue; }
      const fd = new FormData();
      fd.append('householdId', String(raw.householdId || householdId || ''));
      fd.append('title', String(title));
      fd.append('amount', String(amount));
      fd.append('currency', String(raw.currency || 'RON'));
      fd.append('category', String(raw.category || 'altele'));
      fd.append('date', String(date));
      if (raw.time) fd.append('time', String(raw.time));
      if (raw.merchant) fd.append('merchant', String(raw.merchant));
      if (raw.location) fd.append('location', String(raw.location));
      if (raw.notes) fd.append('notes', String(raw.notes));
      fd.append('splitMode', String(raw.splitMode || 'single'));
      try {
        await get().addHouseholdExpense(fd);
        imported++;
      } catch {
        skipped++;
      }
    }
    return { imported, skipped };
  },

  applyServerState: async (data) => {
    if (!data) return;
    if (data.user) {
      await saveAuth('user', data.user);
      setStorageScope(scopeForUser(data.user));
    }

    // Preserve offline-only items still pending in the sync queue.
    const currentState = get();
    const [
      mergedInvoices, mergedFuelLogs, mergedReminders, mergedDocuments, mergedVehicles,
      mergedHouseholds, mergedHExpenses, mergedHIncomes, mergedHEvents,
    ] = await Promise.all([
      mergeWithOfflineQueue(data.invoices, currentState.invoices, 'invoices'),
      mergeWithOfflineQueue(data.fuelLogs, currentState.fuelLogs, 'fuel'),
      mergeWithOfflineQueue(data.reminders, currentState.reminders, 'reminders'),
      mergeWithOfflineQueue(data.documents, currentState.documents, 'documents'),
      mergeWithOfflineQueue(data.vehicles, currentState.vehicles, 'vehicles'),
      mergeWithOfflineQueue(data.households, currentState.households, 'households'),
      mergeWithOfflineQueue(data.householdExpenses, currentState.householdExpenses, 'householdExpenses'),
      mergeWithOfflineQueue(data.householdIncomes, currentState.householdIncomes, 'householdIncomes'),
      mergeWithOfflineQueue(data.householdEvents, currentState.householdEvents, 'householdEvents'),
    ]);

    set({
      user: data.user || get().user,
      vehicles: mergedVehicles,
      invoices: mergedInvoices,
      reminders: mergedReminders,
      documents: mergedDocuments,
      fuelLogs: mergedFuelLogs,
      notifications: data.notifications || [],
      vehicleMembersById: data.vehicleMembersById || get().vehicleMembersById,
      households: mergedHouseholds,
      householdExpenses: mergedHExpenses,
      householdIncomes: mergedHIncomes,
      householdEvents: mergedHEvents,
    });
    await Promise.all([
      saveCache('vehicles', mergedVehicles),
      saveCache('invoices', mergedInvoices),
      saveCache('reminders', mergedReminders),
      saveCache('documents', mergedDocuments),
      saveCache('fuel', mergedFuelLogs),
      saveCache('notifications', data.notifications || []),
      saveCache('vehicleMembersById', data.vehicleMembersById || {}),
      saveCache('households', mergedHouseholds),
      saveCache('householdExpenses', mergedHExpenses),
      saveCache('householdIncomes', mergedHIncomes),
      saveCache('householdEvents', mergedHEvents),
    ]);
  },

  syncOnReconnect: async () => {
    set({ isSyncing: true });
    try {
      const pendingRegistration = await loadPendingRegistration();
      if (pendingRegistration) {
        let authData;
        try {
          const response = await api.post('/auth/register', pendingRegistration);
          authData = response.data;
        } catch (e) {
          if (e.response?.status === 409) {
            const response = await api.post('/auth/login', {
              email: pendingRegistration.email,
              password: pendingRegistration.password,
            });
            authData = response.data;
          } else {
            throw e;
          }
        }
        await saveAuth('accessToken', authData.accessToken);
        await saveAuth('refreshToken', authData.refreshToken);
        await saveAuth('user', authData.user);
        await removePendingRegistration();
        setStorageScope(scopeForUser(authData.user));
        await get().loadQuickActions();
        set({ user: authData.user });
      }

      const queue = await getQueue();
      set({ pendingCount: queue.length });
      if (queue.length > 0) {
        await processSyncQueue((done, total) => {
          set({ pendingCount: total - done });
        });
      }
      const serverState = await pullServerState();
      await get().applyServerState(serverState);
    } finally {
      const remaining = await getQueue();
      set({ isSyncing: false, pendingCount: remaining.length });
    }
  },

  // ── Auth ────────────────────────────────────────────────────────────────────
  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.post('/auth/login', { email: normalizeEmail(email), password });
      await saveAuth('accessToken', data.accessToken);
      await saveAuth('refreshToken', data.refreshToken);
      await saveAuth('user', data.user);
      setStorageScope(scopeForUser(data.user));
      await get().loadQuickActions();
      set({ user: data.user, isLoading: false });
      return { success: true };
    } catch (e) {
      // Network error → try offline login with cached credentials
      if (isNetworkError(e)) {
        const stored = await loadAuth('user');
        if (stored) {
          try {
            const cachedUser = JSON.parse(stored);
            if (normalizeEmail(cachedUser.email) === normalizeEmail(email)) {
              setStorageScope(scopeForUser(cachedUser));
              await get().loadQuickActions();
              set({ user: cachedUser, isLoading: false });
              return { success: true };
            }
          } catch {}
        }
        set({ isLoading: false });
        return { success: false, error: 'Server offline. Dacă ai mai fost autentificat cu acest cont, vei putea intra.' };
      }
      const msg = e.response?.data?.error || 'Eroare la conectare. Verifică serverul și conexiunea.';
      set({ error: msg, isLoading: false });
      return { success: false, error: msg };
    }
  },

  register: async (email, password, name, phone) => {
    set({ isLoading: true, error: null });
    const normalizedEmail = normalizeEmail(email);
    try {
      const { data } = await api.post('/auth/register', { email: normalizedEmail, password, name, phone });
      await saveAuth('accessToken', data.accessToken);
      await saveAuth('refreshToken', data.refreshToken);
      await saveAuth('user', data.user);
      await removePendingRegistration();
      setStorageScope(scopeForUser(data.user));
      await get().loadQuickActions();
      set({ user: data.user, isLoading: false });
      return { success: true };
    } catch (e) {
      if (isNetworkError(e)) {
        const localUser = {
          id: createClientId('user'),
          email: normalizedEmail,
          name,
          phone,
          role: 'user',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          _offlineRegistration: true,
        };
        await savePendingRegistration({ email: normalizedEmail, password, name, phone });
        await saveAuth('user', localUser);
        setStorageScope(scopeForUser(localUser));
        await get().loadQuickActions();
        set({ user: localUser, isLoading: false });
        return { success: true, offline: true };
      }
      const msg = e.response?.data?.error || 'Eroare la înregistrare.';
      set({ error: msg, isLoading: false });
      return { success: false, error: msg };
    }
  },

  logout: async () => {
    try {
      const refreshToken = await loadAuth('refreshToken');
      await api.post('/auth/logout', { refreshToken });
    } catch {}
    await removeAuth('accessToken');
    await removeAuth('refreshToken');
    await removeAuth('user');
    setStorageScope('anonymous');
    set({ user: null, vehicles: [], invoices: [], reminders: [], documents: [], fuelLogs: [], notifications: [] });
  },

  restoreAuth: async () => {
    const stored = await loadAuth('user');
    if (stored) {
      try {
        const user = JSON.parse(stored);
        setStorageScope(scopeForUser(user));
        set({ user });
        get().loadQuickActions();

        // Load cached data immediately so offline-only items are visible
        // until fetch/sync runs. Otherwise the UI starts empty and any
        // unsynced records can appear "lost" on the next online refresh.
        const [
          vehicles, invoices, fuelLogs, reminders, documents, notifications, members, selectedVehicleId,
          appMode, households, selectedHouseholdId, hExpenses, hIncomes, hEvents, hMembers, customCats,
        ] = await Promise.all([
          loadCache('vehicles'),
          loadCache('invoices'),
          loadCache('fuel'),
          loadCache('reminders'),
          loadCache('documents'),
          loadCache('notifications'),
          loadCache('vehicleMembersById'),
          loadCache('selectedVehicleId'),
          loadCache('appMode'),
          loadCache('households'),
          loadCache('selectedHouseholdId'),
          loadCache('householdExpenses'),
          loadCache('householdIncomes'),
          loadCache('householdEvents'),
          loadCache('householdMembersById'),
          loadCache('customCategories'),
        ]);
        const savedMonthStart = await loadCache('monthStartDay');
        set({
          vehicles: vehicles || [],
          invoices: invoices || [],
          fuelLogs: fuelLogs || [],
          reminders: reminders || [],
          documents: documents || [],
          notifications: notifications || [],
          vehicleMembersById: members || {},
          selectedVehicleId: selectedVehicleId || null,
          appMode: appMode || null,
          households: households || [],
          selectedHouseholdId: selectedHouseholdId || null,
          householdExpenses: hExpenses || [],
          householdIncomes: hIncomes || [],
          householdEvents: hEvents || [],
          householdMembersById: hMembers || {},
          customCategories: Array.isArray(customCats) ? customCats : [],
          monthStartDay: Math.min(28, Math.max(1, Number(savedMonthStart) || 1)),
        });
        get().loadSuggestionsAndRecents().catch(() => {});

        const queue = await getQueue();
        if (queue.length > 0) set({ pendingCount: queue.length });
      } catch {}
    }
  },

  updateProfile: async (patch) => {
    const { data } = await api.put('/auth/me', patch);
    await saveAuth('user', data);
    set({ user: data });
    return data;
  },

  fetchMe: async () => {
    const { isOnline } = get();
    if (!isOnline) return get().user;
    const { data } = await api.get('/auth/me');
    const u = data.user || data;
    await saveAuth('user', u);
    set({ user: u });
    return u;
  },

  uploadAvatar: async (asset) => {
    const fd = new FormData();
    const uri = asset.uri;
    const filename = uri.split('/').pop() || 'avatar.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const mimeType = match ? `image/${match[1].toLowerCase()}` : 'image/jpeg';
    fd.append('avatar', { uri, name: filename, type: mimeType });
    const { data } = await api.post('/auth/avatar', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    await saveAuth('user', data);
    set({ user: data });
    return data;
  },

  removeAvatar: async () => {
    const { data } = await api.delete('/auth/avatar');
    await saveAuth('user', data);
    set({ user: data });
    return data;
  },

  setPushToken: async (token) => {
    const { data } = await api.put('/auth/push-token', { pushToken: token });
    await saveAuth('user', data);
    set({ user: data });
    return data;
  },

  exportData: async () => {
    const { data } = await api.get('/auth/export');
    return data;
  },

  deleteAccount: async (password) => {
    await api.delete('/auth/me', { data: { password } });
    await removeAuth('accessToken');
    await removeAuth('refreshToken');
    await removeAuth('user');
    set({
      user: null,
      vehicles: [],
      invoices: [],
      reminders: [],
      documents: [],
      fuelLogs: [],
      notifications: [],
      friends: [],
      pendingFriends: [],
      sentFriends: [],
      vehicleMembersById: {},
    });
  },

  // ── Friends ─────────────────────────────────────────────────────────────────
  fetchFriends: async () => {
    try {
      const [friends, pending, sent] = await Promise.all([
        api.get('/friends').then(r => r.data),
        api.get('/friends/pending').then(r => r.data),
        api.get('/friends/sent').then(r => r.data),
      ]);
      set({ friends, pendingFriends: pending, sentFriends: sent });
      return { friends, pending, sent };
    } catch (e) {
      return { friends: [], pending: [], sent: [] };
    }
  },

  sendFriendRequest: async (email) => {
    const { data } = await api.post('/friends/request', { email });
    if (data.status === 'accepted') {
      set(s => ({
        friends: [data, ...s.friends.filter(f => f.id !== data.id)],
        pendingFriends: s.pendingFriends.filter(f => f.id !== data.id),
      }));
    } else {
      set(s => ({ sentFriends: [data, ...s.sentFriends] }));
    }
    return data;
  },

  acceptFriend: async (id) => {
    const { data } = await api.put(`/friends/${id}/accept`);
    set(s => ({
      friends: [data, ...s.friends.filter(f => f.id !== id)],
      pendingFriends: s.pendingFriends.filter(f => f.id !== id),
    }));
    return data;
  },

  declineFriend: async (id) => {
    const { data } = await api.put(`/friends/${id}/decline`);
    set(s => ({
      pendingFriends: s.pendingFriends.filter(f => f.id !== id),
    }));
    return data;
  },

  removeFriend: async (id) => {
    await api.delete(`/friends/${id}`);
    set(s => ({
      friends: s.friends.filter(f => f.id !== id),
      pendingFriends: s.pendingFriends.filter(f => f.id !== id),
      sentFriends: s.sentFriends.filter(f => f.id !== id),
    }));
  },

  // ── Vehicle members ────────────────────────────────────────────────────────
  fetchVehicleMembers: async (vehicleId) => {
    const { isOnline } = get();
    if (!isOnline) {
      const cached = await loadCache('vehicleMembersById');
      if (cached?.[vehicleId]) {
        set(s => ({
          vehicleMembersById: { ...s.vehicleMembersById, [vehicleId]: cached[vehicleId] },
        }));
        return cached[vehicleId];
      }
      return null;
    }
    const { data } = await api.get(`/vehicles/${vehicleId}/members`);
    set(s => ({
      vehicleMembersById: { ...s.vehicleMembersById, [vehicleId]: data },
    }));
    await saveCache('vehicleMembersById', get().vehicleMembersById);
    return data;
  },

  addVehicleMember: async (vehicleId, payload) => {
    const { isOnline } = get();
    if (!isOnline) {
      await enqueue({
        entity: 'vehicleMembers',
        action: 'create',
        method: 'POST',
        endpoint: `/vehicles/${vehicleId}/members`,
        payload,
        localId: vehicleId,
      });
      const queue = await getQueue();
      set({ pendingCount: queue.length });
      return { ...payload, _offline: true };
    }
    const { data } = await api.post(`/vehicles/${vehicleId}/members`, payload);
    set(s => {
      const existing = s.vehicleMembersById[vehicleId];
      if (!existing) return s;
      return {
        vehicleMembersById: {
          ...s.vehicleMembersById,
          [vehicleId]: {
            ...existing,
            members: [...existing.members, data],
          },
        },
      };
    });
    return data;
  },

  removeVehicleMember: async (vehicleId, userId) => {
    if (!get().isOnline) throw new OfflineActionError();
    await api.delete(`/vehicles/${vehicleId}/members/${userId}`);
    set(s => {
      const existing = s.vehicleMembersById[vehicleId];
      if (!existing) return s;
      return {
        vehicleMembersById: {
          ...s.vehicleMembersById,
          [vehicleId]: {
            ...existing,
            members: existing.members.filter(m => m.user.id !== userId),
          },
        },
      };
    });
  },

  leaveVehicle: async (vehicleId) => {
    const me = get().user?.id;
    if (!me) return;
    if (!get().isOnline) throw new OfflineActionError();
    await api.delete(`/vehicles/${vehicleId}/members/${me}`);
    set(s => ({
      vehicles: s.vehicles.filter(v => v.id !== vehicleId),
    }));
    await saveCache('vehicles', get().vehicles);
  },

  // ── Vehicles ────────────────────────────────────────────────────────────────
  fetchVehicles: async () => {
    const { isOnline } = get();
    if (!isOnline) {
      const cached = await loadCache('vehicles');
      if (cached) set({ vehicles: cached });
      return;
    }
    try {
      const { data } = await api.get('/vehicles');
      const merged = await mergeWithOfflineQueue(data, get().vehicles, 'vehicles');
      set({ vehicles: merged });
      await saveCache('vehicles', merged);
    } catch {
      const cached = await loadCache('vehicles');
      if (cached) set({ vehicles: cached });
    }
  },

  addVehicle: async (v) => {
    const { isOnline } = get();
    const clientId = createClientId('vehicle');
    const { photoUri, ...vehicleData } = v;
    const payload = ensureClientId(vehicleData, clientId);

    if (!isOnline) {
      let queuedPayload = payload;
      if (photoUri) {
        queuedPayload = new FormData();
        Object.entries(payload).forEach(([k, val]) => {
          if (val !== undefined && val !== null) queuedPayload.append(k, String(val));
        });
        queuedPayload.append('vehiclePhoto', { uri: photoUri, name: 'vehicle.jpg', type: 'image/jpeg' });
      }
      const optimistic = {
        ...vehicleData,
        id: clientId,
        clientId,
        photo: photoUri || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isOwner: true,
        role: 'owner',
        _offline: true,
      };
      set(s => ({ vehicles: [optimistic, ...s.vehicles] }));
      await saveCache('vehicles', get().vehicles);
      await enqueue({
        entity: 'vehicles',
        action: 'create',
        method: 'POST',
        endpoint: '/vehicles',
        payload: queuedPayload,
        localId: clientId,
        clientId,
      });
      const queue = await getQueue();
      set({ pendingCount: queue.length });
      return optimistic;
    }

    let response;
    if (photoUri) {
      const fd = new FormData();
      Object.entries(payload).forEach(([k, val]) => {
        if (val !== undefined && val !== null) fd.append(k, String(val));
      });
      fd.append('vehiclePhoto', { uri: photoUri, name: 'vehicle.jpg', type: 'image/jpeg' });
      response = await api.post('/vehicles', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    } else {
      response = await api.post('/vehicles', payload);
    }
    set(s => ({ vehicles: [response.data, ...s.vehicles] }));
    await saveCache('vehicles', get().vehicles);
    return response.data;
  },

  updateVehicle: async (id, patch) => {
    const { isOnline } = get();
    const { photoUri, ...vehicleData } = patch;
    set(s => ({ vehicles: s.vehicles.map(v => v.id === id ? { ...v, ...vehicleData, ...(photoUri ? { photo: photoUri } : {}) } : v) }));

    if (!isOnline) {
      await saveCache('vehicles', get().vehicles);
      let queuedPayload = vehicleData;
      if (photoUri) {
        queuedPayload = new FormData();
        Object.entries(vehicleData).forEach(([k, val]) => {
          if (val !== undefined && val !== null) queuedPayload.append(k, String(val));
        });
        queuedPayload.append('vehiclePhoto', { uri: photoUri, name: 'vehicle.jpg', type: 'image/jpeg' });
      }
      await enqueue({
        entity: 'vehicles',
        action: 'update',
        method: 'PUT',
        endpoint: `/vehicles/${id}`,
        payload: queuedPayload,
        localId: id,
      });
      const queue = await getQueue();
      set({ pendingCount: queue.length });
      return;
    }

    let response;
    if (photoUri) {
      const fd = new FormData();
      Object.entries(vehicleData).forEach(([k, val]) => {
        if (val !== undefined && val !== null) fd.append(k, String(val));
      });
      fd.append('vehiclePhoto', { uri: photoUri, name: 'vehicle.jpg', type: 'image/jpeg' });
      response = await api.put(`/vehicles/${id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    } else {
      response = await api.put(`/vehicles/${id}`, vehicleData);
    }
    set(s => ({ vehicles: s.vehicles.map(v => v.id === id ? response.data : v) }));
    await saveCache('vehicles', get().vehicles);
    return response.data;
  },

  deleteVehicle: async (id) => {
    if (!get().isOnline) throw new OfflineActionError();
    await api.delete(`/vehicles/${id}`);
    set(s => ({
      vehicles: s.vehicles.filter(v => v.id !== id),
      documents: s.documents.filter(d => d.vehicleId !== id),
      invoices: s.invoices.filter(i => i.vehicleId !== id),
      reminders: s.reminders.filter(r => r.vehicleId !== id),
      fuelLogs: s.fuelLogs.filter(f => f.vehicleId !== id),
    }));
    await Promise.all([
      saveCache('vehicles', get().vehicles),
      saveCache('documents', get().documents),
      saveCache('invoices', get().invoices),
      saveCache('reminders', get().reminders),
      saveCache('fuel', get().fuelLogs),
    ]);
    Promise.all([
      cancelDeadlineNotifications(`vehicle:${id}:itpDate`),
      cancelDeadlineNotifications(`vehicle:${id}:rcaDate`),
      cancelDeadlineNotifications(`vehicle:${id}:cascoDate`),
      cancelDeadlineNotifications(`vehicle:${id}:rovDate`),
    ]).catch(() => {});
  },

  setVehicleAvailability: async (vehicleId, payload) => {
    const { data } = await api.put(`/vehicles/${vehicleId}/availability`, payload);
    set(s => ({ vehicles: s.vehicles.map(v => v.id === vehicleId ? data : v) }));
    await saveCache('vehicles', get().vehicles);
    return data;
  },

  fetchVehicleStats: async (vehicleId) => {
    const { data } = await api.get(`/vehicles/${vehicleId}/stats`);
    return data;
  },

  // ── Documents ───────────────────────────────────────────────────────────────
  fetchDocuments: async (vehicleId) => {
    const { isOnline } = get();
    const cacheKey = vehicleId ? `documents_${vehicleId}` : 'documents';

    if (!isOnline) {
      const cached = await loadCache(cacheKey);
      if (cached) {
        set({ documents: cached });
      } else if (vehicleId) {
        const all = await loadCache('documents');
        if (all) set({ documents: all.filter(d => d.vehicleId === vehicleId) });
      }
      return;
    }
    try {
      const { data } = await api.get('/documents', { params: vehicleId ? { vehicleId } : {} });
      const merged = await mergeWithOfflineQueue(data, get().documents, 'documents');
      set({ documents: merged });
      await saveCache(cacheKey, merged);
    } catch {
      const cached = await loadCache(cacheKey);
      if (cached) set({ documents: cached });
    }
  },

  addDocument: async (formData) => {
    const { isOnline } = get();
    const clientId = createClientId('document');
    formData.append('clientId', clientId);
    const { fields, files } = payloadSnapshot(formData);

    if (!isOnline) {
      const optimistic = documentFromPayload(fields, files, clientId);
      set(s => ({ documents: [optimistic, ...s.documents] }));
      await saveCache('documents', get().documents);
      await enqueue({
        entity: 'documents',
        action: 'create',
        method: 'POST',
        endpoint: '/documents',
        payload: formData,
        localId: clientId,
        clientId,
      });
      const queue = await getQueue();
      set({ pendingCount: queue.length });
      return optimistic;
    }

    const { data } = await api.post('/documents', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    set(s => ({ documents: [data, ...s.documents] }));
    await saveCache('documents', get().documents);
    return data;
  },

  signDocument: async (id, signatureData) => {
    const { isOnline } = get();
    set(s => ({ documents: s.documents.map(d => d.id === id ? { ...d, isSigned: true, signatureData } : d) }));

    if (!isOnline) {
      await saveCache('documents', get().documents);
      await enqueue({
        entity: 'documents',
        action: 'sign',
        method: 'PUT',
        endpoint: `/documents/${id}/sign`,
        payload: { signatureData },
        localId: id,
      });
      const queue = await getQueue();
      set({ pendingCount: queue.length });
      return;
    }

    const { data } = await api.put(`/documents/${id}/sign`, { signatureData });
    set(s => ({ documents: s.documents.map(d => d.id === id ? data : d) }));
    await saveCache('documents', get().documents);
    return data;
  },

  deleteDocument: async (id) => {
    if (!get().isOnline) throw new OfflineActionError();
    await api.delete(`/documents/${id}`);
    set(s => ({ documents: s.documents.filter(d => d.id !== id) }));
    await saveCache('documents', get().documents);
  },

  updateDocument: async (id, formData) => {
    const { data } = await api.put(`/documents/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    set(s => ({ documents: s.documents.map(d => d.id === id ? data : d) }));
    await saveCache('documents', get().documents);
    return data;
  },

  // ── Folders ────────────────────────────────────────────────────────────────
  fetchFolders: async (vehicleId) => {
    try {
      const params = vehicleId ? { vehicleId } : {};
      const { data } = await api.get('/folders', { params });
      if (vehicleId) {
        // Replace only folders for this vehicle in the global list
        set(s => ({
          folders: [
            ...s.folders.filter(f => f.vehicleId !== vehicleId),
            ...data,
          ],
        }));
      } else {
        set({ folders: data });
        await saveCache('folders', data);
      }
      return data;
    } catch (e) {
      const cached = await loadCache('folders');
      if (cached && !vehicleId) set({ folders: cached });
      return [];
    }
  },

  createFolder: async (payload) => {
    const clientId = createClientId('folder');
    const { data } = await api.post('/folders', { ...payload, clientId });
    set(s => ({ folders: [...s.folders, data] }));
    await saveCache('folders', get().folders);
    return data;
  },

  updateFolder: async (id, patch) => {
    const { data } = await api.put(`/folders/${id}`, patch);
    set(s => ({ folders: s.folders.map(f => f.id === id ? data : f) }));
    await saveCache('folders', get().folders);
    return data;
  },

  deleteFolder: async (id) => {
    await api.delete(`/folders/${id}`);
    set(s => ({ folders: s.folders.filter(f => f.id !== id) }));
    await saveCache('folders', get().folders);
  },

  // ── Invoices ────────────────────────────────────────────────────────────────
  fetchInvoices: async (vehicleId) => {
    const { isOnline } = get();
    const cacheKey = vehicleId ? `invoices_${vehicleId}` : 'invoices';

    if (!isOnline) {
      const cached = await loadCache(cacheKey);
      if (cached) {
        set({ invoices: cached });
      } else if (vehicleId) {
        const all = await loadCache('invoices');
        if (all) set({ invoices: all.filter(i => i.vehicleId === vehicleId) });
      }
      return;
    }
    try {
      const { data } = await api.get('/invoices', { params: vehicleId ? { vehicleId } : {} });
      const merged = await mergeWithOfflineQueue(data, get().invoices, 'invoices');
      set({ invoices: merged });
      await saveCache(cacheKey, merged);
    } catch {
      const cached = await loadCache(cacheKey);
      if (cached) set({ invoices: cached });
    }
  },

  addInvoice: async (formData) => {
    const { isOnline } = get();
    const clientId = createClientId('invoice');
    formData.append('clientId', clientId);
    const { fields, files } = payloadSnapshot(formData);

    if (!isOnline) {
      const optimistic = invoiceFromPayload(fields, files, clientId);
      set(s => ({ invoices: [optimistic, ...s.invoices] }));
      await saveCache('invoices', get().invoices);
      await enqueue({
        entity: 'invoices',
        action: 'create',
        method: 'POST',
        endpoint: '/invoices',
        payload: formData,
        localId: clientId,
        clientId,
      });
      const queue = await getQueue();
      set({ pendingCount: queue.length });
      return optimistic;
    }

    const { data } = await api.post('/invoices', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    set(s => ({ invoices: [data, ...s.invoices] }));
    await saveCache('invoices', get().invoices);
    return data;
  },

  updateInvoice: async (id, formData) => {
    const { isOnline } = get();
    const { fields, files } = payloadSnapshot(formData);

    if (!isOnline) {
      set(s => ({
        invoices: s.invoices.map(i => {
          if (i.id !== id) return i;
          return {
            ...i,
            ...fields,
            amount: fields.amount !== undefined ? parseMaybeNumber(fields.amount) || i.amount : i.amount,
            km: fields.km !== undefined ? parseMaybeNumber(fields.km) : i.km,
            customFields: parseCustomFields(fields.customFields, i.customFields),
            attachments: [...(i.attachments || []), ...optimisticAttachments(files)],
            updatedAt: new Date().toISOString(),
            _offline: true,
          };
        }),
      }));
      await saveCache('invoices', get().invoices);
      await enqueue({
        entity: 'invoices',
        action: 'update',
        method: 'PUT',
        endpoint: `/invoices/${id}`,
        payload: formData,
        localId: id,
      });
      const queue = await getQueue();
      set({ pendingCount: queue.length });
      return get().invoices.find(i => i.id === id);
    }

    const { data } = await api.put(`/invoices/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    set(s => ({ invoices: s.invoices.map(i => i.id === id ? data : i) }));
    await saveCache('invoices', get().invoices);
    return data;
  },

  addInvoiceAttachments: async (id, formData) => {
    const { isOnline } = get();
    const { files } = payloadSnapshot(formData);

    if (!isOnline) {
      const optimistic = optimisticAttachments(files);
      set(s => ({
        invoices: s.invoices.map(i =>
          i.id === id ? { ...i, attachments: [...(i.attachments || []), ...optimistic] } : i,
        ),
      }));
      await saveCache('invoices', get().invoices);
      await enqueue({
        entity: 'invoiceAttachments',
        action: 'create',
        method: 'POST',
        endpoint: `/invoices/${id}/attachments`,
        payload: formData,
        localId: id,
      });
      const queue = await getQueue();
      set({ pendingCount: queue.length });
      return optimistic;
    }

    const { data } = await api.post(`/invoices/${id}/attachments`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    set(s => ({
      invoices: s.invoices.map(i =>
        i.id === id ? { ...i, attachments: [...(i.attachments || []), ...data] } : i,
      ),
    }));
    await saveCache('invoices', get().invoices);
    return data;
  },

  deleteInvoiceAttachment: async (invoiceId, attId) => {
    if (!get().isOnline) throw new OfflineActionError();
    await api.delete(`/invoices/${invoiceId}/attachments/${attId}`);
    set(s => ({
      invoices: s.invoices.map(i =>
        i.id === invoiceId
          ? { ...i, attachments: (i.attachments || []).filter(a => a.id !== attId) }
          : i,
      ),
    }));
    await saveCache('invoices', get().invoices);
  },

  deleteInvoice: async (id) => {
    if (!get().isOnline) throw new OfflineActionError();
    await api.delete(`/invoices/${id}`);
    set(s => ({ invoices: s.invoices.filter(i => i.id !== id) }));
    await saveCache('invoices', get().invoices);
  },

  // ── Reminders ───────────────────────────────────────────────────────────────
  fetchReminders: async () => {
    const { isOnline } = get();

    if (!isOnline) {
      const cached = await loadCache('reminders');
      if (cached) set({ reminders: cached });
      return;
    }
    try {
      const { data } = await api.get('/reminders');
      const merged = await mergeWithOfflineQueue(data, get().reminders, 'reminders');
      set({ reminders: merged });
      await saveCache('reminders', merged);
    } catch {
      const cached = await loadCache('reminders');
      if (cached) set({ reminders: cached });
    }
  },

  addReminder: async (r) => {
    const { isOnline } = get();
    const clientId = createClientId('reminder');
    const payload = ensureClientId(r, clientId);

    if (!isOnline) {
      const optimistic = { ...r, id: clientId, clientId, isDone: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), _offline: true };
      set(s => ({ reminders: [optimistic, ...s.reminders] }));
      await saveCache('reminders', get().reminders);
      await enqueue({
        entity: 'reminders',
        action: 'create',
        method: 'POST',
        endpoint: '/reminders',
        payload,
        localId: clientId,
        clientId,
      });
      const queue = await getQueue();
      set({ pendingCount: queue.length });
      return optimistic;
    }

    const { data } = await api.post('/reminders', payload);
    set(s => ({ reminders: [data, ...s.reminders] }));
    await saveCache('reminders', get().reminders);
    return data;
  },

  updateReminder: async (id, patch) => {
    const { isOnline } = get();
    set(s => ({ reminders: s.reminders.map(r => r.id === id ? { ...r, ...patch } : r) }));
    await saveCache('reminders', get().reminders);

    if (!isOnline) {
      await enqueue({
        entity: 'reminders',
        action: 'update',
        method: 'PUT',
        endpoint: `/reminders/${id}`,
        payload: patch,
        localId: id,
      });
      const queue = await getQueue();
      set({ pendingCount: queue.length });
      return;
    }

    const { data } = await api.put(`/reminders/${id}`, patch);
    set(s => ({ reminders: s.reminders.map(r => r.id === id ? data : r) }));
    await saveCache('reminders', get().reminders);
    return data;
  },

  deleteReminder: async (id) => {
    if (!get().isOnline) throw new OfflineActionError();
    await api.delete(`/reminders/${id}`);
    set(s => ({ reminders: s.reminders.filter(r => r.id !== id) }));
    await saveCache('reminders', get().reminders);
    cancelDeadlineNotifications(`reminder:${id}`).catch(() => {});
  },

  // ── Fuel ────────────────────────────────────────────────────────────────────
  fetchFuelLogs: async (vehicleId) => {
    const { isOnline } = get();
    const cacheKey = vehicleId ? `fuel_${vehicleId}` : 'fuel';

    if (!isOnline) {
      const cached = await loadCache(cacheKey);
      if (cached) {
        set({ fuelLogs: cached });
      } else if (vehicleId) {
        const all = await loadCache('fuel');
        if (all) set({ fuelLogs: all.filter(f => f.vehicleId === vehicleId) });
      }
      return;
    }
    try {
      const { data } = await api.get('/fuel', { params: vehicleId ? { vehicleId } : {} });
      const merged = await mergeWithOfflineQueue(data, get().fuelLogs, 'fuel');
      set({ fuelLogs: merged });
      await saveCache(cacheKey, merged);
    } catch {
      const cached = await loadCache(cacheKey);
      if (cached) set({ fuelLogs: cached });
    }
  },

  addFuelLog: async (payload) => {
    const { isOnline } = get();
    const isFormData = payload && typeof payload.append === 'function';
    const clientId = createClientId('fuel');
    const queuedPayload = ensureClientId(payload, clientId);
    const { fields, files } = payloadSnapshot(queuedPayload);

    if (!isOnline) {
      const optimistic = isFormData
        ? fuelFromPayload(fields, files, clientId)
        : { ...queuedPayload, id: clientId, clientId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), _offline: true };
      set(s => ({ fuelLogs: [optimistic, ...s.fuelLogs] }));
      await saveCache('fuel', get().fuelLogs);
      await enqueue({
        entity: 'fuelLogs',
        action: 'create',
        method: 'POST',
        endpoint: '/fuel',
        payload: queuedPayload,
        localId: clientId,
        clientId,
      });
      const queue = await getQueue();
      set({ pendingCount: queue.length });
      return optimistic;
    }

    const config = isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
    const { data } = await api.post('/fuel', queuedPayload, config);
    set(s => ({ fuelLogs: [data, ...s.fuelLogs] }));
    await saveCache('fuel', get().fuelLogs);
    return data;
  },

  updateFuelLog: async (id, payload) => {
    const { isOnline } = get();
    const isFormData = payload && typeof payload.append === 'function';
    const { fields, files } = payloadSnapshot(payload);

    if (!isOnline) {
      set(s => ({
        fuelLogs: s.fuelLogs.map(f => {
          if (f.id !== id) return f;
          const liters = fields.liters !== undefined ? parseMaybeNumber(fields.liters) || f.liters : f.liters;
          const pricePerL = fields.pricePerL !== undefined ? parseMaybeNumber(fields.pricePerL) || f.pricePerL : f.pricePerL;
          return {
            ...f,
            ...fields,
            liters,
            pricePerL,
            total: liters * pricePerL,
            km: fields.km !== undefined ? parseMaybeNumber(fields.km) || f.km : f.km,
            customFields: parseCustomFields(fields.customFields, f.customFields),
            attachments: [...(f.attachments || []), ...optimisticAttachments(files)],
            updatedAt: new Date().toISOString(),
            _offline: true,
          };
        }),
      }));
      await saveCache('fuel', get().fuelLogs);
      await enqueue({
        entity: 'fuelLogs',
        action: 'update',
        method: 'PUT',
        endpoint: `/fuel/${id}`,
        payload,
        localId: id,
      });
      const queue = await getQueue();
      set({ pendingCount: queue.length });
      return get().fuelLogs.find(f => f.id === id);
    }

    const config = isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
    const { data } = await api.put(`/fuel/${id}`, payload, config);
    set(s => ({ fuelLogs: s.fuelLogs.map(f => f.id === id ? data : f) }));
    await saveCache('fuel', get().fuelLogs);
    return data;
  },

  deleteFuelLog: async (id) => {
    if (!get().isOnline) throw new OfflineActionError();
    await api.delete(`/fuel/${id}`);
    set(s => ({ fuelLogs: s.fuelLogs.filter(f => f.id !== id) }));
    await saveCache('fuel', get().fuelLogs);
  },

  addFuelAttachments: async (id, formData) => {
    const { isOnline } = get();
    const { files } = payloadSnapshot(formData);

    if (!isOnline) {
      const optimistic = optimisticAttachments(files);
      set(s => ({
        fuelLogs: s.fuelLogs.map(f =>
          f.id === id ? { ...f, attachments: [...(f.attachments || []), ...optimistic] } : f,
        ),
      }));
      await saveCache('fuel', get().fuelLogs);
      await enqueue({
        entity: 'fuelAttachments',
        action: 'create',
        method: 'POST',
        endpoint: `/fuel/${id}/attachments`,
        payload: formData,
        localId: id,
      });
      const queue = await getQueue();
      set({ pendingCount: queue.length });
      return optimistic;
    }

    const { data } = await api.post(`/fuel/${id}/attachments`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    set(s => ({
      fuelLogs: s.fuelLogs.map(f =>
        f.id === id ? { ...f, attachments: [...(f.attachments || []), ...data] } : f,
      ),
    }));
    await saveCache('fuel', get().fuelLogs);
    return data;
  },

  deleteFuelAttachment: async (fuelId, attId) => {
    if (!get().isOnline) throw new OfflineActionError();
    await api.delete(`/fuel/${fuelId}/attachments/${attId}`);
    set(s => ({
      fuelLogs: s.fuelLogs.map(f =>
        f.id === fuelId
          ? { ...f, attachments: (f.attachments || []).filter(a => a.id !== attId) }
          : f,
      ),
    }));
    await saveCache('fuel', get().fuelLogs);
  },

  // ── Notifications ───────────────────────────────────────────────────────────
  fetchNotifications: async () => {
    const { isOnline } = get();

    if (!isOnline) {
      const cached = await loadCache('notifications');
      if (cached) set({ notifications: cached });
      return;
    }
    try {
      const { data } = await api.get('/notifications');
      set({ notifications: data });
      await saveCache('notifications', data);
    } catch {
      const cached = await loadCache('notifications');
      if (cached) set({ notifications: cached });
    }
  },

  markNotifRead: async (id) => {
    set(s => ({ notifications: s.notifications.map(n => n.id === id ? { ...n, isRead: true } : n) }));
    try { await api.put(`/notifications/${id}/read`); } catch {}
    await saveCache('notifications', get().notifications);
  },

  markAllNotifRead: async () => {
    set(s => ({ notifications: s.notifications.map(n => ({ ...n, isRead: true })) }));
    try { await api.put('/notifications/read-all'); } catch {}
    await saveCache('notifications', get().notifications);
  },

  // ── Service Records ────────────────────────────────────────────────────────
  serviceRecords: [],

  fetchServiceRecords: async (vehicleId) => {
    const { isOnline } = get();
    const cacheKey = vehicleId ? `serviceRecords_${vehicleId}` : 'serviceRecords';
    if (!isOnline) {
      const cached = await loadCache(cacheKey);
      if (cached) set({ serviceRecords: cached });
      return cached || get().serviceRecords;
    }
    try {
      const { data } = await api.get('/service-records', { params: vehicleId ? { vehicleId } : {} });
      set({ serviceRecords: data });
      await saveCache(cacheKey, data);
      return data;
    } catch {
      const cached = await loadCache(cacheKey);
      if (cached) set({ serviceRecords: cached });
      return cached || [];
    }
  },

  addServiceRecord: async (payload) => {
    if (!get().isOnline) throw new OfflineActionError();
    const clientId = createClientId('srv');
    const { data } = await api.post('/service-records', { ...payload, clientId });
    set(s => ({ serviceRecords: [data, ...s.serviceRecords] }));
    await saveCache('serviceRecords', get().serviceRecords);
    return data;
  },

  updateServiceRecord: async (id, patch) => {
    if (!get().isOnline) throw new OfflineActionError();
    const { data } = await api.put(`/service-records/${id}`, patch);
    set(s => ({ serviceRecords: s.serviceRecords.map(r => r.id === id ? data : r) }));
    await saveCache('serviceRecords', get().serviceRecords);
    return data;
  },

  deleteServiceRecord: async (id) => {
    if (!get().isOnline) throw new OfflineActionError();
    await api.delete(`/service-records/${id}`);
    set(s => ({ serviceRecords: s.serviceRecords.filter(r => r.id !== id) }));
    await saveCache('serviceRecords', get().serviceRecords);
  },

  // ── Household Bills ────────────────────────────────────────────────────────
  householdBills: [],

  fetchHouseholdBills: async (householdId) => {
    const { isOnline } = get();
    const cacheKey = householdId ? `householdBills_${householdId}` : 'householdBills';
    if (!isOnline) {
      const cached = await loadCache(cacheKey);
      if (cached) set({ householdBills: cached });
      return cached || get().householdBills;
    }
    try {
      const { data } = await api.get('/household-bills', { params: householdId ? { householdId } : {} });
      set({ householdBills: data });
      await saveCache(cacheKey, data);
      return data;
    } catch {
      const cached = await loadCache(cacheKey);
      if (cached) set({ householdBills: cached });
      return cached || [];
    }
  },

  addHouseholdBill: async (payload) => {
    if (!get().isOnline) throw new OfflineActionError();
    const clientId = createClientId('bill');
    const { data } = await api.post('/household-bills', { ...payload, clientId });
    set(s => ({ householdBills: [data, ...s.householdBills] }));
    await saveCache('householdBills', get().householdBills);
    return data;
  },

  updateHouseholdBill: async (id, patch) => {
    if (!get().isOnline) throw new OfflineActionError();
    const { data } = await api.put(`/household-bills/${id}`, patch);
    set(s => ({ householdBills: s.householdBills.map(b => b.id === id ? data : b) }));
    await saveCache('householdBills', get().householdBills);
    return data;
  },

  payHouseholdBill: async (id) => {
    if (!get().isOnline) throw new OfflineActionError();
    const { data } = await api.post(`/household-bills/${id}/pay`);
    set(s => ({ householdBills: s.householdBills.map(b => b.id === id ? data : b) }));
    await saveCache('householdBills', get().householdBills);
    return data;
  },

  deleteHouseholdBill: async (id) => {
    if (!get().isOnline) throw new OfflineActionError();
    await api.delete(`/household-bills/${id}`);
    set(s => ({ householdBills: s.householdBills.filter(b => b.id !== id) }));
    await saveCache('householdBills', get().householdBills);
  },

  // ── Budget ─────────────────────────────────────────────────────────────────
  budgetCategories: [],
  budgetSummary: null,

  fetchBudgetCategories: async (householdId) => {
    if (!get().isOnline) {
      const cached = await loadCache(`budgetCategories_${householdId || 'all'}`);
      if (cached) set({ budgetCategories: cached });
      return cached || [];
    }
    try {
      const { data } = await api.get('/budgets/categories', { params: householdId ? { householdId } : {} });
      set({ budgetCategories: data });
      await saveCache(`budgetCategories_${householdId || 'all'}`, data);
      return data;
    } catch {
      const cached = await loadCache(`budgetCategories_${householdId || 'all'}`);
      if (cached) set({ budgetCategories: cached });
      return cached || [];
    }
  },

  fetchBudgetSummary: async (householdId, month) => {
    if (!householdId) return null;
    if (!get().isOnline) {
      const cached = await loadCache(`budgetSummary_${householdId}`);
      if (cached) set({ budgetSummary: cached });
      return cached;
    }
    try {
      const { data } = await api.get('/budgets/summary', {
        params: { householdId, ...(month ? { month } : {}) },
      });
      set({ budgetSummary: data, budgetCategories: data.categories });
      await saveCache(`budgetSummary_${householdId}`, data);
      return data;
    } catch {
      const cached = await loadCache(`budgetSummary_${householdId}`);
      if (cached) set({ budgetSummary: cached });
      return cached;
    }
  },

  upsertBudgetCategory: async (payload) => {
    if (!get().isOnline) throw new OfflineActionError();
    const { data } = await api.post('/budgets/categories', payload);
    set(s => {
      const exists = s.budgetCategories.some(c => c.id === data.id);
      return {
        budgetCategories: exists
          ? s.budgetCategories.map(c => c.id === data.id ? data : c)
          : [...s.budgetCategories, data],
      };
    });
    return data;
  },

  updateBudgetCategory: async (id, patch) => {
    if (!get().isOnline) throw new OfflineActionError();
    const { data } = await api.put(`/budgets/categories/${id}`, patch);
    set(s => ({ budgetCategories: s.budgetCategories.map(c => c.id === id ? data : c) }));
    return data;
  },

  deleteBudgetCategory: async (id) => {
    if (!get().isOnline) throw new OfflineActionError();
    await api.delete(`/budgets/categories/${id}`);
    set(s => ({ budgetCategories: s.budgetCategories.filter(c => c.id !== id) }));
  },

  // ── Chat ───────────────────────────────────────────────────────────────────
  chatThreads: [],
  chatByFriend: {},        // { [friendId]: ChatMessage[] }

  fetchChatThreads: async () => {
    if (!get().isOnline) return get().chatThreads;
    try {
      const { data } = await api.get('/chats/threads');
      set({ chatThreads: data });
      return data;
    } catch {
      return get().chatThreads;
    }
  },

  fetchChatMessages: async (friendId) => {
    if (!friendId) return [];
    if (!get().isOnline) {
      const cached = await loadCache(`chat_${friendId}`);
      if (cached) set(s => ({ chatByFriend: { ...s.chatByFriend, [friendId]: cached } }));
      return cached || [];
    }
    try {
      const { data } = await api.get(`/chats/${friendId}/messages`);
      set(s => ({ chatByFriend: { ...s.chatByFriend, [friendId]: data } }));
      await saveCache(`chat_${friendId}`, data);
      return data;
    } catch {
      const cached = await loadCache(`chat_${friendId}`);
      if (cached) set(s => ({ chatByFriend: { ...s.chatByFriend, [friendId]: cached } }));
      return cached || [];
    }
  },

  sendChatMessage: async (friendId, { text, kind, metadata } = {}) => {
    if (!friendId) throw new Error('friendId obligatoriu');
    const clientId = createClientId('msg');
    const optimistic = {
      id: `local-${clientId}`,
      clientId,
      fromUserId: get().user?.id,
      toUserId: friendId,
      text: text || null,
      kind: kind || 'text',
      metadata: metadata || null,
      createdAt: new Date().toISOString(),
      _pending: true,
    };
    set(s => ({
      chatByFriend: {
        ...s.chatByFriend,
        [friendId]: [...(s.chatByFriend[friendId] || []), optimistic],
      },
    }));

    if (!get().isOnline) return optimistic;

    try {
      const { data } = await api.post(`/chats/${friendId}/messages`, { clientId, text, kind, metadata });
      set(s => ({
        chatByFriend: {
          ...s.chatByFriend,
          [friendId]: (s.chatByFriend[friendId] || []).map(m => m.id === optimistic.id ? data : m),
        },
      }));
      await saveCache(`chat_${friendId}`, get().chatByFriend[friendId]);
      return data;
    } catch (e) {
      set(s => ({
        chatByFriend: {
          ...s.chatByFriend,
          [friendId]: (s.chatByFriend[friendId] || []).map(m => m.id === optimistic.id ? { ...m, _failed: true } : m),
        },
      }));
      throw e;
    }
  },

  deleteChatMessage: async (friendId, messageId) => {
    if (!get().isOnline) throw new OfflineActionError();
    await api.delete(`/chats/${friendId}/messages/${messageId}`);
    set(s => ({
      chatByFriend: {
        ...s.chatByFriend,
        [friendId]: (s.chatByFriend[friendId] || []).filter(m => m.id !== messageId),
      },
    }));
  },

  markChatRead: async (friendId) => {
    if (!friendId || !get().isOnline) return;
    try { await api.post(`/chats/${friendId}/read`); } catch {}
  },
}));

export default useStore;
