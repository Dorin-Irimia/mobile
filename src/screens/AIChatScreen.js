import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../api/client';
import { T, RADIUS, FONTS, SHADOW } from '../theme';

const WELCOME_MSG = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Bună! Sunt Urbio AI, asistentul tău auto. Te pot ajuta cu informații despre ITP, RCA, CASCO, întreținere vehicule și legislație auto românească. Cu ce te pot ajuta?',
  time: new Date(),
};

const QUICK_SUGGESTIONS = [
  { label: '📅 Când scade RCA-ul?', value: 'Când scade RCA-ul meu?' },
  { label: '🔧 Service recomandat', value: 'Recomandă-mi un service auto' },
  { label: '⛽ Consum carburant', value: 'Cum îmi calculez consumul de carburant?' },
  { label: '📋 Documente necesare ITP', value: 'Ce documente sunt necesare pentru ITP?' },
];

function BouncingDots() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const bounce = (dot, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: -6, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(600 - delay),
        ]),
      ).start();
    bounce(dot1, 0);
    bounce(dot2, 150);
    bounce(dot3, 300);
  }, [dot1, dot2, dot3]);

  const dotStyle = dot => ({
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: T.ink4,
    marginHorizontal: 2,
    transform: [{ translateY: dot }],
  });

  return (
    <View style={styles.dotsContainer}>
      <View style={styles.aiAvatar}>
        <Text style={styles.aiAvatarText}>🤖</Text>
      </View>
      <View style={styles.dotsRow}>
        <Animated.View style={dotStyle(dot1)} />
        <Animated.View style={dotStyle(dot2)} />
        <Animated.View style={dotStyle(dot3)} />
      </View>
    </View>
  );
}

function formatTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
}

export default function AIChatScreen({ navigation }) {
  const [messages, setMessages] = useState([WELCOME_MSG]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef(null);
  const userMessageSent = messages.some(m => m.role === 'user');

  const sendMessage = async (overrideText) => {
    const text = (overrideText !== undefined ? overrideText : inputText).trim();
    if (!text || isLoading) return;
    const userMsg = { id: Date.now(), role: 'user', content: text, time: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);
    try {
      const { data } = await api.post('/ai/chat', {
        messages: [...messages.filter(m => m.role !== 'system'), { role: 'user', content: text }].map(m => ({
          role: m.role,
          content: m.content,
        })),
      });
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'assistant',
          content: data.reply,
          time: new Date(),
        },
      ]);
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'assistant',
          content: 'Scuze, am întâmpinat o eroare. Verifică conexiunea.',
          time: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessage = ({ item }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowAI]}>
        {!isUser && (
          <View style={styles.aiAvatar}>
            <Text style={styles.aiAvatarText}>🤖</Text>
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
          <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextAI]}>
            {item.content}
          </Text>
          <Text style={[styles.timestamp, isUser ? styles.timestampUser : styles.timestampAI]}>
            {formatTime(item.time)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>🤖 Urbio AI</Text>
          <Text style={styles.headerSubtitle}>Asistent auto inteligent</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}>
        <FlatList
          ref={flatListRef}
          data={[...messages].reverse()}
          keyExtractor={item => String(item.id)}
          renderItem={renderMessage}
          inverted
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={isLoading ? <BouncingDots /> : null}
        />

        {!userMessageSent && (
          <View style={styles.suggestionsContainer}>
            <View style={styles.suggestionsGrid}>
              {QUICK_SUGGESTIONS.map((s, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.suggestionPill}
                  onPress={() => sendMessage(s.value)}>
                  <Text style={styles.suggestionText}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={styles.inputContainer}>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Întreabă ceva despre vehiculul tău..."
              placeholderTextColor={T.ink4}
              multiline
              maxHeight={80}
              returnKeyType="send"
              blurOnSubmit={false}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!inputText.trim() || isLoading) && styles.sendBtnDisabled]}
              onPress={() => sendMessage()}
              disabled={!inputText.trim() || isLoading}>
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.sendIcon}>→</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: T.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
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
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: FONTS.semibold,
    color: T.ink,
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: T.ink4,
    marginTop: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  msgRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  msgRowUser: {
    justifyContent: 'flex-end',
  },
  msgRowAI: {
    justifyContent: 'flex-start',
  },
  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: T.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    flexShrink: 0,
  },
  aiAvatarText: {
    fontSize: 14,
  },
  bubble: {
    maxWidth: '75%',
    borderRadius: 18,
    padding: 12,
  },
  bubbleUser: {
    backgroundColor: T.brand,
    borderBottomRightRadius: 4,
  },
  bubbleAI: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: FONTS.regular,
  },
  bubbleTextUser: {
    color: '#FFFFFF',
  },
  bubbleTextAI: {
    color: T.ink,
  },
  timestamp: {
    fontSize: 10,
    fontFamily: FONTS.regular,
    marginTop: 4,
  },
  timestampUser: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'right',
  },
  timestampAI: {
    color: T.ink4,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  suggestionsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  suggestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionPill: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: RADIUS.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
    width: '48%',
  },
  suggestionText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: T.ink2,
    textAlign: 'center',
  },
  inputContainer: {
    backgroundColor: T.card,
    borderTopWidth: 1,
    borderTopColor: T.line,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: RADIUS.xl,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: T.ink,
    maxHeight: 80,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: T.brand,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.sm,
  },
  sendBtnDisabled: {
    backgroundColor: T.ink4,
  },
  sendIcon: {
    fontSize: 20,
    color: '#FFFFFF',
    fontFamily: FONTS.bold,
    marginLeft: 2,
  },
});
