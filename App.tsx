import React from "react";
import { StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import RootNavigator from "@/navigation/RootNavigator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/context/AuthContext";
import { DataProvider } from "@/context/DataContext";
import { MessagingProvider } from "@/context/MessagingContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { PaymentProvider } from "@/context/PaymentContext";
import { LoyaltyProvider } from "@/context/LoyaltyContext";
import { OrdersProvider } from "@/context/OrdersContext";
import { FavoritesProvider } from "@/context/FavoritesContext";
import { HealthCheckProvider } from "@/context/HealthCheckContext";
import { CalendarProvider } from "@/context/CalendarContext";
import { ThemeProvider, useThemeContext } from "@/context/ThemeContext";

function AppContent() {
  const { theme, isDark } = useThemeContext();

  return (
    <GestureHandlerRootView style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
      <KeyboardProvider>
        <AuthProvider>
          <DataProvider>
            <OrdersProvider>
              <FavoritesProvider>
                <PaymentProvider>
                  <LoyaltyProvider>
                    <NotificationProvider>
                      <MessagingProvider>
                        <HealthCheckProvider>
                          <CalendarProvider>
                            <NavigationContainer>
                              <RootNavigator />
                            </NavigationContainer>
                          </CalendarProvider>
                        </HealthCheckProvider>
                      </MessagingProvider>
                    </NotificationProvider>
                  </LoyaltyProvider>
                </PaymentProvider>
              </FavoritesProvider>
            </OrdersProvider>
          </DataProvider>
        </AuthProvider>
        <StatusBar style={isDark ? "light" : "dark"} />
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
