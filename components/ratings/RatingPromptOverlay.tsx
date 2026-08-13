import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PurchaseItem } from '../../types/ratings';
import { RatingBottomSheet } from './RatingBottomSheet';

interface RatingPromptOverlayProps {
  visible: boolean;
  onClose: () => void;
  onRate: (rating: number, purchaseId: string, purchaseType: string) => Promise<void>;
  purchases: PurchaseItem[];
}

const GOLD = '#C9933A';
// Approximate tab-bar height so the card sits above it
const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 83 : 60;

export function RatingPromptOverlay({
  visible,
  onClose,
  onRate,
  purchases,
}: RatingPromptOverlayProps) {
  const insets = useSafeAreaInsets();
  const [sheetVisible, setSheetVisible] = useState(false);

  if (!visible || purchases.length === 0) return null;

  const purchase = purchases[0];

  const handleRateNow = () => setSheetVisible(true);

  const handleSheetClose = () => setSheetVisible(false);

  const handleSubmit = async (
    rating: number,
    purchaseId: string,
    purchaseType: string,
  ) => {
    await onRate(rating, purchaseId, purchaseType);
    setSheetVisible(false);
    onClose();
  };

  return (
    // pointerEvents="box-none" lets touches pass through the transparent area to navigation
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View
        style={[
          styles.card,
          { bottom: TAB_BAR_HEIGHT + Math.max(insets.bottom, 8) },
        ]}
        // The card itself captures touches normally
        pointerEvents="auto"
      >
        <View style={styles.iconRow}>
          <Ionicons name="star" size={18} color={GOLD} />
          <Ionicons name="star" size={18} color={GOLD} />
          <Ionicons name="star" size={18} color={GOLD} />
        </View>

        <Text style={styles.headline}>How was your experience?</Text>
        <Text style={styles.sub} numberOfLines={2}>
          {purchase.label}
        </Text>

        <View style={styles.buttons}>
          <TouchableOpacity style={styles.laterBtn} onPress={onClose}>
            <Text style={styles.laterText}>Maybe Later</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.rateBtn} onPress={handleRateNow}>
            <Text style={styles.rateText}>Rate Now</Text>
          </TouchableOpacity>
        </View>
      </View>

      <RatingBottomSheet
        visible={sheetVisible}
        onClose={handleSheetClose}
        onSubmit={handleSubmit}
        targetType={purchase.targetType}
        targetId={purchase.targetId}
        targetName={purchase.label}
        purchases={purchases}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    gap: 8,
  },
  iconRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 2,
  },
  headline: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  sub: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  buttons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  laterBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingVertical: 11,
    alignItems: 'center',
  },
  laterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  rateBtn: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: GOLD,
    paddingVertical: 11,
    alignItems: 'center',
  },
  rateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
