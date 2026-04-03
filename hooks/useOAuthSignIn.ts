import { useState } from "react";
import { Alert, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from "expo-apple-authentication";

import { useAuth, GoogleAuthUserData, GoogleProfile } from "@/context/AuthContext";
import { api, API_BASE_URL } from "@/services/api";

WebBrowser.maybeCompleteAuthSession();

const BACKEND_GOOGLE_PREFLIGHT = `${API_BASE_URL}/api/auth/mobile/google/preflight`;

export function parseGoogleAuthUrl(urlString: string): {
  isNewUser: boolean;
  profile?: GoogleProfile;
  accessToken?: string;
  refreshToken?: string;
  userId?: string;
  email?: string;
  userData?: Omit<GoogleAuthUserData, "userId" | "email">;
  error?: string;
} | null {
  try {
    const normalized = urlString.replace("outsyde://", "https://outsyde.app/");
    const urlParams = new URL(normalized);
    if (urlString.startsWith("outsyde://auth/error")) {
      return { isNewUser: false, error: urlParams.searchParams.get("error") || "Google sign-in failed" };
    }
    const isNewUser = urlParams.searchParams.get("isNewUser") === "true";
    if (isNewUser) {
      const profile: GoogleProfile = {
        email: urlParams.searchParams.get("email") || "",
        firstName: urlParams.searchParams.get("firstName") || "",
        lastName: urlParams.searchParams.get("lastName") || "",
        name:
          urlParams.searchParams.get("name") ||
          `${urlParams.searchParams.get("firstName") || ""} ${urlParams.searchParams.get("lastName") || ""}`.trim() ||
          urlParams.searchParams.get("email") ||
          "",
        profileImageUrl: urlParams.searchParams.get("profileImageUrl") || undefined,
      };
      return { isNewUser: true, profile };
    }
    return {
      isNewUser: false,
      accessToken: urlParams.searchParams.get("accessToken") || undefined,
      refreshToken: urlParams.searchParams.get("refreshToken") || undefined,
      userId: urlParams.searchParams.get("userId") || undefined,
      email: urlParams.searchParams.get("email") || undefined,
      userData: {
        firstName: urlParams.searchParams.get("firstName") || undefined,
        lastName: urlParams.searchParams.get("lastName") || undefined,
        name: urlParams.searchParams.get("name") || undefined,
        profileImageUrl: urlParams.searchParams.get("profileImageUrl") || undefined,
        isVendor: urlParams.searchParams.get("isVendor") === "true",
        isPhotographer: urlParams.searchParams.get("isPhotographer") === "true",
        isAdmin: urlParams.searchParams.get("isAdmin") === "true",
        businessId: urlParams.searchParams.get("businessId") || undefined,
        photographerId: urlParams.searchParams.get("photographerId") || undefined,
      },
    };
  } catch {
    return null;
  }
}

export function useGoogleSignIn(onNewUser: (profile: GoogleProfile) => void) {
  const [isLoading, setIsLoading] = useState(false);
  const { loginWithTokens } = useAuth();

  const signIn = async () => {
    setIsLoading(true);
    try {
      const preflightRes = await fetch(BACKEND_GOOGLE_PREFLIGHT, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!preflightRes.ok) throw new Error("Failed to initialize Google Sign-In");

      const { authUrl } = await preflightRes.json();
      const result = await WebBrowser.openAuthSessionAsync(authUrl, "outsyde://auth");

      if (result.type === "success" && result.url) {
        if (result.url.startsWith("outsyde://auth/success")) {
          const parsed = parseGoogleAuthUrl(result.url);
          if (!parsed) throw new Error("Failed to parse auth response");

          if (parsed.isNewUser && parsed.profile) {
            await AsyncStorage.setItem("@outsyde_google_profile", JSON.stringify(parsed.profile));
            onNewUser(parsed.profile);
          } else if (!parsed.isNewUser) {
            const { accessToken, refreshToken, userId, email, userData } = parsed;
            if (!accessToken || !refreshToken || !userId || !email) {
              Alert.alert("Error", "Authentication failed. Missing required data.");
              return;
            }
            const sessionResult = await loginWithTokens(accessToken, refreshToken, {
              userId,
              email,
              ...userData,
            } as GoogleAuthUserData);
            if (sessionResult.isPending) {
              Alert.alert("Pending Approval", "Your business application is under review. We'll notify you when it's approved.");
            } else if (sessionResult.isRejected) {
              Alert.alert("Account Rejected", "Your business application was not approved. Please contact support.");
            } else if (!sessionResult.success) {
              Alert.alert("Error", "Failed to complete sign-in. Please try again.");
            }
          }
        } else if (result.url.startsWith("outsyde://auth/error")) {
          const parsed = parseGoogleAuthUrl(result.url);
          Alert.alert("Sign-In Error", parsed?.error || "Google sign-in failed");
        }
      }
    } catch {
      Alert.alert("Error", "Failed to start Google Sign-In. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return { signIn, isLoading };
}

export interface AppleNewUserParams {
  prefillName?: string;
  prefillEmail: string;
  appleId?: string;
}

const APPLE_NAME_KEY = "@outsyde_apple_name";
const APPLE_EMAIL_KEY = "@outsyde_apple_email";

export function useAppleSignIn(onNewUser: (params: AppleNewUserParams) => void) {
  const [isLoading, setIsLoading] = useState(false);
  const { loginWithTokens } = useAuth();

  const signIn = async () => {
    if (Platform.OS !== "ios") {
      Alert.alert("Apple Sign In", "Apple Sign In is only available on iOS devices.");
      return;
    }
    setIsLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const givenName = credential.fullName?.givenName || "";
      const familyName = credential.fullName?.familyName || "";
      const fullName = `${givenName} ${familyName}`.trim() || null;

      // Persist name + email on first login (Apple only provides them once)
      if (credential.email) {
        if (fullName) await AsyncStorage.setItem(APPLE_NAME_KEY, fullName);
        await AsyncStorage.setItem(APPLE_EMAIL_KEY, credential.email);
      }

      // Restore from storage if Apple didn't provide email this time
      const storedName = await AsyncStorage.getItem(APPLE_NAME_KEY);
      const storedEmail = await AsyncStorage.getItem(APPLE_EMAIL_KEY);
      const resolvedEmail = credential.email || storedEmail;
      const resolvedName = fullName || storedName || undefined;

      if (!credential.identityToken) {
        Alert.alert("Sign-In Failed", "Apple Sign-In returned no identity token. Please try again.");
        return;
      }

      // Call backend to verify the credential
      try {
        const response = await api.appleSignIn({
          identityToken: credential.identityToken,
          fullName: resolvedName ?? null,
          email: resolvedEmail ?? null,
        });

        if ("isNewUser" in response && response.isNewUser) {
          // New user — route to signup screen
          onNewUser({
            prefillName: response.fullName || resolvedName,
            prefillEmail: response.email || resolvedEmail || "",
            appleId: response.appleId,
          });
        } else if ("accessToken" in response) {
          // Existing user — log them in
          const backendUser = response.user as any;
          const sessionResult = await loginWithTokens(response.accessToken, response.refreshToken, {
            userId: backendUser.id,
            email: backendUser.email,
            firstName: backendUser.firstName,
            lastName: backendUser.lastName,
            name: backendUser.name,
            profileImageUrl: backendUser.profileImageUrl,
            isVendor: backendUser.isVendor,
            isPhotographer: backendUser.isPhotographer,
            isAdmin: backendUser.isAdmin,
            businessId: backendUser.businessId,
            photographerId: backendUser.photographerId,
          } as GoogleAuthUserData);
          if (!sessionResult.success) {
            Alert.alert("Sign-In Failed", "Failed to complete Apple Sign-In. Please try again.");
          }
        }
      } catch {
        // Backend not yet live or Apple OAuth endpoint not ready —
        // fall back to routing as new user using local Apple credential data
        if (resolvedEmail) {
          onNewUser({ prefillName: resolvedName, prefillEmail: resolvedEmail });
        } else {
          Alert.alert(
            "Sign In",
            "To sign into your existing Outsyde account, please use your email and password.",
            [{ text: "OK", style: "cancel" }]
          );
        }
      }
    } catch (error: any) {
      if (error.code !== "ERR_REQUEST_CANCELED") {
        Alert.alert("Error", "Apple sign-in failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return { signIn, isLoading };
}
