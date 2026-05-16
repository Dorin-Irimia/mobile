import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  StyleSheet,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import useStore from '../store';
import {
  T,
  FONTS,
  RADIUS,
  SHADOW,
  SPACING,
  formatDate,
  daysUntil,
  useResponsive,
  useSafeBottomPadding,
  HIT_SLOP,
  HIT_SLOP_LG,
  TOUCH_TARGET,
} from '../theme';
import { Card, EmptyState, LoadingView, StatusBadge, PrimaryButton } from '../components/ui';
import AttachmentViewer from '../components/AttachmentViewer';
import DateField from '../components/DateField';
import SourcePickerSheet from '../components/SourcePickerSheet';
import { getApiUrl } from '../api/client';

const EMOJI_OPTIONS = ['📁', '📂', '🗂', '🔧', '🛡️', '🔰', '🛣️', '🪪', '🧾', '📋', '📄', '🛠️', '⚙️', '🔑', '📜', '✍️'];

function fileIcon(doc) {
  const mime = doc.mimeType || '';
  if (mime.startsWith('image/')) return '🖼️';
  if (mime === 'application/pdf') return '📄';
  if (mime.includes('word') || mime.includes('officedocument.wordprocessingml')) return '📝';
  if (mime.includes('sheet') || mime.includes('excel') || mime.includes('spreadsheet')) return '📊';
  if (mime.includes('presentation')) return '📊';
  if (mime.startsWith('text/')) return '📃';
  if (mime.startsWith('video/')) return '🎬';
  if (mime.startsWith('audio/')) return '🎵';
  return '📎';
}

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const VEHICLE_FIELD_LABELS = {
  itpDate: 'ITP',
  rcaDate: 'RCA',
  cascoDate: 'CASCO',
  rovDate: 'Rovinietă',
};

