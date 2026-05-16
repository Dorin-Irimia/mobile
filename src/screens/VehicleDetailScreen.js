import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useStore from '../store';
import {
  T, RADIUS, SHADOW, FONTS,
  daysUntil, statusFor, formatDate, formatCurrency,
} from '../theme';
import {
  Card, Pill, StatusBadge, SectionHeader,
  EmptyState, LoadingView, Divider,
} from '../components/ui';
import { getVehicleIcon } from '../utils/vehicleCategories';
import { VehiclePhotoSticker } from '../components/VehiclePhotoSticker';
import VehicleAvailabilityModal from '../components/VehicleAvailabilityModal';
import VehicleStatsTab from '../components/VehicleStatsTab';

// ─── Constante ────────────────────────────────────────────────────────────────
const TABS = ['Detalii', 'Documente', 'Facturi', 'Combustibil', 'Statistici'];
const HEADER_MAX = 200;
const HEADER_MIN = 60;
const HEADER_SCROLL_DIST = HEADER_MAX - HEADER_MIN;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const DOC_TYPE_ICONS = {
  'Permis': '🪪',
  'Asigurare': '🛡️',
  'ITP': '🔧',
  'Talon': '📄',
  default: '📋',
};

function docIcon(type) {
  return DOC_TYPE_ICONS[type] || DOC_TYPE_ICONS.default;
}

