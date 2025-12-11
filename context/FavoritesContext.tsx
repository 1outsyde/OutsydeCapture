import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
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
  addFavorite: (item: Omit<FavoriteItem, "savedAt">) => Promise<void>;
  removeFavorite: (id: string, type: FavoriteType) => Promise<void>;
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

  useEffect(() => {
    if (user) {
      loadFavorites();
    } else {
      setFavorites([]);
      setIsLoading(false);
    }
  }, [user?.id]);

  const loadFavorites = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const stored = await AsyncStorage.getItem(getFavoritesKey(user.id));
      if (stored) {
        setFavorites(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Failed to load favorites:", error);
    } finally {
      setIsLoading(false);
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
        addFavorite,
        removeFavorite,
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
