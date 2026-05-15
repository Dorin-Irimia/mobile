import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SignatureCanvas from 'react-native-signature-canvas';
import useStore from '../store';
import { T, FONTS, RADIUS, SHADOW } from '../theme';
import { PrimaryButton } from '../components/ui';

const WEB_STYLE = `
  .m-signature-pad {
    box-shadow: none;
    border: none;
    margin: 0;
  }
  .m-signature-pad--body {
    border: none;
  }
  .m-signature-pad--footer {
    display: none;
  }
  body, html {
    margin: 0;
    padding: 0;
    background: #fff;
  }
`;

export default function SignatureScreen({ route, navigation }) {
  const { documentId } = route.params;
  const { signDocument } = useStore();
  const sigRef = useRef(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async (base64) => {
    if (!base64 || base64 === 'data:image/png;base64,') {
      Alert.alert('Eroare', 'Semnătura este goală. Desenează semnătura înainte de a salva.');
      return;
    }
    setSaving(true);
    try {
      await signDocument(documentId, base64);
      Alert.alert('Succes', 'Documentul a fost semnat!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert('Eroare', 'Nu s-a putut salva semnătura. Încearcă din nou.');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    sigRef.current?.clearSignature();
  };

  const handleConfirm = () => {
    sigRef.current?.readSignature();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={styles.cancelText}>✕ Anulează</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Semnează Document</Text>
        <View style={styles.cancelBtn} />
      </View>

      <View style={styles.content}>
        <Text style={styles.instruction}>Desenează semnătura în spațiul de mai jos</Text>

        <View style={styles.canvasWrapper}>
          <SignatureCanvas
            ref={sigRef}
            onOK={handleSave}
            webStyle={WEB_STYLE}
            style={styles.canvas}
            backgroundColor="#ffffff"
            penColor={T.ink}
            descriptionText=""
            clearText=""
            confirmText=""
            imageType="image/png"
          />
        </View>

        {saving && (
          <View style={styles.savingOverlay}>
            <ActivityIndicator size="large" color={T.brand} />
            <Text style={styles.savingText}>Se salvează...</Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.clearBtn} onPress={handleClear} activeOpacity={0.8}>
          <Text style={styles.clearText}>Șterge</Text>
        </TouchableOpacity>
        <PrimaryButton
          title="Salvează Semnătura"
          onPress={handleConfirm}
          loading={saving}
          style={styles.saveBtn}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
    backgroundColor: T.card,
  },
  headerTitle: { fontSize: 18, fontWeight: FONTS.bold, color: T.ink },
  cancelBtn: { minWidth: 90 },
  cancelText: { fontSize: 15, color: T.ink3, fontWeight: FONTS.medium },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 24 },
  instruction: {
    fontSize: 14,
    color: T.ink3,
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: FONTS.regular,
  },
  canvasWrapper: {
    height: 250,
    backgroundColor: '#fff',
    borderRadius: RADIUS.md,
    borderWidth: 2,
    borderColor: T.brand,
    overflow: 'hidden',
    ...SHADOW.sm,
  },
  canvas: { flex: 1 },
  savingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
  },
  savingText: { marginTop: 12, fontSize: 14, color: T.ink2, fontWeight: FONTS.medium },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: T.line,
    backgroundColor: T.card,
  },
  clearBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: T.brand,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: { color: T.brand, fontSize: 16, fontWeight: FONTS.semibold },
  saveBtn: { flex: 2 },
});
