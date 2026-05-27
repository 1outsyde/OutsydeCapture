import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { SubscriptionTier } from "@/services/api";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDollars(cents: number): string {
  const dollars = cents / 100;
  return dollars % 1 === 0 ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

export function formatTierPrice(tier: SubscriptionTier): string {
  if (tier.priceLabel) return tier.priceLabel;
  if (typeof tier.priceInCents === "number") {
    return `${formatDollars(tier.priceInCents)}/${tier.interval || "mo"}`;
  }
  if (typeof tier.price === "number") {
    return `${formatDollars(tier.price)}/${tier.interval || "mo"}`;
  }
  return "";
}

export function formatTierName(tier: SubscriptionTier): string {
  if (tier.displayName) return tier.displayName;
  const n = tier.name || "";
  return n.charAt(0).toUpperCase() + n.slice(1);
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface TierCardListProps {
  tiers: SubscriptionTier[];
  selectedTierId: string | null;
  onSelectTier: (tierId: string) => void;
  currentSubscriptionTierId?: string;
  disabled?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function TierCardList({
  tiers,
  selectedTierId,
  onSelectTier,
  currentSubscriptionTierId,
  disabled = false,
}: TierCardListProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.tiersContainer, disabled && { opacity: 0.5 }]}>
      {tiers.map((tier) => {
        const isSelected = selectedTierId === tier.id;
        const isCurrentPlan = currentSubscriptionTierId === tier.id;
        const isPopular = tier.badge === "Most Popular";
        const isBestValue = tier.badge === "Best Value";

        return (
          <Pressable
            key={tier.id}
            style={[
              styles.tierCard,
              {
                borderColor: isCurrentPlan
                  ? "#22c55e"
                  : isSelected
                  ? theme.primary
                  : theme.border,
                backgroundColor: theme.card,
              },
              isSelected && !isCurrentPlan && { backgroundColor: theme.primary + "10" },
              isCurrentPlan && { borderWidth: 2, borderColor: "#22c55e" },
            ]}
            onPress={() => {
              if (!isCurrentPlan && !disabled) {
                onSelectTier(tier.id);
              }
            }}
            disabled={isCurrentPlan || disabled}
          >
            {isCurrentPlan ? (
              <View style={styles.currentPlanBadge}>
                <Text style={styles.currentPlanBadgeText}>Current Plan</Text>
              </View>
            ) : tier.badge ? (
              <View
                style={[
                  styles.tierBadge,
                  {
                    backgroundColor: isPopular
                      ? theme.primary
                      : isBestValue
                      ? "#7c3aed"
                      : theme.primary,
                  },
                ]}
              >
                <Text style={styles.tierBadgeText}>{tier.badge}</Text>
              </View>
            ) : null}

            <View style={styles.tierHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.tierName, { color: theme.text }]}>
                  {formatTierName(tier)}
                </Text>
                <Text
                  style={[
                    styles.tierPrice,
                    { color: isCurrentPlan ? "#22c55e" : theme.primary },
                  ]}
                >
                  {formatTierPrice(tier)}
                </Text>
              </View>
              {isCurrentPlan ? (
                <Feather name="check-circle" size={22} color="#22c55e" />
              ) : isSelected ? (
                <Feather name="check-circle" size={22} color={theme.primary} />
              ) : null}
            </View>

            {tier.description ? (
              <Text style={[styles.tierDesc, { color: theme.textSecondary }]}>
                {tier.description}
              </Text>
            ) : null}

            {(tier.features || []).map((f, i) => (
              <View key={i} style={styles.tierFeatureRow}>
                <Feather name="check" size={13} color="#22c55e" />
                <Text style={[styles.tierFeatureText, { color: theme.textSecondary }]}>
                  {f}
                </Text>
              </View>
            ))}
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  tiersContainer: {
    gap: 14,
    marginBottom: 20,
  },
  tierCard: {
    borderRadius: 16,
    borderWidth: 2,
    paddingTop: 32,
    paddingHorizontal: 18,
    paddingBottom: 18,
    position: "relative",
    overflow: "hidden",
  },
  tierBadge: {
    position: "absolute",
    top: 14,
    right: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  tierBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#000",
  },
  tierHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  tierName: {
    fontSize: 19,
    fontWeight: "800",
  },
  tierPrice: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 2,
  },
  tierDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  tierFeatureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  tierFeatureText: {
    fontSize: 13,
    flex: 1,
  },
  currentPlanBadge: {
    position: "absolute",
    top: 8,
    right: 16,
    backgroundColor: "#22c55e",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 100,
    alignItems: "center",
    zIndex: 10,
  },
  currentPlanBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
});
