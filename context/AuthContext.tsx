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

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  signup: (data: SignupData) => Promise<{ success: boolean; isPending: boolean }>;
  loginAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  getToken: () => Promise<string | null>;
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
      
      const backendUser = response.user;
      const newUser: User = {
        id: backendUser.id,
        firstName: backendUser.firstName || email.split("@")[0],
        lastName: backendUser.lastName || "",
        email: backendUser.email,
        phone: backendUser.phone || "",
        dateOfBirth: backendUser.dateOfBirth || "",
        role: backendUser.role,
        approvalStatus: backendUser.approvalStatus || "approved",
        isProfileComplete: backendUser.isProfileComplete,
        avatar: backendUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(backendUser.firstName || email.split("@")[0])}&background=D4A84B&color=fff`,
        city: backendUser.city,
        state: backendUser.state,
        businessName: backendUser.businessName,
        businessCategory: backendUser.businessCategory,
        businessDescription: backendUser.businessDescription,
        displayName: backendUser.displayName,
        bio: backendUser.bio,
        hourlyRate: backendUser.hourlyRate,
        portfolioUrl: backendUser.portfolioUrl,
        specialties: backendUser.specialties,
      };

      if (newUser.approvalStatus === "rejected") {
        return { success: false, isPending: false, isRejected: true };
      }
      
      if (newUser.role === "business" && newUser.approvalStatus === "pending") {
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));
        await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, response.accessToken);
        return { success: true, isPending: true, isRejected: false, user: newUser };
      }
      
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));
      await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, response.accessToken);
      setUser(newUser);
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

  const signup = async (data: SignupData): Promise<{ success: boolean; isPending: boolean }> => {
    setIsLoading(true);
    try {
      const response = await api.mobileSignup({
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
      });
      
      const backendUser = response.user;
      const newUser: User = {
        id: backendUser.id,
        firstName: backendUser.firstName || data.firstName,
        lastName: backendUser.lastName || data.lastName,
        email: backendUser.email,
        phone: backendUser.phone || data.phone,
        dateOfBirth: backendUser.dateOfBirth || data.dateOfBirth,
        role: backendUser.role,
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
      await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, response.accessToken);
      
      if (data.role === "business" && newUser.approvalStatus === "pending") {
        setUser(null);
        return { success: true, isPending: true };
      }
      
      setUser(newUser);
      return { success: true, isPending: false };
    } catch (error: any) {
      console.error("Signup failed:", error);
      return { success: false, isPending: false };
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

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        signup,
        loginAsGuest,
        logout,
        updateProfile,
        getToken,
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
