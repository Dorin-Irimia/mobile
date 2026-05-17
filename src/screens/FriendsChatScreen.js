import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
  AppState, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useStore from '../store';
import {
  T, RADIUS, SHADOW, FONTS, formatDate, display,
} from '../theme';

const POLL_INTERVAL_MS = 6000;

function initialsOf(name) {
  return (name || '?').split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
}

function fmtTime(at) {
  return new Date(at).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
}

function fmtDay(d) {
  return d.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'short' });
}

function DayDivider({ day }) {
  return (
    <View style={styles.divider}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>{fmtDay(day)}</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

function TextBubble({ msg, isMe, onLongPress }) {
  const pending = msg._pending;
  const failed = msg._failed;
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onLongPress={isMe ? onLongPress : undefined}
      style={[styles.bubbleWrap, isMe ? styles.bubbleWrapMe : styles.bubbleWrapThem]}
    >
      <View
        style={[
          styles.bubble,
          isMe ? styles.bubbleMe : styles.bubbleThem,
          isMe ? styles.bubbleMeCorner : styles.bubbleThemCorner,
          pending && { opacity: 0.6 },
          failed && { borderColor: T.danger, borderWidth: 1 },
        ]}
      >
        <Text style={[styles.bubbleText, isMe && { color: '#fff' }]}>{msg.text}</Text>
      </View>
      <Text style={[styles.bubbleTime, { textAlign: isMe ? 'right' : 'left' }]}>
        {fmtTime(msg.createdAt || msg.at)}
        {isMe && pending ? ' · trimit…' : ''}
        {isMe && failed ? ' · ✗' : ''}
        {isMe && !pending && !failed ? ' · ✓✓' : ''}
      </Text>
    </TouchableOpacity>
  );
}

function DocBubble({ msg, isMe }) {
  const meta = msg.metadata || {};
  const emoji = meta.docType === 'PDF' ? '📄' : meta.docType === 'IMG' ? '🖼️' : '📎';
  return (
    <View style={[styles.bubbleWrap, isMe ? styles.bubbleWrapMe : styles.bubbleWrapThem]}>
      <View
        style={[
          styles.docCard,
          isMe ? styles.bubbleMe : styles.bubbleThem,
          isMe ? styles.bubbleMeCorner : styles.bubbleThemCorner,
        ]}
      >
        <View style={[styles.docIconWrap, { backgroundColor: isMe ? 'rgba(255,255,255,0.18)' : T.brandTint }]}>
          <Text style={{ fontSize: 20 }}>{emoji}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.docKicker, { color: isMe ? 'rgba(255,255,255,0.85)' : T.brand }]}>
            📄 Document partajat
          </Text>
          <Text style={[styles.docName, { color: isMe ? '#fff' : T.ink }]} numberOfLines={1}>
            {meta.docName || 'Document'}
          </Text>
          <Text style={[styles.docMeta, { color: isMe ? 'rgba(255,255,255,0.75)' : T.ink3 }]}>
            {meta.docType || 'FILE'}{meta.size ? ` · ${meta.size}` : ''}
          </Text>
        </View>
      </View>
      <Text style={[styles.bubbleTime, { textAlign: isMe ? 'right' : 'left' }]}>
        {fmtTime(msg.createdAt)}{isMe ? ' · ✓✓' : ''}
      </Text>
    </View>
  );
}

function ExpenseBubble({ msg, isMe }) {
  const meta = msg.metadata || {};
  const catEmoji =
    meta.category === 'combustibil' ? '⛽' :
    meta.category === 'service' ? '🔧' :
    meta.category === 'utilități' ? '💡' : '💸';
  return (
    <View style={[styles.bubbleWrap, isMe ? styles.bubbleWrapMe : styles.bubbleWrapThem]}>
      <View
        style={[
          styles.expCard,
          isMe ? styles.bubbleMe : styles.bubbleThem,
          isMe ? styles.bubbleMeCorner : styles.bubbleThemCorner,
        ]}
      >
        <View style={[styles.expHead, { backgroundColor: isMe ? 'rgba(255,255,255,0.12)' : T.brandTint }]}>
          <Text style={{ fontSize: 14 }}>{catEmoji}</Text>
          <Text style={[styles.expKicker, { color: isMe ? '#fff' : T.brandDark }]}>
            Cheltuială partajată
          </Text>
        </View>
        <View style={styles.expBody}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.expTitle, { color: isMe ? '#fff' : T.ink }]} numberOfLines={1}>
              {meta.title || 'Cheltuială'}
            </Text>
            <Text style={[styles.expMeta, { color: isMe ? 'rgba(255,255,255,0.75)' : T.ink3 }]}>
              {(meta.category || '—')}{meta.date ? ` · ${formatDate(meta.date)}` : ''}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.expAmount, display(700), { color: isMe ? '#fff' : T.brand }]}>
              {Number(meta.amount || 0).toFixed(2)}
            </Text>
            <Text style={[styles.expCurrency, { color: isMe ? 'rgba(255,255,255,0.7)' : T.ink4 }]}>
              {meta.currency || 'RON'}
            </Text>
          </View>
        </View>
      </View>
      <Text style={[styles.bubbleTime, { textAlign: isMe ? 'right' : 'left' }]}>
        {fmtTime(msg.createdAt)}{isMe ? ' · ✓✓' : ''}
      </Text>
    </View>
  );
}

