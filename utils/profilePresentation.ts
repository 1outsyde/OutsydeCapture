// How profile routes (VendorDetail, PhotographerDetail, UserProfile,
// StaffWorkProfile, FollowList) open on the root stack.
//
// Normally they push full screen from the right (a "card"). But on iOS a
// card pushed while a modal is showing goes onto the stack *under* that
// modal (react-native-screens puts every push screen in the root
// UINavigationController), so it would be invisible. When any earlier route
// on the stack is presented as a modal, the profile opens as a full screen
// modal instead, on top.

// Root stack routes whose presentation is a modal. Must match RootNavigator;
// profilePresentation.test.ts checks that it does.
export const MODAL_ROUTE_NAMES: ReadonlySet<string> = new Set([
  "Auth",
  "ConsumerSignup",
  "BusinessSignup",
  "PhotographerSignup",
  "SelectPhotographer",
  "BookService",
  "Booking",
  "PostDetail",
  "SessionDetail",
  "AppointmentDetail",
  "PhotoGallery",
  "CartOrders",
  "CartCheckout",
  "OrderSuccess",
  "Favorites",
  "BusinessOnboarding",
  "PhotographerOnboarding",
  "AdminDashboard",
  "AdminUserDetail",
  "AdminBusinessReview",
  "AdminPhotographerDetail",
  "AdminInfluencerDetail",
  "AdminRefundRequest",
  "AdminVendorPlan",
  "AdminPush",
  "AdminEmails",
  "AdminSetupEmails",
  "AdminReferrals",
  "InfluencerApplication",
  "ProfileCompletionGate",
  "Notifications",
  "ProductDetail",
  "ProductOrderDetail",
  "Sessions",
  "CreatePost",
  "StoryViewer",
  "StoryInsights",
  "ForgotPassword",
  "ClaimAccount",
  "RateReview",
]);

export type ProfilePresentation = "card" | "fullScreenModal";

// routeNames: the root stack's route names in order; index: this route's
// position. A route not found (index < 0) is treated as opening on top.
export function profilePresentationFor(
  routeNames: readonly string[],
  index: number,
): ProfilePresentation {
  const below = index < 0 ? routeNames : routeNames.slice(0, index);
  return below.some((n) => MODAL_ROUTE_NAMES.has(n))
    ? "fullScreenModal"
    : "card";
}
