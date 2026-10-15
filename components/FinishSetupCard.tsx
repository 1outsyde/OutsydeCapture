// FinishSetupCard — home-feed card while the account still has setup steps left (plan, payouts,
// username). Opens FinishSetupScreen. Hidden for guests, signed-out users and finished accounts.
// Data: GET /api/account-setup/status (same list as goutsyde.com/finish), re-checked on focus.

import React, { useCallback, useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { RootStackParamList } from "@/navigation/types";
import { api, type AccountSetupStatus } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { actionableSteps } from "@/utils/accountSetup";

const GOLD = "#C9933A";
const CREAM = "#F0EAD6";

const CARD_COPY: Record<string, string> = {
  plan: "Choose your plan so customers can book and buy",
  payouts: "Connect payouts so customers can book you",
  username: "Pick your username so people can find you",
  password: "Set a password to sign in anywhere",
};

export default function FinishSetupCard() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, getToken } = useAuth();
  const [status, setStatus] = useState<AccountSetupStatus | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (!user || user.isGuest) {
          setStatus(null);
          return;
        }
        try {
          const token = await getToken();
          if (!token) return;
          const s = await api.getAccountSetupStatus(token);
          if (!cancelled) setStatus(s);
        } catch {
          if (!cancelled) setStatus(null); // never block the feed on this
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [user, getToken]),
  );

  const todo = actionableSteps(status);
  if (!status || todo.length === 0) return null;

  const next = todo.find((s) => s.key === status.next) ?? todo[0];
  const done = status.steps.filter((s) => s.state === "done").length;
  const total = status.steps.length;

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={["#1A3C34", "#10241f"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.headRow}>
          <ThemedText style={styles.kicker}>FINISH YOUR SETUP</ThemedText>
          <ThemedText style={styles.count}>
            {done} of {total}
          </ThemedText>
        </View>
        <ThemedText style={styles.title}>
          {CARD_COPY[next.key] ?? next.label}
        </ThemedText>
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              { width: `${total ? (done / total) * 100 : 0}%` },
            ]}
          />
        </View>
        <Pressable
          onPress={() => navigation.navigate("FinishSetup")}
          style={styles.btn}
          accessibilityRole="button"
          accessibilityLabel={
            todo.length === 1
              ? "Finish the last setup step"
              : `Finish ${todo.length} setup steps`
          }
        >
          <ThemedText style={styles.btnText}>
            {todo.length === 1
              ? "Finish the last step"
              : `Finish ${todo.length} steps`}
          </ThemedText>
          <Feather name="arrow-right" size={16} color="#000" />
        </Pressable>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4 },
  card: {
    borderRadius: 14,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(201,147,58,0.45)",
  },
  headRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  kicker: { fontSize: 11, letterSpacing: 2.5, color: GOLD, fontWeight: "600" },
  count: { fontSize: 12, color: "rgba(240,234,214,0.75)" },
  title: { fontSize: 16, fontWeight: "700", color: CREAM, lineHeight: 21 },
  track: {
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(240,234,214,0.15)",
    overflow: "hidden",
  },
  fill: { height: 5, backgroundColor: GOLD },
  btn: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: GOLD,
    borderRadius: 10,
    minHeight: 46,
    marginTop: 2,
  },
  btnText: { fontSize: 14, fontWeight: "700", color: "#000" },
});
