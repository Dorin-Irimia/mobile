import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  SectionList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Modal,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useStore from '../store';
import { T, RADIUS, FONTS, SHADOW, SPACING, formatDate, formatCurrency, HIT_SLOP, TOUCH_TARGET } from '../theme';
import { Card, Pill, EmptyState, LoadingView } from '../components/ui';
import AttachmentViewer from '../components/AttachmentViewer';
import { getApiUrl } from '../api/client';

function getMonthKey(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabel(key) {
  const [year, month] = key.split('-');
  const d = new Date(parseInt(year), parseInt(month) - 1, 1);
  const label = d.toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function groupByMonth(items) {
  const map = {};
  items.forEach((entry) => {
    const key = getMonthKey(entry.date);
    if (!map[key]) map[key] = [];
    map[key].push(entry);
  });
  return Object.keys(map)
    .sort((a, b) => b.localeCompare(a))
    .map((key) => ({ title: getMonthLabel(key), data: map[key] }));
}

export default function FuelLogScreen({ navigation }) {
  const { fuelLogs, vehicles, fetchFuelLogs, fetchVehicles, deleteFuelLog } = useStore();
  const user = useStore(s => s.user);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [vehicleFilter, setVehicleFilter] = useState('toate');
  const [detailLog, setDetailLog] = useState(null);
  const [viewerAttachment, setViewerAttachment] = useState(null);
  const apiUrl = getApiUrl();

  const handleDelete = (id) => {
    Alert.alert('Șterge alimentarea', 'Sigur ștergi această alimentare?', [
      { text: 'Anulează', style: 'cancel' },
      {
        text: 'Șterge',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteFuelLog(id);
            setDetailLog(null);
          } catch (e) {
            Alert.alert('Eroare', e?.response?.data?.error || 'Nu s-a putut șterge.');
          }
        },
      },
    ]);
  };

  const load = useCallback(async () => {
    await Promise.all([fetchFuelLogs(), fetchVehicles()]);
  }, [fetchFuelLogs, fetchVehicles]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const filtered = fuelLogs.filter(
    (f) => vehicleFilter === 'toate' || f.vehicleId === vehicleFilter,
  );

  const totalLiters = filtered.reduce((s, f) => s + Number(f.liters), 0);
  const totalSpent = filtered.reduce((s, f) => s + Number(f.liters) * Number(f.pricePerL), 0);
  const avgPrice =
    filtered.length > 0
      ? filtered.reduce((s, f) => s + Number(f.pricePerL), 0) / filtered.length
      : 0;

  let avgConsumption = null;
  if (filtered.length >= 2) {
    const kms = filtered.map((f) => Number(f.km)).filter((k) => !isNaN(k) && k > 0);
    if (kms.length >= 2) {
      const kmMax = Math.max(...kms);
      const kmMin = Math.min(...kms);
      const dist = kmMax - kmMin;
      if (dist > 0) {
        avgConsumption = (totalLiters / dist) * 100;
      }
    }
  }

  const sections = groupByMonth(filtered);

  const renderItem = ({ item }) => {
    const vehicle = vehicles.find((v) => v.id === item.vehicleId);
    const total = Number(item.liters) * Number(item.pricePerL);
    const attCount = (item.attachments || []).length;
    return (
      <TouchableOpacity onPress={() => setDetailLog(item)} activeOpacity={0.85}>
        <Card style={styles.fuelCard} padded={false}>
          <View style={styles.fuelInner}>
            <View style={styles.fuelLeft}>
              <Text style={styles.fuelIcon}>⛽</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.fuelDate}>
                  {formatDate(item.date)}{item.time ? ` · ${item.time}` : ''}
                </Text>
                {item.station ? <Text style={styles.fuelStation}>{item.station}</Text> : null}
                {vehicle ? <Text style={styles.fuelVehicle}>{vehicle.plate}</Text> : null}
                {attCount > 0 && (
                  <View style={styles.attBadgeRow}>
                    <View style={styles.attBadge}>
                      <Text style={styles.attBadgeText}>📎 {attCount}</Text>
                    </View>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.fuelMid}>
              <Text style={styles.fuelAmount}>{Number(item.liters).toFixed(2)}L</Text>
              <Text style={styles.fuelPrice}>@ {Number(item.pricePerL).toFixed(2)} RON/L</Text>
            </View>
            <View style={styles.fuelRight}>
              <Text style={styles.fuelTotal}>{formatCurrency(total, 'RON')}</Text>
              {item.km ? <Text style={styles.fuelKm}>{Number(item.km).toLocaleString()} km</Text> : null}
              <Pill
                color={item.fullTank ? T.success : T.warn}
                bg={item.fullTank ? T.successTint : T.warnTint}
                style={styles.fuelPill}
              >
                {item.fullTank ? 'Plin' : 'Parțial'}
              </Pill>
            </View>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = ({ section }) => (
    <Text style={styles.sectionTitle}>{section.title}</Text>
  );

  if (loading) return <LoadingView />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Jurnal Combustibil</Text>
        <View style={styles.headerRight} />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.brand} />
        }
        ListHeaderComponent={
          <View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.vehicleRow}
              style={styles.vehicleScroll}
            >
              <TouchableOpacity
                style={[styles.vehicleChip, vehicleFilter === 'toate' && styles.vehicleChipActive]}
                onPress={() => setVehicleFilter('toate')}
              >
                <Text style={[styles.vehicleChipText, vehicleFilter === 'toate' && styles.vehicleChipTextActive]}>
                  Toate
                </Text>
              </TouchableOpacity>
              {vehicles.map((v) => (
                <TouchableOpacity
                  key={v.id}
                  style={[styles.vehicleChip, vehicleFilter === v.id && styles.vehicleChipActive]}
                  onPress={() => setVehicleFilter(v.id)}
                >
                  <Text style={[styles.vehicleChipText, vehicleFilter === v.id && styles.vehicleChipTextActive]}>
                    {v.plate}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Card style={styles.statsCard}>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{totalLiters.toFixed(1)}L</Text>
                  <Text style={styles.statLabel}>Total litri</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{formatCurrency(totalSpent, 'RON')}</Text>
                  <Text style={styles.statLabel}>Total cheltuieli</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{avgPrice.toFixed(2)}</Text>
                  <Text style={styles.statLabel}>RON/L mediu</Text>
                </View>
              </View>
              {avgConsumption !== null && (
                <View style={styles.consumptionWrap}>
                  <View style={styles.consumptionInner}>
                    <Text style={styles.consumptionIcon}>📊</Text>
                    <Text style={styles.consumptionLabel}>Consum mediu:</Text>
                    <Text style={styles.consumptionValue}>{avgConsumption.toFixed(1)} L/100km</Text>
                  </View>
                </View>
              )}
            </Card>

            {sections.length === 0 && (
              <EmptyState
                icon="⛽"
                title="Nicio alimentare"
                subtitle="Apasă + pentru a înregistra prima alimentare"
              />
            )}
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddFuel')}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <FuelDetailModal
        log={detailLog}
        vehicle={detailLog ? vehicles.find(v => v.id === detailLog.vehicleId) : null}
        onClose={() => setDetailLog(null)}
        onOpenAttachment={setViewerAttachment}
        onEdit={() => {
          if (!detailLog) return;
          const id = detailLog.id;
          setDetailLog(null);
          navigation.navigate('EditFuel', { fuelLogId: id });
        }}
        onDelete={handleDelete}
        canEdit={detailLog && (detailLog.userId === user?.id || vehicles.find(v => v.id === detailLog.vehicleId)?.isOwner)}
        apiUrl={apiUrl}
      />

      <AttachmentViewer
        visible={!!viewerAttachment}
        attachment={viewerAttachment}
        onClose={() => setViewerAttachment(null)}
      />
    </SafeAreaView>
  );
}

function FuelDetailModal({ log, vehicle, onClose, onOpenAttachment, onEdit, onDelete, canEdit, apiUrl }) {
  if (!log) return null;
  const total = Number(log.liters) * Number(log.pricePerL);
  const customEntries = log.customFields ? Object.entries(log.customFields) : [];

  return (
    <Modal
      visible={!!log}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalSafe}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Alimentare</Text>
          <TouchableOpacity onPress={onClose} hitSlop={HIT_SLOP}>
            <Text style={styles.modalClose}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.modalContent}>
          <View style={styles.modalAmountBox}>
            <Text style={styles.modalAmount}>{formatCurrency(total, 'RON')}</Text>
            <Text style={styles.modalAmountSub}>
              {Number(log.liters).toFixed(2)} L @ {Number(log.pricePerL).toFixed(2)} RON/L
            </Text>
          </View>

          <DetailRow label="Vehicul" value={vehicle ? `${vehicle.plate} · ${vehicle.brand} ${vehicle.model}` : '—'} />
          <DetailRow label="Data" value={`${formatDate(log.date)}${log.time ? ` · ${log.time}` : ''}`} />
          <DetailRow label="Kilometraj" value={`${Number(log.km).toLocaleString('ro-RO')} km`} />
          {log.station && <DetailRow label="Benzinărie" value={log.station} />}
          {log.fuelType && <DetailRow label="Tip combustibil" value={log.fuelType} />}
          {log.location && <DetailRow label="Locație" value={log.location} multiline />}
          <DetailRow label="Plin complet" value={log.fullTank ? 'Da' : 'Nu (parțial)'} />
          {log.notes && <DetailRow label="Notițe" value={log.notes} multiline />}

          {customEntries.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>CÂMPURI PERSONALIZATE</Text>
              {customEntries.map(([k, v]) => (
                <DetailRow key={k} label={k} value={String(v ?? '')} />
              ))}
            </>
          )}

          {log.attachments && log.attachments.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>ATAȘAMENTE ({log.attachments.length})</Text>
              <View style={styles.attachGrid}>
                {log.attachments.map(att => {
                  const isImage = att.kind === 'image' || (att.mimeType || '').startsWith('image/');
                  const fullUrl = att.fileUrl.startsWith('http') ? att.fileUrl : `${apiUrl}${att.fileUrl}`;
                  return (
                    <TouchableOpacity
                      key={att.id}
                      style={styles.attTile}
                      onPress={() => onOpenAttachment(att)}
                      activeOpacity={0.8}
                    >
                      {isImage ? (
                        <Image source={{ uri: fullUrl }} style={styles.attImage} />
                      ) : (
                        <View style={styles.attIcon}>
                          <Text style={styles.attIconText}>{att.kind === 'pdf' ? '📄' : '📎'}</Text>
                        </View>
                      )}
                      <Text style={styles.attName} numberOfLines={1}>{att.fileName}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {canEdit && (
            <>
              <TouchableOpacity
                style={styles.editBtn}
                onPress={onEdit}
                activeOpacity={0.85}
              >
                <Text style={styles.editBtnText}>✏️ Editează alimentarea</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => onDelete(log.id)}
                activeOpacity={0.85}
              >
                <Text style={styles.deleteBtnText}>🗑️ Șterge alimentarea</Text>
              </TouchableOpacity>
            </>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function DetailRow({ label, value, multiline }) {
  if (!value) return null;
  return (
    <View style={[styles.detailRow, multiline && styles.detailRowMultiline]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 22, color: T.ink, fontWeight: FONTS.medium },
  headerTitle: { fontSize: 18, fontWeight: FONTS.bold, color: T.ink },
  headerRight: { width: 36 },
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  vehicleScroll: { marginBottom: 12 },
  vehicleRow: { gap: 8, paddingBottom: 4 },
  vehicleChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: T.card,
    borderWidth: 1.5,
    borderColor: T.line,
  },
  vehicleChipActive: { backgroundColor: T.brand, borderColor: T.brand },
  vehicleChipText: { fontSize: 13, fontWeight: FONTS.medium, color: T.ink2 },
  vehicleChipTextActive: { color: '#fff' },
  statsCard: { marginBottom: 16 },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: FONTS.bold, color: T.ink, marginBottom: 3 },
  statLabel: { fontSize: 11, color: T.ink3, textAlign: 'center' },
  statDivider: { width: 1, height: 36, backgroundColor: T.line },
  consumptionWrap: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: T.line,
  },
  consumptionInner: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  consumptionIcon: { fontSize: 14 },
  consumptionLabel: { fontSize: 13, color: T.ink3, fontWeight: FONTS.medium },
  consumptionValue: { fontSize: 14, fontWeight: FONTS.bold, color: T.brand },
  sectionTitle: {
    fontSize: 12,
    fontWeight: FONTS.semibold,
    color: T.ink3,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 16,
    marginBottom: 8,
  },
  fuelCard: { marginBottom: 10, borderRadius: RADIUS.md },
  fuelInner: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  fuelLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1.2 },
  fuelIcon: { fontSize: 22 },
  fuelDate: { fontSize: 13, fontWeight: FONTS.semibold, color: T.ink },
  fuelStation: { fontSize: 12, color: T.ink3, marginTop: 1 },
  fuelVehicle: { fontSize: 11, color: T.ink4, marginTop: 1 },
  fuelMid: { flex: 1, alignItems: 'center' },
  fuelAmount: { fontSize: 14, fontWeight: FONTS.bold, color: T.ink },
  fuelPrice: { fontSize: 11, color: T.ink3, marginTop: 2 },
  fuelRight: { alignItems: 'flex-end', gap: 4 },
  fuelTotal: { fontSize: 15, fontWeight: FONTS.bold, color: T.ink },
  fuelKm: { fontSize: 11, color: T.ink3 },
  fuelPill: { marginTop: 2 },
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: RADIUS.full,
    backgroundColor: T.brand,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.lg,
  },
  fabText: { color: '#fff', fontSize: 28, fontWeight: FONTS.bold, lineHeight: 32 },
  attBadgeRow: { flexDirection: 'row', marginTop: 4 },
  attBadge: {
    backgroundColor: T.line2,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  attBadgeText: { fontSize: 10, color: T.ink2, fontWeight: FONTS.medium },

  // Detail modal
  modalSafe: { flex: 1, backgroundColor: T.bg },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
    backgroundColor: T.card,
  },
  modalTitle: { fontSize: 17, fontWeight: FONTS.bold, color: T.ink },
  modalClose: { fontSize: 20, color: T.ink3, padding: 4 },
  modalContent: { padding: SPACING.xl, gap: SPACING.sm },
  modalAmountBox: {
    backgroundColor: T.brand,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    marginBottom: SPACING.lg,
    ...SHADOW.sm,
  },
  modalAmount: { fontSize: 32, color: '#fff', fontWeight: FONTS.bold, marginBottom: 4 },
  modalAmountSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  detailRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: T.line2,
  },
  detailRowMultiline: { flexDirection: 'column', gap: 4 },
  detailLabel: { width: 130, fontSize: 13, color: T.ink3, fontWeight: FONTS.medium },
  detailValue: { flex: 1, fontSize: 14, color: T.ink, fontWeight: FONTS.semibold, textAlign: 'right' },
  sectionLabel: {
    fontSize: 11,
    color: T.ink3,
    fontWeight: FONTS.bold,
    letterSpacing: 0.8,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  attachGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  attTile: {
    width: 100,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: RADIUS.md,
    padding: 6,
  },
  attImage: { width: '100%', height: 88, borderRadius: RADIUS.sm, backgroundColor: T.line2 },
  attIcon: {
    width: '100%',
    height: 88,
    borderRadius: RADIUS.sm,
    backgroundColor: T.line2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attIconText: { fontSize: 32 },
  attName: { fontSize: 11, color: T.ink, marginTop: 4, fontWeight: FONTS.medium },
  editBtn: {
    marginTop: SPACING.xl,
    backgroundColor: T.brand,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    ...SHADOW.sm,
  },
  editBtnText: { color: '#fff', fontSize: 15, fontWeight: FONTS.bold },
  deleteBtn: {
    marginTop: SPACING.md,
    backgroundColor: T.dangerTint,
    borderWidth: 1.5,
    borderColor: T.danger,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  deleteBtnText: { color: T.danger, fontSize: 15, fontWeight: FONTS.bold },
});
