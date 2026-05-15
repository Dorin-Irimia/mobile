import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Dimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { T, RADIUS, FONTS, SHADOW } from '../theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const SERVICES = [
  { id: 1, name: 'Autoservice Rapid', address: 'Calea Victoriei 45, Sector 1', lat: 44.4396, lng: 26.0963, rating: 4.8, reviews: 124, type: 'Service General', phone: '+40 21 123 4567', open: '08:00-18:00' },
  { id: 2, name: 'ITP Expert Auto', address: 'Bd. Unirii 12, Sector 3', lat: 44.4268, lng: 26.1025, rating: 4.6, reviews: 89, type: 'ITP & Revizie', phone: '+40 21 234 5678', open: '07:30-17:30' },
  { id: 3, name: 'Vulcanizare Non-Stop', address: 'Str. Mihai Bravu 78, Sector 2', lat: 44.4312, lng: 26.1187, rating: 4.5, reviews: 67, type: 'Anvelope', phone: '+40 21 345 6789', open: '00:00-24:00' },
  { id: 4, name: 'Electroauto Pro', address: 'Calea Dorobanților 23, Sector 1', lat: 44.4521, lng: 26.0891, rating: 4.7, reviews: 43, type: 'Electrică & Diagnoză', phone: '+40 21 456 7890', open: '09:00-17:00' },
  { id: 5, name: 'Car Wash Premium', address: 'Str. Floreasca 101, Sector 1', lat: 44.4598, lng: 26.0934, rating: 4.4, reviews: 201, type: 'Spălătorie Auto', phone: '+40 21 567 8901', open: '08:00-20:00' },
  { id: 6, name: 'Asigurări Auto Direct', address: 'Bd. Magheru 5, Sector 1', lat: 44.4445, lng: 26.0980, rating: 4.3, reviews: 55, type: 'RCA & CASCO', phone: '+40 21 678 9012', open: '09:00-18:00' },
];

