// What a plan offer tap (push or Activity row) does. Shared by usePlanOfferPushLinks and NotificationsScreen.
//   · signed out or guest → sign in (the popup shows after sign in, once the offer is checked)
//   · business owner → back to the main tabs, where PlanOfferHost opens the popup
//   · anyone else → nothing (offers are only for business owners)

import { shouldFetchOffer } from "./planOffer";
import { requestOpen } from "./planOfferStore";

interface Nav {
  navigate: (...args: any[]) => void;
}

export function openPlanOffer(
  navigation: Nav,
  user: { role?: string | null; isGuest?: boolean | null } | null | undefined,
): void {
  if (!user || user.isGuest) {
    navigation.navigate("Auth", {});
    return;
  }
  if (!shouldFetchOffer(user)) return;
  requestOpen();
  navigation.navigate("Main");
}
