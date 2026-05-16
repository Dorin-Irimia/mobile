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
    try {
      const { data } = await api.get('/households');
      set({ households: data });
      await saveCache('households', data);
      // Auto-select first if none selected
      const { selectedHouseholdId } = get();
      if (!selectedHouseholdId && data.length > 0) {
        get().setSelectedHousehold(data[0].id);
      }
      return data;
    } catch (e) {
      const cached = await loadCache('households');
      if (cached) set({ households: cached });
      return cached || [];
    }
  },

  addHousehold: async (payload) => {
    const clientId = createClientId('household');
    const { data } = await api.post('/households', { ...payload, clientId });
    set(s => ({ households: [data, ...s.households] }));
    await saveCache('households', get().households);
    return data;
  },

  updateHousehold: async (id, patch) => {
    const { data } = await api.put(`/households/${id}`, patch);
    set(s => ({ households: s.households.map(h => h.id === id ? data : h) }));
    await saveCache('households', get().households);
    return data;
  },

  deleteHousehold: async (id) => {
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
    try {
      const params = householdId ? { householdId } : {};
      const { data } = await api.get('/household-expenses', { params });
      set({ householdExpenses: data });
      await saveCache('householdExpenses', data);
      return data;
    } catch (e) {
      const cached = await loadCache('householdExpenses');
      if (cached) set({ householdExpenses: cached });
      return cached || [];
    }
  },

  addHouseholdExpense: async (formData) => {
    const clientId = createClientId('hexp');
    if (formData?.append) formData.append('clientId', clientId);
    const { data } = await api.post('/household-expenses', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    set(s => ({ householdExpenses: [data, ...s.householdExpenses] }));
    await saveCache('householdExpenses', get().householdExpenses);
    return data;
  },

  updateHouseholdExpense: async (id, formData) => {
    const { data } = await api.put(`/household-expenses/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    set(s => ({ householdExpenses: s.householdExpenses.map(e => e.id === id ? data : e) }));
    await saveCache('householdExpenses', get().householdExpenses);
    return data;
  },

  deleteHouseholdExpense: async (id) => {
    await api.delete(`/household-expenses/${id}`);
    set(s => ({ householdExpenses: s.householdExpenses.filter(e => e.id !== id) }));
    await saveCache('householdExpenses', get().householdExpenses);
  },

  // ── Household Incomes ──────────────────────────────────────────────────────
  fetchHouseholdIncomes: async (householdId) => {
    try {
      const params = householdId ? { householdId } : {};
      const { data } = await api.get('/household-incomes', { params });
      set({ householdIncomes: data });
      await saveCache('householdIncomes', data);
      return data;
    } catch (e) {
      const cached = await loadCache('householdIncomes');
      if (cached) set({ householdIncomes: cached });
      return cached || [];
    }
  },

  addHouseholdIncome: async (payload) => {
    const clientId = createClientId('hinc');
    const { data } = await api.post('/household-incomes', { ...payload, clientId });
    set(s => ({ householdIncomes: [data, ...s.householdIncomes] }));
    await saveCache('householdIncomes', get().householdIncomes);
    return data;
  },

  updateHouseholdIncome: async (id, patch) => {
    const { data } = await api.put(`/household-incomes/${id}`, patch);
    set(s => ({ householdIncomes: s.householdIncomes.map(i => i.id === id ? data : i) }));
    await saveCache('householdIncomes', get().householdIncomes);
    return data;
  },

  deleteHouseholdIncome: async (id) => {
    await api.delete(`/household-incomes/${id}`);
    set(s => ({ householdIncomes: s.householdIncomes.filter(i => i.id !== id) }));
    await saveCache('householdIncomes', get().householdIncomes);
  },

  // ── Household Events ───────────────────────────────────────────────────────
  fetchHouseholdEvents: async (householdId) => {
    try {
      const params = householdId ? { householdId } : {};
      const { data } = await api.get('/household-events', { params });
      set({ householdEvents: data });
      await saveCache('householdEvents', data);
      return data;
    } catch (e) {
      const cached = await loadCache('householdEvents');
      if (cached) set({ householdEvents: cached });
      return cached || [];
    }
  },

  addHouseholdEvent: async (payload) => {
    const clientId = createClientId('hev');
    const { data } = await api.post('/household-events', { ...payload, clientId });
    set(s => ({ householdEvents: [data, ...s.householdEvents] }));
    await saveCache('householdEvents', get().householdEvents);
    return data;
  },

  updateHouseholdEvent: async (id, patch) => {
    const { data } = await api.put(`/household-events/${id}`, patch);
    set(s => ({ householdEvents: s.householdEvents.map(e => e.id === id ? data : e) }));
    await saveCache('householdEvents', get().householdEvents);
    return data;
  },

  deleteHouseholdEvent: async (id) => {
    await api.delete(`/household-events/${id}`);
    set(s => ({ householdEvents: s.householdEvents.filter(e => e.id !== id) }));
    await saveCache('householdEvents', get().householdEvents);
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

  applyServerState: async (data) => {
    if (!data) return;
    if (data.user) {
      await saveAuth('user', data.user);
      setStorageScope(scopeForUser(data.user));
    }

    // Preserve offline-only items still pending in the sync queue.
    const currentState = get();
    const [mergedInvoices, mergedFuelLogs, mergedReminders, mergedDocuments, mergedVehicles] =
      await Promise.all([
        mergeWithOfflineQueue(data.invoices, currentState.invoices, 'invoices'),
        mergeWithOfflineQueue(data.fuelLogs, currentState.fuelLogs, 'fuel'),
        mergeWithOfflineQueue(data.reminders, currentState.reminders, 'reminders'),
        mergeWithOfflineQueue(data.documents, currentState.documents, 'documents'),
        mergeWithOfflineQueue(data.vehicles, currentState.vehicles, 'vehicles'),
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
    });
    await Promise.all([
      saveCache('vehicles', mergedVehicles),
      saveCache('invoices', mergedInvoices),
      saveCache('reminders', mergedReminders),
      saveCache('documents', mergedDocuments),
      saveCache('fuel', mergedFuelLogs),
      saveCache('notifications', data.notifications || []),
      saveCache('vehicleMembersById', data.vehicleMembersById || {}),
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
          appMode, households, selectedHouseholdId, hExpenses, hIncomes, hEvents, hMembers,
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
        ]);
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
        });

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
    const { isOnline } = get();
    if (!isOnline) {
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
      await saveCache('vehicleMembersById', get().vehicleMembersById);
      await enqueue({
        entity: 'vehicleMembers',
        action: 'delete',
        method: 'DELETE',
        endpoint: `/vehicles/${vehicleId}/members/${userId}`,
        payload: null,
        localId: vehicleId,
      });
      const queue = await getQueue();
      set({ pendingCount: queue.length });
      return;
    }
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
    const { isOnline } = get();
    if (!isOnline) {
      set(s => ({
        vehicles: s.vehicles.filter(v => v.id !== vehicleId),
      }));
      await saveCache('vehicles', get().vehicles);
      await enqueue({
        entity: 'vehicleMembers',
        action: 'delete',
        method: 'DELETE',
        endpoint: `/vehicles/${vehicleId}/members/${me}`,
        payload: null,
        localId: vehicleId,
      });
      const queue = await getQueue();
      set({ pendingCount: queue.length });
      return;
    }
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
    const { isOnline } = get();
    set(s => ({ vehicles: s.vehicles.filter(v => v.id !== id) }));
    set(s => ({
      documents: s.documents.filter(d => d.vehicleId !== id),
      invoices: s.invoices.filter(i => i.vehicleId !== id),
      reminders: s.reminders.filter(r => r.vehicleId !== id),
      fuelLogs: s.fuelLogs.filter(f => f.vehicleId !== id),
    }));
    await saveCache('vehicles', get().vehicles);
    await Promise.all([
      saveCache('documents', get().documents),
      saveCache('invoices', get().invoices),
      saveCache('reminders', get().reminders),
      saveCache('fuel', get().fuelLogs),
    ]);

    if (!isOnline) {
      const removedLocalCreate = await removePendingCreate('vehicles', id);
      if (!removedLocalCreate) {
        await enqueue({
          entity: 'vehicles',
          action: 'delete',
          method: 'DELETE',
          endpoint: `/vehicles/${id}`,
          payload: null,
          localId: id,
        });
      }
      const queue = await getQueue();
      set({ pendingCount: queue.length });
      return;
    }

    await api.delete(`/vehicles/${id}`);
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
    const { isOnline } = get();
    set(s => ({ documents: s.documents.filter(d => d.id !== id) }));
    await saveCache('documents', get().documents);

    if (!isOnline) {
      const removedLocalCreate = await removePendingCreate('documents', id);
      if (!removedLocalCreate) {
        await enqueue({
          entity: 'documents',
          action: 'delete',
          method: 'DELETE',
          endpoint: `/documents/${id}`,
          payload: null,
          localId: id,
        });
      }
      const queue = await getQueue();
      set({ pendingCount: queue.length });
      return;
    }

    await api.delete(`/documents/${id}`);
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
    const { isOnline } = get();
    set(s => ({
      invoices: s.invoices.map(i =>
        i.id === invoiceId
          ? { ...i, attachments: (i.attachments || []).filter(a => a.id !== attId) }
          : i,
      ),
    }));
    await saveCache('invoices', get().invoices);

    if (!isOnline) {
      if (!String(attId).startsWith('att-')) {
        await enqueue({
          entity: 'invoiceAttachments',
          action: 'delete',
          method: 'DELETE',
          endpoint: `/invoices/${invoiceId}/attachments/${attId}`,
          payload: null,
          localId: attId,
        });
      }
      const queue = await getQueue();
      set({ pendingCount: queue.length });
      return;
    }

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
    const { isOnline } = get();
    set(s => ({ invoices: s.invoices.filter(i => i.id !== id) }));
    await saveCache('invoices', get().invoices);

    if (!isOnline) {
      const removedLocalCreate = await removePendingCreate('invoices', id);
      if (!removedLocalCreate) {
        await enqueue({
          entity: 'invoices',
          action: 'delete',
          method: 'DELETE',
          endpoint: `/invoices/${id}`,
          payload: null,
          localId: id,
        });
      }
      const queue = await getQueue();
      set({ pendingCount: queue.length });
      return;
    }

    await api.delete(`/invoices/${id}`);
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
    const { isOnline } = get();
    set(s => ({ reminders: s.reminders.filter(r => r.id !== id) }));
    await saveCache('reminders', get().reminders);

    if (!isOnline) {
      const removedLocalCreate = await removePendingCreate('reminders', id);
      if (!removedLocalCreate) {
        await enqueue({
          entity: 'reminders',
          action: 'delete',
          method: 'DELETE',
          endpoint: `/reminders/${id}`,
          payload: null,
          localId: id,
        });
      }
      const queue = await getQueue();
      set({ pendingCount: queue.length });
      return;
    }

    await api.delete(`/reminders/${id}`);
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
    const { isOnline } = get();
    set(s => ({ fuelLogs: s.fuelLogs.filter(f => f.id !== id) }));
    await saveCache('fuel', get().fuelLogs);

    if (!isOnline) {
      const removedLocalCreate = await removePendingCreate('fuelLogs', id);
      if (!removedLocalCreate) {
        await enqueue({
          entity: 'fuelLogs',
          action: 'delete',
          method: 'DELETE',
          endpoint: `/fuel/${id}`,
          payload: null,
          localId: id,
        });
      }
      const queue = await getQueue();
      set({ pendingCount: queue.length });
      return;
    }

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
    const { isOnline } = get();
    set(s => ({
      fuelLogs: s.fuelLogs.map(f =>
        f.id === fuelId
          ? { ...f, attachments: (f.attachments || []).filter(a => a.id !== attId) }
          : f,
      ),
    }));
    await saveCache('fuel', get().fuelLogs);

    if (!isOnline) {
      if (!String(attId).startsWith('att-')) {
        await enqueue({
          entity: 'fuelAttachments',
          action: 'delete',
          method: 'DELETE',
          endpoint: `/fuel/${fuelId}/attachments/${attId}`,
          payload: null,
          localId: attId,
        });
      }
      const queue = await getQueue();
      set({ pendingCount: queue.length });
      return;
    }

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
}));

export default useStore;
