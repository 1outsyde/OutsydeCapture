import React, { useState } from "react";
import {
  View,
  Modal,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface RefundModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (amount?: number) => Promise<void>;
  bookingAmount: number;
  clientName: string;
  serviceName: string;
}

export default function RefundModal({
  visible,
  onClose,
  onConfirm,
  bookingAmount,
  clientName,
  serviceName,
}: RefundModalProps) {
  const { theme } = useTheme();
  const [isFullRefund, setIsFullRefund] = useState(true);
  const [partialAmount, setPartialAmount] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setError(null);
    setProcessing(true);
    
    try {
      const amount = isFullRefund ? undefined : parseFloat(partialAmount);
      if (!isFullRefund && (isNaN(amount!) || amount! <= 0 || amount! > bookingAmount)) {
        setError("Please enter a valid refund amount");
        setProcessing(false);
        return;
      }
      await onConfirm(amount);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to process refund");
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    if (!processing) {
      setIsFullRefund(true);
      setPartialAmount("");
      setError(null);
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: theme.card }]}>
          <View style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: theme.error + "15" }]}>
              <Feather name="dollar-sign" size={24} color={theme.error} />
            </View>
            <ThemedText style={styles.title}>Issue Refund</ThemedText>
            <Pressable onPress={handleClose} disabled={processing} style={styles.closeButton}>
              <Feather name="x" size={24} color={theme.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.details}>
            <View style={styles.detailRow}>
              <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Client</ThemedText>
              <ThemedText style={styles.value}>{clientName}</ThemedText>
            </View>
            <View style={styles.detailRow}>
              <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Service</ThemedText>
              <ThemedText style={styles.value}>{serviceName}</ThemedText>
            </View>
            <View style={styles.detailRow}>
              <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Original Amount</ThemedText>
              <ThemedText style={[styles.value, styles.amount]}>${bookingAmount.toFixed(2)}</ThemedText>
            </View>
          </View>

          <View style={styles.refundOptions}>
            <Pressable
              style={[
                styles.optionButton,
                { borderColor: isFullRefund ? theme.primary : theme.border },
                isFullRefund && { backgroundColor: theme.primary + "10" }
              ]}
              onPress={() => setIsFullRefund(true)}
            >
              <Feather 
                name={isFullRefund ? "check-circle" : "circle"} 
                size={20} 
                color={isFullRefund ? theme.primary : theme.textSecondary} 
              />
              <View style={styles.optionText}>
                <ThemedText style={styles.optionTitle}>Full Refund</ThemedText>
                <ThemedText style={[styles.optionDesc, { color: theme.textSecondary }]}>
                  Refund ${bookingAmount.toFixed(2)}
                </ThemedText>
              </View>
            </Pressable>

            <Pressable
              style={[
                styles.optionButton,
                { borderColor: !isFullRefund ? theme.primary : theme.border },
                !isFullRefund && { backgroundColor: theme.primary + "10" }
              ]}
              onPress={() => setIsFullRefund(false)}
            >
              <Feather 
                name={!isFullRefund ? "check-circle" : "circle"} 
                size={20} 
                color={!isFullRefund ? theme.primary : theme.textSecondary} 
              />
              <View style={styles.optionText}>
                <ThemedText style={styles.optionTitle}>Partial Refund</ThemedText>
                <ThemedText style={[styles.optionDesc, { color: theme.textSecondary }]}>
                  Specify custom amount
                </ThemedText>
              </View>
            </Pressable>

            {!isFullRefund && (
              <View style={styles.partialInputContainer}>
                <ThemedText style={[styles.dollarSign, { color: theme.text }]}>$</ThemedText>
                <TextInput
                  style={[styles.partialInput, { color: theme.text, borderColor: theme.border }]}
                  value={partialAmount}
                  onChangeText={setPartialAmount}
                  placeholder="0.00"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="decimal-pad"
                  editable={!processing}
                />
              </View>
            )}
          </View>

          {error && (
            <View style={[styles.errorBanner, { backgroundColor: theme.error + "15" }]}>
              <Feather name="alert-circle" size={16} color={theme.error} />
              <ThemedText style={[styles.errorText, { color: theme.error }]}>{error}</ThemedText>
            </View>
          )}

          <View style={styles.actions}>
            <Pressable
              style={[styles.cancelButton, { borderColor: theme.border }]}
              onPress={handleClose}
              disabled={processing}
            >
              <ThemedText style={{ color: theme.text }}>Cancel</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.confirmButton, { backgroundColor: theme.error }]}
              onPress={handleConfirm}
              disabled={processing}
            >
              {processing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <ThemedText style={styles.confirmButtonText}>Issue Refund</ThemedText>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  modal: {
    width: "100%",
    maxWidth: 400,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  details: {
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: 14,
  },
  value: {
    fontSize: 14,
    fontWeight: "500",
  },
  amount: {
    fontSize: 16,
    fontWeight: "700",
  },
  refundOptions: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: "500",
  },
  optionDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  partialInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xs,
    paddingLeft: Spacing.lg + 28,
  },
  dollarSign: {
    fontSize: 18,
    fontWeight: "600",
    marginRight: Spacing.xs,
  },
  partialInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  errorText: {
    fontSize: 13,
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
  },
  confirmButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  confirmButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
