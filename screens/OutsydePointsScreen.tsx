import React from "react";
import { StyleSheet, View, FlatList } from "react-native";
import { Feather } from "@expo/vector-icons";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import Card from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useLoyalty, PointsTransaction } from "@/context/LoyaltyContext";
import { Spacing, BorderRadius } from "@/constants/theme";

export default function OutsydePointsScreen() {
  const { theme } = useTheme();
  const { points, transactions, isLoading } = useLoyalty();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const renderTransaction = ({ item }: { item: PointsTransaction }) => (
    <Card style={styles.transactionItem}>
      <View style={styles.transactionContent}>
        <View style={styles.transactionLeft}>
          <View
            style={[
              styles.transactionIcon,
              {
                backgroundColor:
                  item.type === "earned"
                    ? theme.success + "26"
                    : theme.error + "26",
              },
            ]}
          >
            <Feather
              name={item.type === "earned" ? "plus" : "minus"}
              size={16}
              color={item.type === "earned" ? theme.success : theme.error}
            />
          </View>
          <View style={styles.transactionInfo}>
            <ThemedText type="body">{item.description}</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {formatDate(item.date)}
            </ThemedText>
          </View>
        </View>
        <ThemedText
          type="body"
          style={{
            color: item.type === "earned" ? theme.success : theme.error,
            fontWeight: "600",
          }}
        >
          {item.type === "earned" ? "+" : "-"}
          {item.amount}
        </ThemedText>
      </View>
    </Card>
  );

  return (
    <ScreenScrollView>
      <View
        style={[styles.balanceCard, { backgroundColor: theme.primary }]}
      >
        <Feather name="star" size={32} color="#FFFFFF" />
        <ThemedText type="h1" style={styles.balanceText}>
          {points.toLocaleString()}
        </ThemedText>
        <ThemedText type="body" style={styles.balanceLabel}>
          Outsyde Points
        </ThemedText>
      </View>

      <View style={styles.earnSection}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          Ways to Earn
        </ThemedText>
        <Card style={styles.earnCard}>
          <View style={[styles.earnItem, { borderBottomColor: theme.border }]}>
            <Feather name="camera" size={20} color={theme.primary} />
            <View style={styles.earnInfo}>
              <ThemedText type="body">Book a Session</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Earn 50 points per booking
              </ThemedText>
            </View>
          </View>
          <View style={[styles.earnItem, { borderBottomColor: theme.border }]}>
            <Feather name="shopping-bag" size={20} color={theme.primary} />
            <View style={styles.earnInfo}>
              <ThemedText type="body">Purchase Products</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Earn 10 points per $1 spent
              </ThemedText>
            </View>
          </View>
          <View style={[styles.earnItem, { borderBottomColor: theme.border }]}>
            <Feather name="star" size={20} color={theme.primary} />
            <View style={styles.earnInfo}>
              <ThemedText type="body">Leave a Review</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Earn 25 points per review
              </ThemedText>
            </View>
          </View>
          <View style={[styles.earnItem, { borderBottomWidth: 0 }]}>
            <Feather name="users" size={20} color={theme.primary} />
            <View style={styles.earnInfo}>
              <ThemedText type="body">Refer a Friend</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Earn 100 points per referral
              </ThemedText>
            </View>
          </View>
        </Card>
      </View>

      <View style={styles.historySection}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          Points History
        </ThemedText>
        {isLoading ? (
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            Loading...
          </ThemedText>
        ) : transactions.length === 0 ? (
          <Card style={styles.emptyState}>
            <Feather name="inbox" size={32} color={theme.textSecondary} />
            <ThemedText
              type="body"
              style={{ color: theme.textSecondary, marginTop: Spacing.md }}
            >
              No transactions yet
            </ThemedText>
          </Card>
        ) : (
          <FlatList
            data={transactions}
            keyExtractor={(item) => item.id}
            renderItem={renderTransaction}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
          />
        )}
      </View>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  balanceCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing["2xl"],
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  balanceText: {
    color: "#FFFFFF",
    marginTop: Spacing.md,
  },
  balanceLabel: {
    color: "rgba(255,255,255,0.8)",
    marginTop: Spacing.xs,
  },
  earnSection: {
    marginBottom: Spacing["2xl"],
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  earnCard: {
    padding: Spacing.lg,
  },
  earnItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  earnInfo: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  historySection: {
    marginBottom: Spacing["2xl"],
  },
  transactionItem: {
    marginBottom: 0,
  },
  transactionContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
  },
  transactionLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  transactionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  transactionInfo: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  emptyState: {
    padding: Spacing["2xl"],
    alignItems: "center",
  },
});
