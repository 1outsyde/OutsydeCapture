import React, { useCallback } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BookingFlow from "@/components/BookingFlow";
import { useStartChat } from "@/hooks/useStartChat";
import { useTheme } from "@/hooks/useTheme";
import { RootStackParamList } from "@/navigation/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteType = RouteProp<RootStackParamList, "BookService">;

/**
 * Booking redesign step 1 (2026-11-05): every business, staff and VendorDetail
 * photographer booking opens here as one full screen, instead of inside the
 * profile's Book tab, a swapped staff page or a pop-up. The header (RootNavigator)
 * carries the provider's name and the Close button. Booking logic, holds and
 * payment stay in BookingFlow, unchanged.
 */
export default function BookServiceScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const p = route.params;

  const close = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  // Done after paying: close booking first, then open My Sessions, so Back from
  // Sessions returns to the profile instead of the finished booking.
  const openSessions = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    navigation.navigate("Sessions");
  }, [navigation]);

  // Message on the Booked screen (step 4): close booking first, then open the
  // chat, so Back from the chat returns to the profile. Staff bookings message
  // the business.
  const { startChat } = useStartChat();
  const openChat = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    startChat({
      participantId: p.providerId,
      participantType: p.providerType === "photographer" ? "photographer" : "business",
      name: p.providerName,
    });
  }, [navigation, startChat, p.providerId, p.providerType, p.providerName]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      // The note and address boxes sit above the pinned bar (step 2): keep
      // them visible while typing. The native header is above this view.
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 44 : 0}
    >
    <View
      style={{
        flex: 1,
        paddingBottom: insets.bottom,
      }}
    >
      <BookingFlow
        providerId={p.providerId}
        providerType={p.providerType}
        providerName={p.providerName}
        providerAddress={p.providerAddress}
        providerCity={p.providerCity}
        providerState={p.providerState}
        providerShowAddress={p.providerShowAddress}
        providerVendorTerms={p.providerVendorTerms}
        staffMemberId={p.staffMemberId}
        accentColor={p.accentColor}
        preselectedServiceId={p.preselectedServiceId}
        onExit={close}
        onDone={openSessions}
        onMessage={openChat}
      />
    </View>
    </KeyboardAvoidingView>
  );
}
