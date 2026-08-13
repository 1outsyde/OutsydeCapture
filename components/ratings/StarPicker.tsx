import React, { useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { displayToRating } from '../../types/ratings';

interface StarPickerProps {
  value: number;
  onChange: (rating: number) => void;
  size?: number;
  color?: string;
  emptyColor?: string;
  disabled?: boolean;
  showLabel?: boolean;
}

const LABELS: Record<number, string> = {
  5: 'Terrible',
  10: 'Bad',
  15: 'Poor',
  20: 'Below Average',
  25: 'Average',
  30: 'Decent',
  35: 'Good',
  40: 'Very Good',
  45: 'Excellent',
  50: 'Outstanding',
};

export function StarPicker({
  value,
  onChange,
  size = 36,
  color = '#C9933A',
  emptyColor = '#D1D5DB',
  disabled = false,
  showLabel = true,
}: StarPickerProps) {
  const currentStars = value / 10;

  const handlePress = useCallback(
    (stars: number) => {
      if (disabled) return;
      onChange(displayToRating(stars));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [disabled, onChange],
  );

  return (
    <View style={styles.container}>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((position) => {
          const filled = currentStars >= position;
          const half = !filled && currentStars >= position - 0.5;
          return (
            <View key={position} style={[styles.starWrapper, { width: size + 8, height: size + 8 }]}>
              <TouchableOpacity
                style={[styles.halfZone, styles.leftZone]}
                onPress={() => handlePress(position - 0.5)}
                disabled={disabled}
                activeOpacity={0.7}
              />
              <TouchableOpacity
                style={[styles.halfZone, styles.rightZone]}
                onPress={() => handlePress(position)}
                disabled={disabled}
                activeOpacity={0.7}
              />
              <View style={styles.starVisual} pointerEvents="none">
                {filled && <Ionicons name="star" size={size} color={color} />}
                {half && <Ionicons name="star-half" size={size} color={color} />}
                {!filled && !half && <Ionicons name="star-outline" size={size} color={emptyColor} />}
              </View>
            </View>
          );
        })}
      </View>
      {showLabel && value > 0 && (
        <Text style={styles.label}>{LABELS[value] ?? `${currentStars} stars`}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 8,
  },
  stars: {
    flexDirection: 'row',
    gap: 4,
  },
  starWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  halfZone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '50%',
    zIndex: 1,
  },
  leftZone: {
    left: 0,
  },
  rightZone: {
    right: 0,
  },
  starVisual: {
    position: 'absolute',
  },
  label: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
});
