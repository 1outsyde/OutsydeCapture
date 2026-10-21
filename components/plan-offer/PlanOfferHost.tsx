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
import { shouldShowOfferPopup } from "@/utils/planOffer";
import * as store from "@/utils/planOfferStore";

const KEY = "plan-offer";

export default function PlanOfferHost() {
  useCheckPlanOffer();
  const navigation = useNavigation<any>();
  const mainFocused = useIsFocused();
  const { offer, wantsPopup, checking, claimed } = usePlanOffer();
  const [othersOpen, setOthersOpen] = useState(isAnyOpenExcept(KEY));

  useEffect(() => {
    const sync = () => setOthersOpen(isAnyOpenExcept(KEY));
    sync();
    return subscribeModals(sync);
  }, []);

  // The done screen of a claim made here stays up (from the store) until the vendor closes it.
  const claimedHere = claimed?.where === "main" ? claimed : null;
  const visible =
    !!claimedHere ||
    shouldShowOfferPopup({
      hasOffer: !!offer,
      wantsPopup,
      blockingModalOpen: othersOpen,
      mainFocused,
    });

  useEffect(() => registerWhile(KEY, checking || visible), [checking, visible]);

  const shown = claimedHere?.offer ?? offer;
  if (!shown) return null;

  const finish = () => {
    // "Do this later" already answered the payouts question for this launch.
    if (claimedHere && !claimedHere.payoutsReady)
      snoozeStripePromptUntilRelaunch();
    store.finishClaimed();
  };

  return (
    <PlanOfferSheet
      offer={shown}
      visible={visible}
      done={claimedHere ? { payoutsReady: claimedHere.payoutsReady } : null}
      onDismiss={() => store.dismissPopup()}
      onClaimed={(payoutsReady) =>
        store.markClaimed(shown, "main", payoutsReady)
      }
      onGone={() => store.clearOffer()}
      onFinished={finish}
      onSetUpPayouts={() => {
        store.finishClaimed();
        navigation.navigate("FinishSetup");
      }}
    />
  );
}
