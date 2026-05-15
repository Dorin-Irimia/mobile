import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

export const DEFAULT_API_URL = 'http://192.168.1.145:3001';
const API_URL_KEY = 'api_server_url';

let _apiUrl = DEFAULT_API_URL;

export async function loadApiUrl() {
  try {
    const saved = await SecureStore.getItemAsync(API_URL_KEY);
    if (saved) _apiUrl = saved;
  } catch {}
}

export async function saveApiUrl(url) {
  _apiUrl = url;
  try { await SecureStore.setItemAsync(API_URL_KEY, url); } catch {}
}

export function getApiUrl() { return _apiUrl; }

export { _apiUrl as API_URL };

const api = axios.create({ timeout: 8000 });

api.interceptors.request.use(async (config) => {
  config.baseURL = `${_apiUrl}/api`;
  try {
    const token = await SecureStore.getItemAsync('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch {}
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = await SecureStore.getItemAsync('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');
        const { data } = await axios.post(`${_apiUrl}/api/auth/refresh`, { refreshToken });
        await SecureStore.setItemAsync('accessToken', data.accessToken);
        await SecureStore.setItemAsync('refreshToken', data.refreshToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch (refreshErr) {
        if (refreshErr.response) {
          // Server explicitly rejected the refresh → truly logged out
          await SecureStore.deleteItemAsync('accessToken');
          await SecureStore.deleteItemAsync('refreshToken');
          await SecureStore.deleteItemAsync('user');
        }
        // Network error → keep credentials so restoreAuth works when back online
      }
    }
    return Promise.reject(error);
  }
);

export default api;
