import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useColorScheme as useSystemColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Colors } from "@/constants/theme";

type ColorScheme = "light" | "dark";

interface ThemeContextType {
  colorScheme: ColorScheme;
  isDark: boolean;
  theme: typeof Colors.light;
  toggleTheme: () => void;
  setColorScheme: (scheme: ColorScheme) => void;
}

const THEME_STORAGE_KEY = "@outsyde_theme_preference";

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const systemColorScheme = useSystemColorScheme();
  const [userPreference, setUserPreference] = useState<ColorScheme | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (stored === "light" || stored === "dark") {
        setUserPreference(stored);
      }
    } catch (error) {
      console.error("Failed to load theme preference:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveThemePreference = async (scheme: ColorScheme) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, scheme);
    } catch (error) {
      console.error("Failed to save theme preference:", error);
    }
  };

  const colorScheme: ColorScheme = userPreference ?? (systemColorScheme === "dark" ? "dark" : "light");
  const isDark = colorScheme === "dark";
  const theme = Colors[colorScheme];

  const toggleTheme = () => {
    const newScheme = isDark ? "light" : "dark";
    setUserPreference(newScheme);
    saveThemePreference(newScheme);
  };

  const setColorScheme = (scheme: ColorScheme) => {
    setUserPreference(scheme);
    saveThemePreference(scheme);
  };

  if (isLoading) {
    return null;
  }

  return (
    <ThemeContext.Provider
      value={{
        colorScheme,
        isDark,
        theme,
        toggleTheme,
        setColorScheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeContext() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useThemeContext must be used within a ThemeProvider");
  }
  return context;
}
