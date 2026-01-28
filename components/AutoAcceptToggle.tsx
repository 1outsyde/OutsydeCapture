import React from "react";
import { View, Switch, StyleSheet, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface AutoAcceptToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
  loading?: boolean;
  disabled?: boolean;
}

export default function AutoAcceptToggle({
  value,
  onChange,
  loading = false,
  disabled = false,
}: AutoAcceptToggleProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.card }]}>
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: value ? theme.success + "20" : theme.backgroundSecondary }]}>
          <Feather 
            name={value ? "check-circle" : "clock"} 
            size={24} 
            color={value ? theme.success : theme.textSecondary} 
          />
        </View>
        <View style={styles.textContainer}>
          <ThemedText style={styles.title}>Auto-Accept Bookings</ThemedText>
          <ThemedText style={[styles.description, { color: theme.textSecondary }]}>
            {value 
              ? "New bookings are confirmed immediately after payment"
              : "New bookings require your approval within 24 hours"
            }
          </ThemedText>
        </View>
        {loading ? (
          <ActivityIndicator size="small" color={theme.primary} />
        ) : (
          <Switch
            value={value}
            onValueChange={onChange}
            disabled={disabled || loading}
            trackColor={{ false: theme.backgroundSecondary, true: theme.success + "60" }}
            thumbColor={value ? theme.success : theme.textSecondary}
          />
        )}
      </View>
      {!value && (
        <View style={[styles.warningBanner, { backgroundColor: theme.warning + "15" }]}>
          <Feather name="alert-circle" size={14} color={theme.warning} />
          <ThemedText style={[styles.warningText, { color: theme.warning }]}>
            Pending bookings expire after 24 hours if not accepted
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    gap: Spacing.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
  },
  warningText: {
    fontSize: 12,
    flex: 1,
  },
});
