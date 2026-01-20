import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../services/api";

export type UserRole = "consumer" | "business" | "photographer";
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
  yearsInBusiness?: string;
  employeeCount?: string;
  businessType?: string;
  hasPhysicalLocation?: boolean;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
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

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  loginWithGoogle: (idToken: string) => Promise<LoginResult>;
  loginWithTokens: (accessToken: string, refreshToken: string, userData: GoogleAuthUserData) => Promise<LoginResult>;
  signup: (data: SignupData) => Promise<SignupResult>;
  loginAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  getToken: () => Promise<string | null>;
  refreshSession: () => Promise<LoginResult>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEYS = {
  USER: "@outsyde_user",
  TOKEN: "@outsyde_token",
  PENDING_BUSINESSES: "@outsyde_pending_businesses",
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedUser = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed.role === "business" && parsed.approvalStatus === "pending") {
          return;
        }
        if (parsed.approvalStatus === "rejected") {
          return;
        }
        setUser(parsed);
      }
    } catch (error) {
      console.error("Failed to load auth:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<LoginResult> => {
    setIsLoading(true);
    try {
      const response = await api.mobileLogin({ email, password });
      console.log("[Auth] Login response received, user:", response.user?.id);
      
      const backendUser = response.user;
      
      // Determine role from backend flags
      let role: UserRole = "consumer";
      if (backendUser.isPhotographer) {
        role = "photographer";
      } else if (backendUser.isVendor) {
        role = "business";
      }
      
      // Extract photographer data if present
      const photographerData = (response as any).photographer;
      
      const newUser: User = {
        id: backendUser.id,
        firstName: backendUser.firstName || backendUser.name?.split(" ")[0] || email.split("@")[0],
        lastName: backendUser.lastName || backendUser.name?.split(" ").slice(1).join(" ") || "",
        email: backendUser.email,
        phone: backendUser.phone || "",
        dateOfBirth: backendUser.dateOfBirth || "",
        role,
        approvalStatus: backendUser.approvalStatus || "approved",
        isProfileComplete: backendUser.isProfileComplete,
        avatar: backendUser.avatar || backendUser.profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(backendUser.firstName || backendUser.name || email.split("@")[0])}&background=D4A84B&color=fff`,
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
      };

      if (newUser.approvalStatus === "rejected") {
        return { success: false, isPending: false, isRejected: true };
      }
      
      // Session-based auth: backend uses cookies, store a session indicator
      // For web, cookies handle auth automatically. For mobile, we rely on cookie persistence.
      const sessionToken = response.accessToken || `session_${backendUser.id}`;
      
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
      };

      if (newUser.approvalStatus === "rejected") {
        return { success: false, isPending: false, isRejected: true };
      }
      
      // Session-based auth: backend uses cookies, store a session indicator
      const sessionToken = response.accessToken || `session_${backendUser.id}`;
      
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
        role: data.role,
        phone: data.phone,
        dateOfBirth: data.dateOfBirth,
        businessName: data.businessName,
        businessCategory: data.businessCategory,
        businessDescription: data.businessDescription,
        city: data.city,
        state: data.state,
        // Photographer-specific fields
        displayName: data.displayName,
        hourlyRate: data.hourlyRate,
        portfolioUrl: data.portfolioUrl,
        // Business-specific fields
        offerType: data.offerType,
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
        setUser(null);
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
      await AsyncStorage.multiRemove([STORAGE_KEYS.USER, STORAGE_KEYS.TOKEN]);
      setUser(null);
    } catch (error) {
      console.error("Failed to logout:", error);
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

  const loginWithTokens = async (accessToken: string, refreshToken: string, userData: GoogleAuthUserData): Promise<LoginResult> => {
    setIsLoading(true);
    try {
      console.log("[AuthContext] loginWithTokens called with userId:", userData.userId);
      console.log("[AuthContext] User data from URL:", JSON.stringify(userData, null, 2));
      
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
      
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));
      setUser(newUser);
      
      console.log("[AuthContext] User logged in successfully:", newUser.email, "role:", derivedRole, "isAdmin:", newUser.isAdmin);
      
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
