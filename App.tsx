import React from "react";
import { StyleSheet, useColorScheme } from "react-native";
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
import { Colors } from "@/constants/theme";

export default function App() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = Colors[colorScheme ?? "light"];

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <GestureHandlerRootView style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
          <KeyboardProvider>
            <AuthProvider>
              <DataProvider>
                <OrdersProvider>
                  <PaymentProvider>
                    <LoyaltyProvider>
                      <NotificationProvider>
                        <MessagingProvider>
                          <NavigationContainer>
                            <RootNavigator />
                          </NavigationContainer>
                        </MessagingProvider>
                      </NotificationProvider>
                    </LoyaltyProvider>
                  </PaymentProvider>
                </OrdersProvider>
              </DataProvider>
            </AuthProvider>
            <StatusBar style={isDark ? "light" : "dark"} />
          </KeyboardProvider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
