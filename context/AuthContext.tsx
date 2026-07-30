import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, AppStateStatus, Linking } from "react-native";
import { api } from "../services/api";
import { captureReferralFromURL, captureReferralFromInitialURL } from "../services/referral";
import {
  storeTokens,
  storeUserData,
  getAccessToken,
  getRefreshToken,
  getStoredUserData,
  clearAuthStorage,
} from "../utils/tokenStorage";

export type UserRole = "consumer" | "business" | "photographer" | "staff";
export type ApprovalStatus = "approved" | "pending" | "rejected";

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  role: UserRole;
  approvalStatus: ApprovalStatus;
  avatar?: string;
  profileImageUrl?: string;
  coverMediaUrl?: string;
  coverMediaType?: "image" | "video";
  isGuest?: boolean;
  isAdmin?: boolean;
  businessName?: string;
  businessCategory?: string;
  businessDescription?: string;
  isProfileComplete?: boolean;
  city?: string;
  state?: string;
  username?: string;
  gender?: string;
  selectedIndustries?: string[];
  industryNiches?: Record<string, string[]>;
  industryValues?: Record<string, string[]>;
  displayName?: string;
  bio?: string;
  hourlyRate?: number;
  portfolioUrl?: string;
  specialties?: string[];
  willTravel?: boolean;
  businessId?: string;
  photographerId?: string;
  isInfluencer?: boolean;
  influencerStatus?: "pending" | "approved" | "rejected";
  staffId?: string;
  staffBusinessId?: string;
  staffBusinessName?: string;
  staffStripeOnboardingComplete?: boolean;
  staffStripeOnboardingUrl?: string;
  deletionStatus?: "active" | "pending_deletion" | "deleted";
  scheduledDeletionAt?: string | null;
  subscriptionTier?: string;
}

export interface SignupData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  password: string;
  role: UserRole;
  businessName?: string;
  businessCategory?: string;
  businessDescription?: string;
  offerType?: "products" | "services" | "both";
  isStartup?: boolean;
  isMultiStaff?: boolean;
  yearsInBusiness?: string;
  employeeCount?: string;
  businessType?: string;
  hasPhysicalLocation?: boolean;
  address?: string;
  streetAddress?: string;
  aptUnit?: string | null;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  billingSameAsHome?: boolean;
  billingAddress?: string;
  billingStreet?: string;
  billingAptUnit?: string | null;
  billingCity?: string;
  billingState?: string;
  billingZipCode?: string;
  billingZip?: string;
  websiteUrl?: string;
  socialMedia?: string;
  username?: string;
  gender?: string;
  ethnicity?: string;
  shoppingFrequency?: string;
  selectedIndustries?: string[];
  industryNiches?: Record<string, string[]>;
  industryValues?: Record<string, string[]>;
  displayName?: string;
  bio?: string;
  hourlyRate?: number;
  portfolioUrl?: string;
  specialties?: string[];
  profileImageUrl?: string;
  logoImage?: string | null;
  shootLocation?: string[];
  studioName?: string | null;
  studioAddress?: string | null;
  usesSharedStudio?: boolean;
  travelRadius?: string;
  pricingType?: string;
  startingPrice?: number | null;
  minimumBooking?: string | null;
  additionalServices?: string[];
  experienceLevel?: string;
  equipmentLevel?: string | null;
  deliveryTime?: string;
}

export interface LoginResult {
  success: boolean;
  isPending: boolean;
  isRejected: boolean;
  user?: User;
}

interface SignupResult {
  success: boolean;
  isPending: boolean;
  errorMessage?: string;
}

export interface GoogleAuthUserData {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  profileImageUrl?: string;
  isVendor?: boolean;
  isPhotographer?: boolean;
  isAdmin?: boolean;
  businessId?: string;
  photographerId?: string;
}

