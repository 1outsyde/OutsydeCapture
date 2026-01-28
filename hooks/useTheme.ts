import { useThemeContext } from "@/context/ThemeContext";

export function useTheme() {
  const { theme, isDark, toggleTheme, setColorScheme, colorScheme } = useThemeContext();

  return {
    theme,
    isDark,
    toggleTheme,
    setColorScheme,
    colorScheme,
  };
}
