import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { StarPicker } from './StarPicker';
import { PurchaseItem, RatingTargetType } from '../../types/ratings';

interface RatingBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (rating: number, purchaseId: string, purchaseType: string) => Promise<void>;
  targetType: RatingTargetType;
  targetId: string;
  targetName: string;
  purchases: PurchaseItem[];
  existingRating?: number | null;
}

export function RatingBottomSheet({
  visible,
  onClose,
  onSubmit,
  targetType,
  targetId,
  targetName,
  purchases,
  existingRating,
}: RatingBottomSheetProps) {
  const [selectedRating, setSelectedRating] = useState<number>(existingRating ?? 0);
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseItem | null>(
    purchases.length === 1 ? purchases[0] : null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = selectedRating > 0 && (purchases.length === 0 || selectedPurchase !== null);

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(
        selectedRating,
        selectedPurchase?.purchaseId ?? '',
        selectedPurchase?.purchaseType ?? '',
      );
      onClose();
    } catch {
      setError('Failed to submit rating. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.title}>Rate {targetName}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <StarPicker value={selectedRating} onChange={setSelectedRating} size={40} showLabel />

          {purchases.length > 1 && (
            <View style={styles.purchaseSection}>
              <Text style={styles.sectionLabel}>Which visit are you rating?</Text>
              {purchases.map((purchase) => (
                <TouchableOpacity
                  key={purchase.purchaseId}
                  style={[
                    styles.purchaseItem,
                    selectedPurchase?.purchaseId === purchase.purchaseId &&
                      styles.purchaseItemSelected,
                  ]}
                  onPress={() => setSelectedPurchase(purchase)}
                >
                  <Text style={styles.purchaseLabel}>{purchase.label}</Text>
                  <Text style={styles.purchaseDate}>{purchase.date}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {error !== null && <Text style={styles.error}>{error}</Text>}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit || submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>
                {existingRating ? 'Update Rating' : 'Submit Rating'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    fontSize: 16,
    color: '#6B7280',
  },
  content: {
    padding: 24,
    gap: 20,
    alignItems: 'center',
  },
  purchaseSection: {
    width: '100%',
    gap: 8,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 4,
  },
  purchaseItem: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  purchaseItemSelected: {
    borderColor: '#C9933A',
    backgroundColor: '#FFFBEB',
  },
  purchaseLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  purchaseDate: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  error: {
    fontSize: 13,
    color: '#EF4444',
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  submitBtn: {
    backgroundColor: '#C9933A',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: '#D1D5DB',
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
