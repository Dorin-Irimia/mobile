import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  SectionList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useStore from '../store';
import {
  T,
  RADIUS,
  FONTS,
  SHADOW,
  SPACING,
  formatDate,
  formatCurrency,
  useResponsive,
  useSafeBottomPadding,
  TOUCH_TARGET,
  HIT_SLOP,
} from '../theme';
import { Card, Pill, EmptyState, LoadingView } from '../components/ui';
import AttachmentViewer from '../components/AttachmentViewer';
import { getApiUrl } from '../api/client';

const CATEGORIES = [
  { key: 'toate', label: 'Toate' },
  { key: 'service', label: 'Service' },
  { key: 'combustibil', label: 'Combustibil' },
  { key: 'asigurare', label: 'Asigurare' },
  { key: 'anvelope', label: 'Anvelope' },
  { key: 'altele', label: 'Altele' },
];

const CAT_META = {
  service: { color: '#3B82F6', bg: '#EFF6FF', label: 'Service' },
  combustibil: { color: T.brand, bg: T.brandTint, label: 'Combustibil' },
  asigurare: { color: T.success, bg: T.successTint, label: 'Asigurare' },
  anvelope: { color: '#8B5CF6', bg: '#F5F3FF', label: 'Anvelope' },
  altele: { color: T.ink3, bg: T.line2, label: 'Altele' },
  piese: { color: T.warn, bg: T.warnTint, label: 'Piese' },
};

function getCatMeta(cat) {
  return CAT_META[cat] || { color: T.ink3, bg: T.line2, label: cat || 'Altele' };
}

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
  items.forEach((inv) => {
    const key = getMonthKey(inv.date);
    if (!map[key]) map[key] = [];
    map[key].push(inv);
  });
  return Object.keys(map)
    .sort((a, b) => b.localeCompare(a))
    .map((key) => ({ title: getMonthLabel(key), data: map[key] }));
}

function getMonthTotal(invoices, monthOffset) {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  return invoices
    .filter((i) => {
      const d = new Date(i.date);
      return d.getMonth() === target.getMonth() && d.getFullYear() === target.getFullYear();
    })
    .reduce((s, i) => s + Number(i.amount), 0);
}

function buildCategoryTotals(invoices) {
  const totals = {};
  invoices.forEach((i) => {
    const cat = i.category || 'altele';
    totals[cat] = (totals[cat] || 0) + Number(i.amount);
  });
  return totals;
}

function fuelToInvoiceItem(fl) {
  const station = fl.station || 'Combustibil';
  const liters = Number(fl.liters || 0);
  const total = Number(fl.total) || (liters * Number(fl.pricePerL || 0));
  return {
    id: `fuel-${fl.id}`,
    _kind: 'fuel',
    _raw: fl,
    userId: fl.userId,
    vehicleId: fl.vehicleId,
    title: `Combustibil · ${liters.toFixed(1)}L ${fl.station || ''}`.trim(),
    amount: total,
    currency: 'RON',
    category: 'combustibil',
    date: fl.date,
    time: fl.time,
    km: fl.km,
    merchant: fl.station,
    location: fl.location,
    notes: fl.notes,
    attachments: fl.attachments || [],
    createdAt: fl.createdAt,
  };
}

