import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "@/services/api";
import { useAuth } from "./AuthContext";
import {
  canClearLegacy,
  favoritesFromServer,
  legacyImportItems,
  type FavoriteItem,
  type FavoriteType,
} from "@/utils/savedFavorites";

export type { FavoriteItem, FavoriteType } from "@/utils/savedFavorites";

/**
 * Saved businesses, photographers and products live on the account (backend #378, migration 077),
 * next to saved posts (SavedPostsContext). Both show in one Saved place (components/SavedCollection).
 *
 * - `favorites` comes from GET /api/users/me/favorites. Saving / removing updates right away, then calls
 *   the backend; on failure it goes back.
 * - One-time move: older builds kept this list only on the phone (`@outsyde_favorites_<userId>`). It is
 *   uploaded once to POST /api/users/me/favorites/import (the server keeps only real, public ids).
 *   The phone list also holds old post bookmarks that SavedPostsContext moves (it reads `legacyFavorites`),
 *   so the phone copy is deleted only after both moves are done (canClearLegacy).
 */

interface FavoritesContextType {
  favorites: FavoriteItem[];
  isLoading: boolean;
  /** Id of the user whose saved items are loaded from the account (null while loading or signed out). */
  loadedUserId: string | null;
  addFavorite: (item: Omit<FavoriteItem, "savedAt">) => Promise<void>;
  removeFavorite: (id: string, type: FavoriteType) => Promise<void>;
  isFavorite: (id: string, type: FavoriteType) => boolean;
  toggleFavorite: (item: Omit<FavoriteItem, "savedAt">) => Promise<void>;
  getFavoritesByType: (type: FavoriteType) => FavoriteItem[];
  refreshFavorites: () => Promise<void>;
  /** The old phone-only list, for the one-time saved-posts move. */
  legacyFavorites: FavoriteItem[];
  /** Id of the user whose phone list is loaded (null while loading or signed out). */
  legacyLoadedUserId: string | null;
  /** Remove entries from the old phone list (the saved-posts move calls this). */
  removeLegacyFavorites: (items: Array<{ id: string; type: FavoriteType }>) => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export const legacyFavoritesKey = (userId: string) => `@outsyde_favorites_${userId}`;
const importedKey = (userId: string) => `@outsyde_favorites_imported_${userId}`;
// Set by SavedPostsContext when its move of old post bookmarks is done.
const postsMovedKey = (userId: string) => `@outsyde_saved_posts_migrated_${userId}`;

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user, getToken } = useAuth();
  const userId = user?.id ? String(user.id) : null;
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [legacyFavorites, setLegacyFavorites] = useState<FavoriteItem[]>([]);
  const [legacyLoadedUserId, setLegacyLoadedUserId] = useState<string | null>(null);
  const legacyRef = useRef<FavoriteItem[]>([]);
  const favoritesRef = useRef<FavoriteItem[]>([]);
  favoritesRef.current = favorites;
  const currentUser = useRef<string | null>(null);
  currentUser.current = userId;
  const inFlight = useRef<Set<string>>(new Set());

  const fetchServer = useCallback(async (forUser: string, token: string) => {
    const res = await api.getFavorites(token);
    if (currentUser.current !== forUser) return;
    const list = favoritesFromServer(res);
    favoritesRef.current = list;
    setFavorites(list);
    setLoadedUserId(forUser);
  }, []);

  const refreshFavorites = useCallback(async () => {
    const forUser = currentUser.current;
    if (!forUser) return;
    try {
      const token = await getToken();
      if (token) await fetchServer(forUser, token);
    } catch (error) {
      console.warn("[Favorites] refresh failed:", error);
    }
  }, [getToken, fetchServer]);

  useEffect(() => {
    if (!userId) {
      setFavorites([]);
      setLoadedUserId(null);
      setLegacyFavorites([]);
      legacyRef.current = [];
      setLegacyLoadedUserId(null);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setLoadedUserId(null);
    setLegacyLoadedUserId(null);
    setFavorites([]);
    (async () => {
      // 1. The old phone list (never another account's).
      let legacy: FavoriteItem[] = [];
      try {
        const stored = await AsyncStorage.getItem(legacyFavoritesKey(userId));
        const parsed = stored ? JSON.parse(stored) : [];
        legacy = Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        console.warn("[Favorites] could not read the phone list:", error);
      }
      if (cancelled) return;
      legacyRef.current = legacy;
      setLegacyFavorites(legacy);
      setLegacyLoadedUserId(userId);

      // 2. The account list, with the one-time upload first.
      try {
        const token = await getToken();
        if (!token || cancelled) return;
        let imported = await AsyncStorage.getItem(importedKey(userId));
        if (!imported) {
          const items = legacyImportItems(legacy);
          if (items.length > 0) await api.importFavorites(token, items);
          imported = new Date().toISOString();
          await AsyncStorage.setItem(importedKey(userId), imported);
        }
        await fetchServer(userId, token);
        if (legacy.length > 0 && canClearLegacy(imported, await AsyncStorage.getItem(postsMovedKey(userId)))) {
          await AsyncStorage.removeItem(legacyFavoritesKey(userId));
        }
      } catch (error) {
        // Offline or server error: the upload is tried again next launch (the flag is not set).
        console.warn("[Favorites] load failed:", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const removeLegacyFavorites = useCallback(
    async (items: Array<{ id: string; type: FavoriteType }>) => {
      const forUser = currentUser.current;
      if (!forUser || items.length === 0) return;
      const drop = new Set(items.map((i) => `${i.type}_${i.id}`));
      const updated = legacyRef.current.filter((f) => !drop.has(`${f.type}_${f.id}`));
      legacyRef.current = updated;
      setLegacyFavorites(updated);
      try {
        await AsyncStorage.setItem(legacyFavoritesKey(forUser), JSON.stringify(updated));
      } catch (error) {
        console.warn("[Favorites] could not update the phone list:", error);
      }
    },
    [],
  );

  const isFavorite = useCallback(
    (id: string, type: FavoriteType): boolean => favorites.some((f) => f.id === String(id) && f.type === type),
    [favorites],
  );

  const write = useCallback(
    async (item: Omit<FavoriteItem, "savedAt">, save: boolean) => {
      const forUser = currentUser.current;
      if (!forUser) return;
      const id = String(item.id);
      const key = `${item.type}:${id}`;
      if (inFlight.current.has(key)) return; // a second tap while the first is running
      inFlight.current.add(key);
      const before = favoritesRef.current;
      const next = save
        ? [{ ...item, id, savedAt: new Date().toISOString() }, ...before.filter((f) => !(f.id === id && f.type === item.type))]
        : before.filter((f) => !(f.id === id && f.type === item.type));
      favoritesRef.current = next;
      setFavorites(next);
      try {
        const token = await getToken();
        if (!token) throw new Error("Not signed in");
        if (save) await api.saveFavorite(token, item.type, id);
        else await api.removeFavorite(token, item.type, id);
      } catch (error) {
        console.warn("[Favorites] save failed:", error);
        if (currentUser.current === forUser) {
          favoritesRef.current = before;
          setFavorites(before);
        }
      } finally {
        inFlight.current.delete(key);
      }
    },
    [getToken],
  );

  const addFavorite = useCallback((item: Omit<FavoriteItem, "savedAt">) => write(item, true), [write]);
  const removeFavorite = useCallback(
    (id: string, type: FavoriteType) => {
      const existing = favoritesRef.current.find((f) => f.id === String(id) && f.type === type);
      return write(existing ?? { id: String(id), type, name: "", image: "" }, false);
    },
    [write],
  );
  const toggleFavorite = useCallback(
    (item: Omit<FavoriteItem, "savedAt">) =>
      write(item, !favoritesRef.current.some((f) => f.id === String(item.id) && f.type === item.type)),
    [write],
  );

  const getFavoritesByType = useCallback(
    (type: FavoriteType): FavoriteItem[] => favorites.filter((f) => f.type === type),
    [favorites],
  );

  return (
    <FavoritesContext.Provider
      value={{
        favorites,
        isLoading,
        loadedUserId,
        addFavorite,
        removeFavorite,
        isFavorite,
        toggleFavorite,
        getFavoritesByType,
        refreshFavorites,
        legacyFavorites,
        legacyLoadedUserId,
        removeLegacyFavorites,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (context === undefined) {
    throw new Error("useFavorites must be used within a FavoritesProvider");
  }
  return context;
}
