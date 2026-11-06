import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import BookServiceView from "@/components/BookServiceView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { RootStackParamList } from "@/navigation/types";
import api from "@/services/api";
import { Spacing, BorderRadius } from "@/constants/theme";
import {
  photographerBookingParams,
  photographerName,
  type PhotographerLike,
} from "@/utils/photographerBookingParams";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteType = RouteProp<RootStackParamList, "Booking">;

/**
 * Booking redesign step 5 (Legend 2026-11-06): photographer bookings opened from
 * PhotographerDetail, Discover, PostDetail, Search, Pulse and Select a
 * photographer now use the same full screen booking as businesses
 * (components/BookServiceView → BookingFlow). The "Booking" route keeps its name
 * and params so every opener works unchanged. The photographer is always
 * reloaded so the studio address, terms and color are current.
 */
export default function BookingScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { theme, isDark } = useTheme();
  const { photographer: routePhotographer, photographerId, preselectedServiceId } = route.params ?? {};
  const id = photographerId || (routePhotographer as { id?: string } | undefined)?.id || "";

  const [data, setData] = useState<PhotographerLike | null>((routePhotographer as PhotographerLike) ?? null);
  const [loading, setLoading] = useState(!routePhotographer && !!id);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    setFailed(false);
    if (!routePhotographer) setLoading(true);
    api
      .getPhotographer(id)
      .then((p) => setData(p as PhotographerLike))
      .catch(() => {
        // Route data is enough to book; only fail when there is nothing to show.
        if (!routePhotographer) setFailed(true);
      })
      .finally(() => setLoading(false));
  }, [id, routePhotographer]);

  useEffect(() => {
    load();
  }, [load]);

  // Header: the photographer's name with Close, same as business bookings.
  useLayoutEffect(() => {
    if (data) navigation.setOptions({ headerTitle: photographerName(data) });
  }, [navigation, data]);

  const params = useMemo(
    () => (id && data ? photographerBookingParams(id, data, isDark ? "dark" : "light", preselectedServiceId) : null),
    [id, data, isDark, preselectedServiceId],
  );

  if (params) return <BookServiceView params={params} />;

  return (
    <View style={[styles.center, { backgroundColor: theme.backgroundRoot }]}>
      {loading ? (
        <ActivityIndicator size="large" color={theme.brandGold} />
      ) : (
        <>
          <ThemedText style={{ color: theme.text, textAlign: "center" }}>
            {id ? "We couldn't load this photographer." : "We couldn't open this booking."}
          </ThemedText>
          {id && failed ? (
            <Pressable
              onPress={load}
              accessibilityRole="button"
              style={[styles.button, { borderColor: theme.brandGold }]}
            >
              <ThemedText style={{ color: theme.brandGold, fontWeight: "600" }}>Try again</ThemedText>
            </Pressable>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl, gap: Spacing.md },
  button: { borderWidth: 1.5, borderRadius: BorderRadius.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xl },
});
