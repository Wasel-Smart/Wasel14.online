import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';

/**
 * Wasel brand mark: a cyan rounded tile with a bold "W" and a small green
 * "waypoint" dot — the dot is the signature (a stop on the route), so the mark
 * reads as movement/arrival rather than a generic letter badge.
 */
export const BrandMark = React.memo(function BrandMark({ size = 88 }: { size?: number }) {
  const dot = Math.max(10, Math.round(size * 0.2));
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: Math.round(size * 0.3) },
      ]}
    >
      <Text style={[styles.letter, { fontSize: Math.round(size * 0.56), lineHeight: Math.round(size * 0.7) }]}>W</Text>
      <View
        style={[
          styles.dot,
          {
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            top: Math.round(size * 0.12),
            end: Math.round(size * 0.12),
            borderWidth: Math.max(2, Math.round(size * 0.04)),
          },
        ]}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
  letter: {
    color: colors.onPrimary,
    fontWeight: '900',
    includeFontPadding: false,
    textAlign: 'center',
  },
  dot: {
    backgroundColor: colors.secondary,
    borderColor: colors.primary,
    position: 'absolute',
  },
});

export default BrandMark;
