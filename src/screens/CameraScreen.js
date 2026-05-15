import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Dimensions,
  ScrollView,
  Image,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { T, RADIUS, FONTS } from '../theme';
import api from '../api/client';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FRAME_W = 300;
const FRAME_H = 190;

const FIELD_LABELS = {
  plate: 'Număr înmatriculare',
  brand: 'Marcă',
  model: 'Model',
  year:  'An fabricație',
  fuel:  'Combustibil',
  power: 'Putere (CP)',
  color: 'Culoare',
  vin:   'Serie șasiu (VIN)',
  km:    'Kilometraj',
};

const DOC_TYPES = ['Talon', 'RCA', 'CASCO', 'ITP', 'Factură', 'Garanție', 'Altele'];

export default function CameraScreen({ navigation, route }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState('camera'); // 'camera' | 'files'
  const [loading, setLoading] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);

  // Files mode state
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [saveAsDocs, setSaveAsDocs] = useState(true);
  const [docType, setDocType] = useState('Talon');
  const [savingDocs, setSavingDocs] = useState(false);

  const cameraRef = useRef(null);
  const { onOCRResult } = route.params || {};

  // ── Camera capture ──────────────────────────────────────────────────────────
  const handleCapture = async () => {
    if (!cameraRef.current || loading) return;
    setLoading(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      const formData = new FormData();
      formData.append('image', { uri: photo.uri, type: 'image/jpeg', name: 'talon.jpg' });
      const { data } = await api.post('/ocr/scan-talon', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      });
      setOcrResult({ parsed: data.parsed || {}, files: [] });
    } catch {
      Alert.alert(
        'Eroare la procesare',
        'Nu am putut citi talonul. Asigură-te că imaginea e clară și bine iluminată.',
        [
          { text: 'Încearcă din nou', onPress: () => setLoading(false) },
          { text: 'Anulează', onPress: () => navigation.goBack(), style: 'cancel' },
        ],
      );
      return;
    }
    setLoading(false);
  };

  // ── Pick images from gallery ────────────────────────────────────────────────
  const pickImages = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permisiune necesară', 'Acordă acces la galerie în Setări.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.length) {
      const newFiles = result.assets.map(a => ({
        uri: a.uri,
        mimeType: 'image/jpeg',
        name: a.fileName || a.uri.split('/').pop() || 'image.jpg',
        kind: 'image',
      }));
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  };

  // ── Pick PDF / documents ────────────────────────────────────────────────────
  const pickDocuments = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets?.length) {
      const newFiles = result.assets.map(a => ({
        uri: a.uri,
        mimeType: a.mimeType || 'application/pdf',
        name: a.name || 'document.pdf',
        kind: a.mimeType === 'application/pdf' ? 'pdf' : 'image',
      }));
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (idx) => setSelectedFiles(prev => prev.filter((_, i) => i !== idx));

  // ── Scan selected files ─────────────────────────────────────────────────────
  const scanFiles = async () => {
    if (!selectedFiles.length) return;
    setLoading(true);
    try {
      const formData = new FormData();
      selectedFiles.forEach(f => {
        formData.append('files', { uri: f.uri, type: f.mimeType, name: f.name });
      });
      const { data } = await api.post('/ocr/scan-files', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });
      setOcrResult({ parsed: data.parsed || {}, files: data.files || [] });
    } catch {
      Alert.alert('Eroare', 'Nu s-au putut procesa fișierele. Încearcă din nou.');
    } finally {
      setLoading(false);
    }
  };

  // ── Confirm OCR result ──────────────────────────────────────────────────────
  const handleConfirm = async () => {
    const parsed = ocrResult?.parsed || {};

    // Optionally save files as documents
    if (saveAsDocs && selectedFiles.length > 0) {
      setSavingDocs(true);
      for (const file of selectedFiles) {
        const fd = new FormData();
        fd.append('name', `${docType} — ${new Date().toLocaleDateString('ro-RO')}`);
        fd.append('type', docType);
        fd.append('image', { uri: file.uri, type: file.mimeType, name: file.name });
        try { await api.post('/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } }); } catch {}
      }
      setSavingDocs(false);
    }

    if (onOCRResult) {
      onOCRResult(parsed);
      navigation.goBack();
    } else {
      navigation.navigate('AddVehicle', { ocrData: parsed });
    }
  };

  const handleRetry = () => {
    setOcrResult(null);
  };

  // ── Permission screens ──────────────────────────────────────────────────────
  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={T.brand} size="large" />
      </View>
    );
  }

  if (!permission.granted && mode === 'camera') {
    return (
      <SafeAreaView style={styles.permContainer} edges={['top', 'bottom']}>
        <TouchableOpacity style={styles.backBtnPerm} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnPermText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.permIcon}>📷</Text>
        <Text style={styles.permTitle}>Acces cameră necesar</Text>
        <Text style={styles.permDesc}>
          Urbio Auto are nevoie de acces la cameră pentru a scana talonul vehiculului.
        </Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Permite acces cameră</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.permAltBtn} onPress={() => setMode('files')}>
          <Text style={styles.permAltText}>Încarcă din galerie/documente</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── Files mode UI ───────────────────────────────────────────────────────────
  if (mode === 'files') {
    return (
      <SafeAreaView style={styles.filesSafe} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.filesHeader}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.filesTitle}>Scanează fișiere</Text>
          <TouchableOpacity style={styles.cameraToggle} onPress={() => setMode('camera')}>
            <Text style={styles.cameraToggleText}>📷</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.filesContent} showsVerticalScrollIndicator={false}>
          {/* Pick buttons */}
          <View style={styles.pickRow}>
            <TouchableOpacity style={styles.pickBtn} onPress={pickImages} activeOpacity={0.8}>
              <Text style={styles.pickBtnIcon}>🖼️</Text>
              <Text style={styles.pickBtnLabel}>Imagini</Text>
              <Text style={styles.pickBtnSub}>galerie foto</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.pickBtn} onPress={pickDocuments} activeOpacity={0.8}>
              <Text style={styles.pickBtnIcon}>📄</Text>
              <Text style={styles.pickBtnLabel}>Documente</Text>
              <Text style={styles.pickBtnSub}>PDF sau imagine</Text>
            </TouchableOpacity>
          </View>

          {/* Selected files list */}
          {selectedFiles.length > 0 && (
            <View style={styles.filesListCard}>
              <Text style={styles.filesListTitle}>Fișiere selectate ({selectedFiles.length})</Text>
              {selectedFiles.map((f, i) => (
                <View key={i} style={styles.fileRow}>
                  {f.kind === 'image'
                    ? <Image source={{ uri: f.uri }} style={styles.fileThumb} />
                    : <View style={styles.pdfThumb}><Text style={styles.pdfThumbIcon}>📄</Text></View>
                  }
                  <Text style={styles.fileName} numberOfLines={1}>{f.name}</Text>
                  <TouchableOpacity onPress={() => removeFile(i)} style={styles.removeBtn}>
                    <Text style={styles.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Save as documents toggle */}
          {selectedFiles.length > 0 && (
            <View style={styles.saveDocsCard}>
              <View style={styles.saveDocsRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.saveDocsLabel}>Salvează fișierele ca acte</Text>
                  <Text style={styles.saveDocsSub}>Rămân în secțiunea Documente</Text>
                </View>
                <Switch
                  value={saveAsDocs}
                  onValueChange={setSaveAsDocs}
                  trackColor={{ false: T.line, true: T.brand }}
                  thumbColor="#fff"
                />
              </View>
              {saveAsDocs && (
                <>
                  <Text style={styles.docTypeLabel}>Tip document</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                    {DOC_TYPES.map(t => (
                      <TouchableOpacity
                        key={t}
                        onPress={() => setDocType(t)}
                        style={[styles.chip, docType === t && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, docType === t && styles.chipTextActive]}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}
            </View>
          )}

          {/* Scan button */}
          {selectedFiles.length > 0 && (
            <TouchableOpacity
              style={[styles.scanBtn, loading && styles.scanBtnDisabled]}
              onPress={scanFiles}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.scanBtnText}>Scanează {selectedFiles.length} fișier{selectedFiles.length > 1 ? 'e' : ''}</Text>
              }
            </TouchableOpacity>
          )}

          {selectedFiles.length === 0 && (
            <View style={styles.emptyHint}>
              <Text style={styles.emptyHintIcon}>📂</Text>
              <Text style={styles.emptyHintText}>
                Selectează imagini cu talonul sau documente PDF pentru a extrage automat datele vehiculului
              </Text>
            </View>
          )}
        </ScrollView>

        {/* OCR Result overlay — shared with camera mode */}
        {ocrResult !== null && renderResultSheet()}
      </SafeAreaView>
    );
  }

  // ── Camera mode UI ──────────────────────────────────────────────────────────
  function renderResultSheet() {
    const parsed = ocrResult?.parsed || {};
    const extractedFields = Object.entries(FIELD_LABELS).filter(([key]) => parsed[key]);
    const hasData = extractedFields.length > 0;

    return (
      <View style={styles.resultOverlay}>
        <View style={styles.resultSheet}>
          <View style={styles.resultHeader}>
            <View style={[styles.resultIconWrap, !hasData && styles.resultIconWrapWarn]}>
              <Text style={styles.resultIcon}>{hasData ? '✓' : '!'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.resultTitle}>
                {hasData ? 'Date extrase din talon' : 'Date insuficiente'}
              </Text>
              <Text style={styles.resultSubtitle}>
                {hasData
                  ? `${extractedFields.length} câmp${extractedFields.length > 1 ? 'uri' : ''} detectat${extractedFields.length > 1 ? 'e' : ''}`
                  : 'Încearcă o fotografie mai clară sau alt fișier.'}
              </Text>
            </View>
          </View>

          {hasData && (
            <ScrollView style={styles.fieldsList} showsVerticalScrollIndicator={false}>
              {extractedFields.map(([key, label]) => (
                <View key={key} style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>{label}</Text>
                  <Text style={styles.fieldValue}>{parsed[key]}</Text>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Save as docs toggle — only in files mode when files are present */}
          {mode === 'files' && selectedFiles.length > 0 && saveAsDocs && (
            <View style={styles.saveConfirmRow}>
              <Text style={styles.saveConfirmText}>
                {savingDocs ? 'Se salvează documentele...' : `${selectedFiles.length} fișier${selectedFiles.length > 1 ? 'e' : ''} salvat${selectedFiles.length > 1 ? 'e' : ''} ca: ${docType}`}
              </Text>
            </View>
          )}

          <View style={styles.resultActions}>
            <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
              <Text style={styles.retryBtnText}>Rescaner</Text>
            </TouchableOpacity>
            {hasData && (
              <TouchableOpacity
                style={[styles.confirmBtn, savingDocs && styles.confirmBtnDisabled]}
                onPress={handleConfirm}
                disabled={savingDocs}
              >
                {savingDocs
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.confirmBtnText}>Folosește datele</Text>
                }
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        flash={flashOn ? 'on' : 'off'}
      />

      <View style={styles.overlay}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.iconBtnText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.topTitle}>Scanează talon</Text>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setFlashOn(f => !f)}>
            <Text style={[styles.iconBtnText, flashOn && styles.flashActive]}>⚡</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.frameArea}>
          <View style={styles.frame}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
        </View>

        <View style={styles.bottomArea}>
          <Text style={styles.instruction}>
            Centrează talonul în cadru, asigură-te că textul e lizibil
          </Text>
          <TouchableOpacity
            style={[styles.captureBtn, loading && styles.captureBtnDisabled]}
            onPress={handleCapture}
            disabled={loading}>
            <View style={styles.captureBtnInner} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.galleryBtn} onPress={() => setMode('files')}>
            <Text style={styles.galleryBtnText}>📂 Galerie & Documente</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={T.brand} />
            <Text style={styles.loadingText}>Se procesează imaginea...</Text>
          </View>
        </View>
      )}

      {ocrResult !== null && renderResultSheet()}
    </View>
  );
}

const CORNER_SIZE = 24;
const CORNER_THICKNESS = 3;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },

  // Permission
  permContainer: {
    flex: 1, backgroundColor: T.bg, alignItems: 'center',
    justifyContent: 'center', paddingHorizontal: 32,
  },
  backBtnPerm: {
    position: 'absolute', top: 56, right: 24,
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
  },
  backBtnPermText: { fontSize: 18, color: T.ink3, fontFamily: FONTS.regular },
  permIcon: { fontSize: 64, marginBottom: 24 },
  permTitle: { fontSize: 22, fontFamily: FONTS.bold, color: T.ink, textAlign: 'center', marginBottom: 12 },
  permDesc: { fontSize: 15, fontFamily: FONTS.regular, color: T.ink3, textAlign: 'center', lineHeight: 22, marginBottom: 36 },
  permBtn: { backgroundColor: T.brand, borderRadius: RADIUS.md, paddingHorizontal: 32, paddingVertical: 14, marginBottom: 12 },
  permBtnText: { fontSize: 16, fontFamily: FONTS.semibold, color: '#FFFFFF' },
  permAltBtn: { paddingVertical: 12 },
  permAltText: { fontSize: 14, fontFamily: FONTS.medium, color: T.brand },

  // Camera
  overlay: { flex: 1, flexDirection: 'column' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  iconBtnText: { fontSize: 18, color: '#FFFFFF', fontFamily: FONTS.medium },
  flashActive: { color: '#FFD700' },
  topTitle: { fontSize: 16, fontFamily: FONTS.semibold, color: '#FFFFFF' },
  frameArea: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  frame: { width: FRAME_W, height: FRAME_H, position: 'relative', backgroundColor: 'transparent' },
  corner: { position: 'absolute', width: CORNER_SIZE, height: CORNER_SIZE },
  cornerTL: { top: 0, left: 0, borderTopWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS, borderTopLeftRadius: 4, borderColor: T.brand },
  cornerTR: { top: 0, right: 0, borderTopWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS, borderTopRightRadius: 4, borderColor: T.brand },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS, borderBottomLeftRadius: 4, borderColor: T.brand },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS, borderBottomRightRadius: 4, borderColor: T.brand },
  bottomArea: {
    backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center',
    paddingTop: 24, paddingBottom: 36, paddingHorizontal: 32,
  },
  instruction: {
    fontSize: 13, fontFamily: FONTS.regular, color: 'rgba(255,255,255,0.8)',
    textAlign: 'center', marginBottom: 24, lineHeight: 19,
  },
  captureBtn: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: T.brand,
    alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#FFFFFF',
    marginBottom: 16,
  },
  captureBtnDisabled: { backgroundColor: T.ink4 },
  captureBtnInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFFFFF' },
  galleryBtn: {
    paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  galleryBtnText: { fontSize: 14, fontFamily: FONTS.medium, color: '#FFFFFF' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center', justifyContent: 'center', zIndex: 99,
  },
  loadingCard: { backgroundColor: '#FFFFFF', borderRadius: RADIUS.lg, padding: 32, alignItems: 'center', width: 220 },
  loadingText: { fontSize: 15, fontFamily: FONTS.medium, color: T.ink, marginTop: 16, textAlign: 'center' },

  // Files mode
  filesSafe: { flex: 1, backgroundColor: T.bg },
  filesHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: T.border,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backBtnText: { fontSize: 18, color: T.ink2, fontFamily: FONTS.medium },
  filesTitle: { fontSize: 17, fontFamily: FONTS.bold, color: T.ink },
  cameraToggle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: T.brandTint, alignItems: 'center', justifyContent: 'center',
  },
  cameraToggleText: { fontSize: 18 },
  filesContent: { padding: 20, paddingBottom: 48 },

  pickRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  pickBtn: {
    flex: 1, backgroundColor: T.card, borderRadius: RADIUS.lg,
    padding: 20, alignItems: 'center',
    borderWidth: 1.5, borderColor: T.border,
    borderStyle: 'dashed',
  },
  pickBtnIcon: { fontSize: 32, marginBottom: 8 },
  pickBtnLabel: { fontSize: 15, fontFamily: FONTS.semibold, color: T.ink, marginBottom: 2 },
  pickBtnSub: { fontSize: 12, fontFamily: FONTS.regular, color: T.ink3 },

  filesListCard: {
    backgroundColor: T.card, borderRadius: RADIUS.lg, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: T.border,
  },
  filesListTitle: { fontSize: 13, fontFamily: FONTS.semibold, color: T.ink3, marginBottom: 10 },
  fileRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  fileThumb: { width: 44, height: 44, borderRadius: 8, marginRight: 10, backgroundColor: T.line },
  pdfThumb: {
    width: 44, height: 44, borderRadius: 8, marginRight: 10,
    backgroundColor: T.brandTint, alignItems: 'center', justifyContent: 'center',
  },
  pdfThumbIcon: { fontSize: 22 },
  fileName: { flex: 1, fontSize: 13, fontFamily: FONTS.regular, color: T.ink },
  removeBtn: { padding: 6 },
  removeBtnText: { fontSize: 14, color: T.ink3 },

  saveDocsCard: {
    backgroundColor: T.card, borderRadius: RADIUS.lg, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: T.border,
  },
  saveDocsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  saveDocsLabel: { fontSize: 15, fontFamily: FONTS.semibold, color: T.ink },
  saveDocsSub: { fontSize: 12, fontFamily: FONTS.regular, color: T.ink3, marginTop: 2 },
  docTypeLabel: { fontSize: 13, fontFamily: FONTS.semibold, color: T.ink3, marginTop: 12, marginBottom: 8 },
  chipRow: { flexDirection: 'row' },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full,
    backgroundColor: T.line2, borderWidth: 1, borderColor: T.line, marginRight: 8,
  },
  chipActive: { backgroundColor: T.brand, borderColor: T.brand },
  chipText: { fontSize: 13, fontFamily: FONTS.medium, color: T.ink2 },
  chipTextActive: { color: '#fff' },

  scanBtn: {
    backgroundColor: T.brand, borderRadius: RADIUS.md, paddingVertical: 16,
    alignItems: 'center', marginTop: 4,
  },
  scanBtnDisabled: { opacity: 0.6 },
  scanBtnText: { fontSize: 16, fontFamily: FONTS.semibold, color: '#FFFFFF' },

  emptyHint: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 24 },
  emptyHintIcon: { fontSize: 52, marginBottom: 16 },
  emptyHintText: {
    fontSize: 15, fontFamily: FONTS.regular, color: T.ink3,
    textAlign: 'center', lineHeight: 22,
  },

  // OCR result sheet (shared)
  resultOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  resultSheet: {
    backgroundColor: T.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 24, paddingHorizontal: 20, paddingBottom: 36,
    maxHeight: '80%',
  },
  resultHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
  resultIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: T.brandTint, alignItems: 'center', justifyContent: 'center',
  },
  resultIconWrapWarn: { backgroundColor: '#FFF3CD' },
  resultIcon: { fontSize: 20, color: T.brand },
  resultTitle: { fontSize: 17, fontFamily: FONTS.bold, color: T.ink },
  resultSubtitle: { fontSize: 13, fontFamily: FONTS.regular, color: T.ink3, marginTop: 2 },
  fieldsList: { maxHeight: 240, marginBottom: 4 },
  fieldRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.border,
  },
  fieldLabel: { fontSize: 13, fontFamily: FONTS.regular, color: T.ink3, flex: 1 },
  fieldValue: { fontSize: 14, fontFamily: FONTS.semibold, color: T.ink, flex: 1, textAlign: 'right' },
  saveConfirmRow: {
    backgroundColor: T.brandTint, borderRadius: RADIUS.sm, padding: 10, marginTop: 8, marginBottom: 4,
  },
  saveConfirmText: { fontSize: 13, fontFamily: FONTS.medium, color: T.brand, textAlign: 'center' },
  resultActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  retryBtn: {
    flex: 1, borderWidth: 1.5, borderColor: T.border,
    borderRadius: RADIUS.md, paddingVertical: 13, alignItems: 'center',
  },
  retryBtnText: { fontSize: 15, fontFamily: FONTS.semibold, color: T.ink3 },
  confirmBtn: {
    flex: 2, backgroundColor: T.brand,
    borderRadius: RADIUS.md, paddingVertical: 13, alignItems: 'center',
  },
  confirmBtnDisabled: { opacity: 0.6 },
  confirmBtnText: { fontSize: 15, fontFamily: FONTS.semibold, color: '#FFFFFF' },
});