export default function InvoicesScreen({ navigation }) {
  const { invoices, vehicles, fetchInvoices, fetchVehicles, deleteInvoice } = useStore();
  const fuelLogs = useStore(s => s.fuelLogs);
  const fetchFuelLogs = useStore(s => s.fetchFuelLogs);
  const deleteFuelLog = useStore(s => s.deleteFuelLog);
  const user = useStore(s => s.user);
  const selectedVehicleIdGlobal = useStore(s => s.selectedVehicleId);
  const { isTablet, hPad, maxContentWidth } = useResponsive();
  const safeBottom = useSafeBottomPadding(28);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [vehicleFilter, setVehicleFilter] = useState(selectedVehicleIdGlobal || 'toate');

  // Sincronizează cu vehiculul activ pe Home
  useEffect(() => {
    if (selectedVehicleIdGlobal) setVehicleFilter(selectedVehicleIdGlobal);
  }, [selectedVehicleIdGlobal]);
  const [catFilter, setCatFilter] = useState('toate');
  const [detailInv, setDetailInv] = useState(null);
  const [viewerAttachment, setViewerAttachment] = useState(null);
  const apiUrl = getApiUrl();

  const load = useCallback(async () => {
    await Promise.all([fetchInvoices(), fetchVehicles(), fetchFuelLogs()]);
  }, [fetchInvoices, fetchVehicles, fetchFuelLogs]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // Combine invoices + fuel logs into a unified expense list
  const combined = useMemo(() => {
    const fuelAsInvoices = (fuelLogs || []).map(fuelToInvoiceItem);
    return [...(invoices || []), ...fuelAsInvoices];
  }, [invoices, fuelLogs]);

  const filtered = combined.filter((inv) => {
    const byVehicle = vehicleFilter === 'toate' || inv.vehicleId === vehicleFilter;
    const byCat = catFilter === 'toate' || (inv.category || 'altele') === catFilter;
    return byVehicle && byCat;
  });

  const sections = groupByMonth(filtered);
  const currentTotal = getMonthTotal(combined, 0);
  const prevTotal = getMonthTotal(combined, -1);
  const grandTotal = combined.reduce((s, i) => s + Number(i.amount || 0), 0);
  const diff = currentTotal - prevTotal;

  const catTotals = buildCategoryTotals(filtered);
  const catSum = Object.values(catTotals).reduce((s, v) => s + v, 0);

  const handleDelete = (item) => {
    const isFuel = item._kind === 'fuel';
    Alert.alert(
      isFuel ? 'Șterge alimentarea' : 'Șterge cheltuiala',
      'Sigur ștergi această înregistrare?',
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Șterge',
          style: 'destructive',
          onPress: async () => {
            try {
              if (isFuel) {
                await deleteFuelLog(item._raw.id);
              } else {
                await deleteInvoice(item.id);
              }
              setDetailInv(null);
            } catch (e) {
              Alert.alert(e?.offline ? 'Mod offline' : 'Eroare', e?.message || e?.response?.data?.error || 'Nu s-a putut șterge.');
            }
          },
        },
      ],
    );
  };

  const handleEdit = (item) => {
    setDetailInv(null);
    if (item._kind === 'fuel') {
      navigation.navigate('EditFuel', { fuelLogId: item._raw.id });
    } else {
      navigation.navigate('EditInvoice', { invoiceId: item.id });
    }
  };

  const canEditItem = (item) => {
    if (!item) return false;
    const vehicle = vehicles.find(v => v.id === item.vehicleId);
    return item.userId === user?.id || vehicle?.isOwner;
  };

  const renderItem = ({ item }) => {
    const meta = getCatMeta(item.category || 'altele');
    const vehicle = vehicles.find((v) => v.id === item.vehicleId);
    const attachmentCount = (item.attachments || []).length;
    const editable = canEditItem(item);
    const isFuel = item._kind === 'fuel';
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setDetailInv(item)}
        onLongPress={() =>
          Alert.alert('Opțiuni', item.title, [
            { text: 'Anulează', style: 'cancel' },
            { text: 'Vezi detalii', onPress: () => setDetailInv(item) },
            ...(editable
              ? [
                  { text: 'Editează', onPress: () => handleEdit(item) },
                  { text: 'Șterge', style: 'destructive', onPress: () => handleDelete(item) },
                ]
              : []),
          ])
        }
        style={styles.itemWrap}
      >
        <Card style={styles.itemCard} padded={false}>
          <View style={styles.itemInner}>
            {isFuel && <Text style={styles.fuelEmoji}>⛽</Text>}
            <View style={styles.itemLeft}>
              <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
              <View style={styles.itemMetaRow}>
                {vehicle ? <Text style={styles.itemVehicle}>{vehicle.plate}</Text> : null}
                {item.merchant ? (
                  <Text style={styles.itemVehicle} numberOfLines={1}>· {item.merchant}</Text>
                ) : null}
              </View>
              <View style={styles.itemBadgesRow}>
                <Pill color={meta.color} bg={meta.bg} style={styles.itemPill}>
                  {meta.label}
                </Pill>
                {attachmentCount > 0 && (
                  <View style={styles.attBadge}>
                    <Text style={styles.attBadgeText}>📎 {attachmentCount}</Text>
                  </View>
                )}
                {item.km && (
                  <View style={styles.attBadge}>
                    <Text style={styles.attBadgeText}>{Number(item.km).toLocaleString('ro-RO')} km</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.itemRight}>
              <Text style={styles.itemAmount}>{formatCurrency(item.amount, item.currency || 'RON')}</Text>
              <Text style={styles.itemDate}>
                {formatDate(item.date)}
                {item.time ? ` · ${item.time}` : ''}
              </Text>
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
      <View style={[styles.header, { paddingHorizontal: hPad }]}>
        <Text style={styles.headerTitle}>Cheltuieli & Facturi</Text>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        contentContainerStyle={[
          styles.listContent,
          { paddingHorizontal: hPad - 4, paddingBottom: safeBottom + 80 },
          isTablet && { alignSelf: 'center', width: '100%', maxWidth: maxContentWidth },
        ]}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.brand} />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.summaryCard}>
              <View style={styles.summaryTop}>
                <View>
                  <Text style={styles.summaryLabel}>Luna curentă</Text>
                  <Text style={styles.summaryAmount}>{formatCurrency(currentTotal, 'RON')}</Text>
                </View>
                {prevTotal > 0 && (
                  <View style={styles.diffWrap}>
                    <Text style={[styles.diffText, { color: diff > 0 ? '#FFBCB0' : '#A7F3C9' }]}>
                      {diff > 0 ? '↑' : '↓'} {formatCurrency(Math.abs(diff), 'RON')}
                    </Text>
                    <Text style={styles.diffLabel}>față de luna trecută</Text>
                  </View>
                )}
              </View>
              <View style={styles.summaryDivider} />
              <Text style={styles.grandLabel}>
                Total general:{' '}
                <Text style={styles.grandAmount}>{formatCurrency(grandTotal, 'RON')}</Text>
              </Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterRow}
              contentContainerStyle={styles.filterContent}
            >
              <TouchableOpacity
                style={[styles.filterChip, vehicleFilter === 'toate' && styles.filterChipActive]}
                onPress={() => setVehicleFilter('toate')}
              >
                <Text style={[styles.filterChipText, vehicleFilter === 'toate' && styles.filterChipTextActive]}>
                  Toate
                </Text>
              </TouchableOpacity>
              {vehicles.map((v) => (
                <TouchableOpacity
                  key={v.id}
                  style={[styles.filterChip, vehicleFilter === v.id && styles.filterChipActive]}
                  onPress={() => setVehicleFilter(v.id)}
                >
                  <Text style={[styles.filterChipText, vehicleFilter === v.id && styles.filterChipTextActive]}>
                    {v.plate}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterRow}
              contentContainerStyle={styles.filterContent}
            >
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c.key}
                  style={[styles.filterChip, catFilter === c.key && styles.filterChipActive]}
                  onPress={() => setCatFilter(c.key)}
                >
                  <Text style={[styles.filterChipText, catFilter === c.key && styles.filterChipTextActive]}>
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {catSum > 0 && (
              <Card style={styles.chartCard}>
                <Text style={styles.chartTitle}>Cheltuieli pe categorii</Text>
                {Object.entries(catTotals)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, total]) => {
                    const meta = getCatMeta(cat);
                    const pct = catSum > 0 ? (total / catSum) * 100 : 0;
                    return (
                      <View key={cat} style={styles.chartRow}>
                        <View style={styles.chartLabelRow}>
                          <Text style={styles.chartCat}>{meta.label}</Text>
                          <Text style={styles.chartPct}>{pct.toFixed(0)}%</Text>
                          <Text style={styles.chartSum}>{formatCurrency(total, 'RON')}</Text>
                        </View>
                        <View style={styles.barTrack}>
                          <View
                            style={[
                              styles.barFill,
                              { width: `${Math.max(pct, 2)}%`, backgroundColor: meta.color },
                            ]}
                          />
                        </View>
                      </View>
                    );
                  })}
              </Card>
            )}

            {sections.length === 0 && (
              <EmptyState
                icon="🧾"
                title="Nicio cheltuială"
                subtitle="Apasă + pentru a adăuga prima cheltuială"
              />
            )}
          </View>
        }
      />

      <TouchableOpacity
        style={[styles.fab, { bottom: safeBottom, right: hPad }]}
        onPress={() => navigation.navigate('AddInvoice')}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <InvoiceDetailModal
        invoice={detailInv}
        vehicle={detailInv ? vehicles.find(v => v.id === detailInv.vehicleId) : null}
        onClose={() => setDetailInv(null)}
        onOpenAttachment={(att) => setViewerAttachment(att)}
        onEdit={() => detailInv && handleEdit(detailInv)}
        onDelete={() => detailInv && handleDelete(detailInv)}
        canEdit={canEditItem(detailInv)}
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

