export const Colors = {
  light: {
    text: "#1A1A1A",
    textSecondary: "#666666",
    textPrimary: "#1A1A1A",
    textMuted: "#999999",
    background: "#FFFFFF",
    backgroundRoot: "#F5F5F5",
    backgroundDefault: "#FFFFFF",
    backgroundSecondary: "#F0F0F0",
    surface: "#FFFFFF",
    surfaceSecondary: "#F5F5F5",
    primary: "#FF9500",
    primaryLight: "#FFB84D",
    primaryTransparent: "rgba(255, 149, 0, 0.1)",
    accent: "#FF9500",
    border: "#E5E5E5",
    success: "#34C759",
    error: "#FF3B30",
    warning: "#FF9500",
    warningBackground: "rgba(255, 149, 0, 0.1)",
    tabIconDefault: "#999999",
    tabIconSelected: "#FF9500",
    icon: "#666666",
    card: "#FFFFFF",
    cardElevated: "#FFFFFF",
    overlay: "rgba(0, 0, 0, 0.5)",
  },
  dark: {
    text: "#FFFFFF",
    textSecondary: "#A0A0A0",
    textPrimary: "#FFFFFF",
    textMuted: "#666666",
    background: "#000000",
    backgroundRoot: "#000000",
    backgroundDefault: "#1C1C1E",
    backgroundSecondary: "#2C2C2E",
    surface: "#1C1C1E",
    surfaceSecondary: "#2C2C2E",
    primary: "#FF9F0A",
    primaryLight: "#FFB84D",
    primaryTransparent: "rgba(255, 159, 10, 0.15)",
    accent: "#FF9F0A",
    border: "#38383A",
    success: "#30D158",
    error: "#FF453A",
    warning: "#FF9F0A",
    warningBackground: "rgba(255, 159, 10, 0.15)",
    tabIconDefault: "#666666",
    tabIconSelected: "#FF9F0A",
    icon: "#A0A0A0",
    card: "#1C1C1E",
    cardElevated: "#2C2C2E",
    overlay: "rgba(0, 0, 0, 0.7)",
  },
};

export const Spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 20,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
  inputHeight: 50,
  buttonHeight: 50,
  fabSize: 56,
};

export const BorderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
  round: 9999,
};

export const FontSizes = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  "2xl": 24,
  "3xl": 34,
};

export const Typography = {
  h1: {
    fontSize: 34,
    fontWeight: "700" as const,
    lineHeight: 41,
  },
  h2: {
    fontSize: 28,
    fontWeight: "700" as const,
    lineHeight: 34,
  },
  h3: {
    fontSize: 22,
    fontWeight: "600" as const,
    lineHeight: 28,
  },
  h4: {
    fontSize: 20,
    fontWeight: "600" as const,
    lineHeight: 25,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "600" as const,
    lineHeight: 23,
  },
  body: {
    fontSize: 17,
    fontWeight: "400" as const,
    lineHeight: 22,
  },
  bodyBold: {
    fontSize: 17,
    fontWeight: "600" as const,
    lineHeight: 22,
  },
  caption: {
    fontSize: 13,
    fontWeight: "400" as const,
    lineHeight: 18,
  },
  small: {
    fontSize: 11,
    fontWeight: "400" as const,
    lineHeight: 13,
  },
  button: {
    fontSize: 17,
    fontWeight: "600" as const,
    lineHeight: 22,
  },
};

export const Fonts = {
  regular: "System",
  medium: "System",
  semibold: "System",
  bold: "System",
  mono: "monospace",
};

export const Shadows = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  fab: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
};
