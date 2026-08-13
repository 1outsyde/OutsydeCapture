import React, { useEffect, useRef, useState } from "react";
import {
  AppState,
  AppStateStatus,
  StyleSheet,
} from "react-native";
import { Audio } from "expo-av";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { StripeProvider } from "@stripe/stripe-react-native";
import RootNavigator from "@/navigation/RootNavigator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { DataProvider } from "@/context/DataContext";
import { MessagingProvider } from "@/context/MessagingContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { PaymentProvider } from "@/context/PaymentContext";
import { LoyaltyProvider } from "@/context/LoyaltyContext";
import { OrdersProvider } from "@/context/OrdersContext";
import { FavoritesProvider } from "@/context/FavoritesContext";
import { HealthCheckProvider } from "@/context/HealthCheckContext";
import { CalendarProvider } from "@/context/CalendarContext";
import { CartProvider } from "@/context/CartContext";
import { ThemeProvider, useThemeContext } from "@/context/ThemeContext";
import { RatingPromptOverlay } from "@/components/ratings";
import { PurchaseItem } from "@/types/ratings";
import { API_BASE_URL } from "@/services/api";

// Inner shell: has access to all context providers, owns rating-prompt state.
function AppShell() {
  const { isAuthenticated, getToken } = useAuth();
  const [promptPurchases, setPromptPurchases] = useState<PurchaseItem[]>([]);
  const [promptVisible, setPromptVisible] = useState(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!isAuthenticated) return;

    const sub = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === "active") {
        fetchRatingPrompts();
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, [isAuthenticated]);

  const fetchRatingPrompts = async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch(
        `${API_BASE_URL}/api/my-orders?status=completed&since=7d`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) return;

      const data = await res.json();
      const orders: Array<{
        id: string;
        businessId: string;
        businessName: string;
        createdAt: string;
      }> = data.orders ?? [];

      const purchases: PurchaseItem[] = orders.map((o) => ({
        purchaseId: o.id,
        purchaseType: "order" as const,
        targetId: o.businessId,
        targetType: "business" as const,
        label: o.businessName,
        date: o.createdAt,
      }));

      if (purchases.length > 0) {
        setPromptPurchases(purchases);
        setPromptVisible(true);
      }
    } catch {
      // non-critical — silently skip
    }
  };

  const handleDismiss = async () => {
    setPromptVisible(false);
    const purchase = promptPurchases[0];
    if (!purchase) return;

    try {
      const token = await getToken();
      if (!token) return;
      await fetch(`${API_BASE_URL}/api/ratings/dismiss`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          purchaseId: purchase.purchaseId,
          purchaseType: purchase.purchaseType,
        }),
      });
    } catch {
      // fire-and-forget
    }
  };

  const handleRate = async (
    rating: number,
    purchaseId: string,
    purchaseType: string,
  ) => {
    const purchase = promptPurchases.find((p) => p.purchaseId === purchaseId) ?? promptPurchases[0];
    if (!purchase) return;

    const token = await getToken();
    if (!token) throw new Error("Not authenticated");

    const res = await fetch(`${API_BASE_URL}/api/ratings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        targetType: purchase.targetType,
        targetId: purchase.targetId,
        rating,
        purchaseId,
        purchaseType,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Failed to submit rating");
    }
  };

  return (
    <>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
      <RatingPromptOverlay
        visible={promptVisible}
        purchases={promptPurchases}
        onClose={handleDismiss}
        onRate={handleRate}
      />
    </>
  );
}

function AppContent() {
  const { theme, isDark } = useThemeContext();

  return (
    <GestureHandlerRootView style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
      <KeyboardProvider>
        <AuthProvider>
          <DataProvider>
            <OrdersProvider>
              <CartProvider>
              <FavoritesProvider>
                <PaymentProvider>
                  <LoyaltyProvider>
                    <NotificationProvider>
                      <MessagingProvider>
                        <HealthCheckProvider>
                          <CalendarProvider>
                            <StripeProvider
                publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""}
                urlScheme="outsyde"
              >
                              <AppShell />
                            </StripeProvider>
                          </CalendarProvider>
                        </HealthCheckProvider>
                      </MessagingProvider>
                    </NotificationProvider>
                  </LoyaltyProvider>
                </PaymentProvider>
              </FavoritesProvider>
              </CartProvider>
            </OrdersProvider>
          </DataProvider>
        </AuthProvider>
        <StatusBar style={isDark ? "light" : "dark"} />
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

export default function App() {
  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    })
      .then(() => console.log("[Audio] session configured: playsInSilentModeIOS"))
      .catch((e) => console.warn("[Audio] setAudioMode failed", e));
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ErrorBoundary>
          <AppContent />
        </ErrorBoundary>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
