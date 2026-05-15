import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { T, RADIUS, FONTS, SPACING, TOUCH_TARGET, HIT_SLOP } from '../theme';
import { getApiUrl } from '../api/client';

function fileIcon(kind, mime) {
  if (kind === 'image' || (mime || '').startsWith('image/')) return '🖼️';
  if (kind === 'pdf' || mime === 'application/pdf') return '📄';
  if (kind === 'doc' || (mime || '').includes('officedocument') || (mime || '').includes('msword')) return '📝';
  return '📎';
}

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function AttachmentsField({
  /** Existing remote attachments (with id, fileUrl, fileName, kind, mimeType, fileSize) */
  existing = [],
  /** Newly selected local files (with uri, name, mimeType, size) */
  selected = [],
  onSelectedChange,
  /** Called when user wants to remove a saved attachment */
  onRemoveExisting,
  /** Open a saved attachment (e.g., navigate to viewer) */
  onOpenExisting,
  /** Max total attachments (existing + selected) */
  maxFiles = 10,
  disabled,
}) {
  const [loading, setLoading] = useState(false);
  const apiUrl = getApiUrl();

  const totalCount = existing.length + selected.length;
  const remaining = Math.max(0, maxFiles - totalCount);

  const addAssets = (assets) => {
    const mapped = assets.slice(0, remaining).map(a => ({
      uri: a.uri,
      name: a.name || a.fileName || a.uri.split('/').pop() || 'fisier',
      mimeType: a.mimeType || a.type || 'application/octet-stream',
      size: a.size || a.fileSize || 0,
      kind: (a.mimeType || a.type || '').startsWith('image/') ? 'image' : 'other',
    }));
    onSelectedChange([...selected, ...mapped]);
  };

  const showSourcePicker = () => {
    Alert.alert('Adaugă fișier', 'Alege sursa', [
      { text: 'Anulează', style: 'cancel' },
      { text: '📷 Cameră', onPress: pickFromCamera },
      { text: '🖼 Galerie', onPress: pickFromGallery },
      { text: '📄 Document (PDF, doc)', onPress: pickDocument },
    ]);
  };

  const pickFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permisiune', 'Acordă acces la cameră în setări.');
      return;
    }
    setLoading(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.length) {
        addAssets(result.assets);
      }
    } finally {
      setLoading(false);
    }
  };

  const pickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permisiune', 'Acordă acces la galerie în setări.');
      return;
    }
    setLoading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.length) {
        addAssets(result.assets);
      }
    } finally {
      setLoading(false);
    }
  };

  const pickDocument = async () => {
    setLoading(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/*'],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.length) {
        addAssets(result.assets);
      }
    } finally {
      setLoading(false);
    }
  };

  const removeSelected = (idx) => {
    onSelectedChange(selected.filter((_, i) => i !== idx));
  };

  const renderExistingItem = (att) => {
    const isImage = att.kind === 'image' || (att.mimeType || '').startsWith('image/');
    const fullUrl = att.fileUrl.startsWith('http') ? att.fileUrl : `${apiUrl}${att.fileUrl}`;
    return (
      <TouchableOpacity
        key={att.id}
        style={styles.tile}
        onPress={() => onOpenExisting && onOpenExisting(att)}
        activeOpacity={0.8}
      >
        {isImage ? (
          <Image source={{ uri: fullUrl }} style={styles.tileImage} />
        ) : (
          <View style={styles.tileIcon}>
            <Text style={styles.tileIconText}>{fileIcon(att.kind, att.mimeType)}</Text>
            <Text style={styles.tileExt} numberOfLines={1}>
              {att.fileName?.split('.').pop()?.toUpperCase() || 'FILE'}
            </Text>
          </View>
        )}
        <Text style={styles.tileName} numberOfLines={1}>{att.fileName}</Text>
        <Text style={styles.tileSize}>{formatSize(att.fileSize)}</Text>
        {onRemoveExisting && !disabled && (
          <TouchableOpacity
            style={styles.tileRemove}
            onPress={() => onRemoveExisting(att)}
            hitSlop={HIT_SLOP}
          >
            <Text style={styles.tileRemoveText}>✕</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const renderSelectedItem = (asset, idx) => {
    const isImage = (asset.mimeType || '').startsWith('image/');
    return (
      <View key={`sel-${idx}`} style={[styles.tile, styles.tilePending]}>
        {isImage ? (
          <Image source={{ uri: asset.uri }} style={styles.tileImage} />
        ) : (
          <View style={styles.tileIcon}>
            <Text style={styles.tileIconText}>{fileIcon('other', asset.mimeType)}</Text>
            <Text style={styles.tileExt} numberOfLines={1}>
              {asset.name?.split('.').pop()?.toUpperCase() || 'FILE'}
            </Text>
          </View>
        )}
        <Text style={styles.tileName} numberOfLines={1}>{asset.name}</Text>
        <Text style={styles.tileSize}>{formatSize(asset.size)} · nou</Text>
        <TouchableOpacity
          style={styles.tileRemove}
          onPress={() => removeSelected(idx)}
          hitSlop={HIT_SLOP}
        >
          <Text style={styles.tileRemoveText}>✕</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>Atașamente ({totalCount}/{maxFiles})</Text>
        {remaining > 0 && !disabled && (
          <TouchableOpacity
            style={[styles.addBtn, loading && { opacity: 0.6 }]}
            onPress={showSourcePicker}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={T.brand} size="small" />
            ) : (
              <Text style={styles.addBtnText}>+ Adaugă</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {totalCount === 0 ? (
        <TouchableOpacity
          style={styles.dropZone}
          onPress={showSourcePicker}
          activeOpacity={0.7}
          disabled={disabled}
        >
          <Text style={styles.dropZoneIcon}>📎</Text>
          <Text style={styles.dropZoneText}>Atinge pentru a adăuga{'\n'}poze, PDF-uri sau documente</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.grid}>
          {existing.map(renderExistingItem)}
          {selected.map(renderSelectedItem)}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: SPACING.sm },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  label: { fontSize: 13, fontWeight: FONTS.semibold, color: T.ink2 },
  addBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    backgroundColor: T.brandTint,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: T.brand + '40',
    minHeight: 32,
    justifyContent: 'center',
  },
  addBtnText: { color: T.brand, fontSize: 13, fontWeight: FONTS.semibold },
  dropZone: {
    borderWidth: 1.5,
    borderColor: T.line,
    borderStyle: 'dashed',
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
    backgroundColor: T.bgSoft,
  },
  dropZoneIcon: { fontSize: 28, marginBottom: 6 },
  dropZoneText: { color: T.ink3, fontSize: 12, textAlign: 'center', lineHeight: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  tile: {
    width: 100,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: RADIUS.md,
    padding: 6,
    position: 'relative',
  },
  tilePending: {
    borderColor: T.brand,
    borderStyle: 'dashed',
    backgroundColor: T.brandTint,
  },
  tileImage: {
    width: '100%',
    height: 88,
    borderRadius: RADIUS.sm,
    backgroundColor: T.line2,
  },
  tileIcon: {
    width: '100%',
    height: 88,
    borderRadius: RADIUS.sm,
    backgroundColor: T.line2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tileIconText: { fontSize: 28 },
  tileExt: { fontSize: 9, color: T.ink3, fontWeight: FONTS.bold },
  tileName: { fontSize: 11, color: T.ink, marginTop: 4, fontWeight: FONTS.medium },
  tileSize: { fontSize: 10, color: T.ink4 },
  tileRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: T.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  tileRemoveText: { color: '#fff', fontSize: 11, fontWeight: FONTS.bold, lineHeight: 13 },
});
