import AsyncStorage from "@react-native-async-storage/async-storage";
import { Linking } from "react-native";
import { api, API_BASE_URL } from "./api";

const REFERRAL_KEY = "@outsyde_referral_code";
const REFERRAL_SENT_KEY = "@outsyde_referral_sent";

export async function captureReferralFromURL(url: string): Promise<string | null> {
  try {
    const parsed = new URL(url);
    const ref = parsed.searchParams.get("ref");
    if (ref) {
      await AsyncStorage.setItem(REFERRAL_KEY, ref);
      return ref;
    }
  } catch {
  }
  return null;
}

export async function captureReferralFromInitialURL(): Promise<string | null> {
  try {
    const url = await Linking.getInitialURL();
    if (url) {
      return captureReferralFromURL(url);
    }
  } catch {
  }
  return null;
}

export async function getStoredReferral(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(REFERRAL_KEY);
  } catch {
    return null;
  }
}

export async function clearReferral(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([REFERRAL_KEY, REFERRAL_SENT_KEY]);
  } catch {
  }
}

export async function sendReferralEvent(
  eventType: "signup" | "first_purchase" | "repeat_purchase",
  authToken: string,
  extras?: Record<string, any>
): Promise<void> {
  try {
    const ref = await getStoredReferral();
    if (!ref) return;

    const sentKey = `${REFERRAL_SENT_KEY}_${eventType}`;
    const alreadySent = await AsyncStorage.getItem(sentKey);
    if (eventType === "signup" && alreadySent) return;

    await fetch(`${API_BASE_URL}/api/influencer/event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ ref, eventType, ...extras }),
    });

    if (eventType === "signup") {
      await AsyncStorage.setItem(sentKey, "true");
    }
  } catch {
  }
}

export async function sendClickEvent(
  referralCode: string,
  postId?: string
): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/api/influencer/click`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref: referralCode, postId }),
    });
  } catch {
  }
}
