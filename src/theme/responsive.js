import { useEffect, useState } from 'react';
import { Dimensions, Platform, PixelRatio, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const IS_IOS = Platform.OS === 'ios';
export const IS_ANDROID = Platform.OS === 'android';

export const BREAKPOINTS = {
  phoneSm: 360,
  phone: 480,
  tablet: 600,
  tabletLg: 900,
  desktop: 1200,
};

const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

export function scale(size) {
  const { width } = Dimensions.get('window');
  const ratio = width / BASE_WIDTH;
  const newSize = size * Math.min(ratio, 1.3);
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
}

export function vScale(size) {
  const { height } = Dimensions.get('window');
  const ratio = height / BASE_HEIGHT;
  return Math.round(PixelRatio.roundToNearestPixel(size * Math.min(ratio, 1.3)));
}

export function fScale(size, factor = 0.4) {
  return Math.round(size + (scale(size) - size) * factor);
}

export function getDeviceType(width) {
  if (width >= BREAKPOINTS.desktop) return 'desktop';
  if (width >= BREAKPOINTS.tabletLg) return 'tabletLg';
  if (width >= BREAKPOINTS.tablet) return 'tablet';
  if (width >= BREAKPOINTS.phone) return 'phone';
  return 'phoneSm';
}

export function useResponsive() {
  const [dim, setDim] = useState(() => Dimensions.get('window'));

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setDim(window));
    return () => sub?.remove?.();
  }, []);

  const { width, height } = dim;
  const isLandscape = width > height;
  const deviceType = getDeviceType(width);
  const isTablet = deviceType === 'tablet' || deviceType === 'tabletLg' || deviceType === 'desktop';
  const isPhoneSm = deviceType === 'phoneSm';

  const hPad = isTablet ? 32 : 20;
  const maxContentWidth = isTablet ? 900 : width;

  return {
    width,
    height,
    isLandscape,
    isTablet,
    isPhoneSm,
    deviceType,
    hPad,
    maxContentWidth,
  };
}

export function getGridColumns(width, minItemWidth = 160, gap = 12, hPad = 20) {
  const available = width - hPad * 2;
  const cols = Math.max(1, Math.floor((available + gap) / (minItemWidth + gap)));
  const itemWidth = (available - gap * (cols - 1)) / cols;
  return { cols, itemWidth };
}

export function useSafeBottomPadding(extra = 16) {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, IS_ANDROID ? 12 : 0) + extra;
}

export function useSafeTopPadding(extra = 0) {
  const insets = useSafeAreaInsets();
  const fallback = IS_ANDROID ? StatusBar.currentHeight || 24 : 0;
  return Math.max(insets.top, fallback) + extra;
}

export const HIT_SLOP = { top: 8, right: 8, bottom: 8, left: 8 };
export const HIT_SLOP_LG = { top: 12, right: 12, bottom: 12, left: 12 };

export const TOUCH_TARGET = IS_IOS ? 44 : 48;
