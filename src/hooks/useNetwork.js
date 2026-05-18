import { useEffect, useRef, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import axios from 'axios';
import useStore from '../store';
import { getApiUrl } from '../api/client';

// Polling intervals — verified server-side every 30s, but the moment NetInfo
// flips state we already update isOnline locally. So users feel the change
// instantly when they lose / regain signal.
const SERVER_PING_INTERVAL_MS = 30000;
const SERVER_PING_TIMEOUT_MS  = 2000;

export function useNetworkMonitor() {
  const setOnline = useStore(s => s.setOnline);
  const syncOnReconnect = useStore(s => s.syncOnReconnect);
  const wasOffline = useRef(false);
  const hasNetwork = useRef(true);
  const intervalRef = useRef(null);

  const checkServer = useCallback(async () => {
    if (!hasNetwork.current) {
      if (!wasOffline.current) {
        wasOffline.current = true;
        setOnline(false);
      }
      return;
    }
    try {
      await axios.get(`${getApiUrl()}/api/health`, { timeout: SERVER_PING_TIMEOUT_MS });
      setOnline(true);
      if (wasOffline.current) {
        wasOffline.current = false;
        syncOnReconnect();
      }
    } catch {
      // Network reachable but server isn't — we're effectively offline for
      // our backend's purposes.
      setOnline(false);
      wasOffline.current = true;
    }
  }, [setOnline, syncOnReconnect]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const next = !!state.isConnected;
      hasNetwork.current = next;
      if (!next) {
        // No carrier / wifi → immediately mark offline without waiting for ping.
        setOnline(false);
        wasOffline.current = true;
      } else {
        // Just got network back — probe the server right away.
        checkServer();
      }
    });

    NetInfo.fetch().then(state => {
      hasNetwork.current = !!state.isConnected;
      checkServer();
    });

    intervalRef.current = setInterval(checkServer, SERVER_PING_INTERVAL_MS);

    return () => {
      unsubscribe();
      clearInterval(intervalRef.current);
    };
  }, [checkServer, setOnline]);
}
