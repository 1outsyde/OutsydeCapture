import React from "react";
import { useRoute, RouteProp } from "@react-navigation/native";

import BookServiceView from "@/components/BookServiceView";
import { RootStackParamList } from "@/navigation/types";

type RouteType = RouteProp<RootStackParamList, "BookService">;

/**
 * Booking redesign step 1 (2026-11-05): every business, staff and VendorDetail
 * photographer booking opens here as one full screen. The screen itself is
 * components/BookServiceView (shared with the photographer Booking route, step 5).
 */
export default function BookServiceScreen() {
  const route = useRoute<RouteType>();
  return <BookServiceView params={route.params} />;
}
