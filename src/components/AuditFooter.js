// Tiny audit line shown at the bottom of cards in lists.
// Renders something like:  "👤 Andrei · acum 3 ore · ✎ Maria"

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { T, FONTS } from '../theme';

function relative(d) {
  if (!d) return '';
  const ms = Date.now() - new Date(d).getTime();
  if (isNaN(ms)) return '';
  const s = Math.floor(ms / 1000);
  if (s < 60) return 'acum';
  const m = Math.floor(s / 60);
  if (m < 60) return `acum ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `acum ${h} ${h === 1 ? 'oră' : 'ore'}`;
  const days = Math.floor(h / 24);
  if (days < 30) return `acum ${days} ${days === 1 ? 'zi' : 'zile'}`;
  const months = Math.floor(days / 30);
  return `acum ${months} ${months === 1 ? 'lună' : 'luni'}`;
}

function firstName(name) {
  if (!name) return '';
  return name.split(' ')[0];
}

/**
 * @param {object} props
 * @param {object} props.creator    - { id, name, email, avatar }
 * @param {object} [props.updater]  - { id, name, email, avatar }
 * @param {string} [props.createdAt]
 * @param {string} [props.updatedAt]
 * @param {object} [props.style]
 */
export default function AuditFooter({ creator, updater, createdAt, updatedAt, style }) {
  if (!creator && !updater) return null;
  const showUpdater = updater && updater.id && updater.id !== creator?.id;
  return (
    <View style={[styles.row, style]}>
      {creator && (
        <Text style={styles.text}>
          👤 <Text style={styles.name}>{firstName(creator.name) || creator.email}</Text>
          {createdAt ? <Text style={styles.dim}> · {relative(createdAt)}</Text> : null}
        </Text>
      )}
      {showUpdater && (
        <Text style={styles.text}>
          <Text style={styles.dim}> · </Text>✎ <Text style={styles.name}>{firstName(updater.name) || updater.email}</Text>
          {updatedAt ? <Text style={styles.dim}> {relative(updatedAt)}</Text> : null}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 6 },
  text: { fontSize: 10, color: T.ink3, fontWeight: FONTS.medium },
  name: { color: T.ink2, fontWeight: FONTS.semibold },
  dim: { color: T.ink4 },
});
