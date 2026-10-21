// Plan offer banner on BusinessDashboard (artboard Reminder): gold strip at the very top.
// Tap → the same popup, opened right here (the main tabs popup can't show over the dashboard).
// X → hidden until the next launch. The offer itself stays until it is accepted or withdrawn.
// Never opens over another blocking popup (the dashboard's eligibility gate registers one).

import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import PlanOfferSheet from "@/components/plan-offer/PlanOfferSheet";
import { snoozeStripePromptUntilRelaunch } from "@/components/StripeConnectPrompt";
import { usePlanOffer } from "@/hooks/usePlanOffer";
import { isAnyOpenExcept, registerWhile } from "@/utils/modalCoordinator";
import { bannerText, type PlanOffer } from "@/utils/planOffer";
import * as store from "@/utils/planOfferStore";

const KEY = "plan-offer-dashboard";

/** True when the banner is on screen (the dashboard header then drops its own top inset). */
export function usePlanOfferBannerVisible(): boolean {
  const { offer, showBanner } = usePlanOffer();
  return !!offer && showBanner;
}

export default function PlanOfferBanner({ topInset }: { topInset: number }) {
  const navigation = useNavigation<any>();
  const { offer, showBanner } = usePlanOffer();
  const [open, setOpen] = useState(false);
  const [finishingOffer, setFinishingOffer] = useState<PlanOffer | null>(null);
  const sheetVisible = open || !!finishingOffer;

  useEffect(() => registerWhile(KEY, sheetVisible), [sheetVisible]);

  const shown = finishingOffer ?? offer;
  const bannerOn = !!offer && showBanner;

  const finish = () => {
    if (finishingOffer) snoozeStripePromptUntilRelaunch();
    setOpen(false);
    setFinishingOffer(null);
    store.clearOffer();
  };

  return (
    <>
      {bannerOn && offer ? (
        <View style={[styles.banner, { paddingTop: topInset }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${bannerText(offer).title}. ${bannerText(offer).body}`}
            onPress={() => {
              if (isAnyOpenExcept(KEY)) return;
              setOpen(true);
            }}
            style={styles.main}
          >
            <Feather name="gift" size={22} color="#000" />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.title}>{bannerText(offer).title}</Text>
              <Text style={styles.body}>{bannerText(offer).body}</Text>
            </View>
            <Feather name="chevron-right" size={18} color="#000" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Hide until next time you open the app"
            onPress={() => store.hideBanner()}
            style={styles.x}
            hitSlop={4}
          >
            <Feather name="x" size={18} color="#000" />
          </Pressable>
        </View>
      ) : null}
      {shown ? (
        <PlanOfferSheet
          offer={shown}
          visible={sheetVisible}
          onDismiss={() => {
            setOpen(false);
            store.dismissPopup();
          }}
          onClaimed={() => setFinishingOffer(shown)}
          onFinished={finish}
          onSetUpPayouts={() => {
            finish();
            navigation.navigate("FinishSetup");
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: "#E8B930",
    flexDirection: "row",
    alignItems: "center",
  },
  main: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingLeft: 20,
    minHeight: 44,
  },
  title: { fontSize: 15, fontWeight: "700", color: "#000" },
  body: { fontSize: 13, color: "#000" },
  x: {
    width: 44,
    height: 44,
    marginRight: 6,
    alignItems: "center",
    justifyContent: "center",
  },
});
