import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import NetInfo from '@react-native-community/netinfo';

// Tailscale IP — funcționează oriunde are telefonul internet, nu se schimbă
// la reboot router. Pentru testare locală fără VPN, schimbă din ServerConfig
// la IP-ul LAN (ex. http://192.168.1.x:3002).
export const DEFAULT_API_URL = 'http://100.121.100.74:3002';
const API_URL_KEY = 'api_server_url';

let _apiUrl = DEFAULT_API_URL;

// Cached NetInfo state — refreshed by NetInfo subscriber below. We default to
// `true` so the very first request (before the listener fires) isn't dropped.
let _hasNetwork = true;
NetInfo.addEventListener(state => { _hasNetwork = !!state.isConnected; });
NetInfo.fetch().then(state => { _hasNetwork = !!state.isConnected; }).catch(() => {});

export function hasNetwork() { return _hasNetwork; }

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

// 4s overall request timeout — long enough for slow cellular, short enough that
// the UI never sits with a spinner for "8 seconds while it eventually fails".
const api = axios.create({ timeout: 4000 });

api.interceptors.request.use(async (config) => {
  config.baseURL = `${_apiUrl}/api`;
  // Short-circuit when the device has no network. This stops every request
  // from waiting the full timeout when we already know it'll fail.
  if (_hasNetwork === false) {
    return Promise.reject({
      message: 'No network',
      code: 'OFFLINE',
      isOfflineShortCircuit: true,
      config,
    });
  }
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
