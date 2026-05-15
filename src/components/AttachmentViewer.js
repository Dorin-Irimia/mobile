import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { T, RADIUS, FONTS, SPACING, HIT_SLOP, TOUCH_TARGET } from '../theme';
import { getApiUrl } from '../api/client';

export default function AttachmentViewer({ visible, attachment, onClose }) {
  const [busy, setBusy] = useState(false);
  if (!attachment) return null;

  const apiUrl = getApiUrl();
  const fullUrl = attachment.fileUrl?.startsWith('http') || attachment.fileUrl?.startsWith('file:')
    ? attachment.fileUrl
    : `${apiUrl}${attachment.fileUrl}`;
  const isImage = attachment.kind === 'image' || (attachment.mimeType || '').startsWith('image/');
  const { width, height } = Dimensions.get('window');

  const downloadToFile = async () => {
    const safeName = (attachment.fileName || 'fisier').replace(/[^\w.\-]/g, '_');
    const dest = `${FileSystem.cacheDirectory}${Date.now()}-${safeName}`;
    const result = await FileSystem.downloadAsync(fullUrl, dest);
    return result.uri;
  };

  const handleShare = async () => {
    setBusy(true);
    try {
      const uri = await downloadToFile();
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: attachment.mimeType,
          dialogTitle: attachment.fileName,
        });
      } else {
        Alert.alert('Descărcat', `Salvat în: ${uri}`);
      }
    } catch (e) {
      Alert.alert('Eroare', 'Nu s-a putut descărca fișierul.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={onClose} hitSlop={HIT_SLOP}>
            <Text style={styles.headerBtnText}>✕</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>{attachment.fileName}</Text>
            <Text style={styles.headerSub}>
              {(attachment.fileSize / 1024).toFixed(0)} KB · {attachment.mimeType}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={handleShare}
            disabled={busy}
            hitSlop={HIT_SLOP}
          >
            {busy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.headerBtnText}>⇪</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          {isImage ? (
            <Image
              source={{ uri: fullUrl }}
              style={{ width, height: height - 200 }}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.nonImageBox}>
              <Text style={styles.nonImageIcon}>
                {attachment.kind === 'pdf' ? '📄' : '📎'}
              </Text>
              <Text style={styles.nonImageTitle}>{attachment.fileName}</Text>
              <Text style={styles.nonImageSub}>
                Fișierele {attachment.kind === 'pdf' ? 'PDF' : 'de acest tip'} se deschid în aplicația implicită.
              </Text>
              <TouchableOpacity
                style={styles.openBtn}
                onPress={handleShare}
                disabled={busy}
                activeOpacity={0.85}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.openBtnText}>📂 Deschide / Descarcă</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.footerBtn}
            onPress={handleShare}
            disabled={busy}
            activeOpacity={0.85}
          >
            <Text style={styles.footerBtnText}>
              {busy ? 'Se descarcă…' : '💾 Salvează / Trimite mai departe'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.md,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  headerBtn: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: TOUCH_TARGET / 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  headerBtnText: { color: '#fff', fontSize: 20, fontWeight: FONTS.bold },
  headerCenter: { flex: 1 },
  headerTitle: { color: '#fff', fontSize: 15, fontWeight: FONTS.semibold },
  headerSub: { color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 2 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },
  nonImageBox: {
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  nonImageIcon: { fontSize: 96, marginBottom: SPACING.lg },
  nonImageTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: FONTS.bold,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  nonImageSub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    lineHeight: 18,
  },
  openBtn: {
    backgroundColor: T.brand,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    minHeight: 50,
    justifyContent: 'center',
  },
  openBtnText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 15 },
  footer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  footerBtn: {
    backgroundColor: T.brand,
    height: 50,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBtnText: { color: '#fff', fontSize: 15, fontWeight: FONTS.bold },
});
