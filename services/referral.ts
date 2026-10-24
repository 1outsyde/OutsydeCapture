import AsyncStorage from "@react-native-async-storage/async-storage";
import { Linking } from "react-native";
import { API_BASE_URL } from "./api";
import { referralCodeFromUrl } from "@/utils/friendReferral";

const REFERRAL_KEY = "@outsyde_referral_code";
const REFERRAL_SENT_KEY = "@outsyde_referral_sent";

export async function captureReferralFromURL(url: string): Promise<string | null> {
  // Friend invite links (2026-10-23): https://www.goutsyde.com/r/<CODE>. Used at signup.
  const friendCode = referralCodeFromUrl(url);
  if (friendCode) {
    try {
      await AsyncStorage.setItem(REFERRAL_KEY, friendCode);
    } catch {
    }
    return friendCode;
  }
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
