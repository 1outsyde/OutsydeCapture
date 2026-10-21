// usePlanOffer: the shared plan offer state (utils/planOfferStore) as React state.
// useCheckPlanOffer: asks the backend for the signed in business owner's offer on launch, on sign in and
// each time the app comes back to the front (at most once a minute), e.g. after confirming on goutsyde.com.
// Mounted once, in PlanOfferHost (MainTabNavigator).

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { AppState, AppStateStatus } from "react-native";

import { api } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { shouldFetchOffer } from "@/utils/planOffer";
import * as store from "@/utils/planOfferStore";

const RECHECK_MS = 60 * 1000;

function snapshot() {
  return {
    offer: store.getOffer(),
    wantsPopup: store.wantsPopup(),
    showBanner: store.showBanner(),
    checking: store.isChecking(),
  };
}

// useSyncExternalStore needs the same object back until something changes.
let cached = snapshot();
let cachedVersion = store.getVersion();
function getSnapshot() {
  if (cachedVersion !== store.getVersion()) {
    cached = snapshot();
    cachedVersion = store.getVersion();
  }
  return cached;
}

export function usePlanOffer() {
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

export function useCheckPlanOffer() {
  const { user, getToken, isLoading } = useAuth();
  const lastAtRef = useRef(0);
  const runningRef = useRef(false);
  // Which account the offer state belongs to. Never tied to isLoading: a session refresh sets it for a
  // moment, and resetting then would bring back a popup the vendor already closed.
  const ownerKey =
    shouldFetchOffer(user as any) && user?.id != null ? String(user.id) : null;
  const eligible = !isLoading && ownerKey !== null;

  // getToken is a new function every render: read it through a ref so the check runs only when needed.
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  // An answer that arrives after a switch to another account is dropped.
  const ownerRef = useRef(ownerKey);
  ownerRef.current = ownerKey;

  const check = useCallback(
    async (force: boolean) => {
      if (!eligible || runningRef.current) return;
      if (!force && Date.now() - lastAtRef.current < RECHECK_MS) return;
      const askedFor = ownerRef.current;
      runningRef.current = true;
      lastAtRef.current = Date.now();
      store.setChecking(true);
      try {
        const token = await getTokenRef.current();
        const offer = token
          ? await api.getPlanOffer(token).catch(() => undefined)
          : null;
        if (ownerRef.current !== askedFor) return;
        // A failed check keeps whatever was already known (and shows nothing new): fail quiet.
        if (offer === undefined) store.setChecking(false);
        else store.setOffer(offer);
      } finally {
        runningRef.current = false;
        if (ownerRef.current !== askedFor) store.setChecking(false);
      }
    },
    [eligible],
  );

  useEffect(() => {
    store.resetForUser(ownerKey);
  }, [ownerKey]);

  useEffect(() => {
    if (!eligible) return;
    check(true);
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "active") check(false);
    });
    return () => sub.remove();
  }, [eligible, ownerKey, check]);
}
