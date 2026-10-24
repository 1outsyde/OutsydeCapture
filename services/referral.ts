import AsyncStorage from "@react-native-async-storage/async-storage";
import { Linking } from "react-native";
import { API_BASE_URL } from "./api";
import { referralCodeFromUrl } from "@/utils/friendReferral";

const REFERRAL_KEY = "@outsyde_referral_code";
const REFERRAL_SENT_KEY = "@outsyde_referral_sent";
// Friend invite codes from goutsyde.com/r/<CODE> (2026-10-23). Kept apart from the ?ref= value
// above, which is an influencer handle, so only real friend codes prefill signup.
const FRIEND_CODE_KEY = "@outsyde_friend_referral_code";

export async function captureReferralFromURL(url: string): Promise<string | null> {
  // Friend invite links (2026-10-23): https://www.goutsyde.com/r/<CODE>. Used at signup.
  const friendCode = referralCodeFromUrl(url);
  if (friendCode) {
    try {
      await AsyncStorage.setItem(FRIEND_CODE_KEY, friendCode);
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

/** A friend invite code saved from a goutsyde.com/r/<CODE> link, or null. */
export async function getStoredFriendCode(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(FRIEND_CODE_KEY);
  } catch {
    return null;
  }
}

/** Forget a used friend invite code (after a successful customer signup). */
export async function clearFriendCode(): Promise<void> {
  try {
    await AsyncStorage.removeItem(FRIEND_CODE_KEY);
  } catch {
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