export default function FriendsChatScreen({ navigation, route }) {
  const friendInfo = route?.params?.friend || null;
  // Support both shapes: { friend: { id, name, ... } } or { friend: { friend: {...} } } from FriendsScreen
  const friend = friendInfo?.friend || friendInfo;
  const friendId = friend?.id;

  const me = useStore(s => s.user);
  const messages = useStore(s => s.chatByFriend?.[friendId] || []);
  const fetchChatMessages = useStore(s => s.fetchChatMessages);
  const sendChatMessage = useStore(s => s.sendChatMessage);
  const deleteChatMessage = useStore(s => s.deleteChatMessage);
  const markChatRead = useStore(s => s.markChatRead);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  const pollRef = useRef(null);
  const appState = useRef(AppState.currentState);

  const load = useCallback(async () => {
    if (!friendId) return;
    await fetchChatMessages(friendId);
  }, [friendId, fetchChatMessages]);

  useEffect(() => {
    if (!friendId) return;
    (async () => {
      try {
        await load();
        await markChatRead(friendId);
      } finally {
        setLoading(false);
      }
    })();
  }, [friendId, load, markChatRead]);

  // Polling for new messages while the screen is mounted + foreground
  useEffect(() => {
    if (!friendId) return undefined;
    const tick = () => { fetchChatMessages(friendId); };
    pollRef.current = setInterval(tick, POLL_INTERVAL_MS);

    const sub = AppState.addEventListener('change', (next) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        tick();
      }
      appState.current = next;
    });

    return () => {
      clearInterval(pollRef.current);
      sub.remove();
    };
  }, [friendId, fetchChatMessages]);

  // Auto-scroll on new messages
  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [messages.length]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput('');
    try {
      await sendChatMessage(friendId, { text, kind: 'text' });
    } catch (e) {
      Alert.alert('Eroare', e?.response?.data?.error || 'Mesajul nu a fost trimis.');
    } finally {
      setSending(false);
    }
  };

  const handleLongPress = (msg) => {
    if (msg.fromUserId !== me?.id) return;
    Alert.alert(
      'Mesaj',
      msg.text || '—',
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Șterge', style: 'destructive',
          onPress: async () => {
            try { await deleteChatMessage(friendId, msg.id); }
            catch (e) { Alert.alert('Eroare', e?.response?.data?.error || 'Nu pot șterge.'); }
          },
        },
      ]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try { await load(); }
    finally { setRefreshing(false); }
  };

  const items = useMemo(() => {
    const out = [];
    let lastDay = null;
    messages.forEach(m => {
      const d = new Date(m.createdAt || m.at);
      const day = d.toDateString();
      if (day !== lastDay) {
        out.push({ kind: 'divider', day: d, id: `d-${day}` });
        lastDay = day;
      }
      out.push({ kind: 'msg', m, id: m.id });
    });
    return out;
  }, [messages]);

  if (!friend || !friendId) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.friendName}>Chat</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>👤</Text>
          <Text style={styles.emptyTitle}>Niciun prieten selectat</Text>
          <Text style={styles.emptySub}>Deschide chat-ul dintr-un contact din lista de prieteni.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const initials = friend.initials || initialsOf(friend.name);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <View style={styles.avatar}>
          <Text style={[styles.avatarText, display(700)]}>{initials}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.friendName} numberOfLines={1}>{friend.name || 'Prieten'}</Text>
          <Text style={styles.friendStatus} numberOfLines={1}>{friend.email || ''}</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {loading ? (
          <ActivityIndicator color={T.brand} style={{ marginTop: 60 }} />
        ) : (
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.messages}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.brand} />}
          >
            {items.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>💬</Text>
                <Text style={styles.emptyTitle}>Niciun mesaj încă</Text>
                <Text style={styles.emptySub}>Trimite primul mesaj — apare aici instant.</Text>
              </View>
            ) : items.map(it => {
              if (it.kind === 'divider') return <DayDivider key={it.id} day={it.day} />;
              const m = it.m;
              const isMe = m.fromUserId === me?.id;
              if (m.kind === 'doc-share')     return <DocBubble key={m.id} msg={m} isMe={isMe} />;
              if (m.kind === 'expense-share') return <ExpenseBubble key={m.id} msg={m} isMe={isMe} />;
              return (
                <TextBubble
                  key={m.id}
                  msg={m}
                  isMe={isMe}
                  onLongPress={() => handleLongPress(m)}
                />
              );
            })}
          </ScrollView>
        )}

        <View style={styles.composer}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Scrie un mesaj…"
            placeholderTextColor={T.ink4}
            multiline
            style={styles.composerInput}
          />
          <TouchableOpacity
            disabled={!input.trim() || sending}
            onPress={send}
            style={[styles.sendBtn, (!input.trim() || sending) && { backgroundColor: T.ink4, shadowOpacity: 0 }]}
            activeOpacity={0.85}
          >
            {sending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.sendArrow}>→</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 12, paddingVertical: 12,
    backgroundColor: T.card, borderBottomWidth: 1, borderBottomColor: T.line,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  backArrow: { color: T.brand, fontSize: 28, lineHeight: 30 },
  avatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: T.brand,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 14, fontWeight: FONTS.bold, letterSpacing: -0.3 },
  friendName: { fontSize: 14, fontWeight: FONTS.bold, color: T.ink },
  friendStatus: { fontSize: 11, color: T.ink3, fontWeight: FONTS.medium },

  empty: { alignItems: 'center', paddingHorizontal: 30, paddingVertical: 60 },
  emptyIcon: { fontSize: 56 },
  emptyTitle: { fontSize: 18, color: T.ink, fontWeight: FONTS.bold, marginTop: 10 },
  emptySub: { fontSize: 13, color: T.ink3, marginTop: 6, textAlign: 'center' },

  messages: { padding: 12, gap: 6, flexGrow: 1 },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: T.line },
  dividerText: {
    fontSize: 10, fontWeight: FONTS.bold, color: T.ink3,
    backgroundColor: T.bgSoft, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: RADIUS.full, letterSpacing: 0.6, textTransform: 'uppercase',
    overflow: 'hidden',
  },

  bubbleWrap: { maxWidth: '78%', marginVertical: 2 },
  bubbleWrapMe:   { alignSelf: 'flex-end' },
  bubbleWrapThem: { alignSelf: 'flex-start' },

  bubble: { borderRadius: 18, paddingVertical: 8, paddingHorizontal: 13 },
  bubbleMe: { backgroundColor: T.brand },
  bubbleThem: { backgroundColor: T.card, borderWidth: 1, borderColor: T.line },
  bubbleMeCorner: { borderBottomRightRadius: 4 },
  bubbleThemCorner: { borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14, lineHeight: 20, color: T.ink },
  bubbleTime: { fontSize: 10, color: T.ink4, marginTop: 4, paddingHorizontal: 8 },

  docCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 18, padding: 10, minWidth: 220,
  },
  docIconWrap: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  docKicker: { fontSize: 9, fontWeight: FONTS.bold, letterSpacing: 0.6, textTransform: 'uppercase' },
  docName: { fontSize: 13, fontWeight: FONTS.semibold, marginTop: 2 },
  docMeta: { fontSize: 10, marginTop: 2 },

  expCard: { borderRadius: 18, minWidth: 240, overflow: 'hidden' },
  expHead: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  expKicker: { fontSize: 9, fontWeight: FONTS.bold, letterSpacing: 0.7, textTransform: 'uppercase' },
  expBody: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  expTitle: { fontSize: 13, fontWeight: FONTS.semibold },
  expMeta: { fontSize: 10, marginTop: 3, textTransform: 'capitalize' },
  expAmount: { fontSize: 18, fontWeight: FONTS.bold, letterSpacing: -0.3, lineHeight: 20 },
  expCurrency: { fontSize: 9, fontWeight: FONTS.bold, marginTop: 2 },

  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    backgroundColor: T.card,
    borderTopWidth: 1, borderTopColor: T.line,
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 20 : 12,
  },
  composerInput: {
    flex: 1, minHeight: 40, maxHeight: 100,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: RADIUS.xl,
    borderWidth: 1, borderColor: T.line, backgroundColor: T.bg,
    fontSize: 14, color: T.ink, lineHeight: 20,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: T.brand,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: T.brand, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12,
    elevation: 4,
  },
  sendArrow: { color: '#fff', fontSize: 18, fontWeight: FONTS.bold },
});
