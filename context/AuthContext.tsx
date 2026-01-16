import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type AccountType = "consumer" | "business";
export type ApprovalStatus = "approved" | "pending" | "rejected";

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  accountType: AccountType;
  approvalStatus: ApprovalStatus;
  avatar?: string;
  isGuest?: boolean;
  businessName?: string;
  businessCategory?: string;
}

export interface SignupData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  password: string;
  accountType: AccountType;
  businessName?: string;
  businessCategory?: string;
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
        if (parsed.accountType === "business" && parsed.approvalStatus === "pending") {
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
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      const storedUser = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      if (storedUser) {
        const existingUser = JSON.parse(storedUser);
        if (existingUser.email === email) {
          if (existingUser.approvalStatus === "rejected") {
            return { success: false, isPending: false, isRejected: true };
          }
          if (existingUser.accountType === "business" && existingUser.approvalStatus === "pending") {
            return { success: true, isPending: true, isRejected: false, user: existingUser };
          }
          setUser(existingUser);
          return { success: true, isPending: false, isRejected: false, user: existingUser };
        }
      }
      
      const pendingList = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_BUSINESSES);
      if (pendingList) {
        const pending = JSON.parse(pendingList);
        const pendingBusiness = pending.find((p: User) => p.email === email);
        if (pendingBusiness) {
          if (pendingBusiness.approvalStatus === "rejected") {
            return { success: false, isPending: false, isRejected: true };
          }
          return { success: true, isPending: true, isRejected: false, user: pendingBusiness };
        }
      }
      
      const mockUser: User = {
        id: "user_" + Date.now(),
        firstName: email.split("@")[0],
        lastName: "",
        email,
        phone: "",
        dateOfBirth: "",
        accountType: "consumer",
        approvalStatus: "approved",
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(email.split("@")[0])}&background=D4A84B&color=fff`,
      };
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(mockUser));
      await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, "mock_token_" + Date.now());
      setUser(mockUser);
      return { success: true, isPending: false, isRejected: false, user: mockUser };
    } catch (error) {
      console.error("Login failed:", error);
      return { success: false, isPending: false, isRejected: false };
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (data: SignupData): Promise<{ success: boolean; isPending: boolean }> => {
    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      const approvalStatus: ApprovalStatus = data.accountType === "business" ? "pending" : "approved";
      
      const newUser: User = {
        id: (data.accountType === "business" ? "biz_" : "user_") + Date.now(),
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        dateOfBirth: data.dateOfBirth,
        accountType: data.accountType,
        approvalStatus,
        businessName: data.businessName,
        businessCategory: data.businessCategory,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(data.firstName + "+" + data.lastName)}&background=D4A84B&color=fff`,
      };
      
      if (data.accountType === "business") {
        const pendingList = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_BUSINESSES);
        const pending = pendingList ? JSON.parse(pendingList) : [];
        pending.push({ ...newUser, createdAt: new Date().toISOString() });
        await AsyncStorage.setItem(STORAGE_KEYS.PENDING_BUSINESSES, JSON.stringify(pending));
        await AsyncStorage.multiRemove([STORAGE_KEYS.USER, STORAGE_KEYS.TOKEN]);
        setUser(null);
        return { success: true, isPending: true };
      }
      
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));
      await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, "mock_token_" + Date.now());
      setUser(newUser);
      return { success: true, isPending: false };
    } catch (error) {
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
        accountType: "consumer",
        approvalStatus: "approved",
        isGuest: true,
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