export interface GoogleProfile {
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  profileImageUrl?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (identifier: string, password: string, type?: "email" | "username") => Promise<LoginResult>;
  loginWithGoogle: (idToken: string) => Promise<LoginResult>;
  loginWithTokens: (accessToken: string, refreshToken: string, userData: GoogleAuthUserData) => Promise<LoginResult>;
  signup: (data: SignupData) => Promise<SignupResult>;
  loginAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  getToken: () => Promise<string | null>;
  refreshSession: () => Promise<LoginResult>;
  refreshUser: () => Promise<void>;
  pendingResetParams: { token: string; email: string } | null;
  clearPendingResetParams: () => void;
  pendingStripeReturn: { status: string; type: string } | null;
  clearPendingStripeReturn: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEYS = {
  USER: "@outsyde_user",
  TOKEN: "@outsyde_token",
  PENDING_BUSINESSES: "@outsyde_pending_businesses",
};

function parseResetPasswordURL(url: string): { token: string; email: string } | null {
  try {
    const normalized = url.replace("outsyde://", "https://outsyde.app/");
    const parsed = new URL(normalized);
    const token = parsed.searchParams.get("token");
    const email = parsed.searchParams.get("email");
    if (token && email) return { token, email };
  } catch (_) {}
  return null;
}

type StaffProfile = {
  id: string;
  businessId: string;
  businessName?: string;
  stripeOnboardingComplete: boolean;
  stripeOnboardingUrl?: string;
};

// Staff detection at login: GET /api/staff/me.
// - 404 = genuinely not a staff member — caller keeps role "consumer".
// - 200 = single-business staff — use it directly.
// - 409 = staff at 2+ businesses (backend returns `businesses`, sorted most-
//   recently-active-first). Auto-select businesses[0] rather than dropping
//   this person back to "consumer" — a 409 is NOT "not staff", it's "staff,
//   ambiguous which business." Logged clearly since it's a silent choice.
async function resolveStaffProfile(accessToken: string): Promise<StaffProfile | null> {
  try {
    const staffRes = await fetch("https://outsyde-backend.onrender.com/api/staff/me", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
    });

    if (staffRes.ok) {
      const staffJson = await staffRes.json();
      const s = staffJson.staff || staffJson;
      return {
        id: s.id,
        businessId: s.businessId,
        businessName: s.businessName || s.business?.name,
        stripeOnboardingComplete: s.stripeOnboardingComplete ?? false,
        stripeOnboardingUrl: s.stripeOnboardingUrl,
      };
    }

    if (staffRes.status === 409) {
      const body = await staffRes.json();
      const businesses = body.businesses || [];
      const chosen = businesses[0];
      if (chosen) {
        console.log(
          `[Auth] Ambiguous staff account, auto-selected business ${chosen.businessId} (staffId ${chosen.staffId})`
        );
        return {
          id: chosen.staffId,
          businessId: chosen.businessId,
          businessName: chosen.displayName,
          stripeOnboardingComplete: false,
          stripeOnboardingUrl: undefined,
        };
      }
    }

    // 404 (or any other non-ok, non-409 status) = not a staff member — leave role as "consumer"
    return null;
  } catch (staffErr) {
    console.warn("[Auth] Staff check failed (non-critical):", staffErr);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingResetParams, setPendingResetParams] = useState<{ token: string; email: string } | null>(null);
  const [pendingStripeReturn, setPendingStripeReturn] = useState<{ status: string; type: string } | null>(null);

  const clearPendingResetParams = () => setPendingResetParams(null);
  const clearPendingStripeReturn = () => setPendingStripeReturn(null);

  function parseStripeReturnURL(url: string): { status: string; type: string } | null {
    try {
      if (!url.includes("stripe-return")) return null;
      const normalized = url.replace("outsyde://", "https://outsyde.app/");
      const parsed = new URL(normalized);
      const status = parsed.searchParams.get("status");
      const type = parsed.searchParams.get("type");
      if (status && type) return { status, type };
    } catch (_) {}
    return null;
  }

