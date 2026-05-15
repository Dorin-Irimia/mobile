import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import useStore from '../store';
import { T, RADIUS, FONTS } from '../theme';

export default function NetworkBadge() {
  const { isOnline, isSyncing } = useStore();
  const slideAnim = useRef(new Animated.Value(-60)).current;
  const prevOnline = useRef(true);

  useEffect(() => {
    const shouldShow = !isOnline || isSyncing;

    if (shouldShow) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: -60, duration: 400, delay: 1500, useNativeDriver: true }).start();
    }

    prevOnline.current = isOnline;
  }, [isOnline, isSyncing]);

  const bg = isSyncing ? T.warn : T.danger;
  const label = isSyncing ? '🔄 Se sincronizează...' : '📵 Offline — modificările se salvează local';

  return (
    <Animated.View style={[styles.banner, { backgroundColor: bg, transform: [{ translateY: slideAnim }] }]}>
      <Text style={styles.text}>{label}</Text>
    </Animated.View>
  );
}

export function OnlineDot() {
  const { isOnline, isSyncing } = useStore();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isSyncing) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 0.4, duration: 500, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulse.stopAnimation();
      pulse.setValue(1);
    }
  }, [isSyncing]);

  const color = isSyncing ? T.warn : isOnline ? T.success : T.danger;

  return (
    <Animated.View style={[styles.dot, { backgroundColor: color, opacity: pulse }]} />
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 13,
    fontWeight: FONTS.semibold,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
  },
});
