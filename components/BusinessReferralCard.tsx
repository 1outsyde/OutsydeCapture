// Business referral card (2026-10-24): share your link with a business, see the businesses you
// referred and their $25 payouts. Shown on OutsydePointsScreen and BusinessDashboardScreen. Loads on
// its own (never blocks the screen) and stays hidden when signed out or when the list can't load.

import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { Feather } from "@expo/vector-icons";

import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";
import {
  BUSINESS_REFERRAL_COPY,
  businessReferralLine,
  businessReferralShareMessage,
  businessSignupLink,
  dollars,
  needsPayoutSetup,
  type BusinessReferralsInfo,
} from "@/utils/businessReferral";

const GOLD = "#E8B930";
const BG = "#0A0A0A";
const CREAM = "#F5F0E6";
const BODY = "#A8A39A";
const SURFACE = "#141414";
const BORDER = "#2A2A1A";

const isStripeUrl = (u: unknown): u is string => {
  if (typeof u !== "string") return false;
  const m = /^https:\/\/([^/?#]+)/i.exec(u);
  const host = m?.[1].toLowerCase() ?? "";
  return host === "stripe.com" || host.endsWith(".stripe.com");
};

export default function BusinessReferralCard({
  code: codeProp,
  refreshKey = 0,
  onSetupPayouts,
}: {
  /** The person's referral code, when the screen already has it. Fetched otherwise. */
  code?: string | null;
  /** Bump to reload (pull to refresh, screen focus). */
  refreshKey?: number;
  /** Vendors are paid to their business Stripe account, so the dashboard passes its own setup. */
  onSetupPayouts?: () => void;
}) {
  const { getToken } = useAuth();
  const [info, setInfo] = useState<BusinessReferralsInfo | null>(null);
  const [fetchedCode, setFetchedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [opening, setOpening] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const code = codeProp ?? fetchedCode;

  // Fetch only; state is applied in the effect's then, after an unmount check.
  const fetchCard = useCallback(async () => {
    const token = await getToken();
    if (!token) return null;
    const [list, mine] = await Promise.all([
      api.getBusinessReferrals(token),
      codeProp
        ? Promise.resolve(null)
        : api.getFriendReferral(token).catch(() => null),
    ]);
    return { list, mine };
  }, [getToken, codeProp]);

  useEffect(() => {
    let cancelled = false;
    fetchCard()
      .then((r) => {
        if (cancelled || !r) return;
        if (r.list && Array.isArray(r.list.referrals) && r.list.totals)
          setInfo(r.list);
        if (r.mine && typeof r.mine.referralCode === "string")
          setFetchedCode(r.mine.referralCode);
      })
      .catch(() => {
        // Card stays as it was (hidden on first load).
      });
    return () => {
      cancelled = true;
    };
  }, [fetchCard, refreshKey]);

  if (!info || !code) return null;
  const showSetup = needsPayoutSetup(info.referrals);

  const share = async () => {
    try {
      await Share.share({ message: businessReferralShareMessage(code) });
    } catch {
      // Share sheet closed or unavailable.
    }
  };
  const copy = async () => {
    await Clipboard.setStringAsync(businessSignupLink(code));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const setupPayouts = async () => {
    if (onSetupPayouts) {
      onSetupPayouts();
      return;
    }
    setOpening(true);
    setSetupError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("signed out");
      const { url } = await api.startPayoutSetup(token);
      if (!isStripeUrl(url)) throw new Error("bad url");
      await Linking.openURL(url);
    } catch {
      setSetupError("Couldn't open Stripe. Please try again.");
    } finally {
      setOpening(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Feather name="briefcase" size={18} color={GOLD} />
        <Text style={styles.title}>{BUSINESS_REFERRAL_COPY.cardTitle}</Text>
      </View>
      <Text style={styles.body}>{BUSINESS_REFERRAL_COPY.cardBody}</Text>

      <View style={styles.row}>
        <TouchableOpacity
          style={styles.primary}
          onPress={share}
          accessibilityRole="button"
        >
          <Feather name="share" size={16} color={BG} />
          <Text style={styles.primaryText}>Share link</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.ghost}
          onPress={copy}
          accessibilityRole="button"
        >
          <Text style={styles.ghostText}>
            {copied ? "Link copied" : "Copy link"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.stats}>
        <Stat value={String(info.totals.invited)} label="Invited" />
        <Stat value={String(info.totals.qualified)} label="Qualified" />
        <Stat value={dollars(info.totals.paidCents)} label="Paid" />
        {info.totals.waitingCents > 0 && (
          <Stat value={dollars(info.totals.waitingCents)} label="On the way" />
        )}
      </View>

      {showSetup && (
        <View style={styles.setup}>
          <Text style={styles.setupText}>
            {BUSINESS_REFERRAL_COPY.setupPayoutsBody}
          </Text>
          {setupError ? (
            <Text style={styles.error} accessibilityRole="alert">
              {setupError}
            </Text>
          ) : null}
          <TouchableOpacity
            style={[styles.primary, opening && { opacity: 0.6 }]}
            onPress={setupPayouts}
            disabled={opening}
            accessibilityRole="button"
          >
            {opening ? (
              <ActivityIndicator color={BG} />
            ) : (
              <Text style={styles.primaryText}>
                {BUSINESS_REFERRAL_COPY.setupPayouts}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {info.referrals.length === 0 ? (
        <Text style={styles.empty}>{BUSINESS_REFERRAL_COPY.empty}</Text>
      ) : (
        info.referrals.map((r, i) => (
          <View key={`${r.businessName}-${i}`} style={styles.item}>
            <Text style={styles.name}>{r.businessName}</Text>
            <Text style={styles.line}>{businessReferralLine(r)}</Text>
          </View>
        ))
      )}
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 18,
    marginBottom: 24,
    gap: 12,
  },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 16, fontWeight: "700", color: CREAM, flexShrink: 1 },
  body: { fontSize: 13, lineHeight: 19, color: BODY },
  row: { flexDirection: "row", gap: 10 },
  primary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: GOLD,
    borderRadius: 10,
    paddingVertical: 12,
    minHeight: 44,
  },
  primaryText: { fontSize: 15, fontWeight: "700", color: BG },
  ghost: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#3A3A3A",
    minHeight: 44,
  },
  ghostText: { fontSize: 15, color: CREAM },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 18 },
  stat: { minWidth: 56 },
  statValue: { fontSize: 20, fontWeight: "700", color: GOLD },
  statLabel: { fontSize: 11, color: BODY, marginTop: 2 },
  setup: {
    borderWidth: 1,
    borderColor: "rgba(232,185,48,0.35)",
    borderRadius: 10,
    padding: 14,
    gap: 10,
  },
  setupText: { fontSize: 14, color: CREAM },
  error: { fontSize: 13, color: "#E57A6E" },
  empty: { fontSize: 13, color: BODY },
  item: { borderTopWidth: 1, borderTopColor: "#222", paddingTop: 10, gap: 2 },
  name: { fontSize: 14, fontWeight: "600", color: CREAM },
  line: { fontSize: 13, color: BODY },
});
