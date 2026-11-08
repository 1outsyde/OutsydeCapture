import { resolveApiBaseUrl } from "../utils/apiBaseUrl";

// Expo inlines EXPO_PUBLIC_* only when read exactly like this (process.env.NAME).
export const BASE_URL = resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_URL);
