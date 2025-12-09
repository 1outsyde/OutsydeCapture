import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  isGuest?: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  loginAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEYS = {
  USER: "@outsyde_user",
  TOKEN: "@outsyde_token",
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
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error("Failed to load auth:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const mockUser: User = {
        id: "user_" + Date.now(),
        name: email.split("@")[0],
        email,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(email.split("@")[0])}&background=D4A84B&color=fff`,
      };
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(mockUser));
      await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, "mock_token_" + Date.now());
      setUser(mockUser);
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (name: string, email: string, password: string) => {
    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const mockUser: User = {
        id: "user_" + Date.now(),
        name,
        email,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=D4A84B&color=fff`,
      };
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(mockUser));
      await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, "mock_token_" + Date.now());
      setUser(mockUser);
    } finally {
      setIsLoading(false);
    }
  };

  const loginAsGuest = async () => {
    setIsLoading(true);
    try {
      const guestUser: User = {
        id: "guest_" + Date.now(),
        name: "Guest User",
        email: "guest@outsyde.app",
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