// ─── Componenta principală ────────────────────────────────────────────────────
export default function VehicleDetailScreen({ navigation, route }) {
  const { vehicleId } = route.params;
  const {
    vehicles,
    documents, invoices, fuelLogs,
    fetchVehicles,
    fetchDocuments, fetchInvoices, fetchFuelLogs,
    deleteVehicle,
  } = useStore();

  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [availabilityModalVisible, setAvailabilityModalVisible] = useState(false);

  // Animatii header
  const scrollY = useRef(new Animated.Value(0)).current;
  // Tab underline
  const tabUnderlineX = useRef(new Animated.Value(0)).current;

  const user = useStore(s => s.user);
  const vehicle = vehicles.find(v => v.id === vehicleId);
  const isOwner = vehicle ? (vehicle.isOwner !== false && vehicle.userId === user?.id) : false;

  // ── Date filtrate ──────────────────────────────────────────────────────────
  const vehicleDocs = documents.filter(d => d.vehicleId === vehicleId);
  const vehicleInvoices = invoices.filter(i => i.vehicleId === vehicleId);
  const vehicleFuel = fuelLogs.filter(f => f.vehicleId === vehicleId);

  const totalInvoiceCost = vehicleInvoices.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const totalFuelCost = vehicleFuel.reduce((s, f) => s + (Number(f.totalCost) || 0), 0);
  const totalLiters = vehicleFuel.reduce((s, f) => s + (Number(f.liters) || 0), 0);

  // medie consum L/100km din loguri
  const avgConsumption = (() => {
    if (vehicleFuel.length < 2) return null;
    const withKm = vehicleFuel.filter(f => f.km);
    if (withKm.length < 2) return null;
    const sorted = [...withKm].sort((a, b) => a.km - b.km);
    const kmDiff = sorted[sorted.length - 1].km - sorted[0].km;
    if (kmDiff <= 0) return null;
    return ((totalLiters / kmDiff) * 100).toFixed(1);
  })();

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    try {
      await Promise.all([
        fetchVehicles(),
        fetchDocuments(vehicleId),
        fetchInvoices(vehicleId),
        fetchFuelLogs(vehicleId),
      ]);
    } catch {}
  }, [vehicleId]);

  useEffect(() => {
    loadAll().finally(() => setLoading(false));
  }, [loadAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  // ── Ştergere ───────────────────────────────────────────────────────────────
  const handleDelete = () => {
    Alert.alert('Ești sigur?', `Vrei să ștergi vehiculul ${vehicle?.plate}?`, [
      { text: 'Anulează', style: 'cancel' },
      {
        text: 'Continuă',
        style: 'destructive',
        onPress: () =>
          Alert.alert(
            'Atenție',
            'Această acțiune este ireversibilă. Toate datele asociate vor fi pierdute.',
            [
              { text: 'Anulează', style: 'cancel' },
              {
                text: 'Șterge definitiv',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await deleteVehicle(vehicleId);
                    navigation.goBack();
                  } catch {
                    Alert.alert('Eroare', 'Nu s-a putut șterge vehiculul.');
                  }
                },
              },
            ]
          ),
      },
    ]);
  };

  // ── Tab switch cu animatie ─────────────────────────────────────────────────
  const switchTab = (idx) => {
    setActiveTab(idx);
    // mutam underline-ul la pozitia tab-ului selectat (calculat ca fractie)
    Animated.spring(tabUnderlineX, {
      toValue: idx,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  };

  // ── Header interpolari ─────────────────────────────────────────────────────
  const headerHeight = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DIST],
    outputRange: [HEADER_MAX, HEADER_MIN],
    extrapolate: 'clamp',
  });

  const heroOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DIST * 0.5],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const titleOpacity = scrollY.interpolate({
    inputRange: [HEADER_SCROLL_DIST * 0.5, HEADER_SCROLL_DIST],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // ── Guards ─────────────────────────────────────────────────────────────────
  if (loading) return <LoadingView />;
  if (!vehicle) return <EmptyState title="Vehicul negăsit" subtitle="Reveniti la lista de vehicule" />;

  const expiries = [
    { label: 'ITP', date: vehicle.itpDate, editKey: 'itpDate' },
    { label: 'RCA', date: vehicle.rcaDate, editKey: 'rcaDate' },
    { label: 'CASCO', date: vehicle.cascoDate, editKey: 'cascoDate' },
    { label: 'Rovinieta', date: vehicle.rovDate, editKey: 'rovDate' },
  ];

  // ── Render tabs ────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <StatusBar barStyle="light-content" />

      {/* ─── Header animat ─────────────────────────────────────────────── */}
      <Animated.View style={[styles.header, { height: headerHeight }]}>
        {/* Gradient portocaliu simulat cu layere */}
        <View style={styles.headerGradientBottom} />
        <View style={styles.headerGradientTop} />

        {/* Butoane navigare (mereu vizibile) */}
        <View style={styles.headerNav}>
          <TouchableOpacity style={styles.navBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.navBtnText}>←</Text>
          </TouchableOpacity>
          <View style={styles.navActions}>
            <TouchableOpacity
              style={styles.navBtn}
              onPress={() => navigation.navigate('ShareVehicle', { vehicleId })}
            >
              <Text style={styles.navBtnText}>👥</Text>
            </TouchableOpacity>
            {isOwner ? (
              <>
                <TouchableOpacity
                  style={styles.navBtn}
                  onPress={() => setAvailabilityModalVisible(true)}
                >
                  <Text style={styles.navBtnText}>
                    {vehicle.isEffectivelyAvailable !== false ? '🟢' : '🔴'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.navBtn}
                  onPress={() => navigation.navigate('EditVehicle', { vehicleId })}
                >
                  <Text style={styles.navBtnText}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.navBtn} onPress={handleDelete}>
                  <Text style={styles.navBtnText}>🗑️</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>

        {/* Titlu mic (apare la scroll) */}
        <Animated.View style={[styles.headerTitleSmall, { opacity: titleOpacity }]}>
          <Text style={styles.headerTitleSmallText} numberOfLines={1}>
            {vehicle.brand} {vehicle.model}
          </Text>
        </Animated.View>

        {/* Hero content (dispare la scroll) */}
        <Animated.View style={[styles.heroContent, { opacity: heroOpacity }]}>
          <View style={styles.heroRow}>
            <VehiclePhotoSticker
              photo={vehicle.photo}
              category={vehicle.category}
              size={64}
              onPress={isOwner ? () => navigation.navigate('EditVehicle', { vehicleId }) : undefined}
              editable={isOwner}
            />
            <View style={styles.heroTextCol}>
              <View style={styles.plateRow}>
                <Text style={styles.heroPlate}>{vehicle.plate}</Text>
                {vehicle.color ? (
                  <View style={[styles.colorDot, { backgroundColor: resolveColor(vehicle.color) }]} />
                ) : null}
                {!isOwner && (
                  <View style={styles.sharedBadge}>
                    <Text style={styles.sharedBadgeText}>👥 Compartit</Text>
                  </View>
                )}
                {isOwner && vehicle.memberCount > 0 && (
                  <View style={styles.sharedBadge}>
                    <Text style={styles.sharedBadgeText}>👥 {vehicle.memberCount}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.heroName}>{vehicle.brand} {vehicle.model}</Text>
              <Text style={styles.heroSub}>
                {vehicle.year}
                {vehicle.fuel ? ` · ${vehicle.fuel}` : ''}
                {vehicle.km != null ? ` · ${Number(vehicle.km).toLocaleString('ro-RO')} km` : ''}
              </Text>
            </View>
          </View>
          {vehicle.isEffectivelyAvailable === false && (
            <View style={styles.unavailableBanner}>
              <Text style={styles.unavailableBannerText} numberOfLines={2}>
                🚫 INDISPONIBIL · {(vehicle.availabilityReasons || []).map(r => r.label).join(' · ') || 'motiv necunoscut'}
              </Text>
            </View>
          )}
        </Animated.View>
      </Animated.View>

      {/* ─── Tab bar ───────────────────────────────────────────────────── */}
      <TabBar tabs={TABS} activeTab={activeTab} onSwitch={switchTab} underlineAnim={tabUnderlineX} />

      {/* ─── Continut scrollabil ───────────────────────────────────────── */}
      <Animated.ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.brand} />
        }
      >
        {activeTab === 0 && (
          <TabDetalii
            vehicle={vehicle}
            expiries={expiries}
            totalInvoiceCost={totalInvoiceCost}
            navigation={navigation}
            vehicleId={vehicleId}
          />
        )}
        {activeTab === 1 && (
          <TabDocumente
            docs={vehicleDocs}
            navigation={navigation}
            vehicleId={vehicleId}
          />
        )}
        {activeTab === 2 && (
          <TabFacturi
            invoices={vehicleInvoices}
            totalCost={totalInvoiceCost}
            navigation={navigation}
            vehicleId={vehicleId}
          />
        )}
        {activeTab === 3 && (
          <TabCombustibil
            fuel={vehicleFuel}
            totalLiters={totalLiters}
            totalCost={totalFuelCost}
            avgConsumption={avgConsumption}
            navigation={navigation}
            vehicleId={vehicleId}
          />
        )}
        {activeTab === 4 && <VehicleStatsTab vehicleId={vehicleId} />}
        <View style={styles.bottomPad} />
      </Animated.ScrollView>

      {/* ─── FAB ───────────────────────────────────────────────────────── */}
      <FAB activeTab={activeTab} navigation={navigation} vehicleId={vehicleId} />

      <VehicleAvailabilityModal
        visible={availabilityModalVisible}
        vehicle={vehicle}
        onClose={() => setAvailabilityModalVisible(false)}
      />
    </SafeAreaView>
  );
}

