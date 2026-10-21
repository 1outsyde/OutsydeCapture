// The plan offer popup on the main tabs (artboards Main and FreeOffer). Mounted once in MainTabNavigator.
// Shows only while Main is the screen in front (never over setup screens, the dashboard or its eligibility
// gate) and no other blocking popup is open. Registers "plan-offer" with the modal coordinator while the
// offer check runs and while it is open, so the Stripe Connect prompt waits instead of flashing first.

import React, { useEffect, useState } from "react";
import { useIsFocused, useNavigation } from "@react-navigation/native";

import PlanOfferSheet from "@/components/plan-offer/PlanOfferSheet";
import { snoozeStripePromptUntilRelaunch } from "@/components/StripeConnectPrompt";
import { useCheckPlanOffer, usePlanOffer } from "@/hooks/usePlanOffer";
import {
  isAnyOpenExcept,
  registerWhile,
  subscribe as subscribeModals,
} from "@/utils/modalCoordinator";
import { shouldShowOfferPopup, type PlanOffer } from "@/utils/planOffer";
import * as store from "@/utils/planOfferStore";

const KEY = "plan-offer";

export default function PlanOfferHost() {
  useCheckPlanOffer();
  const navigation = useNavigation<any>();
  const mainFocused = useIsFocused();
  const { offer, wantsPopup, checking } = usePlanOffer();
  const [othersOpen, setOthersOpen] = useState(isAnyOpenExcept(KEY));
  // The free plan "done" screen stays up after the claim even though the offer is no longer pending.
  // A recheck that finds no pending offer must not close it, so the host keeps its own copy.
  const [finishingOffer, setFinishingOffer] = useState<PlanOffer | null>(null);
  const finishing = !!finishingOffer;

  useEffect(() => {
    const sync = () => setOthersOpen(isAnyOpenExcept(KEY));
    sync();
    return subscribeModals(sync);
  }, []);

  const visible =
    finishing ||
    shouldShowOfferPopup({
      hasOffer: !!offer,
      wantsPopup,
      blockingModalOpen: othersOpen,
      mainFocused,
    });

  useEffect(() => registerWhile(KEY, checking || visible), [checking, visible]);

  const shown = finishingOffer ?? offer;
  if (!shown) return null;

  return (
    <PlanOfferSheet
      offer={shown}
      visible={visible}
      onDismiss={() => store.dismissPopup()}
      onClaimed={() => setFinishingOffer(shown)}
      onFinished={() => {
        // Closing the done screen ("Do this later", Done or X) also answers the payouts question for now.
        if (finishingOffer) snoozeStripePromptUntilRelaunch();
        setFinishingOffer(null);
        store.clearOffer();
      }}
      onSetUpPayouts={() => {
        setFinishingOffer(null);
        store.clearOffer();
        navigation.navigate("FinishSetup");
      }}
    />
  );
}