  useEffect(() => {
    const init = async () => {
      await loadStoredAuth();
      await refreshUser();
    };
    init();

    captureReferralFromInitialURL();
    // Handle cold-start deep links
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log("[DeepLink] Initial URL:", url);
        captureReferralFromURL(url);
        if (url.includes("reset-password")) {
          const params = parseResetPasswordURL(url);
          if (params) setPendingResetParams(params);
        }
        if (url.includes("stripe-return")) {
          const params = parseStripeReturnURL(url);
          if (params) {
            console.log("[DeepLink] Stripe return on cold start:", params);
            setPendingStripeReturn(params);
          }
        }
      }
    }).catch(() => {});
    const linkSub = Linking.addEventListener("url", ({ url }) => {
      console.log("[DeepLink] Received URL:", url);
      captureReferralFromURL(url);
      if (url.includes("reset-password")) {
        const params = parseResetPasswordURL(url);
        if (params) setPendingResetParams(params);
      }
      if (url.includes("stripe-return")) {
        const params = parseStripeReturnURL(url);
        if (params) {
          console.log("[DeepLink] Stripe return while running:", params);
          setPendingStripeReturn(params);
        }
      }
    });
    const appStateSub = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState === "active") {
        refreshUser();
      }
    });
    return () => {
      linkSub.remove();
      appStateSub.remove();
    };
  }, []);

  const _clearAllAuth = async () => {
    await clearAuthStorage();
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.USER,
      STORAGE_KEYS.TOKEN,
      "@outsyde_refresh_token",
    ]);
  };

  const loadStoredAuth = async () => {
    try {
      // ── 1. Instant hydration from SecureStore (no network call) ─────────────
      const secureUser = await getStoredUserData<User>();
      if (secureUser) {
        // Skip pending/rejected users
        if (secureUser.role === "business" && secureUser.approvalStatus === "pending") {
          setIsLoading(false);
          return;
        }
        if (secureUser.approvalStatus === "rejected") {
          setIsLoading(false);
          return;
        }
        // Show UI immediately while we verify in the background
        setUser(secureUser);
      }

      // ── 2. Migration: also try AsyncStorage if SecureStore is empty ──────────
      const storedUserJson = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      const parsed: User | null = secureUser || (storedUserJson ? JSON.parse(storedUserJson) : null);
      if (!parsed) {
        // Clean up any abandoned Google OAuth profile
        try {
          const abandoned = await AsyncStorage.getItem("@outsyde_google_profile");
          if (abandoned) await AsyncStorage.removeItem("@outsyde_google_profile");
        } catch (_) {}
        setIsLoading(false);
        return;
      }

      // ── 3. Verify session with backend ─────────────────────────────────────
      try {
        const accessToken = await getAccessToken();
        const headers: HeadersInit = { "Content-Type": "application/json" };
        if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

        const response = await fetch("https://outsyde-backend.onrender.com/api/auth/me", {
          method: "GET",
          credentials: "include",
          headers,
        });

        if (response.ok) {
          const backendData = await response.json();
          const backendUser = backendData.user || backendData;
          if (backendUser?.id && backendUser.id !== parsed.id) {
            console.warn("[Auth] Session mismatch — clearing auth");
            await _clearAllAuth();
            setUser(null);
            return;
          }
          if (backendUser) {
            const updated: User = {
              ...parsed,
              username: backendUser.username || parsed.username,
              displayName: backendUser.displayName || parsed.displayName,
              avatar: backendUser.avatar || backendUser.profileImageUrl || parsed.avatar,
              profileImageUrl: backendUser.profileImageUrl || parsed.profileImageUrl,
              coverMediaUrl: backendUser.coverMediaUrl || parsed.coverMediaUrl,
              coverMediaType: backendUser.coverMediaType || parsed.coverMediaType,
              deletionStatus: backendUser.deletionStatus ?? parsed.deletionStatus,
              scheduledDeletionAt: backendUser.scheduledDeletionAt ?? parsed.scheduledDeletionAt,
            };
            await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updated));
            await storeUserData(updated);
            setUser(updated);
          } else {
            setUser(parsed);
          }
          console.log("[Auth] Session verified — userId:", parsed.id);
          return;
        }

        if (response.status === 401) {
          // ── 4. Cookie session expired — try JWT refresh token ───────────────
          const refreshToken = await getRefreshToken();
          if (refreshToken) {
            try {
              const refreshRes = await fetch("https://outsyde-backend.onrender.com/api/auth/refresh", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refreshToken }),
              });
              if (refreshRes.ok) {
                const { accessToken: newAccess, refreshToken: newRefresh } = await refreshRes.json();
                await storeTokens(newAccess, newRefresh);
                await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, newAccess);
                setUser(parsed);
                console.log("[Auth] Session restored via refresh token");
                return;
              }
            } catch (_) {}
          }
          // Both cookie and refresh failed — session truly expired
          console.log("[Auth] Session expired — clearing stored auth");
          await _clearAllAuth();
          setUser(null);
          return;
        }
        // Other errors (network, 500) — use cached auth (offline-first)
        setUser(parsed);
      } catch (verifyError) {
        console.warn("[Auth] Verification failed (using cached auth):", verifyError);
        setUser(parsed);
      }
    } catch (error) {
      console.error("Failed to load auth:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (identifier: string, password: string, type: "email" | "username" = "email"): Promise<LoginResult> => {
    setIsLoading(true);
    try {
      const loginPayload = type === "username"
        ? { username: identifier, password }
        : { email: identifier, password };
      const response = await api.mobileLogin(loginPayload);
      console.log("[Auth] Login response received, user:", response.user?.id);
      
      const backendUser = response.user;
      
      // Determine role from backend flags
      let role: UserRole = "consumer";
      if (backendUser.isPhotographer) {
        role = "photographer";
      } else if (backendUser.isVendor) {
        role = "business";
      }
      
      // Staff detection: GET /api/staff/me (404 = not staff; 409 = staff at
      // 2+ businesses, auto-selected — see resolveStaffProfile)
      let staffData: StaffProfile | null = null;
      if (role === "consumer" && response.accessToken) {
        staffData = await resolveStaffProfile(response.accessToken);
        if (staffData) {
          role = "staff";
          console.log("[Auth] Staff profile found:", staffData.id);
        }
      }

      // Extract photographer data if present
      const photographerData = (response as any).photographer;
      
      const newUser: User = {
        id: backendUser.id,
        firstName: backendUser.firstName || backendUser.name?.split(" ")[0] || backendUser.email?.split("@")[0] || identifier,
        lastName: backendUser.lastName || backendUser.name?.split(" ").slice(1).join(" ") || "",
        email: backendUser.email,
        phone: backendUser.phone || "",
        dateOfBirth: backendUser.dateOfBirth || "",
        role,
        approvalStatus: backendUser.approvalStatus || "approved",
        isProfileComplete: backendUser.isProfileComplete,
        avatar: backendUser.avatar || backendUser.profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(backendUser.firstName || backendUser.name || backendUser.email?.split("@")[0] || identifier)}&background=D4A84B&color=fff`,
        profileImageUrl: backendUser.profileImageUrl,
        coverMediaUrl: (backendUser as any).coverMediaUrl,
        coverMediaType: (backendUser as any).coverMediaType,
        city: backendUser.city || photographerData?.city,
        state: backendUser.state || photographerData?.state,
        businessName: backendUser.businessName,
        businessCategory: backendUser.businessCategory,
        businessDescription: backendUser.businessDescription,
        displayName: photographerData?.displayName || backendUser.displayName,
        bio: photographerData?.bio || backendUser.bio,
        hourlyRate: photographerData?.hourlyRate || backendUser.hourlyRate,
        portfolioUrl: photographerData?.portfolioUrl || backendUser.portfolioUrl,
        specialties: photographerData?.specialties || backendUser.specialties,
        isAdmin: backendUser.isAdmin || false,
        businessId: (response as any).vendor?.id,
        photographerId: photographerData?.id,
        username: (backendUser as any).username,
        staffId: staffData?.id,
        staffBusinessId: staffData?.businessId,
        staffBusinessName: staffData?.businessName,
        staffStripeOnboardingComplete: staffData?.stripeOnboardingComplete,
        staffStripeOnboardingUrl: staffData?.stripeOnboardingUrl,
      };
      console.log("[Auth] Login user constructed with username:", newUser.username);

      if (newUser.approvalStatus === "rejected") {
        return { success: false, isPending: false, isRejected: true };
      }
      
      const sessionToken = response.accessToken || `session_${backendUser.id}`;
      console.log("[Auth] Token stored:", response.accessToken ? "JWT accessToken received" : "Fallback to session indicator", "Token preview:", sessionToken.substring(0, 30) + "...");
      if (response.refreshToken) {
        await AsyncStorage.setItem("@outsyde_refresh_token", response.refreshToken);
      }
      
      // Persist to both SecureStore and AsyncStorage
      if (response.accessToken && response.refreshToken) {
        await storeTokens(response.accessToken, response.refreshToken);
      }
      await storeUserData(newUser);

      if (newUser.role === "business" && newUser.approvalStatus === "pending") {
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));
        await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, sessionToken);
        return { success: true, isPending: true, isRejected: false, user: newUser };
      }
      
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));
      await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, sessionToken);
      setUser(newUser);
      console.log("[Auth] User logged in successfully:", newUser.email, "role:", newUser.role);
      return { success: true, isPending: false, isRejected: false, user: newUser };
    } catch (error: any) {
      console.error("Login failed:", error);
      const status = error?.status;
      if (status === 401 || status === 403) {
        return { success: false, isPending: false, isRejected: false };
      }
      return { success: false, isPending: false, isRejected: false };
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async (idToken: string): Promise<LoginResult> => {
    setIsLoading(true);
    try {
      const response = await api.mobileGoogleLogin(idToken);
      console.log("[Auth] Google login response received, user:", response.user?.id);
      
      const backendUser = response.user;
      
      // Determine role from backend flags
      let role: UserRole = "consumer";
      if (backendUser.isPhotographer) {
        role = "photographer";
      } else if (backendUser.isVendor) {
        role = "business";
      }
      
      // Staff detection: GET /api/staff/me (404 = not staff; 409 = staff at
      // 2+ businesses, auto-selected — see resolveStaffProfile)
      let staffData: StaffProfile | null = null;
      if (role === "consumer" && response.accessToken) {
        staffData = await resolveStaffProfile(response.accessToken);
        if (staffData) {
          role = "staff";
          console.log("[Auth] Google login — staff profile found:", staffData.id);
        }
      }

      // Extract photographer data if present
      const photographerData = (response as any).photographer;
      
      const newUser: User = {
        id: backendUser.id,
        firstName: backendUser.firstName || backendUser.name?.split(" ")[0] || "",
        lastName: backendUser.lastName || backendUser.name?.split(" ").slice(1).join(" ") || "",
        email: backendUser.email,
        phone: backendUser.phone || "",
        dateOfBirth: backendUser.dateOfBirth || "",
        role,
        approvalStatus: backendUser.approvalStatus || "approved",
        isProfileComplete: backendUser.isProfileComplete,
        avatar: backendUser.avatar || backendUser.profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(backendUser.firstName || backendUser.name || "User")}&background=D4A84B&color=fff`,
        profileImageUrl: backendUser.profileImageUrl,
        coverMediaUrl: (backendUser as any).coverMediaUrl,
        coverMediaType: (backendUser as any).coverMediaType,
        city: backendUser.city || photographerData?.city,
        state: backendUser.state || photographerData?.state,
        businessName: backendUser.businessName,
        businessCategory: backendUser.businessCategory,
        businessDescription: backendUser.businessDescription,
        displayName: photographerData?.displayName || backendUser.displayName,
        bio: photographerData?.bio || backendUser.bio,
        hourlyRate: photographerData?.hourlyRate || backendUser.hourlyRate,
        portfolioUrl: photographerData?.portfolioUrl || backendUser.portfolioUrl,
        specialties: photographerData?.specialties || backendUser.specialties,
        isAdmin: backendUser.isAdmin || false,
        businessId: (response as any).vendor?.id,
        photographerId: photographerData?.id,
        staffId: staffData?.id,
        staffBusinessId: staffData?.businessId,
        staffBusinessName: staffData?.businessName,
        staffStripeOnboardingComplete: staffData?.stripeOnboardingComplete,
        staffStripeOnboardingUrl: staffData?.stripeOnboardingUrl,
      };

      if (newUser.approvalStatus === "rejected") {
        return { success: false, isPending: false, isRejected: true };
      }
      
      const sessionToken = response.accessToken || `session_${backendUser.id}`;
      if (response.accessToken && response.refreshToken) {
        await storeTokens(response.accessToken, response.refreshToken);
      } else if (response.refreshToken) {
        await AsyncStorage.setItem("@outsyde_refresh_token", response.refreshToken);
      }
      await storeUserData(newUser);

      if (newUser.role === "business" && newUser.approvalStatus === "pending") {
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));
        await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, sessionToken);
        return { success: true, isPending: true, isRejected: false, user: newUser };
      }
      
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));
      await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, sessionToken);
      setUser(newUser);
      console.log("[Auth] User logged in via Google:", newUser.email, "role:", newUser.role);
      return { success: true, isPending: false, isRejected: false, user: newUser };
    } catch (error: any) {
      console.error("Google login failed:", error);
      return { success: false, isPending: false, isRejected: false };
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (data: SignupData): Promise<SignupResult> => {
    setIsLoading(true);
    try {
      // Use role-based signup flow: calls role-specific endpoint then mobileLogin
      const response = await api.roleBasedSignupAndLogin({
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role as "consumer" | "business" | "photographer",
        phone: data.phone,
        dateOfBirth: data.dateOfBirth,
        username: data.username,
        businessName: data.businessName,
        businessCategory: data.businessCategory,
        businessDescription: data.businessDescription,
        logoImage: data.logoImage,
        city: data.city,
        state: data.state,
        // Photographer-specific fields
        displayName: data.displayName,
        hourlyRate: data.hourlyRate,
        portfolioUrl: data.portfolioUrl,
        // Business-specific fields
        offerType: data.offerType,
        isStartup: data.isStartup,
        isMultiStaff: data.isMultiStaff,
        yearsInBusiness: data.yearsInBusiness,
        employeeCount: data.employeeCount,
        businessType: data.businessType,
        hasPhysicalLocation: data.hasPhysicalLocation,
        address: data.address,
        streetAddress: data.streetAddress,
        aptUnit: data.aptUnit,
        zipCode: data.zipCode,
        country: data.country,
        billingSameAsHome: data.billingSameAsHome,
        billingAddress: data.billingAddress ?? data.billingStreet,
        billingStreet: data.billingStreet,
        billingCity: data.billingCity,
        billingState: data.billingState,
        billingZipCode: data.billingZipCode ?? data.billingZip,
        billingZip: data.billingZip,
        websiteUrl: data.websiteUrl,
        socialMedia: data.socialMedia,
        // Consumer-specific fields
        gender: data.gender,
        ethnicity: data.ethnicity,
        shoppingFrequency: data.shoppingFrequency,
        selectedIndustries: data.selectedIndustries,
        industryNiches: data.industryNiches,
        industryValues: data.industryValues,
      });
      
      const backendUser = response.user;
      const newUser: User = {
        id: backendUser.id,
        firstName: backendUser.firstName || data.firstName,
        lastName: backendUser.lastName || data.lastName,
        email: backendUser.email,
        phone: backendUser.phone || data.phone,
        dateOfBirth: backendUser.dateOfBirth || data.dateOfBirth,
        role: backendUser.role || data.role,
        approvalStatus: backendUser.approvalStatus || (data.role === "business" ? "pending" : "approved"),
        isProfileComplete: backendUser.isProfileComplete ?? (data.role === "consumer"),
        avatar: backendUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.firstName + "+" + data.lastName)}&background=D4A84B&color=fff`,
        city: backendUser.city || data.city,
        state: backendUser.state || data.state,
        businessName: backendUser.businessName || data.businessName,
        businessCategory: backendUser.businessCategory || data.businessCategory,
        businessDescription: backendUser.businessDescription,
        displayName: backendUser.displayName || data.displayName,
        bio: backendUser.bio || data.bio,
        hourlyRate: backendUser.hourlyRate || data.hourlyRate,
        portfolioUrl: backendUser.portfolioUrl || data.portfolioUrl,
        specialties: backendUser.specialties || data.specialties,
        username: data.username,
        gender: data.gender,
        selectedIndustries: data.selectedIndustries,
        industryNiches: data.industryNiches,
        industryValues: data.industryValues,
      };
      
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));
      // Session-based auth: backend uses cookies, store session indicator
      const sessionToken = response.accessToken || `session_${backendUser.id}`;
      await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, sessionToken);
      
      if (data.role === "business" && newUser.approvalStatus === "pending") {
        // Keep the user logged in so they can see their profile while waiting for approval
        setUser(newUser);
        return { success: true, isPending: true };
      }
      
      setUser(newUser);
      return { success: true, isPending: false };
    } catch (error: any) {
      console.error("Signup failed:", error);
      // Extract error message for display
      const errorMessage = error?.message || "Registration failed. Please try again.";
      return { success: false, isPending: false, errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const loginAsGuest = async () => {
    setIsLoading(true);
    try {
      const guestUser: User = {
        id: "guest_" + Date.now(),
        firstName: "Guest",
        lastName: "User",
        email: "guest@outsyde.app",
        phone: "",
        dateOfBirth: "",
        role: "consumer",
        approvalStatus: "approved",
        isGuest: true,
        isProfileComplete: true,
        avatar: `https://ui-avatars.com/api/?name=Guest&background=D4A84B&color=fff`,
      };
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(guestUser));
      setUser(guestUser);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      // Send refresh token to backend to revoke server-side
      try {
        const refreshToken = await getRefreshToken();
        await fetch("https://outsyde-backend.onrender.com/api/auth/logout", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: refreshToken ? JSON.stringify({ refreshToken }) : undefined,
        });
      } catch (e) {
        console.warn("[Auth] Backend logout failed (non-critical):", e);
      }
      
      // Clear SecureStore + AsyncStorage
      await clearAuthStorage();
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.USER, 
        STORAGE_KEYS.TOKEN, 
        "@outsyde_refresh_token",
        "@outsyde_favorites",
        "@outsyde_notifications",
      ]);
      
      setUser(null);
      console.log("[Auth] Logout complete - all state cleared");
    } catch (error) {
      console.error("Failed to logout:", error);
      setUser(null);
    }
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (!user) return;
    const updatedUser = { ...user, ...updates };
    await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  const getToken = async (): Promise<string | null> => {
    try {
      // Prefer SecureStore; fall back to AsyncStorage for migration
      const secureToken = await getAccessToken();
      if (secureToken) return secureToken;
      return await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
    } catch (error) {
      console.error("Failed to get token:", error);
      return null;
    }
  };

  const refreshSession = async (): Promise<LoginResult> => {
    setIsLoading(true);
    try {
      const response = await fetch("https://outsyde-backend.onrender.com/api/auth/me", {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        return { success: false, isPending: false, isRejected: false };
      }

      const data = await response.json();
      console.log("[AuthContext] refreshSession response:", JSON.stringify(data, null, 2));
      
      const userData = data.user || data;
      
      const isPhotographer = userData.isPhotographer || !!data.photographer;
      const isVendor = userData.isVendor || !!data.vendor;
      
      let derivedRole: UserRole = "consumer";
      if (isPhotographer) {
        derivedRole = "photographer";
      } else if (isVendor) {
        derivedRole = "business";
      }
      
      const approvalStatus = userData.approvalStatus || data.vendor?.approvalStatus;
      
      if (derivedRole === "business" && approvalStatus === "pending") {
        return {
          success: true,
          isPending: true,
          isRejected: false,
          user: {
            id: userData.id,
            email: userData.email || "",
            firstName: userData.firstName || userData.name?.split(" ")[0] || "",
            lastName: userData.lastName || userData.name?.split(" ").slice(1).join(" ") || "",
            phone: userData.phone || "",
            dateOfBirth: userData.dateOfBirth || "",
            role: derivedRole,
            approvalStatus: approvalStatus || "pending",
            businessName: data.vendor?.businessName,
            businessCategory: data.vendor?.businessCategory,
          },
        };
      }
      
      if (approvalStatus === "rejected") {
        return { success: false, isPending: false, isRejected: true };
      }
      
      const newUser: User = {
        id: userData.id,
        email: userData.email || "",
        firstName: userData.firstName || userData.name?.split(" ")[0] || "",
        lastName: userData.lastName || userData.name?.split(" ").slice(1).join(" ") || "",
        phone: userData.phone || "",
        dateOfBirth: userData.dateOfBirth || "",
        role: derivedRole,
        approvalStatus: approvalStatus || "approved",
        avatar: userData.avatar,
        city: isPhotographer ? data.photographer?.city : data.vendor?.city,
        state: isPhotographer ? data.photographer?.state : data.vendor?.state,
        displayName: isPhotographer ? data.photographer?.displayName : undefined,
        bio: isPhotographer ? data.photographer?.bio : undefined,
        hourlyRate: isPhotographer ? data.photographer?.hourlyRate : undefined,
        portfolioUrl: isPhotographer ? data.photographer?.portfolioUrl : undefined,
        specialties: isPhotographer ? data.photographer?.specialties : undefined,
        businessName: data.vendor?.businessName,
        businessCategory: data.vendor?.businessCategory,
        deletionStatus: userData.deletionStatus,
        scheduledDeletionAt: userData.scheduledDeletionAt,
      };
      
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));
      await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, `session_${newUser.id}`);
      setUser(newUser);
      
      return { success: true, isPending: false, isRejected: false, user: newUser };
    } catch (error) {
      console.error("Failed to refresh session:", error);
      return { success: false, isPending: false, isRejected: false };
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async (): Promise<void> => {
    try {
      console.log("[Auth] Refreshing user from /api/auth/me...");
      const response = await fetch("https://outsyde-backend.onrender.com/api/auth/me", {
        method: "GET",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      
      if (!response.ok) {
        console.warn("[Auth] refreshUser failed - status:", response.status);
        return;
      }
      
      const data = await response.json();
      console.log("[Auth] refreshUser response:", JSON.stringify(data, null, 2));
      
      // /api/auth/me returns a flat object { userId, username, displayName, bio,
      // profilePhotoUrl, coverMediaUrl, coverMediaType, ... } with no nested .user
      const backendUser = data;
      if (!backendUser?.userId && !backendUser?.id) {
        console.warn("[Auth] refreshUser - no user id in response");
        return;
      }
      
      // Update current user with fresh data from backend
      if (user) {
        const updatedUser: User = {
          ...user,
          username: backendUser.username ?? user.username,
          displayName: backendUser.displayName ?? user.displayName,
          // profilePhotoUrl is the field name on the flat /api/auth/me response
          avatar: backendUser.profilePhotoUrl || backendUser.avatar || backendUser.profileImageUrl || user.avatar,
          profileImageUrl: backendUser.profilePhotoUrl || backendUser.profileImageUrl || user.profileImageUrl,
          coverMediaUrl: backendUser.coverMediaUrl ?? user.coverMediaUrl,
          coverMediaType: (backendUser.coverMediaType as "image" | "video" | undefined) ?? user.coverMediaType,
          city: backendUser.city ?? user.city,
          state: backendUser.state ?? user.state,
          bio: backendUser.bio ?? user.bio,
          deletionStatus: backendUser.deletionStatus ?? user.deletionStatus,
          scheduledDeletionAt: backendUser.scheduledDeletionAt ?? user.scheduledDeletionAt,
          subscriptionTier: backendUser.subscriptionTier ?? user.subscriptionTier,
        };
        
        console.log("[Auth] User refreshed - username:", updatedUser.username, "displayName:", updatedUser.displayName, "bio:", updatedUser.bio);
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
        setUser(updatedUser);
      }
    } catch (error) {
      console.error("[Auth] refreshUser error:", error);
    }
  };

  const loginWithTokens = async (accessToken: string, refreshToken: string, userData: GoogleAuthUserData): Promise<LoginResult> => {
    setIsLoading(true);
    try {
      console.log("[AuthContext] loginWithTokens called with userId:", userData.userId);
      console.log("[AuthContext] User data from URL:", JSON.stringify(userData, null, 2));
      
      await storeTokens(accessToken, refreshToken);
      await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, accessToken);
      await AsyncStorage.setItem("@outsyde_refresh_token", refreshToken);

      let derivedRole: UserRole = "consumer";
      if (userData.isPhotographer) {
        derivedRole = "photographer";
      } else if (userData.isVendor) {
        derivedRole = "business";
      }
      
      const nameParts = userData.name?.split(" ") || [];
      const firstName = userData.firstName || nameParts[0] || "";
      const lastName = userData.lastName || nameParts.slice(1).join(" ") || "";
      
      const newUser: User = {
        id: userData.userId,
        email: userData.email,
        firstName,
        lastName,
        phone: "",
        dateOfBirth: "",
        role: derivedRole,
        approvalStatus: "approved",
        avatar: userData.profileImageUrl,
        isAdmin: userData.isAdmin || false,
        businessId: userData.businessId,
        photographerId: userData.photographerId,
      };
      
      await storeUserData(newUser);
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));
      setUser(newUser);
      
      console.log("[AuthContext] User logged in successfully:", newUser.email, "role:", derivedRole, "isAdmin:", newUser.isAdmin);
      // Remove any abandoned Google profile stored during OAuth signup flow
      await AsyncStorage.removeItem('@outsyde_google_profile');
      return { success: true, isPending: false, isRejected: false, user: newUser };
    } catch (error) {
      console.error("Failed to login with tokens:", error);
      return { success: false, isPending: false, isRejected: false };
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        loginWithGoogle,
        loginWithTokens,
        signup,
        loginAsGuest,
        logout,
        updateProfile,
        getToken,
        refreshSession,
        refreshUser,
        pendingResetParams,
        clearPendingResetParams,
        pendingStripeReturn,
        clearPendingStripeReturn,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
