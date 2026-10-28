import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/context/AuthContext"; // adjust path if needed
import { cartLineKey, type CartAddon } from "@/components/products/productAddonLogic";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  vendorId: string;
  vendorStripeAccountId?: string;
  imageUrl?: string;
  variantId?: string;
  variantLabel?: string;
  /**
   * Add-ons picked for this line (backend #371). Present (even empty) only for products that have
   * add-on groups; checkout then sends it so the backend checks and prices the picks. `price` is the
   * per unit price with the add-ons included.
   */
  addons?: CartAddon[];
  addonsLabel?: string;
}

/** Identity of a cart line: product, variation and picked add-ons. */
export const lineKeyOf = (i: Pick<CartItem, "productId" | "variantId" | "addons">): string =>
  cartLineKey(i.productId, i.variantId, i.addons);

interface CartContextType {
  items: CartItem[];
  addItem(item: CartItem): void;
  /** lineKey (from lineKeyOf) picks the exact line when the same product is in the cart with different add-ons. */
  removeItem(productId: string, variantId?: string, lineKey?: string): void;
  updateQuantity(productId: string, variantId: string | undefined, quantity: number, lineKey?: string): void;
  clearCart(): void;
  removeVendorItems(vendorId: string): void;
  itemCount: number;
  subtotal: number;
  isCartLoading: boolean;
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

/**
 * Cart is keyed per user so that:
 * - User A's cart is never shown to User B
 * - Logging out and back in as the same user restores their cart
 * - Guest/unauthenticated state uses a "guest" key and merges on login
 */
function cartKey(userId: string | null): string {
  return `cart:${userId ?? "guest"}`;
}

async function loadCart(userId: string | null): Promise<CartItem[]> {
  try {
    const raw = await AsyncStorage.getItem(cartKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveCart(userId: string | null, items: CartItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(cartKey(userId), JSON.stringify(items));
  } catch (err) {
    console.warn("[CartContext] Failed to persist cart:", err);
  }
}

async function clearCartStorage(userId: string | null): Promise<void> {
  try {
    await AsyncStorage.removeItem(cartKey(userId));
  } catch (err) {
    console.warn("[CartContext] Failed to clear cart storage:", err);
  }
}

// Dedup key for cart line items: productId + variantId, plus the add-ons when the line has them.
// A caller that passes only (productId, variantId) matches the line without add-ons, as before.
const keyFor = (productId: string, variantId?: string, explicit?: string): string =>
  explicit ?? cartLineKey(productId, variantId);

// ─── Context ──────────────────────────────────────────────────────────────────

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
const userId = user?.id ?? null;
  // userId should be the logged-in user's ID string (or null if not logged in).
  // Adjust the field name to match whatever your AuthContext exposes.

  const [items, setItems] = useState<CartItem[]>([]);
  const [isCartLoading, setIsCartLoading] = useState(true);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);

  // ─── Rehydrate cart whenever the user changes (login / logout / app launch) ──
  useEffect(() => {
    let cancelled = false;

    async function rehydrate() {
      setIsCartLoading(true);

      const currentUserId = isAuthenticated ? (userId ?? null) : null;

      // If we had a previous user loaded, save their cart first
      // (belt-and-suspenders — saves should have already happened on each mutation)
      if (activeUserId !== currentUserId) {
        // switching users — load the new user's cart
        const loaded = await loadCart(currentUserId);
        if (!cancelled) {
          setItems(loaded);
          setActiveUserId(currentUserId);
        }
      }

      if (!cancelled) setIsCartLoading(false);
    }

    rehydrate();
    return () => { cancelled = true; };
    // Re-run whenever auth state changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, userId]);

  // ─── Persist to AsyncStorage on every change ──────────────────────────────
  // We use activeUserId (not userId directly) to avoid saving to the wrong key
  // during the transition between users.
  useEffect(() => {
    if (!isCartLoading) {
      saveCart(activeUserId, items);
    }
  }, [items, activeUserId, isCartLoading]);

  // ─── Actions ──────────────────────────────────────────────────────────────

  const addItem = useCallback((item: CartItem) => {
    setItems((prev) => {
      const key = lineKeyOf(item);
      const existing = prev.find((i) => lineKeyOf(i) === key);
      if (existing) {
        return prev.map((i) =>
          lineKeyOf(i) === key ? { ...i, quantity: i.quantity + item.quantity } : i
        );
      }
      return [...prev, item];
    });
  }, []);

  const removeItem = useCallback((productId: string, variantId?: string, lineKey?: string) => {
    const key = keyFor(productId, variantId, lineKey);
    setItems((prev) => prev.filter((i) => lineKeyOf(i) !== key));
  }, []);

  const updateQuantity = useCallback(
    (productId: string, variantId: string | undefined, quantity: number, lineKey?: string) => {
      const key = keyFor(productId, variantId, lineKey);
      if (quantity <= 0) {
        setItems((prev) => prev.filter((i) => lineKeyOf(i) !== key));
        return;
      }
      setItems((prev) => prev.map((i) => (lineKeyOf(i) === key ? { ...i, quantity } : i)));
    },
    []
  );

  /**
   * clearCart: wipes in-memory state AND storage.
   * Call this only after a successful purchase, not on logout.
   */
  const clearCart = useCallback(() => {
    setItems([]);
    clearCartStorage(activeUserId);
  }, [activeUserId]);

  const removeVendorItems = useCallback((vendorId: string) => {
    setItems((prev) => prev.filter((i) => i.vendorId !== vendorId));
  }, []);

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        removeVendorItems,
        itemCount,
        subtotal,
        isCartLoading,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within a CartProvider");
  return context;
}
