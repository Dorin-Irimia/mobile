import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useStore from '../store';
import api from '../api/client';
import { T, RADIUS, FONTS, SHADOW } from '../theme';
import { Card, EmptyState, LoadingView } from '../components/ui';

function relativeTime(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return 'acum';
  if (minutes < 60) return `acum ${minutes}m`;
  if (hours < 24) return `acum ${hours}h`;
  if (days === 1) return 'ieri';
  return `${days} zile`;
}

function getDotColor(type) {
  if (type === 'urgent') return T.danger;
  if (type === 'warning') return T.warn;
  return '#3B82F6';
}

export default function NotificationsScreen({ navigation }) {
  const { notifications, fetchNotifications, markNotifRead, markAllNotifRead } = useStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    await fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const allRead = notifications.every((n) => n.isRead);

  const unread = notifications.filter((n) => !n.isRead);
  const read = notifications.filter((n) => n.isRead);

  const sections = [];
  if (unread.length > 0) sections.push({ title: 'Necitite', data: unread });
  if (read.length > 0) sections.push({ title: 'Citite', data: read });

  const handleMarkAll = async () => {
    if (allRead) return;
    try {
      await markAllNotifRead();
    } catch {
      Alert.alert('Eroare', 'Nu s-au putut marca notificările ca citite.');
    }
  };

  const handlePress = async (item) => {
    if (!item.isRead) {
      try {
        await markNotifRead(item.id);
      } catch {}
    }
  };

  const handleDelete = (item) => {
    Alert.alert('Șterge notificarea?', item.title, [
      { text: 'Anulează', style: 'cancel' },
      {
        text: 'Șterge',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/notifications/${item.id}`);
            await load();
          } catch {
            Alert.alert('Eroare', 'Nu s-a putut șterge notificarea.');
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }) => {
    const dotColor = getDotColor(item.type);
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => handlePress(item)}
        onLongPress={() => handleDelete(item)}
        style={[styles.itemWrap, item.isRead && styles.itemWrapRead]}
      >
        <Card style={styles.itemCard} padded={false}>
          <View style={styles.itemInner}>
            <View style={[styles.dot, { backgroundColor: dotColor }]} />
            <View style={styles.itemBody}>
              <Text style={[styles.itemTitle, item.isRead && styles.itemTitleRead]} numberOfLines={2}>
                {item.title}
              </Text>
              {item.body ? (
                <Text style={styles.itemText} numberOfLines={3}>
                  {item.body}
                </Text>
              ) : null}
            </View>
            <Text style={styles.itemTime}>{relativeTime(item.createdAt || item.date)}</Text>
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
        <Text style={styles.headerTitle}>Notificări</Text>
        <TouchableOpacity
          onPress={handleMarkAll}
          disabled={allRead}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[styles.markAllText, allRead && styles.markAllTextDisabled]}>
            Marchează toate
          </Text>
        </TouchableOpacity>
      </View>

      {notifications.length === 0 ? (
        <EmptyState
          icon="🔔"
          title="Nicio notificare"
          subtitle="Vei fi anunțat despre scadențe și actualizări"
        />
      ) : (
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
        />
      )}
    </SafeAreaView>
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
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 22, fontWeight: FONTS.bold, color: T.ink },
  markAllText: { fontSize: 14, color: T.brand, fontWeight: FONTS.medium },
  markAllTextDisabled: { color: T.ink4 },
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },
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
  itemWrapRead: { opacity: 0.6 },
  itemCard: { borderRadius: RADIUS.md },
  itemInner: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 12 },
  dot: {
    width: 10,
    height: 10,
    borderRadius: RADIUS.full,
    marginTop: 4,
    flexShrink: 0,
  },
  itemBody: { flex: 1 },
  itemTitle: { fontSize: 14, fontWeight: FONTS.bold, color: T.ink, marginBottom: 3, lineHeight: 20 },
  itemTitleRead: { fontWeight: FONTS.regular, color: T.ink2 },
  itemText: { fontSize: 13, color: T.ink3, lineHeight: 18 },
  itemTime: { fontSize: 12, color: T.ink4, flexShrink: 0, marginTop: 2 },
});
