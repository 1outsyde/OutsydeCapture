/**
 * Location for Events. Thin wrappers over expo-location; the decision rule lives in
 * eventsLogic.nearMeDecision (tested). These coordinates only ever go to GET /api/events.
 */
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Coords } from "@/utils/eventsLogic";

export type PermissionStatus = "granted" | "denied" | "undetermined";

/** Never shows the permission prompt. Returns the position only when location is already allowed. */
export async function getEventCoords(): Promise<{ coords: Coords | null; status: PermissionStatus; canAskAgain: boolean }> {
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    const status = (perm.status as PermissionStatus) ?? "undetermined";
    if (status !== "granted") return { coords: null, status, canAskAgain: perm.canAskAgain !== false };
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { coords: { lat: loc.coords.latitude, lng: loc.coords.longitude }, status, canAskAgain: true };
  } catch {
    return { coords: null, status: "undetermined", canAskAgain: false };
  }
}

/** Shows the system prompt. Only call when nearMeDecision returned "ask" (never asked before). */
export async function requestOnce(): Promise<Coords | null> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") return null;
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: loc.coords.latitude, lng: loc.coords.longitude };
  } catch {
    return null;
  }
}

/** The city saved during onboarding, used when location is off. */
export async function savedCity(): Promise<string | null> {
  try {
    const city = await AsyncStorage.getItem("@outsyde_onboarding_city");
    return city && city.trim() ? city.trim() : null;
  } catch {
    return null;
  }
}
