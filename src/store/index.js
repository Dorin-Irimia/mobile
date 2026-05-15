import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import api from '../api/client';
import { saveCache, loadCache, enqueue, getQueue } from '../utils/storage';
import { processSyncQueue } from '../utils/syncManager';

async function saveAuth(key, value) {
  try { await SecureStore.setItemAsync(key, typeof value === 'string' ? value : JSON.stringify(value)); } catch {}
}
async function loadAuth(key) {
  try { return await SecureStore.getItemAsync(key); } catch { return null; }
}
async function removeAuth(key) {
  try { await SecureStore.deleteItemAsync(key); } catch {}
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
  isLoading: false,
  isOnline: true,
  isSyncing: false,
  pendingCount: 0,
  error: null,

  setOnline: (isOnline) => set({ isOnline }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  syncOnReconnect: async () => {
    set({ isSyncing: true });
    try {
      const queue = await getQueue();
      if (queue.length > 0) {
        await processSyncQueue((done, total) => {
          set({ pendingCount: total - done });
        });
      }
      const s = get();
      await s.fetchVehicles();
      await s.fetchReminders();
      await s.fetchNotifications();
    } finally {
      set({ isSyncing: false, pendingCount: 0 });
    }
  },

  // ── Auth ────────────────────────────────────────────────────────────────────
  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.post('/auth/login', { email, password });
      await saveAuth('accessToken', data.accessToken);
      await saveAuth('refreshToken', data.refreshToken);
      await saveAuth('user', data.user);
      set({ user: data.user, isLoading: false });
      return { success: true };
    } catch (e) {
      // Network error → try offline login with cached credentials
      if (!e.response) {
        const stored = await loadAuth('user');
        if (stored) {
          try {
            const cachedUser = JSON.parse(stored);
            if (cachedUser.email === email.trim()) {
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
    try {
      const { data } = await api.post('/auth/register', { email, password, name, phone });
      await saveAuth('accessToken', data.accessToken);
      await saveAuth('refreshToken', data.refreshToken);
      await saveAuth('user', data.user);
      set({ user: data.user, isLoading: false });
      return { success: true };
    } catch (e) {
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
    set({ user: null, vehicles: [], invoices: [], reminders: [], documents: [], fuelLogs: [], notifications: [] });
  },

  restoreAuth: async () => {
    const stored = await loadAuth('user');
    if (stored) {
      try { set({ user: JSON.parse(stored) }); } catch {}
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
    const { data } = await api.get(`/vehicles/${vehicleId}/members`);
    set(s => ({
      vehicleMembersById: { ...s.vehicleMembersById, [vehicleId]: data },
    }));
    return data;
  },

  addVehicleMember: async (vehicleId, payload) => {
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
      set({ vehicles: data });
      await saveCache('vehicles', data);
    } catch {
      const cached = await loadCache('vehicles');
      if (cached) set({ vehicles: cached });
    }
  },

  addVehicle: async (v) => {
    const { isOnline } = get();
    const tempId = `offline-${Date.now()}`;
    const { photoUri, ...vehicleData } = v;

    if (!isOnline) {
      const optimistic = { ...vehicleData, id: tempId, photo: photoUri || null, createdAt: new Date().toISOString(), _offline: true };
      set(s => ({ vehicles: [optimistic, ...s.vehicles] }));
      await saveCache('vehicles', get().vehicles);
      await enqueue({ method: 'POST', endpoint: '/vehicles', payload: vehicleData });
      set(s => ({ pendingCount: s.pendingCount + 1 }));
      return optimistic;
    }

    let response;
    if (photoUri) {
      const fd = new FormData();
      Object.entries(vehicleData).forEach(([k, val]) => {
        if (val !== undefined && val !== null) fd.append(k, String(val));
      });
      fd.append('vehiclePhoto', { uri: photoUri, name: 'vehicle.jpg', type: 'image/jpeg' });
      response = await api.post('/vehicles', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    } else {
      response = await api.post('/vehicles', vehicleData);
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
      await enqueue({ method: 'PUT', endpoint: `/vehicles/${id}`, payload: vehicleData });
      set(s => ({ pendingCount: s.pendingCount + 1 }));
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
    await saveCache('vehicles', get().vehicles);

    if (!isOnline) {
      await enqueue({ method: 'DELETE', endpoint: `/vehicles/${id}`, payload: null });
      set(s => ({ pendingCount: s.pendingCount + 1 }));
      return;
    }

    await api.delete(`/vehicles/${id}`);
  },

  // ── Documents ───────────────────────────────────────────────────────────────
  fetchDocuments: async (vehicleId) => {
    const { isOnline } = get();
    const cacheKey = vehicleId ? `documents_${vehicleId}` : 'documents';

    if (!isOnline) {
      const cached = await loadCache(cacheKey);
      if (cached) set({ documents: cached });
      return;
    }
    try {
      const { data } = await api.get('/documents', { params: vehicleId ? { vehicleId } : {} });
      set({ documents: data });
      await saveCache(cacheKey, data);
    } catch {
      const cached = await loadCache(cacheKey);
      if (cached) set({ documents: cached });
    }
  },

  addDocument: async (formData) => {
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
      await enqueue({ method: 'PUT', endpoint: `/documents/${id}/sign`, payload: { signatureData } });
      set(s => ({ pendingCount: s.pendingCount + 1 }));
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
      await enqueue({ method: 'DELETE', endpoint: `/documents/${id}`, payload: null });
      set(s => ({ pendingCount: s.pendingCount + 1 }));
      return;
    }

    await api.delete(`/documents/${id}`);
  },

  // ── Invoices ────────────────────────────────────────────────────────────────
  fetchInvoices: async (vehicleId) => {
    const { isOnline } = get();
    const cacheKey = vehicleId ? `invoices_${vehicleId}` : 'invoices';

    if (!isOnline) {
      const cached = await loadCache(cacheKey);
      if (cached) set({ invoices: cached });
      return;
    }
    try {
      const { data } = await api.get('/invoices', { params: vehicleId ? { vehicleId } : {} });
      set({ invoices: data });
      await saveCache(cacheKey, data);
    } catch {
      const cached = await loadCache(cacheKey);
      if (cached) set({ invoices: cached });
    }
  },

  addInvoice: async (formData) => {
    const { data } = await api.post('/invoices', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    set(s => ({ invoices: [data, ...s.invoices] }));
    await saveCache('invoices', get().invoices);
    return data;
  },

  updateInvoice: async (id, formData) => {
    const { data } = await api.put(`/invoices/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    set(s => ({ invoices: s.invoices.map(i => i.id === id ? data : i) }));
    await saveCache('invoices', get().invoices);
    return data;
  },

  addInvoiceAttachments: async (id, formData) => {
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
      await enqueue({ method: 'DELETE', endpoint: `/invoices/${id}`, payload: null });
      set(s => ({ pendingCount: s.pendingCount + 1 }));
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
      set({ reminders: data });
      await saveCache('reminders', data);
    } catch {
      const cached = await loadCache('reminders');
      if (cached) set({ reminders: cached });
    }
  },

  addReminder: async (r) => {
    const { isOnline } = get();
    const tempId = `offline-${Date.now()}`;

    if (!isOnline) {
      const optimistic = { ...r, id: tempId, isDone: false, createdAt: new Date().toISOString(), _offline: true };
      set(s => ({ reminders: [optimistic, ...s.reminders] }));
      await saveCache('reminders', get().reminders);
      await enqueue({ method: 'POST', endpoint: '/reminders', payload: r });
      set(s => ({ pendingCount: s.pendingCount + 1 }));
      return optimistic;
    }

    const { data } = await api.post('/reminders', r);
    set(s => ({ reminders: [data, ...s.reminders] }));
    await saveCache('reminders', get().reminders);
    return data;
  },

  updateReminder: async (id, patch) => {
    const { isOnline } = get();
    set(s => ({ reminders: s.reminders.map(r => r.id === id ? { ...r, ...patch } : r) }));
    await saveCache('reminders', get().reminders);

    if (!isOnline) {
      await enqueue({ method: 'PUT', endpoint: `/reminders/${id}`, payload: patch });
      set(s => ({ pendingCount: s.pendingCount + 1 }));
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
      await enqueue({ method: 'DELETE', endpoint: `/reminders/${id}`, payload: null });
      set(s => ({ pendingCount: s.pendingCount + 1 }));
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
      if (cached) set({ fuelLogs: cached });
      return;
    }
    try {
      const { data } = await api.get('/fuel', { params: vehicleId ? { vehicleId } : {} });
      set({ fuelLogs: data });
      await saveCache(cacheKey, data);
    } catch {
      const cached = await loadCache(cacheKey);
      if (cached) set({ fuelLogs: cached });
    }
  },

  addFuelLog: async (payload) => {
    const { isOnline } = get();
    const isFormData = payload && typeof payload.append === 'function';
    const tempId = `offline-${Date.now()}`;

    if (!isOnline && !isFormData) {
      const optimistic = { ...payload, id: tempId, createdAt: new Date().toISOString(), _offline: true };
      set(s => ({ fuelLogs: [optimistic, ...s.fuelLogs] }));
      await saveCache('fuel', get().fuelLogs);
      await enqueue({ method: 'POST', endpoint: '/fuel', payload });
      set(s => ({ pendingCount: s.pendingCount + 1 }));
      return optimistic;
    }

    const config = isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
    const { data } = await api.post('/fuel', payload, config);
    set(s => ({ fuelLogs: [data, ...s.fuelLogs] }));
    await saveCache('fuel', get().fuelLogs);
    return data;
  },

  updateFuelLog: async (id, payload) => {
    const isFormData = payload && typeof payload.append === 'function';
    const config = isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
    const { data } = await api.put(`/fuel/${id}`, payload, config);
    set(s => ({ fuelLogs: s.fuelLogs.map(f => f.id === id ? data : f) }));
    await saveCache('fuel', get().fuelLogs);
    return data;
  },

  deleteFuelLog: async (id) => {
    await api.delete(`/fuel/${id}`);
    set(s => ({ fuelLogs: s.fuelLogs.filter(f => f.id !== id) }));
    await saveCache('fuel', get().fuelLogs);
  },

  addFuelAttachments: async (id, formData) => {
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