// ─── Sub-componentă: TabBar ───────────────────────────────────────────────────
function TabBar({ tabs, activeTab, onSwitch, underlineAnim }) {
  return (
    <View style={tabBarStyles.container}>
      {tabs.map((tab, idx) => (
        <TouchableOpacity
          key={tab}
          style={tabBarStyles.tab}
          onPress={() => onSwitch(idx)}
          activeOpacity={0.7}
        >
          <Text style={[tabBarStyles.text, activeTab === idx && tabBarStyles.textActive]}>
            {tab}
          </Text>
        </TouchableOpacity>
      ))}
      {/* Underline animat */}
      <Animated.View
        style={[
          tabBarStyles.underline,
          {
            width: `${100 / tabs.length}%`,
            transform: [
              {
                translateX: underlineAnim.interpolate({
                  inputRange: tabs.map((_, i) => i),
                  outputRange: tabs.map((_, i) => i * (100 / tabs.length) + '%').map(
                    (_, i) => i * (0) // va fi calculat la runtime pe baza width
                  ),
                }),
              },
            ],
          },
        ]}
      >
        {/* Folosim abordare cu left calculat din activeTab */}
      </Animated.View>
      {/* Underline simplu bazat pe activeTab (non-animated fallback cu animated spring) */}
      <UnderlineMover tabCount={tabs.length} anim={underlineAnim} />
    </View>
  );
}

function UnderlineMover({ tabCount, anim }) {
  const translateX = anim.interpolate({
    inputRange: Array.from({ length: tabCount }, (_, i) => i),
    outputRange: Array.from({ length: tabCount }, (_, i) => i),
  });
  // Vom redimensiona prin style width procentual si translateX in unitati de "tab-uri"
  return null; // Underline-ul e gestionat in tabBarStyles direct prin activeTab
}

const tabBarStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: T.card,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
    position: 'relative',
  },
  tab: {
    flex: 1,
    paddingVertical: 13,
    alignItems: 'center',
  },
  text: {
    fontSize: 13,
    color: T.ink3,
    fontWeight: FONTS.medium,
  },
  textActive: {
    color: T.brand,
    fontWeight: FONTS.semibold,
  },
  underline: {
    position: 'absolute',
    bottom: 0,
    height: 2,
    backgroundColor: T.brand,
    borderRadius: 2,
  },
});

// ─── Tab bar cu underline animat corect ──────────────────────────────────────
// Inlocuim implementarea de mai sus cu una mai simpla si corecta
function TabBarCorrect({ tabs, activeTab, onSwitch }) {
  const underline = useRef(new Animated.Value(activeTab)).current;

  const handlePress = (idx) => {
    Animated.spring(underline, {
      toValue: idx,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
    onSwitch(idx);
  };

  return (
    <View style={tbcStyles.wrap}>
      {tabs.map((tab, idx) => (
        <TouchableOpacity
          key={tab}
          style={tbcStyles.tab}
          onPress={() => handlePress(idx)}
          activeOpacity={0.7}
        >
          <Text style={[tbcStyles.text, activeTab === idx && tbcStyles.textActive]}>
            {tab}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const tbcStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', backgroundColor: T.card, borderBottomWidth: 1, borderBottomColor: T.line },
  tab: { flex: 1, paddingVertical: 13, alignItems: 'center' },
  text: { fontSize: 13, color: T.ink3, fontWeight: FONTS.medium },
  textActive: { color: T.brand, fontWeight: FONTS.semibold },
});

// ─── Tab Detalii ──────────────────────────────────────────────────────────────
function TabDetalii({ vehicle, expiries, totalInvoiceCost, navigation, vehicleId }) {
  const infoRows = [
    ['Marcă', vehicle.brand],
    ['Model', vehicle.model],
    ['An fabricație', vehicle.year],
    ['Combustibil', vehicle.fuel],
    ['Putere', vehicle.power ? `${vehicle.power} CP` : null],
    ['Kilometraj', vehicle.km != null ? `${Number(vehicle.km).toLocaleString('ro-RO')} km` : null],
    ['VIN', vehicle.vin],
    ['Culoare', vehicle.color],
  ].filter(([, v]) => v != null && v !== '');

  return (
    <View style={styles.tabContent}>
      <SectionHeader title="Informații vehicul" />
      <Card style={styles.infoCard}>
        {infoRows.map(([label, value], i) => (
          <View key={label}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{label}</Text>
              <Text style={styles.infoValue}>{value || '-'}</Text>
            </View>
            {i < infoRows.length - 1 && <Divider />}
          </View>
        ))}
      </Card>

      <SectionHeader title="Termene valabilitate" />
      {expiries.map((item) => {
        const days = item.date ? daysUntil(item.date) : null;
        const st = days !== null ? statusFor(days) : null;
        return (
          <Card key={item.label} style={styles.expiryCard}>
            <View style={styles.expiryRow}>
              <Text style={styles.expiryLabel}>{item.label}</Text>
              <View style={styles.expiryRight}>
                {item.date ? (
                  <>
                    <Text style={styles.expiryDate}>{formatDate(item.date)}</Text>
                    {st && <StatusBadge days={days} />}
                  </>
                ) : (
                  <Text style={styles.expiryNone}>Nedefinit</Text>
                )}
                <TouchableOpacity
                  style={styles.expiryEditBtn}
                  onPress={() => navigation.navigate('EditVehicle', { vehicleId, focusField: item.editKey })}
                >
                  <Text style={styles.expiryEditText}>✏️ Edit</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Card>
        );
      })}

      <SectionHeader title="Cheltuieli totale" />
      <Card style={styles.totalCard}>
        <Text style={styles.totalLabel}>Suma totală facturi</Text>
        <Text style={styles.totalAmount}>{formatCurrency(totalInvoiceCost, 'RON')}</Text>
      </Card>
    </View>
  );
}

// ─── Tab Documente ────────────────────────────────────────────────────────────
function TabDocumente({ docs, navigation, vehicleId }) {
  const handleDeleteDoc = (doc) => {
    Alert.alert('Șterge document', `Ștergi "${doc.name}"?`, [
      { text: 'Anulează', style: 'cancel' },
      {
        text: 'Șterge',
        style: 'destructive',
        onPress: () => {
          // Apelul de stergere doc – implementat de store/api
          Alert.alert('Info', 'Funcție disponibilă din ecranul Documents.');
        },
      },
    ]);
  };

  if (docs.length === 0) {
    return (
      <View style={styles.tabContent}>
        <EmptyState
          title="Niciun document"
          subtitle="Adaugă primul document pentru acest vehicul"
          action="Adaugă document"
          onAction={() => navigation.navigate('DocumentsStack', { vehicleId })}
        />
      </View>
    );
  }

  return (
    <View style={styles.tabContent}>
      {docs.map((doc) => {
        const days = doc.expiryDate ? daysUntil(doc.expiryDate) : null;
        const st = days !== null ? statusFor(days) : null;
        return (
          <Card key={doc.id} style={styles.listCard}>
            <View style={styles.docRow}>
              <Text style={styles.docIcon}>{docIcon(doc.type)}</Text>
              <View style={styles.docInfo}>
                <Text style={styles.docName}>{doc.name}</Text>
                <View style={styles.docMeta}>
                  {doc.type ? <Pill>{doc.type}</Pill> : null}
                  {doc.isSigned ? (
                    <View style={styles.signedBadge}>
                      <Text style={styles.signedText}>Semnat ✓</Text>
                    </View>
                  ) : null}
                </View>
                {doc.expiryDate ? (
                  <Text style={styles.docExpiry}>{formatDate(doc.expiryDate)}</Text>
                ) : null}
              </View>
              <View style={styles.docRight}>
                {st && <StatusBadge days={days} />}
                <TouchableOpacity
                  style={styles.deleteDocBtn}
                  onPress={() => handleDeleteDoc(doc)}
                >
                  <Text style={styles.deleteDocText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Card>
        );
      })}
    </View>
  );
}

// ─── Tab Facturi ──────────────────────────────────────────────────────────────
function TabFacturi({ invoices, totalCost, navigation, vehicleId }) {
  if (invoices.length === 0) {
    return (
      <View style={styles.tabContent}>
        <EmptyState
          title="Nicio factură"
          subtitle="Adaugă prima factură pentru acest vehicul"
          action="Adaugă factură"
          onAction={() => navigation.navigate('AddInvoice', { vehicleId })}
        />
      </View>
    );
  }

  return (
    <View style={styles.tabContent}>
      <Card style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total cheltuieli</Text>
        <Text style={styles.totalAmount}>{formatCurrency(totalCost, 'RON')}</Text>
      </Card>
      {invoices.map((inv) => (
        <Card key={inv.id} style={styles.listCard}>
          <View style={styles.invRow}>
            <View style={styles.invInfo}>
              <Text style={styles.invTitle}>{inv.title}</Text>
              {inv.category ? <Pill bg={T.brandTint} color={T.brand}>{inv.category}</Pill> : null}
            </View>
            <Text style={styles.invAmount}>{formatCurrency(Number(inv.amount), 'RON')}</Text>
          </View>
          <Text style={styles.invDate}>{formatDate(inv.date)}</Text>
        </Card>
      ))}
    </View>
  );
}

// ─── Tab Combustibil ──────────────────────────────────────────────────────────
function TabCombustibil({ fuel, totalLiters, totalCost, avgConsumption, navigation, vehicleId }) {
  if (fuel.length === 0) {
    return (
      <View style={styles.tabContent}>
        <EmptyState
          title="Nicio înregistrare"
          subtitle="Adaugă prima alimentare pentru acest vehicul"
          action="Adaugă alimentare"
          onAction={() => navigation.navigate('AddFuel', { vehicleId })}
        />
      </View>
    );
  }

  return (
    <View style={styles.tabContent}>
      {/* Stats */}
      <Card style={styles.fuelStatsCard}>
        <View style={styles.fuelStatsRow}>
          <View style={styles.fuelStat}>
            <Text style={styles.fuelStatVal}>{totalLiters.toFixed(1)} L</Text>
            <Text style={styles.fuelStatLabel}>Total litri</Text>
          </View>
          <View style={styles.fuelStatDivider} />
          <View style={styles.fuelStat}>
            <Text style={styles.fuelStatVal}>{formatCurrency(totalCost, 'RON')}</Text>
            <Text style={styles.fuelStatLabel}>Total cheltuieli</Text>
          </View>
          {avgConsumption !== null && (
            <>
              <View style={styles.fuelStatDivider} />
              <View style={styles.fuelStat}>
                <Text style={styles.fuelStatVal}>{avgConsumption} L</Text>
                <Text style={styles.fuelStatLabel}>Medie /100 km</Text>
              </View>
            </>
          )}
        </View>
      </Card>

      {fuel.map((f) => (
        <Card key={f.id} style={styles.listCard}>
          <View style={styles.fuelItemRow}>
            <View style={styles.fuelItemLeft}>
              <Text style={styles.fuelItemDate}>{formatDate(f.date)}</Text>
              <Text style={styles.fuelItemStation}>{f.station || 'Stație necunoscută'}</Text>
              {f.km ? <Text style={styles.fuelItemKm}>{Number(f.km).toLocaleString('ro-RO')} km</Text> : null}
            </View>
            <View style={styles.fuelItemRight}>
              <Text style={styles.fuelItemLiters}>{Number(f.liters).toFixed(2)} L</Text>
              {f.pricePerLiter ? (
                <Text style={styles.fuelItemPpu}>{Number(f.pricePerLiter).toFixed(2)} RON/L</Text>
              ) : null}
              <Text style={styles.fuelItemTotal}>{formatCurrency(Number(f.totalCost), 'RON')}</Text>
            </View>
          </View>
        </Card>
      ))}
    </View>
  );
}

// ─── FAB ──────────────────────────────────────────────────────────────────────
function FAB({ activeTab, navigation, vehicleId }) {
  const destinations = [
    null, // tab Detalii – fara FAB
    () => navigation.navigate('DocumentsStack', { vehicleId }),
    () => navigation.navigate('AddInvoice', { vehicleId }),
    () => navigation.navigate('AddFuel', { vehicleId }),
    null, // tab Statistici – fara FAB
  ];

  const action = destinations[activeTab];
  if (!action) return null;

  return (
    <TouchableOpacity style={styles.fab} onPress={action} activeOpacity={0.85}>
      <Text style={styles.fabText}>+</Text>
    </TouchableOpacity>
  );
}

// ─── Utilitara culoare ────────────────────────────────────────────────────────
function resolveColor(colorName) {
  const map = {
    alb: '#FFFFFF', negru: '#1A1A1A', gri: '#9E9E9E', argintiu: '#C0C0C0',
    albastru: '#2196F3', rosu: '#F44336', verde: '#4CAF50', galben: '#FFEB3B',
    portocaliu: '#FF9800', maro: '#795548', bej: '#F5F0DC', violet: '#9C27B0',
  };
  const key = (colorName || '').toLowerCase().trim();
  return map[key] || T.line;
}

// ─── Stiluri globale ──────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },

  // Header
  header: {
    backgroundColor: T.brand,
    overflow: 'hidden',
    position: 'relative',
  },
  headerGradientTop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: T.brand,
  },
  headerGradientBottom: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: T.brandDark,
    top: '50%',
  },
  headerNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 12,
    zIndex: 10,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnText: { fontSize: 16, color: '#fff' },
  navActions: { flexDirection: 'row', gap: 8 },

  headerTitleSmall: {
    position: 'absolute',
    left: 60,
    right: 60,
    bottom: 14,
    alignItems: 'center',
  },
  headerTitleSmallText: {
    fontSize: 16,
    fontWeight: FONTS.semibold,
    color: '#fff',
  },

  heroContent: {
    position: 'absolute',
    bottom: 16,
    left: 20,
    right: 20,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroTextCol: { flex: 1 },
  plateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  heroPlate: {
    fontSize: 20,
    fontWeight: FONTS.bold,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
  },
  colorDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  heroName: { fontSize: 24, fontWeight: FONTS.bold, color: '#fff', marginBottom: 2 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  sharedBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  sharedBadgeText: { fontSize: 11, color: '#fff', fontWeight: FONTS.semibold },
  unavailableBanner: {
    marginTop: 10,
    backgroundColor: 'rgba(224,67,44,0.92)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  unavailableBannerText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 12 },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    backgroundColor: T.card,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
  },
  tab: { flex: 1, paddingVertical: 13, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: T.brand },
  tabText: { fontSize: 13, color: T.ink3, fontWeight: FONTS.medium },
  tabTextActive: { color: T.brand, fontWeight: FONTS.semibold },

  // Scroll & content
  scroll: { flex: 1 },
  tabContent: { padding: 16 },

  // Info card
  infoCard: { padding: 0, overflow: 'hidden', marginBottom: 8 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  infoLabel: { fontSize: 14, color: T.ink3, fontWeight: FONTS.regular },
  infoValue: { fontSize: 14, color: T.ink, fontWeight: FONTS.medium, flexShrink: 1, textAlign: 'right', marginLeft: 16 },

  // Expiry cards
  expiryCard: { padding: 14, marginBottom: 8 },
  expiryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  expiryLabel: { fontSize: 15, fontWeight: FONTS.semibold, color: T.ink, marginTop: 4 },
  expiryRight: { alignItems: 'flex-end', gap: 6 },
  expiryDate: { fontSize: 12, color: T.ink3 },
  expiryNone: { fontSize: 12, color: T.ink4 },
  expiryEditBtn: {
    backgroundColor: T.line2,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    marginTop: 4,
  },
  expiryEditText: { fontSize: 11, color: T.ink2, fontWeight: FONTS.medium },

  // Total card
  totalCard: {
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: { fontSize: 14, color: T.ink3, fontWeight: FONTS.medium },
  totalAmount: { fontSize: 18, fontWeight: FONTS.bold, color: T.brand },

  // List card (shared)
  listCard: { padding: 14, marginBottom: 8 },

  // Documente
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  docIcon: { fontSize: 22, width: 32, textAlign: 'center' },
  docInfo: { flex: 1 },
  docName: { fontSize: 14, fontWeight: FONTS.medium, color: T.ink, marginBottom: 4 },
  docMeta: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 4 },
  docExpiry: { fontSize: 11, color: T.ink4, marginTop: 2 },
  signedBadge: {
    backgroundColor: T.successTint,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  signedText: { fontSize: 11, color: T.success, fontWeight: FONTS.medium },
  docRight: { alignItems: 'flex-end', gap: 6 },
  deleteDocBtn: { padding: 4 },
  deleteDocText: { fontSize: 14 },

  // Facturi
  invRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  invInfo: { flex: 1, marginRight: 8, gap: 4 },
  invTitle: { fontSize: 14, fontWeight: FONTS.medium, color: T.ink, marginBottom: 4 },
  invAmount: { fontSize: 15, fontWeight: FONTS.bold, color: T.brand },
  invDate: { fontSize: 12, color: T.ink4 },

  // Combustibil
  fuelStatsCard: { padding: 16, marginBottom: 12 },
  fuelStatsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  fuelStat: { flex: 1, alignItems: 'center' },
  fuelStatVal: { fontSize: 16, fontWeight: FONTS.bold, color: T.ink, marginBottom: 2 },
  fuelStatLabel: { fontSize: 11, color: T.ink3, textAlign: 'center' },
  fuelStatDivider: { width: 1, height: 36, backgroundColor: T.line },
  fuelItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  fuelItemLeft: { flex: 1 },
  fuelItemDate: { fontSize: 14, fontWeight: FONTS.medium, color: T.ink, marginBottom: 2 },
  fuelItemStation: { fontSize: 12, color: T.ink3, marginBottom: 2 },
  fuelItemKm: { fontSize: 11, color: T.ink4 },
  fuelItemRight: { alignItems: 'flex-end' },
  fuelItemLiters: { fontSize: 14, fontWeight: FONTS.semibold, color: T.ink, marginBottom: 2 },
  fuelItemPpu: { fontSize: 11, color: T.ink3, marginBottom: 2 },
  fuelItemTotal: { fontSize: 13, fontWeight: FONTS.bold, color: T.brand },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: T.brand,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.lg,
  },
  fabText: { fontSize: 28, color: '#fff', lineHeight: 32, marginTop: -2 },

  bottomPad: { height: 80 },
});
