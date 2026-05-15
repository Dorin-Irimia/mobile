import React from 'react';
import { View, Image, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { getVehicleIcon } from '../utils/vehicleCategories';
import { getApiUrl } from '../api/client';
import { SHADOW } from '../theme';

export function VehiclePhotoSticker({ photo, category, size = 56, onPress, editable = false, style }) {
  const resolveUri = (p) => {
    if (!p) return null;
    if (p.startsWith('file://') || p.startsWith('content://')) return p;
    if (p.startsWith('http')) return p;
    return `${getApiUrl()}${p}`;
  };

  const uri = resolveUri(photo);

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.8}
      style={style}
    >
      <View style={[s.wrap, { width: size, height: size, borderRadius: size / 2 }]}>
        {uri ? (
          <Image
            source={{ uri }}
            style={{ width: size, height: size, borderRadius: size / 2 }}
            resizeMode="cover"
          />
        ) : (
          <View style={[s.emojiBg, { width: size, height: size, borderRadius: size / 2 }]}>
            <Text style={{ fontSize: size * 0.44 }}>{getVehicleIcon(category)}</Text>
          </View>
        )}

        {editable && (
          <View style={[s.editBadge, { width: size * 0.36, height: size * 0.36, borderRadius: size * 0.18, bottom: -2, right: -2 }]}>
            <Text style={{ fontSize: size * 0.2 }}>📷</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  wrap: {
    borderWidth: 2.5,
    borderColor: '#fff',
    overflow: 'visible',
    ...SHADOW.md,
  },
  emojiBg: {
    backgroundColor: 'rgba(0,0,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  editBadge: {
    position: 'absolute',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.sm,
  },
});
