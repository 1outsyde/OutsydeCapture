import { useCallback } from "react";
import { useData, Post } from "@/context/DataContext";
import { useOrders } from "@/context/OrdersContext";

interface RatingEligibility {
  canRate: boolean;
  reason: string;
}

export function useRatingEligibility() {
  const { hasCompletedSessionWith } = useData();
  const { hasDeliveredOrderFrom } = useOrders();

  const checkEligibility = useCallback((post: Post): RatingEligibility => {
    const authorId = post.authorId || post.photographerId || "";
    const authorName = post.authorName || post.photographerName || "";

    if (post.type === "photographer") {
      const hasSession = hasCompletedSessionWith(authorId, authorName);
      if (hasSession) {
        return { canRate: true, reason: "" };
      }
      return {
        canRate: false,
        reason: `You can only rate ${authorName} after completing a photography session with them through Outsyde.`,
      };
    }

    if (post.type === "vendor") {
      const hasOrder = hasDeliveredOrderFrom(authorId, authorName);
      if (hasOrder) {
        return { canRate: true, reason: "" };
      }
      return {
        canRate: false,
        reason: `You can only rate ${authorName} after receiving a delivered order from them through Outsyde.`,
      };
    }

    return { canRate: false, reason: "Unable to verify rating eligibility." };
  }, [hasCompletedSessionWith, hasDeliveredOrderFrom]);

  return { checkEligibility };
}