export default function DocumentsScreen({ navigation }) {
  const documents = useStore(s => s.documents);
  const folders = useStore(s => s.folders);
  const vehicles = useStore(s => s.vehicles);
  const user = useStore(s => s.user);
  const selectedVehicleIdGlobal = useStore(s => s.selectedVehicleId);
  const fetchDocuments = useStore(s => s.fetchDocuments);
  const fetchFolders = useStore(s => s.fetchFolders);
  const fetchVehicles = useStore(s => s.fetchVehicles);
  const addDocument = useStore(s => s.addDocument);
  const updateDocument = useStore(s => s.updateDocument);
  const deleteDocument = useStore(s => s.deleteDocument);
  const createFolder = useStore(s => s.createFolder);
  const deleteFolder = useStore(s => s.deleteFolder);
  const updateVehicle = useStore(s => s.updateVehicle);

  const { isTablet, hPad, maxContentWidth } = useResponsive();
  const safeBottom = useSafeBottomPadding(28);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [vehicleFilter, setVehicleFilter] = useState(selectedVehicleIdGlobal || 'all');
  const [openFolderId, setOpenFolderId] = useState(null);    // null = root level

  // Când utilizatorul schimbă vehiculul activ pe Home, re-aplicăm filtrul aici
  useEffect(() => {
    if (selectedVehicleIdGlobal) setVehicleFilter(selectedVehicleIdGlobal);
  }, [selectedVehicleIdGlobal]);

  const [viewerDoc, setViewerDoc] = useState(null);

  // Add doc modal
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [addingDocLoading, setAddingDocLoading] = useState(false);
  const [docName, setDocName] = useState('');
  const [docFile, setDocFile] = useState(null);
  const [docExpiry, setDocExpiry] = useState('');
  const [docVehicleId, setDocVehicleId] = useState(null);
  const [docFolderId, setDocFolderId] = useState(null);
  const [docNotes, setDocNotes] = useState('');

  // Add folder modal
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [folderIcon, setFolderIcon] = useState('📁');
  const [folderVehicleId, setFolderVehicleId] = useState(null);

  // Source picker
  const [sourceSheetVisible, setSourceSheetVisible] = useState(false);

  // Sync prompt
  const [syncPrompt, setSyncPrompt] = useState(null); // { docId, field, oldDate, newDate, vehicleId, plate }

  const apiUrl = getApiUrl();

  const load = useCallback(async () => {
    await Promise.all([
      fetchDocuments(),
      fetchFolders(),
      fetchVehicles(),
    ]);
  }, [fetchDocuments, fetchFolders, fetchVehicles]);

  useEffect(() => {
    (async () => { await load(); setLoading(false); })();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // Build filtered folder list based on vehicle filter
  const visibleFolders = useMemo(() => {
    return (folders || []).filter(f => {
      if (vehicleFilter === 'all') return true;
      if (vehicleFilter === 'personal') return !f.vehicleId;
      return f.vehicleId === vehicleFilter;
    });
  }, [folders, vehicleFilter]);

  // Documents in current folder
  const openFolder = useMemo(
    () => folders.find(f => f.id === openFolderId),
    [folders, openFolderId],
  );

  const currentDocs = useMemo(() => {
    if (openFolderId) return documents.filter(d => d.folderId === openFolderId);
    // Root: show docs without folder + docs filtered by vehicle
    return documents.filter(d => {
      if (vehicleFilter === 'all') return !d.folderId;
      if (vehicleFilter === 'personal') return !d.vehicleId && !d.folderId;
      return d.vehicleId === vehicleFilter && !d.folderId;
    });
  }, [documents, openFolderId, vehicleFilter]);

  const docsByFolder = useMemo(() => {
    const map = {};
    documents.forEach(d => {
      if (d.folderId) {
        if (!map[d.folderId]) map[d.folderId] = 0;
        map[d.folderId] += 1;
      }
    });
    return map;
  }, [documents]);

  // Pick file (any type) — folosim un bottom sheet pentru a fi sigur că toate cele 3 opțiuni
  // sunt vizibile (Alert.alert pe iOS uneori se taie la 4 butoane)
  const pickFile = () => setSourceSheetVisible(true);

  const pickFromCamera = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return Alert.alert('Permisiune', 'Acordă acces la cameră.');
      const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
      if (!result.canceled && result.assets?.length) setDocFileFromAsset(result.assets[0]);
    } catch (e) {
      Alert.alert('Eroare', 'Nu s-a putut deschide camera.');
    }
  };
  const pickFromGallery = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return Alert.alert('Permisiune', 'Acordă acces la galerie.');
      const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
      if (!result.canceled && result.assets?.length) setDocFileFromAsset(result.assets[0]);
    } catch (e) {
      Alert.alert('Eroare', 'Nu s-a putut deschide galeria.');
    }
  };
  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (!result.canceled && result.assets?.length) setDocFileFromAsset(result.assets[0]);
    } catch (e) {
      Alert.alert('Eroare', 'Nu s-a putut deschide selectorul de documente. Încearcă din nou sau folosește camera/galeria.');
    }
  };
  const setDocFileFromAsset = (a) => {
    const name = a.name || a.fileName || a.uri.split('/').pop() || 'fisier';
    const mimeType = a.mimeType || a.type || 'application/octet-stream';
    setDocFile({ uri: a.uri, name, mimeType, size: a.size || a.fileSize || 0 });
    if (!docName) setDocName(name.replace(/\.[^/.]+$/, '')); // strip extension
  };

  const resetDocForm = () => {
    setDocName('');
    setDocFile(null);
    setDocExpiry('');
    setDocVehicleId(null);
    setDocFolderId(null);
    setDocNotes('');
  };

  const handleSaveDoc = async () => {
    if (!docName.trim()) return Alert.alert('Nume', 'Introdu un nume.');
    if (!docFile) return Alert.alert('Fișier', 'Alege un fișier de încărcat.');

    setAddingDocLoading(true);
    try {
      const fd = new FormData();
      fd.append('name', docName.trim());
      if (docVehicleId) fd.append('vehicleId', docVehicleId);
      if (docFolderId) fd.append('folderId', docFolderId);
      if (docExpiry) fd.append('expiryDate', docExpiry);
      if (docNotes.trim()) fd.append('notes', docNotes.trim());

      // If folder is system, the type is derived server-side. Otherwise default 'other'.
      const folder = folders.find(f => f.id === docFolderId);
      if (folder?.systemType) {
        fd.append('type', folder.systemType);
      } else {
        fd.append('type', 'other');
      }

      fd.append('file', {
        uri: docFile.uri,
        name: docFile.name,
        type: docFile.mimeType,
      });

      const saved = await addDocument(fd);
      setShowAddDoc(false);
      resetDocForm();

      // Verifică dacă serverul a sugerat actualizarea datei din vehicul
      if (saved?._suggestedVehicleUpdate) {
        const s = saved._suggestedVehicleUpdate;
        setSyncPrompt({
          docId: saved.id,
          field: s.field,
          oldDate: s.oldDate,
          newDate: s.newDate,
          vehicleId: docVehicleId,
          plate: s.vehiclePlate,
          systemType: s.systemType,
        });
      }
    } catch (e) {
      Alert.alert('Eroare', e?.response?.data?.error || 'Nu s-a putut salva.');
    } finally {
      setAddingDocLoading(false);
    }
  };

  const confirmSyncDate = async () => {
    if (!syncPrompt) return;
    try {
      await updateVehicle(syncPrompt.vehicleId, {
        [syncPrompt.field]: syncPrompt.newDate,
      });
      Alert.alert('Actualizat', `Data ${VEHICLE_FIELD_LABELS[syncPrompt.field] || syncPrompt.field} a fost actualizată pe ${syncPrompt.plate}.`);
    } catch (e) {
      Alert.alert('Eroare', 'Nu s-a putut actualiza vehiculul.');
    } finally {
      setSyncPrompt(null);
    }
  };

  const handleDeleteDoc = (doc) => {
    Alert.alert(
      'Șterge document',
      `Sigur ștergi "${doc.name}"?`,
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Șterge',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDocument(doc.id);
              setViewerDoc(null);
            } catch (e) {
              Alert.alert('Eroare', 'Nu s-a putut șterge.');
            }
          },
        },
      ],
    );
  };

  const handleCreateFolder = async () => {
    if (!folderName.trim()) return Alert.alert('Nume', 'Introdu un nume pentru folder.');
    try {
      await createFolder({
        name: folderName.trim(),
        icon: folderIcon,
        vehicleId: folderVehicleId,
      });
      setShowAddFolder(false);
      setFolderName('');
      setFolderIcon('📁');
      setFolderVehicleId(null);
    } catch (e) {
      Alert.alert('Eroare', e?.response?.data?.error || 'Nu s-a putut crea folderul.');
    }
  };

  const handleDeleteFolder = (folder) => {
    Alert.alert(
      'Șterge folder',
      `Sigur ștergi folderul "${folder.name}"?`,
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Șterge',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFolder(folder.id);
            } catch (e) {
              Alert.alert('Eroare', e?.response?.data?.error || 'Nu s-a putut șterge.');
            }
          },
        },
      ],
    );
  };

  const renderFolderTile = (folder) => {
    const count = docsByFolder[folder.id] || 0;
    const vehiclePlate = folder.vehicleId
      ? vehicles.find(v => v.id === folder.vehicleId)?.plate
      : null;
    return (
      <TouchableOpacity
        key={folder.id}
        style={styles.folderTile}
        onPress={() => setOpenFolderId(folder.id)}
        onLongPress={folder.isSystem ? undefined : () => handleDeleteFolder(folder)}
        activeOpacity={0.8}
      >
        <Text style={styles.folderIcon}>{folder.icon || '📁'}</Text>
        <Text style={styles.folderName} numberOfLines={2}>{folder.name}</Text>
        <View style={styles.folderMeta}>
          <Text style={styles.folderCount}>{count} fișier{count !== 1 ? 'e' : ''}</Text>
          {vehiclePlate && <Text style={styles.folderVehicle}>{vehiclePlate}</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  const canDeleteDoc = (doc) => {
    if (!doc) return false;
    if (doc.userId === user?.id) return true; // autorul poate șterge
    if (!doc.vehicleId) return false;
    const v = vehicles.find(veh => veh.id === doc.vehicleId);
    return !!v?.isOwner; // owner-ul vehiculului poate șterge orice
  };

  const renderDocItem = (doc) => {
    const days = doc.expiryDate ? daysUntil(doc.expiryDate) : null;
    const isImage = (doc.mimeType || '').startsWith('image/');
    const fullUrl = doc.fileUrl?.startsWith('http') ? doc.fileUrl : `${apiUrl}${doc.fileUrl || ''}`;
    const canDelete = canDeleteDoc(doc);
    return (
      <TouchableOpacity
        key={doc.id}
        style={styles.docRow}
        onPress={() => setViewerDoc(doc)}
        onLongPress={canDelete ? () => handleDeleteDoc(doc) : undefined}
        activeOpacity={0.85}
      >
        {isImage && doc.fileUrl ? (
          <Image source={{ uri: fullUrl }} style={styles.docThumb} />
        ) : (
          <View style={styles.docThumbIcon}>
            <Text style={{ fontSize: 26 }}>{fileIcon(doc)}</Text>
          </View>
        )}
        <View style={{ flex: 1, marginLeft: SPACING.md }}>
          <Text style={styles.docName} numberOfLines={1}>{doc.name}</Text>
          {doc.fileName && doc.fileName !== doc.name ? (
            <Text style={styles.docFile} numberOfLines={1}>{doc.fileName}</Text>
          ) : null}
          <View style={styles.docMeta}>
            <Text style={styles.docMetaText}>{formatSize(doc.fileSize)}</Text>
            {doc.expiryDate && (
              <>
                <Text style={styles.dot}>·</Text>
                <Text style={styles.docMetaText}>expiră {formatDate(doc.expiryDate)}</Text>
              </>
            )}
          </View>
        </View>
        {days !== null && <StatusBadge days={days} />}
      </TouchableOpacity>
    );
  };

  if (loading) return <LoadingView />;

  const ownedVehicles = vehicles.filter(v => v.isOwner !== false);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.header} edges={['top']}>
        <View style={[styles.headerContent, { paddingHorizontal: hPad }]}>
          {openFolderId ? (
            <TouchableOpacity onPress={() => setOpenFolderId(null)} hitSlop={HIT_SLOP_LG}>
              <Text style={styles.headerBack}>← Înapoi</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          <Text style={styles.headerTitle} numberOfLines={1}>
            {openFolder ? `${openFolder.icon || '📁'} ${openFolder.name}` : 'Documente'}
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Search')}
            hitSlop={HIT_SLOP}
            style={{ flex: 1, alignItems: 'flex-end' }}
          >
            <Text style={styles.headerBtnText}>🔍</Text>
          </TouchableOpacity>
        </View>

        {!openFolderId && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.filterRow, { paddingHorizontal: hPad }]}
          >
            <TouchableOpacity
              onPress={() => setVehicleFilter('all')}
              style={[styles.filterChip, vehicleFilter === 'all' && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, vehicleFilter === 'all' && styles.filterTextActive]}>Toate</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setVehicleFilter('personal')}
              style={[styles.filterChip, vehicleFilter === 'personal' && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, vehicleFilter === 'personal' && styles.filterTextActive]}>👤 Personale</Text>
            </TouchableOpacity>
            {vehicles.map(v => (
              <TouchableOpacity
                key={v.id}
                onPress={() => setVehicleFilter(v.id)}
                style={[styles.filterChip, vehicleFilter === v.id && styles.filterChipActive]}
              >
                <Text style={[styles.filterText, vehicleFilter === v.id && styles.filterTextActive]}>
                  {v.plate}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          { paddingHorizontal: hPad, paddingVertical: SPACING.lg, paddingBottom: safeBottom + 80 },
          isTablet && { alignSelf: 'center', width: '100%', maxWidth: maxContentWidth },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.brand} />}
      >
        {/* Folders grid (only at root level) */}
        {!openFolderId && (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>📂 Foldere ({visibleFolders.length})</Text>
              <TouchableOpacity onPress={() => setShowAddFolder(true)} hitSlop={HIT_SLOP}>
                <Text style={styles.sectionAction}>+ Folder nou</Text>
              </TouchableOpacity>
            </View>
            {visibleFolders.length === 0 ? (
              <View style={styles.emptyFolders}>
                <Text style={{ color: T.ink3 }}>Niciun folder. Adaugă unul cu butonul de mai sus.</Text>
              </View>
            ) : (
              <View style={styles.folderGrid}>
                {visibleFolders.map(renderFolderTile)}
              </View>
            )}
          </>
        )}

        {/* Documents */}
        <View style={[styles.sectionRow, { marginTop: SPACING.xl }]}>
          <Text style={styles.sectionTitle}>
            📄 {openFolderId ? 'Documente în folder' : 'Documente fără folder'} ({currentDocs.length})
          </Text>
        </View>

        {currentDocs.length === 0 ? (
          <EmptyState
            icon="📂"
            title={openFolderId ? 'Folderul e gol' : 'Niciun document'}
            subtitle="Apasă + pentru a adăuga primul document."
          />
        ) : (
          <View style={{ gap: SPACING.sm }}>
            {currentDocs.map(renderDocItem)}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, { bottom: safeBottom, right: hPad }]}
        onPress={() => {
          if (openFolder) {
            setDocFolderId(openFolder.id);
            setDocVehicleId(openFolder.vehicleId || null);
          }
          setShowAddDoc(true);
        }}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Add document modal */}
      <Modal
        visible={showAddDoc}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setShowAddDoc(false); resetDocForm(); }}
      >
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Document nou</Text>
              <TouchableOpacity onPress={() => { setShowAddDoc(false); resetDocForm(); }} hitSlop={HIT_SLOP}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Nume document *</Text>
              <TextInput
                style={styles.input}
                value={docName}
                onChangeText={setDocName}
                placeholder='Ex: "RCA 2026"'
                placeholderTextColor={T.ink4}
              />

              <TouchableOpacity
                style={[styles.pickFileBtn, docFile && styles.pickFileBtnActive]}
                onPress={pickFile}
                activeOpacity={0.7}
              >
                {docFile ? (
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickFileText}>📎 {docFile.name}</Text>
                    <Text style={styles.pickFileSub}>{formatSize(docFile.size)} · {docFile.mimeType}</Text>
                  </View>
                ) : (
                  <Text style={styles.pickFileText}>📎 Alege un fișier (foto, PDF, Word, Excel, etc.)</Text>
                )}
                <Text style={styles.pickFileChev}>›</Text>
              </TouchableOpacity>

              <Text style={styles.label}>Vehicul (opțional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                <TouchableOpacity
                  style={[styles.chip, !docVehicleId && styles.chipActive]}
                  onPress={() => { setDocVehicleId(null); setDocFolderId(null); }}
                >
                  <Text style={[styles.chipText, !docVehicleId && styles.chipTextActive]}>Fără vehicul</Text>
                </TouchableOpacity>
                {vehicles.map(v => (
                  <TouchableOpacity
                    key={v.id}
                    style={[styles.chip, docVehicleId === v.id && styles.chipActive]}
                    onPress={() => { setDocVehicleId(v.id); setDocFolderId(null); }}
                  >
                    <Text style={[styles.chipText, docVehicleId === v.id && styles.chipTextActive]}>{v.plate}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.label}>Folder</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                {folders
                  .filter(f => (docVehicleId ? f.vehicleId === docVehicleId : !f.vehicleId))
                  .map(f => (
                    <TouchableOpacity
                      key={f.id}
                      style={[styles.chip, docFolderId === f.id && styles.chipActive]}
                      onPress={() => setDocFolderId(f.id)}
                    >
                      <Text style={[styles.chipText, docFolderId === f.id && styles.chipTextActive]}>
                        {f.icon} {f.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </ScrollView>

              <DateField
                label="Data expirării (opțional)"
                value={docExpiry}
                onChange={setDocExpiry}
                showRelative
                hint='Pentru RCA, ITP, etc., te voi întreba dacă vrei să se actualizeze și data din detaliile vehiculului.'
              />

              <Text style={styles.label}>Notițe (opțional)</Text>
              <TextInput
                style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
                value={docNotes}
                onChangeText={setDocNotes}
                placeholder="Detalii suplimentare"
                placeholderTextColor={T.ink4}
                multiline
              />

              <PrimaryButton
                title="💾 Salvează document"
                onPress={handleSaveDoc}
                loading={addingDocLoading}
                style={{ marginTop: SPACING.xl }}
              />
              <View style={{ height: 40 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Add folder modal */}
      <Modal
        visible={showAddFolder}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddFolder(false)}
      >
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Folder nou</Text>
            <TouchableOpacity onPress={() => setShowAddFolder(false)} hitSlop={HIT_SLOP}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.label}>Nume folder *</Text>
            <TextInput
              style={styles.input}
              value={folderName}
              onChangeText={setFolderName}
              placeholder='Ex: "Acte revizii 2026"'
              placeholderTextColor={T.ink4}
            />

            <Text style={styles.label}>Iconiță</Text>
            <View style={styles.iconGrid}>
              {EMOJI_OPTIONS.map(emoji => (
                <TouchableOpacity
                  key={emoji}
                  style={[styles.iconChoice, folderIcon === emoji && styles.iconChoiceActive]}
                  onPress={() => setFolderIcon(emoji)}
                >
                  <Text style={{ fontSize: 22 }}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Pentru vehicul (opțional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              <TouchableOpacity
                style={[styles.chip, !folderVehicleId && styles.chipActive]}
                onPress={() => setFolderVehicleId(null)}
              >
                <Text style={[styles.chipText, !folderVehicleId && styles.chipTextActive]}>👤 Personal</Text>
              </TouchableOpacity>
              {ownedVehicles.map(v => (
                <TouchableOpacity
                  key={v.id}
                  style={[styles.chip, folderVehicleId === v.id && styles.chipActive]}
                  onPress={() => setFolderVehicleId(v.id)}
                >
                  <Text style={[styles.chipText, folderVehicleId === v.id && styles.chipTextActive]}>{v.plate}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <PrimaryButton title="Creează folder" onPress={handleCreateFolder} style={{ marginTop: SPACING.xl }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Sync prompt */}
      <Modal
        visible={!!syncPrompt}
        transparent
        animationType="fade"
        onRequestClose={() => setSyncPrompt(null)}
      >
        <View style={styles.promptBackdrop}>
          <View style={styles.promptCard}>
            <Text style={styles.promptIcon}>🔄</Text>
            <Text style={styles.promptTitle}>Actualizezi datele vehiculului?</Text>
            <Text style={styles.promptBody}>
              Documentul are data de expirare <Text style={{ fontWeight: FONTS.bold }}>{formatDate(syncPrompt?.newDate)}</Text>,
              {' '}mai târzie decât data {VEHICLE_FIELD_LABELS[syncPrompt?.field] || syncPrompt?.field} din detaliile vehiculului{' '}
              <Text style={{ fontWeight: FONTS.bold }}>{syncPrompt?.plate}</Text>
              {syncPrompt?.oldDate ? ` (${formatDate(syncPrompt.oldDate)})` : ' (nesetată)'}.
              {'\n\n'}Vrei să o actualizez automat?
            </Text>
            <View style={styles.promptActions}>
              <TouchableOpacity style={styles.promptBtnSecondary} onPress={() => setSyncPrompt(null)}>
                <Text style={styles.promptBtnSecondaryText}>Nu acum</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.promptBtnPrimary} onPress={confirmSyncDate}>
                <Text style={styles.promptBtnPrimaryText}>Actualizează</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <AttachmentViewer
        visible={!!viewerDoc}
        attachment={viewerDoc}
        onClose={() => setViewerDoc(null)}
        canDelete={canDeleteDoc(viewerDoc)}
        onDelete={(doc) => handleDeleteDoc(doc)}
      />

      <SourcePickerSheet
        visible={sourceSheetVisible}
        onClose={() => setSourceSheetVisible(false)}
        title="Adaugă fișier"
        options={[
          {
            key: 'camera',
            icon: '📷',
            label: 'Fă o fotografie',
            sub: 'Folosește camera pentru a scana un document',
            onPress: pickFromCamera,
          },
          {
            key: 'gallery',
            icon: '🖼',
            label: 'Alege din galerie',
            sub: 'Selectează o imagine deja existentă',
            onPress: pickFromGallery,
          },
          {
            key: 'document',
            icon: '📄',
            label: 'Caută un document',
            sub: 'PDF, Word, Excel, txt și orice alt tip de fișier',
            onPress: pickDocument,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  header: { backgroundColor: T.brand },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
    minHeight: TOUCH_TARGET,
    gap: SPACING.sm,
  },
  headerBack: { color: '#fff', fontSize: 14, fontWeight: FONTS.medium, flex: 1 },
  headerTitle: { flex: 2, color: '#fff', fontSize: 17, fontWeight: FONTS.bold, textAlign: 'center' },
  headerBtnText: { color: '#fff', fontSize: 18 },
  filterRow: { gap: SPACING.sm, paddingBottom: SPACING.sm },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  filterChipActive: { backgroundColor: '#fff' },
  filterText: { color: '#fff', fontSize: 13, fontWeight: FONTS.medium },
  filterTextActive: { color: T.brand, fontWeight: FONTS.bold },

  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md },
  sectionTitle: { fontSize: 14, fontWeight: FONTS.bold, color: T.ink2, letterSpacing: 0.5 },
  sectionAction: { fontSize: 13, color: T.brand, fontWeight: FONTS.semibold },

  emptyFolders: { padding: SPACING.lg, alignItems: 'center' },
  folderGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  folderTile: {
    width: '47%',
    backgroundColor: T.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    ...SHADOW.sm,
    minHeight: 110,
  },
  folderIcon: { fontSize: 32, marginBottom: 4 },
  folderName: { fontSize: 14, fontWeight: FONTS.bold, color: T.ink, marginBottom: 4 },
  folderMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  folderCount: { fontSize: 11, color: T.ink3 },
  folderVehicle: {
    fontSize: 10,
    color: T.brand,
    fontWeight: FONTS.semibold,
    backgroundColor: T.brandTint,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },

  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    ...SHADOW.sm,
  },
  docThumb: { width: 52, height: 52, borderRadius: RADIUS.md, backgroundColor: T.line2 },
  docThumbIcon: {
    width: 52, height: 52, borderRadius: RADIUS.md, backgroundColor: T.brandTint,
    alignItems: 'center', justifyContent: 'center',
  },
  docName: { fontSize: 15, fontWeight: FONTS.semibold, color: T.ink },
  docFile: { fontSize: 11, color: T.ink4, marginTop: 1 },
  docMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
  docMetaText: { fontSize: 11, color: T.ink3 },
  dot: { fontSize: 11, color: T.ink4 },

  fab: {
    position: 'absolute',
    width: 56, height: 56, borderRadius: RADIUS.full,
    backgroundColor: T.brand, alignItems: 'center', justifyContent: 'center', ...SHADOW.lg,
  },
  fabText: { color: '#fff', fontSize: 30, lineHeight: 34, fontWeight: FONTS.light, marginTop: -2 },

  // Modal
  modalSafe: { flex: 1, backgroundColor: T.bg },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg,
    borderBottomWidth: 1, borderBottomColor: T.line, backgroundColor: T.card,
  },
  modalTitle: { fontSize: 17, fontWeight: FONTS.bold, color: T.ink },
  modalClose: { fontSize: 20, color: T.ink3, padding: 4 },
  modalContent: { padding: SPACING.xl, gap: SPACING.sm },
  label: { fontSize: 13, fontWeight: FONTS.semibold, color: T.ink2, marginTop: SPACING.md, marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: T.line, backgroundColor: T.bgSoft,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 12,
    fontSize: 15, color: T.ink, minHeight: 46,
  },
  pickFileBtn: {
    marginTop: SPACING.md,
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: T.line,
    backgroundColor: T.bgSoft,
    borderRadius: RADIUS.md, padding: SPACING.md,
    minHeight: 60,
  },
  pickFileBtnActive: {
    borderStyle: 'solid',
    borderColor: T.brand,
    backgroundColor: T.brandTint,
  },
  pickFileText: { fontSize: 14, color: T.ink, fontWeight: FONTS.semibold },
  pickFileSub: { fontSize: 11, color: T.ink3, marginTop: 2 },
  pickFileChev: { fontSize: 22, color: T.ink4 },
  chipRow: { paddingVertical: SPACING.sm, gap: 6 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: RADIUS.full, backgroundColor: T.bgSoft,
    borderWidth: 1.5, borderColor: T.line, marginRight: 6,
  },
  chipActive: { backgroundColor: T.brand, borderColor: T.brand },
  chipText: { fontSize: 13, fontWeight: FONTS.medium, color: T.ink2 },
  chipTextActive: { color: '#fff', fontWeight: FONTS.bold },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  iconChoice: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
    backgroundColor: T.bgSoft, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: T.line,
  },
  iconChoiceActive: { borderColor: T.brand, backgroundColor: T.brandTint },

  // Sync prompt
  promptBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  promptCard: {
    backgroundColor: T.card, borderRadius: RADIUS.xl, padding: SPACING.xl,
    alignItems: 'center', ...SHADOW.lg, maxWidth: 380, width: '100%',
  },
  promptIcon: { fontSize: 48, marginBottom: SPACING.md },
  promptTitle: { fontSize: 17, fontWeight: FONTS.bold, color: T.ink, marginBottom: SPACING.sm, textAlign: 'center' },
  promptBody: { fontSize: 14, color: T.ink2, textAlign: 'center', lineHeight: 20 },
  promptActions: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.xl, width: '100%' },
  promptBtnSecondary: {
    flex: 1, paddingVertical: 14, backgroundColor: T.line2,
    borderRadius: RADIUS.md, alignItems: 'center',
  },
  promptBtnSecondaryText: { color: T.ink2, fontWeight: FONTS.semibold, fontSize: 14 },
  promptBtnPrimary: {
    flex: 1, paddingVertical: 14, backgroundColor: T.brand,
    borderRadius: RADIUS.md, alignItems: 'center',
  },
  promptBtnPrimaryText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 14 },
});
