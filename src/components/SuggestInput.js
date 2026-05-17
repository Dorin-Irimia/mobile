// TextInput with an autocomplete dropdown driven by the on-device
// suggestions store. Use it anywhere the user types free-form text we
// want to remember and re-surface — invoice/expense titles, merchants,
// stations, locations, notes, etc.
//
// Usage:
//   <SuggestInput
//     field="merchant"
//     value={merchant}
//     onChangeText={setMerchant}
//     placeholder="Magazin"
//     style={styles.input}
//   />

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import useStore from '../store';
import { T, RADIUS, FONTS, SPACING, SHADOW } from '../theme';
import { pickSuggestions } from '../utils/suggestionsStore';

export default function SuggestInput({
  field,
  value,
  onChangeText,
  style,
  inputStyle,
  containerStyle,
  maxSuggestions = 6,
  showOnFocusEmpty = true,
  rightAccessory,
  ...rest
}) {
  const suggestionsMap = useStore(s => s.suggestions);
  const [focused, setFocused] = useState(false);

  const list = useMemo(() => {
    if (!focused) return [];
    return pickSuggestions(suggestionsMap, field, value, maxSuggestions);
  }, [focused, suggestionsMap, field, value, maxSuggestions]);

  const showDropdown =
    focused &&
    list.length > 0 &&
    (showOnFocusEmpty || (value && String(value).trim().length > 0));

  const handlePick = useCallback((picked) => {
    onChangeText?.(picked);
  }, [onChangeText]);

  return (
    <View style={[styles.wrap, containerStyle]}>
      <View style={[styles.inputWrap, style]}>
        <TextInput
          {...rest}
          value={value}
          onChangeText={onChangeText}
          onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
          onBlur={(e) => {
            // Delay so a tap on a suggestion can fire before we unmount.
            setTimeout(() => setFocused(false), 120);
            rest.onBlur?.(e);
          }}
          style={[styles.input, inputStyle]}
          placeholderTextColor={rest.placeholderTextColor || T.ink4}
        />
        {rightAccessory}
      </View>

      {showDropdown && (
        <View style={styles.dropdown}>
          {list.map((item, index) => (
            <Pressable
              key={`${item}-${index}`}
              onPress={() => handlePick(item)}
              style={({ pressed }) => [
                styles.option,
                index < list.length - 1 && styles.optionDivider,
                pressed && { backgroundColor: T.brandTint },
              ]}
            >
              <Text style={styles.optionIcon}>🕐</Text>
              <Text style={styles.optionText} numberOfLines={1}>
                {item}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  inputWrap: { flexDirection: 'row', alignItems: 'center' },
  input: {
    flex: 1,
    fontSize: 15,
    color: T.ink,
    padding: 0,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    backgroundColor: T.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: T.line,
    zIndex: 1000,
    elevation: 8,
    ...SHADOW.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
  },
  optionDivider: { borderBottomWidth: 1, borderBottomColor: T.line2 },
  optionIcon: { fontSize: 13, opacity: 0.6 },
  optionText: { flex: 1, fontSize: 14, color: T.ink, fontWeight: FONTS.medium },
});
