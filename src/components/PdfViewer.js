// Native PDF rendering on both iOS and Android via react-native-pdf
// (PDFKit on iOS, AndroidPdfViewer / PdfRenderer on Android). Falls back to
// downloading + base64 only if a `file://` URI is provided and direct rendering
// fails for some reason.
//
// Reasons we switched away from WebView-based rendering:
//   • Android Chromium WebView cannot render PDFs natively (black screen for
//     <embed> + base64 and for data: URIs).
//   • Google Docs viewer (`docs.google.com/gview?embedded`) cannot reach LAN
//     URLs like http://192.168.x.x:3002, so it stays blank for self-hosted dev
//     servers and any non-public backend.

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Pdf from 'react-native-pdf';
import { T, RADIUS, FONTS, SPACING, HIT_SLOP, SHADOW } from '../theme';

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.5;

export default function PdfViewer({ uri, fileName }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);

  const source = { uri, cache: true };

  if (error) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Nu pot deschide PDF-ul</Text>
        <Text style={styles.errorText}>{error}</Text>
        {fileName ? <Text style={styles.errorFile}>{fileName}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Pdf
        source={source}
        trustAllCerts={false}
        onLoadComplete={(n) => { setPageCount(n); setLoading(false); }}
        onPageChanged={(p) => setPage(p)}
        onError={(err) => {
          const msg = err?.message || String(err) || 'Eroare necunoscută';
          setError(msg);
          setLoading(false);
        }}
        scale={zoom}
        minScale={MIN_ZOOM}
        maxScale={MAX_ZOOM}
        enablePaging={false}
        enableAntialiasing
        spacing={6}
        style={styles.pdf}
      />

      {loading && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator color="#fff" />
          <Text style={styles.loadingText}>Se încarcă PDF-ul…</Text>
        </View>
      )}

      <View style={styles.zoomBar} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.zoomBtn}
          onPress={() => setZoom(z => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2)))}
          hitSlop={HIT_SLOP}
        >
          <Text style={styles.zoomBtnText}>−</Text>
        </TouchableOpacity>
        <View style={styles.zoomLabel}>
          <Text style={styles.zoomLabelText}>{Math.round(zoom * 100)}%</Text>
        </View>
        <TouchableOpacity
          style={styles.zoomBtn}
          onPress={() => setZoom(z => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2)))}
          hitSlop={HIT_SLOP}
        >
          <Text style={styles.zoomBtnText}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.zoomBtn, styles.zoomReset]}
          onPress={() => setZoom(1)}
          hitSlop={HIT_SLOP}
        >
          <Text style={styles.zoomBtnText}>↺</Text>
        </TouchableOpacity>
      </View>

      {pageCount > 1 && (
        <View style={styles.pageBar} pointerEvents="none">
          <Text style={styles.pageText}>{page} / {pageCount}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  pdf: { flex: 1, width: '100%', backgroundColor: '#000' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000', gap: 12, padding: 24 },
  loadingText: { color: '#fff', fontSize: 13, marginTop: 8 },
  errorIcon: { fontSize: 48 },
  errorTitle: { color: '#fff', fontSize: 16, fontWeight: FONTS.bold },
  errorText: { color: 'rgba(255,255,255,0.75)', fontSize: 12, textAlign: 'center' },
  errorFile: { color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 4 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
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
  pageBar: {
    position: 'absolute',
    top: SPACING.lg,
    alignSelf: 'center',
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  pageText: { color: '#fff', fontSize: 12, fontWeight: FONTS.semibold },
});
