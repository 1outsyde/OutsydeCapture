import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "outsyde_access_token";
const REFRESH_TOKEN_KEY = "outsyde_refresh_token";
const USER_DATA_KEY = "outsyde_user_data";

export async function storeTokens(accessToken: string, refreshToken: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function storeUserData(user: object): Promise<void> {
  await SecureStore.setItemAsync(USER_DATA_KEY, JSON.stringify(user));
}

export async function getStoredUserData<T>(): Promise<T | null> {
  const data = await SecureStore.getItemAsync(USER_DATA_KEY);
  return data ? (JSON.parse(data) as T) : null;
}

export async function clearAuthStorage(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(USER_DATA_KEY),
  ]);
}