function InvoiceDetailModal({ invoice, vehicle, onClose, onOpenAttachment, onEdit, onDelete, canEdit, apiUrl }) {
  if (!invoice) return null;
  const isFuel = invoice._kind === 'fuel';
  const meta = invoice.category ? { label: invoice.category } : null;
  const fuelRaw = invoice._raw;
  const customEntries = (isFuel ? fuelRaw?.customFields : invoice.customFields) || {};
  const customEntriesArr = Object.entries(customEntries || {});

  return (
    <Modal
      visible={!!invoice}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalSafe}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle} numberOfLines={1}>
            {isFuel ? '⛽ ' : ''}{invoice.title}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={HIT_SLOP}>
            <Text style={styles.modalClose}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.modalContent}>
          <View style={styles.modalAmountBox}>
            <Text style={styles.modalAmount}>
              {formatCurrency(invoice.amount, invoice.currency || 'RON')}
            </Text>
            <Text style={styles.modalAmountSub}>
              {formatDate(invoice.date)}{invoice.time ? ` · ${invoice.time}` : ''}
            </Text>
            {isFuel && (
              <Text style={styles.modalAmountSub}>
                {Number(fuelRaw.liters).toFixed(2)} L @ {Number(fuelRaw.pricePerL).toFixed(2)} RON/L
              </Text>
            )}
          </View>

          <DetailRow label="Vehicul" value={vehicle ? `${vehicle.plate} · ${vehicle.brand} ${vehicle.model}` : '—'} />
          <DetailRow label={isFuel ? 'Tip' : 'Categorie'} value={isFuel ? (fuelRaw.fuelType || 'combustibil') : invoice.category} />
          {invoice.merchant && (
            <DetailRow label={isFuel ? 'Benzinărie' : 'Magazin / firmă'} value={invoice.merchant} />
          )}
          {invoice.location && <DetailRow label="Locație" value={invoice.location} multiline />}
          {invoice.km && <DetailRow label="Kilometraj" value={`${Number(invoice.km).toLocaleString('ro-RO')} km`} />}
          {isFuel && <DetailRow label="Plin complet" value={fuelRaw.fullTank ? 'Da' : 'Nu (parțial)'} />}
          {invoice.notes && <DetailRow label="Notițe" value={invoice.notes} multiline />}

          {customEntriesArr.length > 0 && (
            <View style={styles.customSection}>
              <Text style={styles.sectionLabel}>CÂMPURI PERSONALIZATE</Text>
              {customEntriesArr.map(([k, v]) => (
                <DetailRow key={k} label={k} value={String(v ?? '')} />
              ))}
            </View>
          )}

          {invoice.attachments && invoice.attachments.length > 0 && (
            <View style={styles.attachSection}>
              <Text style={styles.sectionLabel}>ATAȘAMENTE ({invoice.attachments.length})</Text>
              <View style={styles.attachGrid}>
                {invoice.attachments.map(att => {
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
            </View>
          )}

          {canEdit && (
            <>
              <TouchableOpacity
                style={styles.editBtn}
                onPress={onEdit}
                activeOpacity={0.85}
              >
                <Text style={styles.editBtnText}>✏️ Editează</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={onDelete}
                activeOpacity={0.85}
              >
                <Text style={styles.deleteBtnText}>
                  🗑️ Șterge {isFuel ? 'alimentarea' : 'cheltuiala'}
                </Text>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerTitle: { fontSize: 22, fontWeight: FONTS.bold, color: T.ink },
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  summaryCard: {
    backgroundColor: T.brand,
    borderRadius: RADIUS.xl,
    padding: 20,
    marginBottom: 14,
    ...SHADOW.md,
  },
  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  summaryLabel: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: FONTS.medium, marginBottom: 4 },
  summaryAmount: { fontSize: 26, fontWeight: FONTS.bold, color: '#fff' },
  diffWrap: { alignItems: 'flex-end' },
  diffText: { fontSize: 14, fontWeight: FONTS.bold },
  diffLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  summaryDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 12 },
  grandLabel: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: FONTS.medium },
  grandAmount: { color: '#fff', fontWeight: FONTS.bold },
  filterRow: { marginBottom: 6 },
  filterContent: { paddingVertical: 4, gap: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    backgroundColor: T.card,
    borderWidth: 1.5,
    borderColor: T.line,
  },
  filterChipActive: { backgroundColor: T.brand, borderColor: T.brand },
  filterChipText: { fontSize: 13, fontWeight: FONTS.medium, color: T.ink2 },
  filterChipTextActive: { color: '#fff' },
  chartCard: { marginBottom: 16 },
  chartTitle: { fontSize: 15, fontWeight: FONTS.semibold, color: T.ink, marginBottom: 12 },
  chartRow: { marginBottom: 10 },
  chartLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  chartCat: { flex: 1, fontSize: 13, fontWeight: FONTS.medium, color: T.ink2 },
  chartPct: { fontSize: 12, color: T.ink3, marginRight: 8 },
  chartSum: { fontSize: 13, fontWeight: FONTS.semibold, color: T.ink },
  barTrack: { height: 8, backgroundColor: T.line2, borderRadius: RADIUS.full, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: RADIUS.full },
  sectionTitle: {
    fontSize: 12,
    fontWeight: FONTS.semibold,
    color: T.ink3,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 16,
    marginBottom: 8,
  },
  itemWrap: { marginBottom: 10 },
  itemCard: { borderRadius: RADIUS.md },
  itemInner: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  itemLeft: { flex: 1, marginRight: 12 },
  itemTitle: { fontSize: 15, fontWeight: FONTS.semibold, color: T.ink, marginBottom: 3 },
  itemMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginBottom: 6 },
  itemVehicle: { fontSize: 12, color: T.ink3 },
  itemBadgesRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  itemPill: { alignSelf: 'flex-start' },
  attBadge: {
    backgroundColor: T.line2,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  attBadgeText: { fontSize: 11, color: T.ink2, fontWeight: FONTS.medium },
  itemRight: { alignItems: 'flex-end' },
  itemAmount: { fontSize: 16, fontWeight: FONTS.bold, color: T.ink, marginBottom: 4 },
  itemDate: { fontSize: 12, color: T.ink3 },

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
    gap: SPACING.md,
  },
  modalTitle: { flex: 1, fontSize: 17, fontWeight: FONTS.bold, color: T.ink },
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
  customSection: {},
  attachSection: {},
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
  fuelEmoji: { fontSize: 22, marginRight: 10, alignSelf: 'center' },
  fab: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: RADIUS.full,
    backgroundColor: T.brand,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.lg,
  },
  fabText: { color: '#fff', fontSize: 28, fontWeight: FONTS.bold, lineHeight: 32 },
});
