import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ratingToStars } from '../../types/ratings';

interface StarDisplayProps {
  rating: number;
  size?: number;
  color?: string;
  emptyColor?: string;
  style?: object;
}

export function StarDisplay({
  rating,
  size = 16,
  color = '#C9933A',
  emptyColor = '#D1D5DB',
  style,
}: StarDisplayProps) {
  const stars = ratingToStars(rating);

  return (
    <View style={[styles.container, style]}>
      {[1, 2, 3, 4, 5].map((position) => {
        const filled = stars >= position;
        const half = !filled && stars >= position - 0.5;
        return (
          <View key={position}>
            {filled && <Ionicons name="star" size={size} color={color} />}
            {half && <Ionicons name="star-half" size={size} color={color} />}
            {!filled && !half && <Ionicons name="star-outline" size={size} color={emptyColor} />}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
});
