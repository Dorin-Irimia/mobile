// In-app PDF viewer powered by react-native-webview.
//
// • iOS: WebView renders PDFs natively (built-in pinch zoom, scroll).
// • Android: WebView cannot render PDFs out of the box. For http(s) URLs we
//   embed via Google's Docs viewer; for local file:// URLs we download to a
//   cache file and base64-encode it into a PDF.js-free fallback page that
//   uses native scroll + CSS zoom buttons. The zoom buttons are mirrored on
//   both platforms so the UX is identical.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import WebView from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import { T, RADIUS, FONTS, SPACING, HIT_SLOP, SHADOW } from '../theme';

const ANDROID_REMOTE_VIEWER = (url) =>
  `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`;

// Inline HTML wrapper used for local PDFs on Android (and as a fallback when
// Google's viewer is unreachable). It loads the PDF as a base64 <embed/>
// inside a styled container so the user can pinch / pan / zoom.
function buildLocalHtml(base64) {
  return `<!doctype html><html><head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=8.0, user-scalable=yes" />
    <style>
      html, body { margin:0; padding:0; height:100%; background:#000; }
      embed { width:100%; height:100%; border:0; }
      object { width:100%; height:100%; border:0; }
    </style>
  </head><body>
    <object data="data:application/pdf;base64,${base64}" type="application/pdf">
      <embed src="data:application/pdf;base64,${base64}" type="application/pdf" />
    </object>
  </body></html>`;
}

export default function PdfViewer({ uri, fileName }) {
  const [zoom, setZoom] = useState(1);
  const [base64, setBase64] = useState(null);
  const [loadingLocal, setLoadingLocal] = useState(false);
  const webViewRef = useRef(null);

  const isLocal = typeof uri === 'string' && uri.startsWith('file:');
  const isAndroid = Platform.OS === 'android';
  const needsLocalEncode = isLocal && isAndroid;

  useEffect(() => {
    let cancelled = false;
    if (!needsLocalEncode) return;
    setLoadingLocal(true);
    FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 })
      .then(b64 => { if (!cancelled) setBase64(b64); })
      .catch(() => { if (!cancelled) setBase64(null); })
      .finally(() => { if (!cancelled) setLoadingLocal(false); });
    return () => { cancelled = true; };
  }, [uri, needsLocalEncode]);

  const source = useMemo(() => {
    if (!isAndroid) return { uri };
    if (isLocal) return base64 ? { html: buildLocalHtml(base64) } : null;
    return { uri: ANDROID_REMOTE_VIEWER(uri) };
  }, [uri, isAndroid, isLocal, base64]);

  const setBodyZoom = (next) => {
    setZoom(next);
    // The native PDF view on iOS does not respond to CSS zoom — but the user
    // can pinch directly inside the WebView, so we just toggle CSS for the
    // HTML-rendered Android case.
    const js = `(function(){
      try {
        document.body.style.zoom = '${next}';
        document.documentElement.style.transformOrigin = '0 0';
      } catch (e) {}
      true;
    })();`;
    webViewRef.current?.injectJavaScript?.(js);
  };

  if (needsLocalEncode && loadingLocal) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color="#fff" />
        <Text style={styles.loadingText}>Se pregătește PDF-ul…</Text>
      </View>
    );
  }

  if (!source) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.errorText}>Nu am putut deschide PDF-ul.</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <WebView
        ref={webViewRef}
        source={source}
        style={styles.web}
        originWhitelist={['*']}
        allowsBackForwardNavigationGestures={false}
        scalesPageToFit
        androidLayerType="hardware"
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color="#fff" />
          </View>
        )}
      />

      <View style={styles.zoomBar} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.zoomBtn}
          onPress={() => setBodyZoom(Math.max(0.5, +(zoom - 0.25).toFixed(2)))}
          hitSlop={HIT_SLOP}
        >
          <Text style={styles.zoomBtnText}>−</Text>
        </TouchableOpacity>
        <View style={styles.zoomLabel}>
          <Text style={styles.zoomLabelText}>{Math.round(zoom * 100)}%</Text>
        </View>
        <TouchableOpacity
          style={styles.zoomBtn}
          onPress={() => setBodyZoom(Math.min(4, +(zoom + 0.25).toFixed(2)))}
          hitSlop={HIT_SLOP}
        >
          <Text style={styles.zoomBtnText}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.zoomBtn, styles.zoomReset]}
          onPress={() => setBodyZoom(1)}
          hitSlop={HIT_SLOP}
        >
          <Text style={styles.zoomBtnText}>↺</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  web: { flex: 1, backgroundColor: '#000' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000', gap: 12 },
  loadingText: { color: '#fff', fontSize: 13 },
  errorText: { color: '#fff', fontSize: 13 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  zoomBar: {
    position: 'absolute',
    bottom: SPACING.lg,
    right: SPACING.lg,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    padding: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: RADIUS.full,
    ...SHADOW.lg,
  },
  zoomBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  zoomReset: { backgroundColor: T.brand },
  zoomBtnText: { color: '#fff', fontSize: 18, fontWeight: FONTS.bold },
  zoomLabel: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  zoomLabelText: { color: '#fff', fontSize: 11, fontWeight: FONTS.bold },
});
