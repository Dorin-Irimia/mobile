import { Alert } from 'react-native';

export const OFFLINE_REQUIRED_MSG = 'Această acțiune necesită conexiune la internet. Conectează-te și încearcă din nou.';
export const OFFLINE_DELETE_MSG = 'Ștergerea nu este permisă în modul offline. Conectează-te la internet și încearcă din nou.';

export function showOfflineAlert(title = 'Mod offline', message = OFFLINE_REQUIRED_MSG) {
  Alert.alert(title, message);
}

export function showOfflineDeleteAlert() {
  Alert.alert('Mod offline', OFFLINE_DELETE_MSG);
}

// Throws a tagged error for store actions when offline.
export class OfflineActionError extends Error {
  constructor(message = OFFLINE_REQUIRED_MSG) {
    super(message);
    this.name = 'OfflineActionError';
    this.offline = true;
  }
}

// Wrap a handler so that, when offline, it shows an alert instead of running.
export function guardOnline(isOnline, handler, title) {
  return (...args) => {
    if (!isOnline) {
      showOfflineAlert(title);
      return undefined;
    }
    return handler?.(...args);
  };
}
