import React, { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api, { ApiPost } from "@/services/api";
import { useAuth } from "./AuthContext";
import { useFavorites, FavoriteItem } from "./FavoritesContext";

/**
 * Saved posts live on the account (backend `user_saved_posts`), not on the phone.
 *
 * - `savedIds` is loaded from GET /api/users/me/saved-posts when the user signs in and is the
 *   single source the bookmark icons read (`isSaved`).
 * - `toggleSave` updates the icon right away, then calls the backend; on failure it reverts.
 *   A second tap while the first request is still running is ignored.
 * - One-time move: before this build, post bookmarks were stored in the phone-only Favorites list
 *   (FavoritesContext `legacyFavorites`),
 *   (phone only), filed as type "product" (vendor posts) or "photographer" (all other posts).
 *   Each of those ids is tried against POST /api/feed/:id/save. Saved (200) = it was a post, so it
 *   moves to the account and leaves Favorites. 404 = not a post: "photographer" entries are real
 *   photographer favorites and stay; "product" entries were posts that no longer exist and are
 *   removed. Any other error (offline, server) leaves the entry for the next launch. The move is
 *   marked done per user only when nothing was left to retry.
 */

const migratedKey = (userId: string) => `@outsyde_saved_posts_migrated_${userId}`;

interface SavedPostsContextType {
  savedIds: Set<string>;
  savedPosts: ApiPost[];
  isLoading: boolean;
  isSaved: (postId: string) => boolean;
  toggleSave: (postId: string) => Promise<void>;
  refreshSaved: () => Promise<void>;
}

const SavedPostsContext = createContext<SavedPostsContextType | undefined>(undefined);

export function SavedPostsProvider({ children }: { children: ReactNode }) {
  const { user, getToken } = useAuth();
  const {
    legacyFavorites: favorites,
    legacyLoadedUserId: favoritesUserId,
    removeLegacyFavorites: removeFavorites,
  } = useFavorites();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savedPosts, setSavedPosts] = useState<ApiPost[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inFlight = useRef<Set<string>>(new Set());
  const migrationRan = useRef<string | null>(null);
  const userId = user?.id ? String(user.id) : null;

  const refreshSaved = useCallback(async () => {
    if (!userId) return;
    const token = await getToken();
    if (!token) return;
    setIsLoading(true);
    try {
      const { posts } = await api.getSavedPosts(token);
      const list = Array.isArray(posts) ? posts : [];
      setSavedPosts(list);
      setSavedIds(new Set(list.map((p) => String(p.id))));
    } catch (error) {
      console.warn("[SavedPosts] load failed:", error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, getToken]);

  // Load on sign-in, clear on sign-out.
  useEffect(() => {
    if (userId) {
      refreshSaved();
    } else {
      setSavedIds(new Set());
      setSavedPosts([]);
      migrationRan.current = null;
    }
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // One-time move of old phone-only post bookmarks (see header comment).
  useEffect(() => {
    // Wait until the phone's favorites for THIS user are loaded (never another account's).
    if (!userId || favoritesUserId !== userId || migrationRan.current === userId) return;
    migrationRan.current = userId;
    (async () => {
      try {
        if (await AsyncStorage.getItem(migratedKey(userId))) return;
        const token = await getToken();
        if (!token) {
          migrationRan.current = null;
          return;
        }
        const candidates: FavoriteItem[] = favorites.filter(
          (f) => f.type === "product" || f.type === "photographer"
        );
        let retryLater = false;
        let moved = 0;
        const toRemove: FavoriteItem[] = [];
        for (const item of candidates) {
          try {
            await api.savePost(token, item.id);
            toRemove.push(item);
            moved++;
          } catch (error: any) {
            if (error?.status === 404) {
              if (item.type === "product") toRemove.push(item);
              // photographer + 404 = a real photographer favorite: keep it
            } else {
              retryLater = true;
            }
          }
        }
        await removeFavorites(toRemove);
        if (!retryLater) await AsyncStorage.setItem(migratedKey(userId), new Date().toISOString());
        else migrationRan.current = null; // try again on next sign-in / launch
        if (moved > 0) await refreshSaved();
      } catch (error) {
        console.warn("[SavedPosts] migration failed:", error);
        migrationRan.current = null;
      }
    })();
  }, [userId, favoritesUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  const isSaved = useCallback((postId: string) => savedIds.has(String(postId)), [savedIds]);

  const toggleSave = useCallback(
    async (rawId: string) => {
      const postId = String(rawId);
      if (!userId || inFlight.current.has(postId)) return;
      // Claim the post before any await so a double tap can't slip through.
      inFlight.current.add(postId);
      const token = await getToken();
      if (!token) {
        inFlight.current.delete(postId);
        return;
      }
      const wasSaved = savedIds.has(postId);
      const apply = (saved: boolean) =>
        setSavedIds((prev) => {
          const next = new Set(prev);
          if (saved) next.add(postId);
          else next.delete(postId);
          return next;
        });
      apply(!wasSaved);
      try {
        if (wasSaved) {
          await api.unsavePost(token, postId);
          setSavedPosts((prev) => prev.filter((p) => String(p.id) !== postId));
        } else {
          await api.savePost(token, postId);
          refreshSaved();
        }
      } catch (error) {
        console.warn("[SavedPosts] toggle failed:", error);
        apply(wasSaved);
      } finally {
        inFlight.current.delete(postId);
      }
    },
    [userId, getToken, savedIds, refreshSaved]
  );

  return (
    <SavedPostsContext.Provider value={{ savedIds, savedPosts, isLoading, isSaved, toggleSave, refreshSaved }}>
      {children}
    </SavedPostsContext.Provider>
  );
}

export function useSavedPosts() {
  const context = useContext(SavedPostsContext);
  if (context === undefined) {
    throw new Error("useSavedPosts must be used within a SavedPostsProvider");
  }
  return context;
}
