import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "./AuthContext";

export type FavoriteType = "photographer" | "business" | "product";

export interface FavoriteItem {
  id: string;
  type: FavoriteType;
  name: string;
  image: string;
  subtitle?: string;
  savedAt: string;
}

interface FavoritesContextType {
  favorites: FavoriteItem[];
  isLoading: boolean;
  /** Id of the user whose favorites are currently loaded (null while loading or signed out). */
  loadedUserId: string | null;
  addFavorite: (item: Omit<FavoriteItem, "savedAt">) => Promise<void>;
  removeFavorite: (id: string, type: FavoriteType) => Promise<void>;
  /** Remove several at once in one write (used by the one-time saved-posts move). */
  removeFavorites: (items: Array<{ id: string; type: FavoriteType }>) => Promise<void>;
  isFavorite: (id: string, type: FavoriteType) => boolean;
  toggleFavorite: (item: Omit<FavoriteItem, "savedAt">) => Promise<void>;
  getFavoritesByType: (type: FavoriteType) => FavoriteItem[];
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

const getFavoritesKey = (userId: string) => `@outsyde_favorites_${userId}`;

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const favoritesRef = useRef<FavoriteItem[]>([]);
  favoritesRef.current = favorites;

  useEffect(() => {
    if (user) {
      loadFavorites();
    } else {
      setFavorites([]);
      setLoadedUserId(null);
      setIsLoading(false);
    }
  }, [user?.id]);

  const loadFavorites = async () => {
    if (!user) return;
    setIsLoading(true);
    setLoadedUserId(null);
    let loaded = false;
    try {
      const stored = await AsyncStorage.getItem(getFavoritesKey(user.id));
      // A user with nothing stored starts empty (never keeps the previous account's list).
      const list: FavoriteItem[] = stored ? JSON.parse(stored) : [];
      favoritesRef.current = list;
      setFavorites(list);
      loaded = true;
    } catch (error) {
      console.error("Failed to load favorites:", error);
    } finally {
      setIsLoading(false);
      if (loaded) setLoadedUserId(String(user.id));
    }
  };

  const saveFavorites = async (newFavorites: FavoriteItem[]) => {
    if (!user) return;
    try {
      await AsyncStorage.setItem(getFavoritesKey(user.id), JSON.stringify(newFavorites));
    } catch (error) {
      console.error("Failed to save favorites:", error);
    }
  };

  const addFavorite = async (item: Omit<FavoriteItem, "savedAt">) => {
    if (!user) return;
    const newItem: FavoriteItem = {
      ...item,
      savedAt: new Date().toISOString(),
    };
    const updated = [...favorites, newItem];
    setFavorites(updated);
    await saveFavorites(updated);
  };

  const removeFavorite = async (id: string, type: FavoriteType) => {
    if (!user) return;
    const updated = favorites.filter(f => !(f.id === id && f.type === type));
    setFavorites(updated);
    await saveFavorites(updated);
  };

  const removeFavorites = async (items: Array<{ id: string; type: FavoriteType }>) => {
    if (!user || items.length === 0) return;
    const drop = new Set(items.map((i) => `${i.type}_${i.id}`));
    const updated = favoritesRef.current.filter((f) => !drop.has(`${f.type}_${f.id}`));
    favoritesRef.current = updated;
    setFavorites(updated);
    await saveFavorites(updated);
  };

  const isFavorite = useCallback((id: string, type: FavoriteType): boolean => {
    return favorites.some(f => f.id === id && f.type === type);
  }, [favorites]);

  const toggleFavorite = async (item: Omit<FavoriteItem, "savedAt">) => {
    if (isFavorite(item.id, item.type)) {
      await removeFavorite(item.id, item.type);
    } else {
      await addFavorite(item);
    }
  };

  const getFavoritesByType = useCallback((type: FavoriteType): FavoriteItem[] => {
    return favorites.filter(f => f.type === type);
  }, [favorites]);

  return (
    <FavoritesContext.Provider
      value={{
        favorites,
        isLoading,
        loadedUserId,
        addFavorite,
        removeFavorite,
        removeFavorites,
        isFavorite,
        toggleFavorite,
        getFavoritesByType,
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
