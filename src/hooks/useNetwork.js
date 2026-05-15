import { useEffect, useRef, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import axios from 'axios';
import useStore from '../store';
import { getApiUrl } from '../api/client';

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
      await axios.get(`${getApiUrl()}/api/health`, { timeout: 4000 });
      setOnline(true);
      if (wasOffline.current) {
        wasOffline.current = false;
        syncOnReconnect();
      }
    } catch {
      setOnline(false);
      wasOffline.current = true;
    }
  }, [setOnline, syncOnReconnect]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      hasNetwork.current = !!state.isConnected;
    });

    NetInfo.fetch().then(state => {
      hasNetwork.current = !!state.isConnected;
      checkServer();
    });

    intervalRef.current = setInterval(checkServer, 15000);

    return () => {
      unsubscribe();
      clearInterval(intervalRef.current);
    };
  }, [checkServer]);
}
