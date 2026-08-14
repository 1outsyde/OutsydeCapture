import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StarPicker } from '@/components/ratings/StarPicker';
import { apiClient } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { RootStackParamList } from '@/navigation/types';
import { RatingTargetType } from '@/types/ratings';

const GOLD = '#C9933A';
const MIN_REVIEW_CHARS = 20;

type Props = NativeStackScreenProps<RootStackParamList, 'RateReview'>;

export default function RateReviewScreen({ route, navigation }: Props) {
  const { targetType, targetId, vendorName, bookingId, bookingType } = route.params;
  const { getToken } = useAuth();

  // Resolved booking — seeded from nav params when present, otherwise fetched on mount
  const [resolvedBookingId, setResolvedBookingId] = useState('');
  const [resolvedBookingType, setResolvedBookingType] = useState('');
  const [bookingFetching, setBookingFetching] = useState(!bookingId);
  const [bookingFetchError, setBookingFetchError] = useState(false);

  // StarPicker values are in ×10 format (5–50); 0 means no selection
  const [starRating, setStarRating] = useState(0);
  const [showReviewInput, setShowReviewInput] = useState(false);
  const [reviewText, setReviewText] = useState('');
  const [reviewTitle, setReviewTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Seed resolved values from nav params when present, or fetch from API when absent.
  // Auto-selects the most recent completed booking/order — no picker UI.
  useEffect(() => {
    if (bookingId) {
      setResolvedBookingId(bookingId);
      setResolvedBookingType(bookingType ?? '');
      setBookingFetching(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const token = await getToken();
        if (!token || cancelled) return;

        const [orders, appointments] = await Promise.all([
          apiClient.getRecentCompletedOrders(token, '180d'),
          apiClient.getRecentCompletedBookings(token, '180d'),
        ]);

        if (cancelled) return;

        const matchingOrders = orders
          .filter((o) => o.businessId === targetId)
          .map((o) => ({ id: o.id, type: 'order' as const, date: o.createdAt }));

        const matchingAppointments = appointments
          .filter((a) => a.businessId === targetId)
          .map((a) => ({ id: a.id, type: 'appointment' as const, date: a.appointmentDate }));

        const all = [...matchingOrders, ...matchingAppointments].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        );

        if (all.length > 0) {
          setResolvedBookingId(all[0].id);
          setResolvedBookingType(all[0].type);
        }
        // No matching booking found — rating still submits, review is skipped
        // (hasReview requires a non-empty resolvedBookingId)
      } catch {
        if (!cancelled) setBookingFetchError(true);
      } finally {
        if (!cancelled) setBookingFetching(false);
      }
    })();

    return () => { cancelled = true; };
  }, [bookingId, bookingType, targetId, getToken]);

  const canSubmit = starRating > 0 && !submitting && !submitted && !bookingFetching;
  const reviewValid = reviewText.trim().length >= MIN_REVIEW_CHARS;
  const hasReview = showReviewInput && reviewValid && !!resolvedBookingId && !!resolvedBookingType;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) {
        Alert.alert('Sign in required', 'Please sign in to submit.');
        return;
      }

      await apiClient.submitRating(
        token,
        targetType as RatingTargetType,
        targetId,
        starRating,
        resolvedBookingId,
        resolvedBookingType,
      );

      if (hasReview) {
        await apiClient.submitReview(token, {
          targetType,
          targetId,
          bookingType: resolvedBookingType,
          bookingId: resolvedBookingId,
          rating: starRating,
          title: reviewTitle.trim() || undefined,
          comment: reviewText.trim(),
        });
      }

      setSubmitted(true);
      Alert.alert(
        'Thank you!',
        hasReview
          ? 'Your rating and review have been submitted.'
          : 'Your rating has been submitted.',
        [{ text: 'Done', onPress: () => navigation.goBack() }],
      );
    } catch {
      Alert.alert('Submission failed', 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, hasReview, starRating, reviewText, reviewTitle, resolvedBookingId, resolvedBookingType, targetType, targetId, getToken, navigation]);

  const displayName = vendorName ?? (targetType === 'photographer' ? 'Rate Photographer' : 'Rate Vendor');
  const submitLabel = submitting
    ? 'Submitting...'
    : hasReview
    ? 'Submit Rating & Review'
    : 'Submit Rating';

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {displayName}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {bookingFetching ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={GOLD} size="large" />
          </View>
        ) : bookingFetchError ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.errorText}>
              Unable to load your booking history. You can still submit a star rating.
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.sectionLabel}>How was it?</Text>

            <StarPicker
              value={starRating}
              onChange={setStarRating}
              size={40}
              color={GOLD}
              showLabel
            />

            {!showReviewInput && (
              <Pressable
                style={styles.addReviewButton}
                onPress={() => setShowReviewInput(true)}
                accessibilityRole="button"
                accessibilityLabel="Add a written review"
              >
                <Text style={styles.addReviewText}>+ Add a written review</Text>
              </Pressable>
            )}

            {showReviewInput && (
              <View style={styles.reviewSection}>
                <TextInput
                  style={styles.titleInput}
                  placeholder="Title (optional)"
                  placeholderTextColor="#888888"
                  value={reviewTitle}
                  onChangeText={setReviewTitle}
                  maxLength={100}
                />
                <TextInput
                  style={styles.reviewInput}
                  placeholder="Share your experience..."
                  placeholderTextColor="#888888"
                  value={reviewText}
                  onChangeText={setReviewText}
                  multiline
                  maxLength={1000}
                  textAlignVertical="top"
                />
                <Text style={[
                  styles.charCount,
                  reviewText.length < MIN_REVIEW_CHARS && styles.charCountWarn,
                ]}>
                  {reviewText.length < MIN_REVIEW_CHARS
                    ? `${MIN_REVIEW_CHARS - reviewText.length} more characters needed`
                    : `${reviewText.length} / 1000`}
                </Text>
              </View>
            )}
          </ScrollView>
        )}

        <View style={styles.footer}>
          <Pressable
            style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel={submitLabel}
          >
            {submitting
              ? <ActivityIndicator color="#000000" />
              : <Text style={styles.submitButtonText}>{submitLabel}</Text>
            }
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1A3C34',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  errorText: {
    color: '#888888',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  body: {
    padding: 24,
    alignItems: 'center',
    gap: 24,
  },
  sectionLabel: {
    color: '#F5F0E6',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  addReviewButton: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  addReviewText: {
    color: '#C9933A',
    fontSize: 16,
    fontWeight: '500',
  },
  reviewSection: {
    width: '100%',
    gap: 12,
  },
  titleInput: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333333',
  },
  reviewInput: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 16,
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#333333',
  },
  charCount: {
    color: '#888888',
    fontSize: 12,
    textAlign: 'right',
  },
  charCountWarn: {
    color: '#E8B930',
  },
  footer: {
    padding: 16,
    paddingBottom: 24,
    backgroundColor: '#000000',
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  submitButton: {
    backgroundColor: '#C9933A',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
});