function buildMapHTML(services, selectedId) {
  const markers = services
    .map(
      s => `
    var icon${s.id} = L.divIcon({
      className: '',
      html: '<div style="background:${selectedId === s.id ? '#e85a0c' : '#FF6B1A'};width:${selectedId === s.id ? '44px' : '36px'};height:${selectedId === s.id ? '44px' : '36px'};border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.2s;"><span style="color:white;font-size:${selectedId === s.id ? '20px' : '16px'}">🔧</span></div>',
      iconSize: [${selectedId === s.id ? 44 : 36}, ${selectedId === s.id ? 44 : 36}],
      iconAnchor: [${selectedId === s.id ? 22 : 18}, ${selectedId === s.id ? 22 : 18}],
    });
    L.marker([${s.lat}, ${s.lng}], {icon: icon${s.id}})
      .addTo(map)
      .on('click', function() {
        window.ReactNativeWebView.postMessage(String(${s.id}));
      });
  `,
    )
    .join('');

  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{margin:0;padding:0;height:100%;width:100%;overflow:hidden;}.leaflet-control-attribution{display:none}</style>
</head><body>
<div id="map"></div>
<script>
var map = L.map('map',{zoomControl:true}).setView([44.4396,26.0963],13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:''}).addTo(map);
${markers}
</script></body></html>`;
}

function StarRating({ rating }) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <Text key={i} style={{ color: i <= Math.round(rating) ? '#FFB800' : T.line, fontSize: 14 }}>
        ★
      </Text>,
    );
  }
  return <View style={{ flexDirection: 'row' }}>{stars}</View>;
}

export default function ServicesScreen({ navigation }) {
  const [selected, setSelected] = useState(null);
  const slideAnim = useRef(new Animated.Value(300)).current;

  const handleMessage = e => {
    const id = parseInt(e.nativeEvent.data, 10);
    const service = SERVICES.find(s => s.id === id);
    if (service) {
      setSelected(service);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 60,
        friction: 10,
      }).start();
    }
  };

  const closeSheet = () => {
    Animated.timing(slideAnim, {
      toValue: 300,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setSelected(null));
  };

  const openPhone = phone => Linking.openURL(`tel:${phone.replace(/\s/g, '')}`);
  const openDirections = (lat, lng) =>
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Service-uri Auto</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.mapContainer}>
        <WebView
          source={{ html: buildMapHTML(SERVICES, selected?.id) }}
          style={styles.map}
          onMessage={handleMessage}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          scrollEnabled={false}
          bounces={false}
        />
      </View>

      {!selected && (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>Toate service-urile</Text>
          {SERVICES.map(s => (
            <View key={s.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.cardLeft}>
                  <Text style={styles.cardName}>{s.name}</Text>
                  <View style={styles.typePill}>
                    <Text style={styles.typePillText}>{s.type}</Text>
                  </View>
                </View>
                <View style={styles.cardRight}>
                  <StarRating rating={s.rating} />
                  <Text style={styles.ratingText}>
                    {s.rating} ({s.reviews})
                  </Text>
                </View>
              </View>
              <Text style={styles.cardAddress}>📍 {s.address}</Text>
              <View style={styles.cardFooter}>
                <Text style={styles.cardOpen}>🕐 {s.open}</Text>
                <TouchableOpacity
                  style={styles.directionsBtn}
                  onPress={() => openDirections(s.lat, s.lng)}>
                  <Text style={styles.directionsBtnText}>🗺️ Direcții</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {selected && (
        <>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={closeSheet} />
          <Animated.View style={[styles.bottomSheet, { transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.sheetHandle} />
            <TouchableOpacity style={styles.sheetClose} onPress={closeSheet}>
              <Text style={styles.sheetCloseText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.sheetName}>{selected.name}</Text>
            <View style={styles.typePill}>
              <Text style={styles.typePillText}>{selected.type}</Text>
            </View>
            <View style={styles.sheetRow}>
              <StarRating rating={selected.rating} />
              <Text style={styles.sheetRatingText}>
                {selected.rating} · {selected.reviews} recenzii
              </Text>
            </View>
            <Text style={styles.sheetAddress}>📍 {selected.address}</Text>
            <Text style={styles.sheetOpen}>🕐 Program: {selected.open}</Text>
            <View style={styles.sheetBtns}>
              <TouchableOpacity
                style={[styles.sheetBtn, styles.sheetBtnCall]}
                onPress={() => openPhone(selected.phone)}>
                <Text style={styles.sheetBtnCallText}>📞 Sună</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetBtn, styles.sheetBtnDir]}
                onPress={() => openDirections(selected.lat, selected.lng)}>
                <Text style={styles.sheetBtnDirText}>🗺️ Direcții</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: T.card,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 32,
    color: T.brand,
    lineHeight: 36,
    marginTop: -4,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: FONTS.semibold,
    color: T.ink,
  },
  mapContainer: {
    height: SCREEN_HEIGHT * 0.45,
    width: '100%',
  },
  map: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: FONTS.semibold,
    color: T.ink2,
    marginBottom: 12,
  },
  card: {
    backgroundColor: T.card,
    borderRadius: RADIUS.lg,
    padding: 16,
    marginBottom: 12,
    ...SHADOW.sm,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardLeft: {
    flex: 1,
    marginRight: 8,
  },
  cardName: {
    fontSize: 15,
    fontFamily: FONTS.semibold,
    color: T.ink,
    marginBottom: 6,
  },
  cardRight: {
    alignItems: 'flex-end',
  },
  ratingText: {
    fontSize: 11,
    fontFamily: FONTS.regular,
    color: T.ink3,
    marginTop: 2,
  },
  typePill: {
    backgroundColor: T.brandTint,
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  typePillText: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: T.brand,
  },
  cardAddress: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: T.ink3,
    marginBottom: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardOpen: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: T.ink4,
  },
  directionsBtn: {
    backgroundColor: T.brandTint,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  directionsBtnText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: T.brand,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 10,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: T.card,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: 20,
    paddingBottom: 36,
    zIndex: 20,
    ...SHADOW.lg,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: T.line,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetClose: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: T.line2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCloseText: {
    fontSize: 14,
    color: T.ink3,
    fontFamily: FONTS.medium,
  },
  sheetName: {
    fontSize: 20,
    fontFamily: FONTS.bold,
    color: T.ink,
    marginBottom: 8,
    paddingRight: 36,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 2,
  },
  sheetRatingText: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: T.ink3,
    marginLeft: 6,
  },
  sheetAddress: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: T.ink3,
    marginTop: 10,
    marginBottom: 4,
  },
  sheetOpen: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: T.ink4,
    marginBottom: 20,
  },
  sheetBtns: {
    flexDirection: 'row',
    gap: 12,
  },
  sheetBtn: {
    flex: 1,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBtnCall: {
    backgroundColor: T.card,
    borderWidth: 1.5,
    borderColor: T.brand,
  },
  sheetBtnCallText: {
    fontSize: 15,
    fontFamily: FONTS.semibold,
    color: T.brand,
  },
  sheetBtnDir: {
    backgroundColor: T.brand,
  },
  sheetBtnDirText: {
    fontSize: 15,
    fontFamily: FONTS.semibold,
    color: '#FFFFFF',
  },
});
