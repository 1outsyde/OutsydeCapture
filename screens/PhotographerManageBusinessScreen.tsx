import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Linking,
  TextInput,
  AppState,
  AppStateStatus,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, usePreventRemove } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "@/hooks/useTheme";
import {
  parseBrandColorSpec,
  resolveBrandColor,
  specToHex,
  toColorPayload,
} from "@/constants/colorOptions";
import ColorWheelPicker from "@/components/ColorWheelPicker";
import { useAuth } from "@/context/AuthContext";
import api, {
  PhotographerDashboardProfile,
  PhotographerService,
  BlockedDate,
  type PhotographerTaxonomy,
} from "@/services/api";
import { RootStackParamList } from "@/navigation/types";
import HoursEditor, { DayHours, getDefaultHours, convertTo24Hour, convertTo12Hour } from "@/components/HoursEditor";
import DateBlocker from "@/components/DateBlocker";
import ServiceEditorModal, { ServiceFormData } from "@/components/ServiceEditorModal";
import {
  VendorBookerPhotographerService,
  getPhotographerServiceAddons,
  createPhotographerServiceAddon,
  updatePhotographerServiceAddon,
  deletePhotographerServiceAddon,
} from "@/services/api";
import type { ServiceAddonsApi } from "@/components/ServiceAddonsEditor";
import { mapProviderBlockToBlockedDate } from "@/utils/availabilityUtils";
import { uploadImage } from "@/services/mediaUpload";
import { availabilityEvents } from "@/services/availabilityEvents";
import MediaUploader from "@/components/MediaUploader";
import { CROP_PRESETS, useCropPicker } from "@/components/crop/useCropPicker";
import { formatDuration } from "@/utils/duration";
import {
  PHOTO_OTHER_CODE, pickableSpecialties, codesForProfile, toggleSpecialtyCode, specialtyProblem,
} from "@/utils/photographerTaxonomy";
import {
  photographerSetupSteps,
  serviceCountText,
  servicesMissingPhoto,
  visibilityBanner,
  type PhotographerSetupTarget,
} from "@/utils/photographerSetup";

// Photographer Manage business (2026-11-06): the same hub and pages as the business
// Manage business (StorefrontEditorScreen), replacing the tall sheets that lived on
// the photographer dashboard. Every page keeps the exact save the sheet had.

// Photographer add-on routes (backend photographers router, migration 041).
const PHOTOGRAPHER_ADDONS_API: ServiceAddonsApi = {
  list: getPhotographerServiceAddons,
  create: createPhotographerServiceAddon,
  update: updatePhotographerServiceAddon,
  remove: deletePhotographerServiceAddon,
};

type SectionKey = "hub" | "services" | "branding" | "profile" | "booking" | "hours" | "blocked" | "payouts";

const SECTION_TITLES: Record<SectionKey, string> = {
  hub: "Manage business",
  services: "Services",
  branding: "Look and branding",
  profile: "Profile and contact",
  booking: "Booking settings",
  hours: "Hours",
  blocked: "Blocked dates",
  payouts: "Payouts",
};

// Where back goes from each page.
const PARENT: Record<SectionKey, SectionKey | null> = {
  hub: null,
  services: "hub",
  branding: "hub",
  profile: "hub",
  booking: "hub",
  hours: "booking",
  blocked: "booking",
  payouts: "hub",
};

// The setup card is always the dark brand green, so its gold stays the bright
// one in both themes (same as the business hub).
const SETUP_GOLD = "#E8B930";

const MOCK_BANNERS = [
  { id: "studio", label: "Studio", url: "https://images.unsplash.com/photo-1598128558393-70ff21433be0?w=800&q=80" },
  { id: "outdoor", label: "Outdoor", url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80" },
  { id: "urban", label: "Urban", url: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800&q=80" },
  { id: "nature", label: "Nature", url: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&q=80" },
  { id: "minimal", label: "Minimal", url: "https://images.unsplash.com/photo-1557683316-973673baf926?w=800&q=80" },
  { id: "creative", label: "Creative", url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80" },
];

const SECTION_KEYS: SectionKey[] = ["hub", "services", "branding", "profile", "booking", "hours", "blocked", "payouts"];

export default function PhotographerManageBusinessScreen() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "PhotographerManageBusiness">>();
  const { getToken, logout, user, refreshUser, isLoading: authLoading } = useAuth();

  const initialSection = route.params?.section && SECTION_KEYS.includes(route.params.section)
    ? route.params.section
    : "hub";
  const [section, setSection] = useState<SectionKey>(initialSection);
  // Opened straight on a page (dashboard Services, Base Hours, Edit Profile...): back from
  // that page returns to where the photographer came from, not to the hub.
  const [entrySection, setEntrySection] = useState<SectionKey>(initialSection);
  // Set right after a save on the entry page, so leaving the screen isn't asked about.
  const leavingAfterSaveRef = useRef(false);
  const [showDoneSteps, setShowDoneSteps] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState<PhotographerDashboardProfile | null>(null);
  const [rawPhotographer, setRawPhotographer] = useState<any>(null); // Raw API response, compared on save
  // Shared photographer list (GET /api/taxonomy/photographer, backend #320)
  const [photographerTaxonomy, setPhotographerTaxonomy] = useState<PhotographerTaxonomy | null>(null);
  const loadPhotographerTaxonomy = useCallback(async () => {
    try {
      const data = await api.getPhotographerTaxonomy();
      if (data && Array.isArray(data.specialties)) setPhotographerTaxonomy(data);
    } catch (err) {
      console.log("[PhotographerManage] Could not load the photographer specialty list:", err);
    }
  }, []);
  useEffect(() => { loadPhotographerTaxonomy(); }, [loadPhotographerTaxonomy]);
  // A profile saved before the shared list has names only: show them as picks once the list loads.
  useEffect(() => {
    if (!photographerTaxonomy || !rawPhotographer) return;
    const stored = Array.isArray(rawPhotographer.specialtyCodes) ? rawPhotographer.specialtyCodes : [];
    if (stored.length) return;
    const mapped = codesForProfile(photographerTaxonomy, rawPhotographer);
    if (mapped.length) setEditProfile(prev => (prev.specialtyCodes.length ? prev : { ...prev, specialtyCodes: mapped }));
  }, [photographerTaxonomy, rawPhotographer]);

  const [services, setServices] = useState<PhotographerService[]>([]);
  const [publishingServiceId, setPublishingServiceId] = useState<string | null>(null);
  const [hours, setHours] = useState<DayHours[]>(getDefaultHours());
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);

  const [editProfile, setEditProfile] = useState({
    name: "",
    username: "",
    hourlyRate: "",
    bio: "",
    city: "",
    state: "",
    portfolioUrl: "",
    specialties: [] as string[],
    // Shared photographer list (backend #320): codes are what's saved, names follow them.
    specialtyCodes: [] as string[],
    specialtyOther: "",
    // Profile color as #RRGGBB from the color wheel (2026-10-29, replaces the 16 swatches).
    profileTheme: specToHex(null),
    avatar: "" as string,
    bannerType: "color" as "color" | "image" | "video" | "mock",
    bannerImage: "" as string,
    bannerVideo: "" as string,
    bannerMock: "" as string,
  });

  // Profile photo: pick or take, crop to a 1:1 circle, then upload.
  const profileCrop = useCropPicker();
  const pickProfilePhoto = async (source: "library" | "camera") => {
    const cropped = await profileCrop.pick(source, CROP_PRESETS.profile);
    if (!cropped) return;
    try {
      setEditProfile(prev => ({ ...prev, avatar: cropped.uri }));
      const authToken = await getToken();
      if (!authToken) throw new Error("Not authenticated");
      const uploadResult = await uploadImage(cropped.uri, "image/jpeg", "profiles", authToken);
      setEditProfile(prev => ({ ...prev, avatar: uploadResult.url }));
    } catch (error) {
      console.error("[PhotographerManage] Profile photo upload failed:", error);
      Alert.alert("Upload Failed", "Could not upload photo. Please try again.");
      setEditProfile(prev => ({ ...prev, avatar: "" }));
    }
  };

  const [identityStatus, setIdentityStatus] = useState<{
    canChangeUsername: boolean;
    canChangeDisplayName: boolean;
    usernameCooldownDays?: number;
    displayNameCooldownDays?: number;
  } | null>(null);
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [originalUsername, setOriginalUsername] = useState("");

  const [showServiceEditor, setShowServiceEditor] = useState(false);
  const [editingService, setEditingService] = useState<ServiceFormData | null>(null);
  const [rawServices, setRawServices] = useState<VendorBookerPhotographerService[]>([]);
  const [depositServerError, setDepositServerError] = useState<string | null>(null);

  // CTA Button config — photographers only have Book Now, we just pick which service
  const [ctaServiceTarget, setCtaServiceTarget] = useState<"first_available" | "specific">("first_available");
  const [ctaSpecificServiceId, setCtaSpecificServiceId] = useState<string>("");
  const [ctaSpecificServiceName, setCtaSpecificServiceName] = useState<string>("");

  // Same loads as the dashboard (PhotographerDashboardScreen fetchDashboard), without bookings.
  const fetchData = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setLoadError("Please sign in to manage your business");
      setLoading(false);
      return;
    }

    try {
      setLoadError(null);
      const photographer = await api.getPhotographerMe(token) as any;
      setRawPhotographer(photographer);

      const parsedBrandColors = parseBrandColorSpec(photographer.brandColors);
      const originalThemeId = specToHex(parsedBrandColors);

      setProfile({
        id: photographer.id,
        name: photographer.displayName || "",
        avatar: photographer.logoImage,
        hourlyRate: photographer.hourlyRate ? photographer.hourlyRate / 100 : 0,
        bio: photographer.bio,
        city: photographer.city,
        state: photographer.state,
        portfolioUrl: photographer.portfolioUrl,
        specialties: photographer.specialties || [],
        stripeConnected: photographer.stripeOnboardingComplete || false,
        profileTheme: originalThemeId,
        autoAcceptBookings: photographer.autoAcceptBookings ?? false,
      });

      setEditProfile({
        name: photographer.displayName || "",
        username: photographer.username || "",
        hourlyRate: photographer.hourlyRate ? (photographer.hourlyRate / 100).toString() : "",
        bio: photographer.bio || "",
        city: photographer.city || "",
        state: photographer.state || "",
        portfolioUrl: photographer.portfolioUrl || "",
        specialties: photographer.specialties || [],
        specialtyCodes: Array.isArray(photographer.specialtyCodes) ? photographer.specialtyCodes : [],
        specialtyOther: photographer.specialtyOther || "",
        profileTheme: originalThemeId,
        avatar: photographer.logoImage || "",
        bannerType: photographer.coverMediaType === "video"
          ? "video"
          : photographer.coverImage
            ? "image"
            : "color",
        bannerImage: photographer.coverMediaType !== "video" ? (photographer.coverImage || "") : "",
        bannerVideo: photographer.coverMediaType === "video" ? (photographer.coverImage || "") : "",
        bannerMock: "",
      });
      setOriginalUsername(photographer.username || "");

      // Parse CTA config
      const rawCta = photographer.ctaConfig;
      if (rawCta) {
        try {
          const parsedCta = typeof rawCta === "string" ? JSON.parse(rawCta) : rawCta;
          setCtaServiceTarget(parsedCta.serviceTarget ?? "first_available");
          setCtaSpecificServiceId(parsedCta.specificServiceId ?? "");
          setCtaSpecificServiceName(parsedCta.specificServiceName ?? "");
        } catch {
          // Keep the defaults
        }
      }

      try {
        const status = await api.getUserIdentityStatus(token);
        setIdentityStatus(status);
      } catch (err) {
        console.log("[PhotographerManage] Could not fetch identity status:", err);
      }

      try {
        const { services: servicesData } = await api.getPhotographerMeServices(token);
        setRawServices(servicesData || []);
        setServices((servicesData || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          description: s.description || "",
          duration: s.estimatedDurationMinutes || s.durationMinutes || 60,
          // Hourly services show the rate (hourlyRateCents); legacy hourly rows that
          // only have priceCents, and package services, show priceCents.
          price:
            s.pricingModel === "hourly" && typeof s.hourlyRateCents === "number"
              ? s.hourlyRateCents / 100
              : s.priceCents
                ? s.priceCents / 100
                : 0,
          isActive: s.status === "active",
          status: s.status || "draft",
          pricingModel: s.pricingModel || "package",
          category: s.category || "Other",
          depositAmountCents: s.depositAmountCents ?? null,
          imageUrl: s.imageUrl ?? null,
        })));
      } catch {
        setServices([]);
        setRawServices([]);
      }

      try {
        const availabilityData = await api.getPhotographerMeAvailability(token);
        if (availabilityData.hoursOfOperation) {
          const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
          const parsedHours = dayNames.map((dayName, index) => {
            const dayData = availabilityData.hoursOfOperation[dayName] as { open: boolean; start?: string; end?: string } | undefined;
            if (dayData && dayData.open === true && dayData.start && dayData.end) {
              return {
                dayOfWeek: index,
                isAvailable: true,
                startTime: convertTo12Hour(dayData.start),
                endTime: convertTo12Hour(dayData.end),
              };
            }
            return {
              dayOfWeek: index,
              isAvailable: false,
              startTime: "9:00 AM",
              endTime: "5:00 PM",
            };
          });
          setHours(parsedHours);
        }
      } catch {
        // Keep default hours
      }

      try {
        const blocks = await api.getBlocks(token, "photographer");
        setBlockedDates(
          blocks
            .map(mapProviderBlockToBlockedDate)
            .filter((b): b is NonNullable<typeof b> => b !== null)
        );
      } catch (err) {
        console.error("[PhotographerManage] Failed to load blocked dates:", err);
        setBlockedDates([]);
      }
    } catch (error: any) {
      console.error("[PhotographerManage] Failed to load:", error);
      const status = error?.status || error?.response?.status;
      const message = error?.message || "";
      if (status === 401 || message.includes("401") || message.toLowerCase().includes("unauthorized")) {
        setLoadError("Your session has expired. Please sign in again.");
        await logout();
        return;
      }
      setLoadError("Could not load your business. Pull down or tap Try again.");
    } finally {
      setLoading(false);
    }
  }, [getToken, logout]);

  const hasFetchedRef = useRef(false);
  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== "photographer") {
      setLoadError("Manage business is only available for photographers");
      setLoading(false);
      return;
    }
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchData();
    }
  }, [authLoading, user?.id, user?.role]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  // ── Leaving a page with unsaved edits asks first (same as the business pages) ──
  const snapshotFor = (key: SectionKey): string | null => {
    if (key === "branding" || key === "profile") {
      // Username has its own Save button, so it isn't part of the page's unsaved check.
      return JSON.stringify([{ ...editProfile, username: "" }, ctaServiceTarget, ctaSpecificServiceId]);
    }
    if (key === "hours") return JSON.stringify(hours);
    return null;
  };
  const [baseline, setBaseline] = useState<string | null>(null);
  const openSection = (key: SectionKey) => {
    setShowDoneSteps(false);
    // Once the photographer moves on from the page the screen opened on, back works level by level.
    setEntrySection("hub");
    setBaseline(snapshotFor(key));
    setSection(key);
  };
  // Pages opened from a link (route param) take their baseline once the data has loaded.
  useEffect(() => {
    if (!loading) setBaseline(snapshotFor(section));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const hasUnsavedChanges = () => {
    const now = snapshotFor(section);
    return now !== null && baseline !== null && now !== baseline;
  };

  const leaveSection = (then: () => void) => {
    if (!hasUnsavedChanges()) {
      then();
      return;
    }
    Alert.alert("Discard changes?", "You have changes on this page that aren't saved yet.", [
      { text: "Keep editing", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: () => {
          then();
          fetchData();
        },
      },
    ]);
  };

  const isEntryPage = section === entrySection && entrySection !== "hub";

  // After a save: the page the screen opened on closes (like the old sheet did); other pages go up.
  const afterSave = (parent: SectionKey) => {
    if (isEntryPage) {
      leavingAfterSaveRef.current = true;
      navigation.goBack();
    } else {
      openSection(parent);
    }
  };

  const goUp = () => {
    if (isEntryPage) {
      navigation.goBack();
      return;
    }
    const parent = PARENT[section];
    if (parent) leaveSection(() => openSection(parent));
  };

  // Back from a page goes up one level: header arrow, iOS swipe and Android back all land
  // here. The page the screen was opened on leaves the screen, asking first when unsaved.
  usePreventRemove(section !== "hub" && (!isEntryPage || hasUnsavedChanges()), ({ data }) => {
    const type = data.action.type;
    if (leavingAfterSaveRef.current || (type !== "GO_BACK" && type !== "POP")) {
      // Sign out, resets and the like are never blocked.
      navigation.dispatch(data.action);
      return;
    }
    if (isEntryPage) {
      leaveSection(() => navigation.dispatch(data.action));
    } else {
      goUp();
    }
  });

  const [stripeError, setStripeError] = useState<string | null>(null);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [loadingPayoutLink, setLoadingPayoutLink] = useState(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState as AppStateStatus);
  
  const STRIPE_RETURN_URL = "outsyde://stripe-return";
  
  const refreshStripeStatus = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    
    try {
      console.log("[PhotographerManage] Fetching fresh Stripe status...");
      const stripeStatus = await api.getPhotographerStripeStatus(token);
      console.log("[PhotographerManage] Stripe status response:", stripeStatus);
      
      const isConnected = stripeStatus.chargesEnabled && stripeStatus.payoutsEnabled;
      
      setProfile(prev => prev ? { ...prev, stripeConnected: isConnected } : prev);
      
      // Only the screen in front says so; the dashboard under this one checks too.
      if (isConnected && navigation.isFocused()) {
        Alert.alert("Success", "Your Stripe account is now connected! You can start accepting bookings.");
      }
    } catch (error) {
      console.error("[PhotographerManage] Failed to fetch Stripe status:", error);
    }
  }, [getToken, navigation]);
  
  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      if (event.url.includes("stripe-return")) {
        console.log("[PhotographerManage] Stripe return deep link received, refreshing status...");
        await refreshStripeStatus();
      }
    };

    const subscription = Linking.addEventListener("url", handleDeepLink);
    
    Linking.getInitialURL().then((url) => {
      if (url && url.includes("stripe-return")) {
        handleDeepLink({ url });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [refreshStripeStatus]);
  
  useEffect(() => {
    const subscription = AppState.addEventListener("change", async (nextAppState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === "active") {
        console.log("[PhotographerManage] App came to foreground, checking Stripe status...");
        await refreshStripeStatus();
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [refreshStripeStatus]);
  
  const handleConnectStripe = async () => {
    const token = await getToken();
    if (!token) return;

    try {
      setConnectingStripe(true);
      setStripeError(null);
      const { url } = await api.startPhotographerStripeOnboarding(token, STRIPE_RETURN_URL);
      if (url) {
        Linking.openURL(url);
      }
    } catch (error: any) {
      const errorMsg = error?.message || "Failed to connect Stripe. Please try again.";
      setStripeError(errorMsg);
    } finally {
      setConnectingStripe(false);
    }
  };

  const handleManagePayouts = async () => {
    const token = await getToken();
    if (!token) return;
    try {
      setLoadingPayoutLink(true);
      const { url } = await api.getPhotographerStripeDashboardLink(token);
      Linking.openURL(url);
    } catch (error: any) {
      if (error?.status === 403 && error?.body?.requiresOnboarding) {
        Alert.alert("Stripe Setup Required", "Please complete your Stripe setup before accessing payouts");
      } else {
        Alert.alert("Error", "Unable to open payout dashboard. Please try again.");
      }
    } finally {
      setLoadingPayoutLink(false);
    }
  };

  const handleSaveUsername = async () => {
    const token = await getToken();
    if (!token) return;

    const newUsername = editProfile.username.trim().toLowerCase();
    if (newUsername === originalUsername) {
      Alert.alert("No Changes", "Username is the same as before.");
      return;
    }

    if (!newUsername) {
      Alert.alert("Invalid Username", "Username cannot be empty.");
      return;
    }
    
    if (!/^[a-z0-9_]+$/.test(newUsername)) {
      Alert.alert("Invalid Username", "Username can only contain lowercase letters, numbers, and underscores.");
      return;
    }
    
    if (!identityStatus?.canChangeUsername) {
      Alert.alert(
        "Cooldown Active",
        `You can change your username again in ${identityStatus?.usernameCooldownDays || 14} days.`
      );
      return;
    }
    
    try {
      setSavingIdentity(true);
      await api.updateUserIdentity(token, { username: newUsername });
      setOriginalUsername(newUsername);
      
      // Refresh identity status
      const status = await api.getUserIdentityStatus(token);
      setIdentityStatus(status);
      
      // Refresh user from backend to update AuthContext with new username
      await refreshUser();
      console.log("[PhotographerManage] Username updated, refreshed user from backend");
      
      Alert.alert("Success", "Username updated successfully!");
    } catch (error: any) {
      const message = error?.message || "Failed to update username";
      Alert.alert("Error", message);
    } finally {
      setSavingIdentity(false);
    }
  };

  const handleSaveProfile = async () => {
    const token = await getToken();
    if (!token) return;

    try {
      setSaving(true);
      
      // Compare against RAW API response, not reconstructed profile state
      // Backend expects hourlyRate in DOLLARS (it converts to cents internally)
      const updateData: Record<string, any> = {};
      
      // Debug: Log what we're comparing
      console.log("[PhotographerManage] === SAVE PROFILE DEBUG ===");
      console.log("[PhotographerManage] editProfile:", JSON.stringify(editProfile, null, 2));
      console.log("[PhotographerManage] rawPhotographer:", JSON.stringify(rawPhotographer, null, 2));
      
      // Compare against raw API response values
      // Only filter out undefined and null - empty strings and 0 are valid values
      
      // displayName
      const currentName = editProfile.name ?? "";
      const originalName = rawPhotographer?.displayName ?? "";
      console.log(`[PhotographerManage] displayName: current="${currentName}" vs original="${originalName}"`);
      if (currentName !== originalName) {
        updateData.displayName = currentName;
      }
      
      // hourlyRate - raw API stores in cents, we display/edit in dollars
      const currentRate = parseFloat(editProfile.hourlyRate) || 0;
      const originalRateCents = rawPhotographer?.hourlyRate ?? 0;
      const originalRate = originalRateCents / 100;
      console.log(`[PhotographerManage] hourlyRate: current=${currentRate} vs original=${originalRate} (raw cents: ${originalRateCents})`);
      if (currentRate !== originalRate) {
        updateData.hourlyRate = currentRate; // Send in dollars
      }
      
      // bio
      const currentBio = editProfile.bio ?? "";
      const originalBio = rawPhotographer?.bio ?? "";
      console.log(`[PhotographerManage] bio: current="${currentBio}" vs original="${originalBio}"`);
      if (currentBio !== originalBio) {
        updateData.bio = currentBio;
      }
      
      // city
      const currentCity = editProfile.city ?? "";
      const originalCity = rawPhotographer?.city ?? "";
      console.log(`[PhotographerManage] city: current="${currentCity}" vs original="${originalCity}"`);
      if (currentCity !== originalCity) {
        updateData.city = currentCity;
      }
      
      // state
      const currentState = editProfile.state ?? "";
      const originalState = rawPhotographer?.state ?? "";
      console.log(`[PhotographerManage] state: current="${currentState}" vs original="${originalState}"`);
      if (currentState !== originalState) {
        updateData.state = currentState;
      }
      
      // portfolioUrl
      const currentPortfolioUrl = editProfile.portfolioUrl ?? "";
      const originalPortfolioUrl = rawPhotographer?.portfolioUrl ?? "";
      console.log(`[PhotographerManage] portfolioUrl: current="${currentPortfolioUrl}" vs original="${originalPortfolioUrl}"`);
      if (currentPortfolioUrl !== originalPortfolioUrl) {
        updateData.portfolioUrl = currentPortfolioUrl;
      }
      
      // specialties (shared list codes; the backend rewrites the readable names from them)
      const currentCodes = editProfile.specialtyCodes || [];
      const originalCodes = codesForProfile(photographerTaxonomy, rawPhotographer);
      const currentOther = currentCodes.includes(PHOTO_OTHER_CODE) ? editProfile.specialtyOther.trim() : "";
      const originalOther = (rawPhotographer?.specialtyOther ?? "").trim();
      const codesChanged = JSON.stringify([...currentCodes].sort()) !== JSON.stringify([...originalCodes].sort());
      // Unchanged picks are left alone (a profile with older names only keeps them until edited).
      if (codesChanged || currentOther !== originalOther) {
        const problem = specialtyProblem(currentCodes, editProfile.specialtyOther, photographerTaxonomy);
        if (problem && currentCodes.length) {
          Alert.alert("Specialties", problem);
          setSaving(false);
          return;
        }
        updateData.specialtyCodes = currentCodes;
        updateData.specialtyOther = currentOther || null;
      }
      
      // brandColors - sent only when the wheel color changed (an untouched preset or wheel color is
      // never rewritten); saved as { type: "custom", hex } with v:2 (wheel-aware app).
      const currentThemeHex = editProfile.profileTheme || specToHex(null);
      const originalThemeHex = specToHex(parseBrandColorSpec(rawPhotographer?.brandColors));
      console.log(`[PhotographerManage] profile color: current="${currentThemeHex}" vs original="${originalThemeHex}"`);
      if (currentThemeHex !== originalThemeHex) {
        updateData.brandColors = toColorPayload({ type: "custom", hex: currentThemeHex }) as any;
      }
      
      // logoImage (avatar)
      const currentAvatar = editProfile.avatar || "";
      const originalAvatar = rawPhotographer?.logoImage || "";
      console.log(`[PhotographerManage] avatar: current="${currentAvatar.slice(0, 50)}..." vs original="${originalAvatar.slice(0, 50)}..."`);
      if (currentAvatar && currentAvatar !== originalAvatar) {
        updateData.logoImage = currentAvatar;
      }
      
      // coverImage (banner) - determine based on banner type
      let finalBannerImage = "";
      let finalMediaType: "image" | "video" | "" = "";
      if (editProfile.bannerType === "image" && editProfile.bannerImage) {
        finalBannerImage = editProfile.bannerImage;
        finalMediaType = "image";
      } else if (editProfile.bannerType === "mock" && editProfile.bannerMock) {
        finalBannerImage = editProfile.bannerMock;
        finalMediaType = "image";
      } else if (editProfile.bannerType === "video" && editProfile.bannerVideo) {
        finalBannerImage = editProfile.bannerVideo;
        finalMediaType = "video";
      }
      // For "color" type, we leave coverImage empty and the profile theme is used
      
      const originalCover = rawPhotographer?.coverImage || "";
      const originalMediaType = rawPhotographer?.coverMediaType || "";
      console.log(`[PhotographerManage] coverImage: current="${finalBannerImage.slice(0, 50)}..." vs original="${originalCover.slice(0, 50)}..."`);
      console.log(`[PhotographerManage] coverMediaType: current="${finalMediaType}" vs original="${originalMediaType}"`);
      
      if (finalBannerImage !== originalCover) {
        updateData.coverImage = finalBannerImage;
      }
      if (finalMediaType !== originalMediaType) {
        updateData.coverMediaType = finalMediaType;
      }
      
      console.log("[PhotographerManage] === FINAL UPDATE DATA ===");
      console.log("[PhotographerManage] updateData:", JSON.stringify(updateData, null, 2));
      console.log("[PhotographerManage] updateData keys:", Object.keys(updateData));
      console.log("[PhotographerManage] updateData length:", Object.keys(updateData).length);
      
      // Always include CTA config — not worth diff-checking
      updateData.ctaConfig = {
        buttonType: "book_now",
        serviceTarget: ctaServiceTarget,
        ...(ctaServiceTarget === "specific" && {
          specificServiceId: ctaSpecificServiceId,
          specificServiceName: ctaSpecificServiceName,
        }),
      };

      // Check if any fields changed
      if (Object.keys(updateData).length === 0) {
        Alert.alert("No Changes", "No profile changes detected to save.");
        setSaving(false);
        return;
      }
      
      console.log("[PhotographerManage] Calling api.updatePhotographerMe with:", JSON.stringify(updateData, null, 2));
      
      await api.updatePhotographerMe(token, updateData);
      Alert.alert("Success", "Profile updated successfully");
      await fetchData();
      afterSave("hub");
    } catch (error: any) {
      console.error("[PhotographerManage] Failed to save profile:", error);
      const errorMessage = error?.message || "Failed to save profile";
      Alert.alert("Error", errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveHours = async () => {
    const token = await getToken();
    if (!token) return;

    try {
      setSaving(true);
      
      // Convert DayHours array to WeeklyAvailabilitySlot[] for weekly_availability table
      // Backend expects: PUT /api/photographers/me/weekly-availability
      // Payload: { slots: [{ dayOfWeek: 0-6, startTime: "HH:mm", endTime: "HH:mm", isActive: true }] }
      const slots = hours
        .filter((h) => h.isAvailable)
        .map((h) => ({
          dayOfWeek: h.dayOfWeek,
          startTime: convertTo24Hour(h.startTime),
          endTime: convertTo24Hour(h.endTime),
          isActive: true,
        }));

      console.log("[PhotographerManage] Saving weekly availability - slots payload:", JSON.stringify(slots, null, 2));
      
      // Save to weekly_availability table (primary source of truth for booking/calendar)
      const response = await api.updateWeeklyAvailability(token, "photographer", slots);
      console.log("[PhotographerManage] Weekly availability saved - response:", JSON.stringify(response, null, 2));
      
      // DUAL-SYNC: Also update hoursOfOperation for legacy banner UI support
      // This is transitional - banner should eventually read from weekly_availability directly
      const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      const hoursOfOperation: Record<string, { open: boolean; start?: string; end?: string }> = {};
      dayNames.forEach((dayName, index) => {
        const slot = slots.find((s) => s.dayOfWeek === index);
        if (slot) {
          hoursOfOperation[dayName] = { open: true, start: slot.startTime, end: slot.endTime };
        } else {
          hoursOfOperation[dayName] = { open: false };
        }
      });
      console.log("[PhotographerManage] Syncing hoursOfOperation for banner:", JSON.stringify(hoursOfOperation, null, 2));
      try {
        await api.updatePhotographerProfile(token, { hoursOfOperation: hoursOfOperation as any });
        console.log("[PhotographerManage] hoursOfOperation synced successfully");
      } catch (syncError) {
        console.warn("[PhotographerManage] Failed to sync hoursOfOperation (non-blocking):", syncError);
      }
      
      // Emit availability changed event so other screens (e.g., ProfileScreen) can refresh
      availabilityEvents.emit();
      
      Alert.alert("Success", "Your availability has been updated");
      await fetchData();
      afterSave("booking");
    } catch (error: any) {
      console.error("[PhotographerManage] Failed to save availability:", error);
      Alert.alert("Error", error.message || "Failed to save availability");
    } finally {
      setSaving(false);
    }
  };

  const handleAddBlockedDate = async (blockedDate: BlockedDate) => {
    const exists = blockedDates.some(b => b.date === blockedDate.date && b.isFullDay === blockedDate.isFullDay);
    if (exists && blockedDate.isFullDay) {
      Alert.alert("Already Blocked", "This date is already blocked.");
      return;
    }
    
    const token = await getToken();
    if (!token) return;
    
    try {
      setSaving(true);
      // The backend requires startAt/endAt and has no is_full_day column, so
      // full day is expressed as a midnight-to-end-of-day span. Callers pass
      // times in either format (DateBlocker sends 24h, ProviderCalendar sends
      // 12h), so normalise before interpolating; convertTo24Hour returns a
      // 24-hour string unchanged.
      const startAt = blockedDate.isFullDay
        ? `${blockedDate.date}T00:00:00`
        : `${blockedDate.date}T${convertTo24Hour(blockedDate.startTime || "00:00")}:00`;
      const endAt = blockedDate.isFullDay
        ? `${blockedDate.date}T23:59:59`
        : `${blockedDate.date}T${convertTo24Hour(blockedDate.endTime || "23:59")}:00`;

      const result = await api.createBlock(token, "photographer", {
        startAt,
        endAt,
        reason: blockedDate.reason,
      } as any);
      setBlockedDates(prev => [...prev, {
        id: result.id,
        date: blockedDate.date,
        isFullDay: blockedDate.isFullDay,
        startTime: blockedDate.isFullDay ? undefined : startAt.split("T")[1]?.substring(0, 5),
        endTime: blockedDate.isFullDay ? undefined : endAt.split("T")[1]?.substring(0, 5),
        reason: blockedDate.reason,
      }]);
    } catch (error: any) {
      console.error("[PhotographerManage] Failed to add blocked date:", error);
      Alert.alert("Error", error.message || "Failed to add blocked date");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveBlockedDate = async (index: number) => {
    const dateToRemove = blockedDates[index];
    if (!dateToRemove) return;
    
    const token = await getToken();
    if (!token) return;
    
    if (dateToRemove.id) {
      try {
        setSaving(true);
        // Use new blocks endpoint for deletion
        await api.deleteBlock(token, "photographer", dateToRemove.id);
        setBlockedDates(prev => prev.filter((_, i) => i !== index));
      } catch (error: any) {
        console.error("[PhotographerManage] Failed to remove blocked date:", error);
        Alert.alert("Error", error.message || "Failed to remove blocked date");
      } finally {
        setSaving(false);
      }
    } else {
      setBlockedDates(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleSaveBlockedDates = async () => {
    Alert.alert("Success", "Your blocked dates are saved automatically when added or removed");
    afterSave("booking");
  };

  const handleAddService = () => {
    setEditingService(null);
    setDepositServerError(null);
    setShowServiceEditor(true);
  };

  const handleEditService = (service: PhotographerService) => {
    const rawService = rawServices.find(s => s.id === service.id);
    setEditingService({
      id: service.id,
      name: service.name,
      description: service.description || "",
      category: rawService?.category || "Other",
      pricingModel: (rawService?.pricingModel as "package" | "hourly") || "package",
      price:
        rawService?.pricingModel === "hourly" && typeof rawService.hourlyRateCents === "number"
          ? (rawService.hourlyRateCents / 100).toString()
          : service.price.toString(),
      duration: service.duration.toString(),
      packageHours: rawService?.packageHours?.toString() || "",
      status: rawService?.status || "draft",
      serviceLocationType: rawService?.serviceLocationType ?? "business",
      alternateAddress: rawService?.alternateAddress ?? null,
      alternateCity: rawService?.alternateCity ?? null,
      alternateState: rawService?.alternateState ?? null,
      alternateZipCode: rawService?.alternateZipCode ?? null,
      virtualLink: rawService?.virtualLink ?? null,
      fullRefundWindow: rawService?.fullRefundWindow ?? undefined,
      hasPartialRefund: rawService?.hasPartialRefund ?? false,
      partialRefundWindow: rawService?.partialRefundWindow ?? null,
      partialRefundPercentage: rawService?.partialRefundPercentage ?? null,
      hasCancellationFee: rawService?.hasCancellationFee ?? false,
      cancellationFeeType: rawService?.cancellationFeeType ?? null,
      cancellationFeeAmount: rawService?.cancellationFeeAmount ?? null,
      depositAmountCents: rawService?.depositAmountCents ?? null,
      imageUrl: rawService?.imageUrl ?? null,
    });
    setDepositServerError(null);
    setShowServiceEditor(true);
  };

  const handleUploadServiceImage = async (uri: string): Promise<string> => {
    const token = await getToken();
    if (!token) throw new Error("Authentication required. Please log in again.");
    const result = await uploadImage(uri, "image/jpeg", "services", token);
    return result.url;
  };

  const handleSaveService = async (data: ServiceFormData) => {
    const token = await getToken();
    if (!token) return;

    try {
      const payload: Partial<VendorBookerPhotographerService> = {
        name: data.name,
        description: data.description || null,
        category: data.category || null,
        pricingModel: data.pricingModel || "package",
        // Hourly sends the rate and minimum hours; the backend computes the
        // price (rate x hours) and duration (hours x 60). Package is unchanged.
        ...(data.pricingModel === "hourly"
          ? {
              hourlyRateCents: Math.round(parseFloat(data.price) * 100),
              packageHours: parseInt(data.packageHours ?? "", 10),
            }
          : {
              priceCents: Math.round(parseFloat(data.price) * 100),
              estimatedDurationMinutes: parseInt(data.duration) || 60,
            }),
        serviceLocationType: data.serviceLocationType,
        alternateAddress: data.alternateAddress,
        alternateCity: data.alternateCity,
        alternateState: data.alternateState,
        alternateZipCode: data.alternateZipCode,
        virtualLink: data.virtualLink,
        fullRefundWindow: data.fullRefundWindow,
        hasPartialRefund: data.hasPartialRefund,
        partialRefundWindow: data.partialRefundWindow,
        partialRefundPercentage: data.partialRefundPercentage,
        hasCancellationFee: data.hasCancellationFee,
        cancellationFeeType: data.cancellationFeeType,
        cancellationFeeAmount: data.cancellationFeeAmount,
      };
      // Sent on create; on edit only when changed, so an untouched form never
      // overwrites a deposit set elsewhere.
      if (!data.id || data.depositTouched) {
        payload.depositAmountCents = data.depositAmountCents ?? null;
      }

      // Edit sends the image only when it was uploaded or removed; create only
      // when one is set. Removing sends null, never "".
      if (data.id) {
        if (data.imageTouched) payload.imageUrl = data.imageUrl ?? null;
      } else if (data.imageUrl) {
        payload.imageUrl = data.imageUrl;
      }

      setDepositServerError(null);
      if (data.id) {
        await api.updatePhotographerMeService(token, data.id, payload);
        Alert.alert("Success", "Service updated successfully");
      } else {
        await api.createPhotographerMeService(token, payload);
        Alert.alert("Success", "Service created successfully");
      }
      
      setShowServiceEditor(false);
      setEditingService(null);
      fetchData();
    } catch (error: any) {
      if (error.status === 400 && error.body?.code === "INVALID_DEPOSIT") {
        // Rethrown so the editor stays open with the message inline.
        setDepositServerError(error.message);
        throw error;
      }
      console.error("[PhotographerManage] Failed to save service:", error);
      Alert.alert("Error", error.message || "Failed to save service");
      throw error;
    }
  };

  const handleDeleteService = (serviceId: string, serviceName: string) => {
    Alert.alert(
      "Delete Service",
      `Are you sure you want to delete "${serviceName}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const token = await getToken();
            if (!token) return;
            
            try {
              await api.deletePhotographerMeService(token, serviceId);
              Alert.alert("Success", "Service deleted");
              fetchData();
            } catch (error: any) {
              console.error("[PhotographerManage] Failed to delete service:", error);
              Alert.alert("Error", error.message || "Failed to delete service");
            }
          },
        },
      ]
    );
  };

  const handleGoLiveService = (serviceId: string, serviceName: string) => {
    if (!profile?.stripeConnected) {
      Alert.alert(
        "Stripe Required",
        "You need to connect Stripe before publishing services. Connect Stripe to accept payments.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Connect Stripe", onPress: handleConnectStripe },
        ]
      );
      return;
    }

    Alert.alert(
      "Publish Service",
      `Publish "${serviceName}"? This will make it visible to clients and create a Stripe product for payments.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Publish",
          onPress: async () => {
            const token = await getToken();
            if (!token) return;
            
            setPublishingServiceId(serviceId);
            try {
              const response = await api.goLivePhotographerService(token, serviceId);
              // Update the service in local state with the response
              if (response?.service) {
                setServices(prev => prev.map(svc => 
                  svc.id === serviceId 
                    ? { ...svc, status: "live" } as PhotographerService
                    : svc
                ));
              }
              Alert.alert("Success", "Service is now live!");
              fetchData();
            } catch (error: any) {
              console.error("[PhotographerManage] Failed to publish service:", error);
              const errorMessage = error.message || "Failed to publish service";
              // Check for Stripe onboarding error
              if (errorMessage.toLowerCase().includes("stripe") || 
                  errorMessage.toLowerCase().includes("onboarding")) {
                Alert.alert(
                  "Stripe Setup Required",
                  "Provider must finish Stripe onboarding before services can go live.",
                  [
                    { text: "Cancel", style: "cancel" },
                    { text: "Finish Stripe Setup", onPress: handleConnectStripe },
                  ]
                );
              } else {
                Alert.alert("Error", errorMessage);
              }
            } finally {
              setPublishingServiceId(null);
            }
          },
        },
      ]
    );
  };

  const handleArchiveService = (serviceId: string, serviceName: string) => {
    Alert.alert(
      "Archive Service",
      `Archive "${serviceName}"? This will hide it from clients but keep the data.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Archive",
          onPress: async () => {
            const token = await getToken();
            if (!token) return;
            
            try {
              await api.archivePhotographerService(token, serviceId);
              Alert.alert("Success", "Service archived");
              fetchData();
            } catch (error: any) {
              console.error("[PhotographerManage] Failed to archive service:", error);
              Alert.alert("Error", error.message || "Failed to archive service");
            }
          },
        },
      ]
    );
  };

  const toggleSpecialty = (code: string) => {
    setEditProfile(prev => ({
      ...prev,
      specialtyCodes: toggleSpecialtyCode(prev.specialtyCodes, code, photographerTaxonomy?.maxSpecialties ?? 5),
    }));
  };

  const getServiceStatusColor = (status: string) => {
    switch (status) {
      case "live":
      case "active": return "#22c55e";
      case "draft": return "#f97316";
      case "archived": return "#64748b";
      default: return theme.brandTextDim;
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.brandBg },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: insets.top + 8,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.brandSurfaceBorder,
    },
    backButton: { padding: 8, marginRight: 8 },
    headerTitle: { flex: 1, fontSize: 20, fontWeight: "700", color: theme.brandCream },
    roleBadge: { backgroundColor: theme.brandSurface, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
    roleBadgeText: { fontSize: 12, color: theme.brandTextDim, fontWeight: "600" },
    content: { flex: 1 },
    section: { padding: 16 },
    sectionDesc: { fontSize: 14, color: theme.brandTextDim, marginBottom: 16 },

    // ── Hub (same look as the business Manage business) ──
    statusBanner: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12 },
    statusBannerIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
    statusBannerTitle: { fontSize: 14, fontWeight: "600", color: theme.brandCream, marginBottom: 2 },
    statusBannerDesc: { fontSize: 13, color: theme.brandTextDim },
    hubGroupLabel: { fontSize: 13, fontWeight: "700", color: theme.brandTextDim, marginTop: 22, marginBottom: 8, marginHorizontal: 4 },
    hubCard: {
      backgroundColor: theme.brandBgElevated,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.brandSurfaceBorder,
      overflow: "hidden",
    },
    hubRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 12, minHeight: 60 },
    hubRowDivider: { borderTopWidth: 1, borderTopColor: theme.brandSurfaceBorder },
    hubIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.brandPrimary, alignItems: "center", justifyContent: "center" },
    hubRowTitle: { fontSize: 16, fontWeight: "700", color: theme.brandCream },
    hubRowSub: { fontSize: 13, color: theme.brandTextDim, marginTop: 2 },
    hubTag: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: theme.brandGold + "22" },
    hubTagText: { fontSize: 12, fontWeight: "700", color: theme.brandGoldDim },
    setupCard: { backgroundColor: theme.brandPrimary, borderRadius: 16, padding: 16, marginTop: 4 },
    setupTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
    setupTitle: { fontSize: 16, fontWeight: "800", color: theme.brandPrimaryText },
    setupCount: { fontSize: 14, fontWeight: "700", color: SETUP_GOLD },
    setupBar: { height: 8, borderRadius: 4, backgroundColor: theme.brandPrimaryText + "26", marginTop: 12, marginBottom: 6, overflow: "hidden" },
    setupBarFill: { height: 8, borderRadius: 4, backgroundColor: SETUP_GOLD },
    setupStep: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 },
    setupDot: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: SETUP_GOLD, alignItems: "center", justifyContent: "center" },
    setupStepText: { flex: 1, fontSize: 15, color: theme.brandPrimaryText },
    setupToggle: { minHeight: 44, justifyContent: "center" },
    setupToggleText: { fontSize: 14, fontWeight: "700", color: SETUP_GOLD },

    // ── Page Save button ──
    saveButton: {
      backgroundColor: theme.brandPrimary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 8,
    },
    saveButtonText: { color: theme.brandPrimaryText, fontSize: 16, fontWeight: "700" },

    // ── Form fields (same as the old sheet) ──
    formGroup: { marginBottom: 20 },
    formLabel: {
      fontSize: 13,
      fontWeight: "500",
      color: theme.brandTextDim,
      marginBottom: 8,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    formInput: {
      backgroundColor: theme.brandSurface,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: theme.brandCream,
    },
    formTextarea: { minHeight: 100, textAlignVertical: "top" },
    formRow: { flexDirection: "row", gap: 12 },
    formHalf: { flex: 1 },
    specialtiesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    specialtyChip: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: theme.brandSurface,
      borderWidth: 1,
      borderColor: theme.brandSurfaceBorder,
    },
    specialtyChipActive: { backgroundColor: theme.brandGold + "20", borderColor: theme.brandGold },
    specialtyChipText: { fontSize: 14, color: theme.brandTextDim },
    specialtyChipTextActive: { color: theme.brandGold, fontWeight: "500" },
    formHint: { fontSize: 13, color: theme.brandTextDim, marginTop: 2, marginBottom: 12 },

    // ── Service cards (theme colors, so light mode works) ──
    emptyCard: {
      backgroundColor: theme.brandBgElevated,
      borderColor: theme.brandSurfaceBorder,
      borderWidth: 1,
      borderRadius: 14,
      padding: 24,
      alignItems: "center",
    },
    emptyIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.brandGold + "1A",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },
    emptyText: { fontSize: 14, color: theme.brandTextDim, textAlign: "center" },
    serviceThumb: { width: 44, height: 44, borderRadius: 8, marginRight: 10, backgroundColor: theme.brandSurfaceBorder },
    bookingCard: {
      backgroundColor: theme.brandBgElevated,
      borderColor: theme.brandSurfaceBorder,
      borderWidth: 1,
      borderRadius: 14,
      padding: 16,
      marginBottom: 12,
    },
    bookingClient: { fontSize: 15, fontWeight: "600", color: theme.brandCream },
    bookingService: { fontSize: 13, color: theme.brandTextDim, marginTop: 2 },
    bookingAmount: { fontSize: 15, fontWeight: "600", color: theme.brandGold },
    bookingDetails: {
      flexDirection: "row",
      alignItems: "center",
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.brandSurfaceBorder,
    },
    bookingDate: { flexDirection: "row", alignItems: "center", marginRight: 16 },
    bookingDateText: { fontSize: 13, color: theme.brandTextDim, marginLeft: 6 },

    // ── Load error ──
    errorWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
    errorText: { color: theme.brandTextDim, fontSize: 15, textAlign: "center", marginBottom: 16 },
  });

  const renderHubRow = (opts: {
    icon: keyof typeof Feather.glyphMap;
    title: string;
    sub: string;
    onPress: () => void;
    tag?: string | null;
    first?: boolean;
  }) => (
    <Pressable
      key={opts.title}
      onPress={opts.onPress}
      style={({ pressed }) => [styles.hubRow, !opts.first && styles.hubRowDivider, pressed && { opacity: 0.7 }]}
      accessibilityRole="button"
      accessibilityLabel={opts.title}
      accessibilityHint={opts.sub}
    >
      <View style={styles.hubIcon}>
        <Feather name={opts.icon} size={20} color={theme.brandPrimaryText} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.hubRowTitle}>{opts.title}</Text>
        <Text style={styles.hubRowSub}>{opts.sub}</Text>
      </View>
      {opts.tag ? (
        <View style={styles.hubTag}>
          <Text style={styles.hubTagText}>{opts.tag}</Text>
        </View>
      ) : null}
      <Feather name="chevron-right" size={18} color={theme.brandTextDim} />
    </Pressable>
  );

  const renderSaveButton = (onPress: () => void, label = "Save") => (
    <Pressable
      onPress={onPress}
      disabled={saving}
      style={({ pressed }) => [styles.saveButton, (pressed || saving) && { opacity: 0.7 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {saving ? (
        <ActivityIndicator size="small" color={theme.brandPrimaryText} />
      ) : (
        <Text style={styles.saveButtonText}>{label}</Text>
      )}
    </Pressable>
  );

  const hasAvailabilitySet = hours.some(h => h.isAvailable);
  const payoutsReady = Boolean(profile?.stripeConnected);
  const offeredServices = services.filter((s) => s.status !== "archived");
  const missingPhotos = servicesMissingPhoto(services);
  const openDays = hours.filter((h) => h.isAvailable).length;

  const goToTarget = (target: PhotographerSetupTarget) => openSection(target);

  const renderSetupCard = () => {
    const steps = photographerSetupSteps({
      name: profile?.name,
      hourlyRate: profile?.hourlyRate,
      hasHours: hasAvailabilitySet,
      services,
      payoutsReady,
    });
    const doneSteps = steps.filter((s) => s.done);
    const todo = steps.filter((s) => !s.done);
    if (todo.length === 0) return null;
    return (
      <View style={styles.setupCard}>
        <View style={styles.setupTitleRow}>
          <Text style={styles.setupTitle}>Finish setting up</Text>
          <Text style={styles.setupCount}>
            {doneSteps.length} of {steps.length} done
          </Text>
        </View>
        <View style={styles.setupBar}>
          <View style={[styles.setupBarFill, { width: `${Math.round((doneSteps.length / steps.length) * 100)}%` }]} />
        </View>
        {todo.map((step) => (
          <Pressable
            key={step.key}
            onPress={() => goToTarget(step.target)}
            style={({ pressed }) => [styles.setupStep, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
          >
            <View style={styles.setupDot} />
            <Text style={styles.setupStepText}>{step.label}</Text>
            <Feather name="chevron-right" size={18} color={theme.brandPrimaryText} />
          </Pressable>
        ))}
        {doneSteps.length > 0 ? (
          <Pressable
            onPress={() => setShowDoneSteps((v) => !v)}
            style={styles.setupToggle}
            accessibilityRole="button"
            accessibilityState={{ expanded: showDoneSteps }}
          >
            <Text style={styles.setupToggleText}>
              {showDoneSteps ? "Hide finished steps" : `Show ${doneSteps.length} finished`}
            </Text>
          </Pressable>
        ) : null}
        {showDoneSteps
          ? doneSteps.map((step) => (
              <View key={step.key} style={styles.setupStep}>
                <View style={[styles.setupDot, { backgroundColor: SETUP_GOLD }]}>
                  <Feather name="check" size={14} color={theme.brandPrimary} />
                </View>
                <Text style={[styles.setupStepText, { opacity: 0.75 }]}>{step.label}</Text>
              </View>
            ))
          : null}
      </View>
    );
  };

  const renderStatusBanner = () => {
    const banner = visibilityBanner(rawPhotographer?.visibilityStatus);
    if (!banner) return null;
    const color = banner.tone === "ok" ? theme.brandSuccess : theme.brandPending;
    return (
      <View style={styles.statusBanner}>
        <View style={[styles.statusBannerIcon, { backgroundColor: color + "20" }]}>
          <Feather name={banner.tone === "ok" ? "check-circle" : "eye-off"} size={20} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.statusBannerTitle}>{banner.title}</Text>
          <Text style={styles.statusBannerDesc}>{banner.desc}</Text>
        </View>
      </View>
    );
  };

  const renderHub = () => (
    <ScrollView
      style={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.brandGold} />}
    >
      {renderStatusBanner()}
      <View style={[styles.section, { paddingTop: 4 }]}>
        {renderSetupCard()}

        <Text style={styles.hubGroupLabel}>What you offer</Text>
        <View style={styles.hubCard}>
          {renderHubRow({
            first: true,
            icon: "camera",
            title: "Services",
            sub: offeredServices.length ? serviceCountText(services) : "Shoots customers book a time for. Add-ons are inside each service",
            tag: missingPhotos ? `${missingPhotos} ${missingPhotos === 1 ? "needs" : "need"} a photo` : null,
            onPress: () => openSection("services"),
          })}
        </View>

        <Text style={styles.hubGroupLabel}>Your storefront</Text>
        <View style={styles.hubCard}>
          {renderHubRow({
            first: true,
            icon: "image",
            title: "Look and branding",
            sub: "Banner, photo, color, Book Now button",
            onPress: () => openSection("branding"),
          })}
          {renderHubRow({
            icon: "user",
            title: "Profile and contact",
            sub: "Name, rate, username, bio, location, specialties",
            onPress: () => openSection("profile"),
          })}
        </View>

        <Text style={styles.hubGroupLabel}>Bookings and money</Text>
        <View style={styles.hubCard}>
          {renderHubRow({
            first: true,
            icon: "clock",
            title: "Booking settings",
            sub: "Hours and blocked dates",
            tag: hasAvailabilitySet ? null : "Set up",
            onPress: () => openSection("booking"),
          })}
          {renderHubRow({
            icon: "credit-card",
            title: "Payouts",
            sub: payoutsReady ? "Payouts are on" : "Connect payouts to get paid",
            tag: payoutsReady ? null : "Set up",
            onPress: () => openSection("payouts"),
          })}
        </View>
        <View style={{ height: insets.bottom + 24 }} />
      </View>
    </ScrollView>
  );

  const renderPageScroll = (children: React.ReactNode) => (
    <ScrollView
      style={styles.content}
      contentContainerStyle={styles.section}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
      <View style={{ height: insets.bottom + 24 }} />
    </ScrollView>
  );

  const renderBrandingPage = () => renderPageScroll(
    <>
      {/* Banner Editor */}
      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>Profile Banner</Text>
        <Text style={styles.formHint}>Choose a banner style for your public profile</Text>
        
        {/* Banner Type Selector - 3 options: Color, Media, Presets */}
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
          {[
            { type: "color" as const, label: "Color", icon: "droplet" as const },
            { type: "media" as const, label: "Media", icon: "upload" as const },
            { type: "mock" as const, label: "Presets", icon: "grid" as const },
          ].map(opt => (
            <Pressable
              key={opt.type}
              onPress={() => {
                if (opt.type === "media") {
                  setEditProfile({ ...editProfile, bannerType: editProfile.bannerVideo ? "video" : "image" });
                } else {
                  setEditProfile({ ...editProfile, bannerType: opt.type });
                }
              }}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 10,
                borderRadius: 8,
                backgroundColor: (opt.type === "media" && (editProfile.bannerType === "image" || editProfile.bannerType === "video")) || editProfile.bannerType === opt.type ? theme.brandGold : theme.brandSurface,
              }}
            >
              <Feather name={opt.icon} size={14} color={(opt.type === "media" && (editProfile.bannerType === "image" || editProfile.bannerType === "video")) || editProfile.bannerType === opt.type ? theme.brandCream : theme.brandCream} />
              <Text style={{ marginLeft: 4, fontSize: 12, fontWeight: "600", color: (opt.type === "media" && (editProfile.bannerType === "image" || editProfile.bannerType === "video")) || editProfile.bannerType === opt.type ? theme.brandCream : theme.brandCream }}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Banner Preview & Editor based on type */}
        {editProfile.bannerType === "color" && (
          <View style={{ 
            height: 120, 
            borderRadius: 12, 
            backgroundColor: resolveBrandColor({ type: "custom", hex: editProfile.profileTheme || specToHex(null) }, isDark ? "dark" : "light"),
            alignItems: "center",
            justifyContent: "center",
          }}>
            <Text style={{ color: "#fff", fontSize: 13, opacity: 0.8 }}>Uses your profile theme color</Text>
          </View>
        )}

        {(editProfile.bannerType === "image" || editProfile.bannerType === "video") && (
          <MediaUploader
            currentImage={editProfile.bannerImage || undefined}
            currentVideo={editProfile.bannerVideo || undefined}
            currentMediaType={editProfile.bannerType === "video" ? "video" : editProfile.bannerType === "image" ? "image" : undefined}
            onMediaUploaded={(url, mediaType) => {
              console.log("[PhotographerManage] MediaUploader callback:", { url: url.substring(0, 50), mediaType });
              if (mediaType === "video") {
                setEditProfile(prev => ({ 
                  ...prev, 
                  bannerVideo: url, 
                  bannerImage: "",
                  bannerType: "video" 
                }));
              } else {
                setEditProfile(prev => ({ 
                  ...prev, 
                  bannerImage: url, 
                  bannerVideo: "",
                  bannerType: "image" 
                }));
              }
            }}
            onRemove={() => {
              setEditProfile(prev => ({ 
                ...prev, 
                bannerImage: "", 
                bannerVideo: "",
                bannerType: "color" 
              }));
            }}
            folder="covers"
            maxVideoDuration={15}
            placeholder="Upload banner image"
          />
        )}

        {editProfile.bannerType === "mock" && (
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
              {MOCK_BANNERS.map(mock => (
                <Pressable
                  key={mock.id}
                  onPress={() => setEditProfile({ ...editProfile, bannerMock: mock.url, bannerImage: mock.url })}
                  style={{
                    width: 140,
                    height: 80,
                    borderRadius: 10,
                    overflow: "hidden",
                    borderWidth: editProfile.bannerMock === mock.url ? 3 : 0,
                    borderColor: theme.brandGold,
                  }}
                >
                  <Image source={{ uri: mock.url }} style={{ width: "100%", height: "100%" }} />
                  {editProfile.bannerMock === mock.url && (
                    <View style={{ position: "absolute", top: 4, right: 4, backgroundColor: theme.brandGold, borderRadius: 10, padding: 2 }}>
                      <Feather name="check" size={12} color={theme.brandCream} />
                    </View>
                  )}
                </Pressable>
              ))}
            </ScrollView>
            <Text style={{ color: theme.brandTextDim, fontSize: 11, marginTop: 8 }}>Swipe to see more preset banners</Text>
          </View>
        )}
      </View>

      {/* Profile Picture Editor */}
      <View style={[styles.formGroup, { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 24 }]}>
        {profileCrop.cropper}
        <Pressable
          onPress={async () => {
            Alert.alert("Update Profile Photo", "Choose an option", [
              { text: "Take Photo", onPress: () => pickProfilePhoto("camera") },
              { text: "Choose from Library", onPress: () => pickProfilePhoto("library") },
              { text: "Cancel", style: "cancel" },
            ]);
          }}
          style={{
            width: 100,
            height: 100,
            borderRadius: 50,
            backgroundColor: theme.brandSurface,
            overflow: "hidden",
            borderWidth: 3,
            borderColor: theme.brandGold,
          }}
        >
          {editProfile.avatar ? (
            <Image source={{ uri: editProfile.avatar }} style={{ width: "100%", height: "100%" }} />
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <Feather name="camera" size={28} color={theme.brandTextDim} />
            </View>
          )}
          <View style={{ 
            position: "absolute", 
            bottom: 0, 
            right: 0, 
            backgroundColor: theme.brandGold, 
            borderRadius: 12, 
            padding: 6,
          }}>
            <Feather name="edit-2" size={12} color={theme.brandCream} />
          </View>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.formLabel}>Profile Photo</Text>
          <Text style={{ color: theme.brandTextDim, fontSize: 12, marginTop: 4 }}>Tap to change photo</Text>
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>Profile Theme</Text>
        <ColorWheelPicker
          value={editProfile.profileTheme || specToHex(null)}
          onChange={(hex) => setEditProfile((prev) => ({ ...prev, profileTheme: hex }))}
          hint="Choose any color for your public profile"
        />
      </View>

      {/* ── Quick Action Button Config ─────────────────────────────────── */}
      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>Quick Action Button</Text>
        <Text style={styles.formHint}>
          The "Book Now" button floating on your public profile. Choose whether it opens
          your full booking flow or jumps directly to one specific service.
        </Text>

        {/* Preview of the button */}
        <View
          style={{
            alignSelf: "flex-start",
            backgroundColor: theme.brandGold,
            borderRadius: 20,
            paddingHorizontal: 20,
            paddingVertical: 10,
            marginBottom: 16,
          }}
        >
          <Text style={{ color: "#000", fontWeight: "800", fontSize: 14 }}>
            Book Now →
          </Text>
        </View>

        {/* Option: open full booking flow */}
        <Pressable
          onPress={() => {
            setCtaServiceTarget("first_available");
            setCtaSpecificServiceId("");
            setCtaSpecificServiceName("");
          }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            padding: 14,
            borderRadius: 12,
            borderWidth: 1.5,
            marginBottom: 10,
            borderColor:
              ctaServiceTarget === "first_available"
                ? theme.brandGold
                : theme.brandSurface,
            backgroundColor:
              ctaServiceTarget === "first_available"
                ? theme.brandGold + "14"
                : theme.brandSurface,
            gap: 12,
          }}
        >
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              borderWidth: 2,
              borderColor:
                ctaServiceTarget === "first_available"
                  ? theme.brandGold
                  : theme.brandTextDim,
              backgroundColor:
                ctaServiceTarget === "first_available" ? theme.brandGold : "transparent",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {ctaServiceTarget === "first_available" && (
              <View
                style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff" }}
              />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: ctaServiceTarget === "first_available" ? "700" : "500",
                color:
                  ctaServiceTarget === "first_available"
                    ? theme.brandGold
                    : theme.brandCream,
              }}
            >
              Open booking flow
            </Text>
            <Text style={{ fontSize: 12, color: theme.brandTextDim, marginTop: 2 }}>
              Customer picks their service from your full list
            </Text>
          </View>
        </Pressable>

        {/* Option: jump to specific service */}
        <Pressable
          onPress={() => setCtaServiceTarget("specific")}
          style={{
            flexDirection: "row",
            alignItems: "center",
            padding: 14,
            borderRadius: 12,
            borderWidth: 1.5,
            marginBottom: 10,
            borderColor:
              ctaServiceTarget === "specific" ? theme.brandGold : theme.brandSurface,
            backgroundColor:
              ctaServiceTarget === "specific"
                ? theme.brandGold + "14"
                : theme.brandSurface,
            gap: 12,
          }}
        >
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              borderWidth: 2,
              borderColor:
                ctaServiceTarget === "specific" ? theme.brandGold : theme.brandTextDim,
              backgroundColor:
                ctaServiceTarget === "specific" ? theme.brandGold : "transparent",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {ctaServiceTarget === "specific" && (
              <View
                style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff" }}
              />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: ctaServiceTarget === "specific" ? "700" : "500",
                color:
                  ctaServiceTarget === "specific" ? theme.brandGold : theme.brandCream,
              }}
            >
              Jump to a specific service
            </Text>
            <Text style={{ fontSize: 12, color: theme.brandTextDim, marginTop: 2 }}>
              Button takes them straight to one service
            </Text>
          </View>
        </Pressable>

        {/* Specific service picker — only shown when "specific" selected */}
        {ctaServiceTarget === "specific" && (
          <View style={{ marginTop: 4, gap: 8 }}>
            {services.filter((s) => s.status === "live" || (s as any).status === "active").length === 0 ? (
              <View
                style={{
                  backgroundColor: theme.brandSurface,
                  borderRadius: 10,
                  padding: 14,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{ fontSize: 13, color: theme.brandTextDim, textAlign: "center" }}
                >
                  No live services yet. Publish a service first, then come back to
                  pin it to your button.
                </Text>
              </View>
            ) : (
              services
                .filter((s) => s.status === "live" || (s as any).status === "active")
                .map((service) => {
                  const isSelected = ctaSpecificServiceId === String(service.id);
                  return (
                    <Pressable
                      key={String(service.id)}
                      onPress={() => {
                        setCtaSpecificServiceId(String(service.id));
                        setCtaSpecificServiceName(service.name);
                      }}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        padding: 12,
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: isSelected
                          ? theme.brandGold
                          : theme.brandSurface,
                        backgroundColor: isSelected
                          ? theme.brandGold + "14"
                          : theme.brandSurface,
                        gap: 10,
                      }}
                    >
                      <View
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          borderWidth: 2,
                          borderColor: isSelected ? theme.brandGold : theme.brandTextDim,
                          backgroundColor: isSelected ? theme.brandGold : "transparent",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {isSelected && (
                          <View
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 4,
                              backgroundColor: "#fff",
                            }}
                          />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: isSelected ? "700" : "500",
                            color: isSelected ? theme.brandGold : theme.brandCream,
                          }}
                          numberOfLines={1}
                        >
                          {service.name}
                        </Text>
                        <Text
                          style={{ fontSize: 12, color: theme.brandTextDim, marginTop: 1 }}
                        >
                          ${service.price.toFixed(2)}
                          {service.depositAmountCents && service.depositAmountCents > 0
                            ? ` · $${(service.depositAmountCents / 100).toFixed(2)} deposit`
                            : ""}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })
            )}
          </View>
        )}
      </View>
      {/* ── End Quick Action Button Config ─────────────────────────────── */}
      {renderSaveButton(handleSaveProfile)}
    </>
  );

  const renderProfilePage = () => renderPageScroll(
    <>
      <View style={styles.formRow}>
        <View style={[styles.formGroup, styles.formHalf]}>
          <Text style={styles.formLabel}>Display Name</Text>
          <TextInput
            style={styles.formInput}
            value={editProfile.name}
            onChangeText={(text) => setEditProfile({ ...editProfile, name: text })}
            placeholder="Your name"
            placeholderTextColor={theme.brandTextDim}
          />
        </View>
        <View style={[styles.formGroup, styles.formHalf]}>
          <Text style={styles.formLabel}>Hourly Rate ($)</Text>
          <TextInput
            style={styles.formInput}
            value={editProfile.hourlyRate}
            onChangeText={(text) => setEditProfile({ ...editProfile, hourlyRate: text })}
            placeholder="150"
            placeholderTextColor={theme.brandTextDim}
            keyboardType="numeric"
          />
        </View>
      </View>
      
      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>Username</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <TextInput
              style={[
                styles.formInput,
                !identityStatus?.canChangeUsername && editProfile.username === originalUsername 
                  ? { opacity: 0.6 } 
                  : null
              ]}
              value={editProfile.username}
              onChangeText={(text) => setEditProfile({ ...editProfile, username: text.toLowerCase().replace(/[^a-z0-9_]/g, "") })}
              placeholder="your_username"
              placeholderTextColor={theme.brandTextDim}
              autoCapitalize="none"
              autoCorrect={false}
              editable={identityStatus?.canChangeUsername !== false}
            />
          </View>
          {editProfile.username !== originalUsername && (
            <Pressable 
              onPress={handleSaveUsername} 
              disabled={savingIdentity}
              style={{
                backgroundColor: theme.brandPrimary,
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 8,
              }}
            >
              {savingIdentity ? (
                <ActivityIndicator size="small" color={theme.brandPrimaryText} />
              ) : (
                <Text style={{ color: theme.brandPrimaryText, fontWeight: "600" }}>Save</Text>
              )}
            </Pressable>
          )}
        </View>
        {!identityStatus?.canChangeUsername && identityStatus?.usernameCooldownDays ? (
          <Text style={{ color: theme.brandTextDim, fontSize: 12, marginTop: 4 }}>
            You can change your username again in {identityStatus.usernameCooldownDays} days
          </Text>
        ) : (
          <Text style={{ color: theme.brandTextDim, fontSize: 12, marginTop: 4 }}>
            This is how others find you (@{editProfile.username || "username"})
          </Text>
        )}
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>Bio</Text>
        <TextInput
          style={[styles.formInput, styles.formTextarea]}
          value={editProfile.bio}
          onChangeText={(text) => setEditProfile({ ...editProfile, bio: text })}
          placeholder="Tell clients about yourself..."
          placeholderTextColor={theme.brandTextDim}
          multiline
        />
      </View>

      <View style={styles.formRow}>
        <View style={[styles.formGroup, styles.formHalf]}>
          <Text style={styles.formLabel}>City</Text>
          <TextInput
            style={styles.formInput}
            value={editProfile.city}
            onChangeText={(text) => setEditProfile({ ...editProfile, city: text })}
            placeholder="New York"
            placeholderTextColor={theme.brandTextDim}
          />
        </View>
        <View style={[styles.formGroup, styles.formHalf]}>
          <Text style={styles.formLabel}>State</Text>
          <TextInput
            style={styles.formInput}
            value={editProfile.state}
            onChangeText={(text) => setEditProfile({ ...editProfile, state: text })}
            placeholder="NY"
            placeholderTextColor={theme.brandTextDim}
          />
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>Portfolio URL</Text>
        <TextInput
          style={styles.formInput}
          value={editProfile.portfolioUrl}
          onChangeText={(text) => setEditProfile({ ...editProfile, portfolioUrl: text })}
          placeholder="https://yourportfolio.com"
          placeholderTextColor={theme.brandTextDim}
          autoCapitalize="none"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>Specialties</Text>
        <Text style={styles.formHint}>Choose up to {photographerTaxonomy?.maxSpecialties ?? 5}</Text>
        {!photographerTaxonomy ? (
          <Pressable onPress={() => loadPhotographerTaxonomy()}>
            <Text style={styles.formHint}>{"Loading the specialty list. Tap to try again."}</Text>
          </Pressable>
        ) : (
          <View style={styles.specialtiesGrid}>
            {pickableSpecialties(photographerTaxonomy).map(s => {
              const selected = editProfile.specialtyCodes.includes(s.code);
              const disabled = !selected && editProfile.specialtyCodes.length >= photographerTaxonomy.maxSpecialties;
              return (
                <Pressable
                  key={s.code}
                  onPress={() => toggleSpecialty(s.code)}
                  disabled={disabled}
                  accessibilityState={{ checked: selected, disabled }}
                  style={[
                    styles.specialtyChip,
                    selected && styles.specialtyChipActive,
                    disabled && { opacity: 0.4 },
                  ]}
                >
                  <Text style={[
                    styles.specialtyChipText,
                    selected && styles.specialtyChipTextActive,
                  ]}>
                    {s.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
        {editProfile.specialtyCodes.includes(PHOTO_OTHER_CODE) ? (
          <TextInput
            style={[styles.formInput, { marginTop: 10, minHeight: 70, textAlignVertical: "top" }]}
            value={editProfile.specialtyOther}
            onChangeText={(text) => setEditProfile({ ...editProfile, specialtyOther: text })}
            placeholder="What do you shoot?"
            placeholderTextColor={theme.brandTextDim}
            multiline
            maxLength={photographerTaxonomy?.otherMax ?? 500}
          />
        ) : null}
      </View>
      {renderSaveButton(handleSaveProfile)}
    </>
  );

  const renderServicesPage = () => renderPageScroll(
    <>
      <Pressable
        onPress={handleAddService}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.primary,
          paddingVertical: 14,
          borderRadius: 12,
          marginBottom: 16,
        }}
      >
        <Feather name="plus" size={20} color="#000" />
        <Text style={{ color: "#000", fontWeight: "600", fontSize: 16, marginLeft: 8 }}>
          Add Service
        </Text>
      </Pressable>

      {!profile?.stripeConnected && (
        <Pressable
          onPress={handleConnectStripe}
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#6366f1" + "15",
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 10,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: "#6366f1" + "30",
          }}
        >
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#6366f1", alignItems: "center", justifyContent: "center" }}>
            <Feather name="credit-card" size={18} color="#fff" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ color: theme.text, fontWeight: "600", fontSize: 14 }}>Stripe Setup Required</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>Complete setup to publish services and accept payments</Text>
          </View>
          <Feather name="chevron-right" size={20} color="#6366f1" />
        </Pressable>
      )}

      {profile?.stripeConnected && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#22c55e" + "15",
            paddingVertical: 10,
            paddingHorizontal: 14,
            borderRadius: 8,
            marginBottom: 16,
          }}
        >
          <Feather name="check-circle" size={16} color="#22c55e" />
          <Text style={{ color: "#22c55e", fontWeight: "500", fontSize: 13, marginLeft: 8 }}>Stripe connected - ready to publish services</Text>
        </View>
      )}

      {services.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Feather name="camera" size={24} color={theme.textSecondary} />
          </View>
          <Text style={styles.emptyText}>No services added yet</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 14, marginTop: 8, textAlign: "center" }}>
            Create your first service to start accepting bookings
          </Text>
        </View>
      ) : (
        services.map(service => {
          const status = (service as any).status || "draft";
          const statusColor = getServiceStatusColor(status);
          return (
            <View key={service.id} style={styles.bookingCard}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                {service.imageUrl ? (
                  <Image
                    source={{ uri: service.imageUrl }}
                    style={styles.serviceThumb}
                    contentFit="cover"
                  />
                ) : null}
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={styles.bookingClient}>{service.name}</Text>
                    <View style={{
                      backgroundColor: statusColor + "20",
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 6,
                    }}>
                      <Text style={{ color: statusColor, fontSize: 11, fontWeight: "600", textTransform: "capitalize" }}>
                        {status}
                      </Text>
                    </View>
                  </View>
                  {service.description ? (
                    <Text style={[styles.bookingService, { marginTop: 4 }]} numberOfLines={2}>
                      {service.description}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.bookingAmount}>${service.price}</Text>
              </View>
              <View style={[styles.bookingDetails, { marginTop: 12 }]}>
                <View style={styles.bookingDate}>
                  <Feather name="clock" size={14} color={theme.textSecondary} />
                  <Text style={styles.bookingDateText}>{formatDuration(service.duration)}</Text>
                </View>
                <View style={[styles.bookingDate, { marginLeft: 12 }]}>
                  <Feather name="tag" size={14} color={theme.textSecondary} />
                  <Text style={styles.bookingDateText}>{(service as any).category || "Other"}</Text>
                </View>
                {service.depositAmountCents && service.depositAmountCents > 0 ? (
                  <View style={[styles.bookingDate, { marginLeft: 12 }]}>
                    <Feather name="lock" size={14} color={theme.textSecondary} />
                    <Text style={styles.bookingDateText}>
                      ${(service.depositAmountCents / 100).toFixed(2)} deposit
                    </Text>
                  </View>
                ) : null}
              </View>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                <Pressable
                  onPress={() => handleEditService(service)}
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: theme.backgroundSecondary,
                    paddingVertical: 10,
                    borderRadius: 8,
                  }}
                >
                  <Feather name="edit-2" size={16} color={theme.text} />
                  <Text style={{ color: theme.text, fontWeight: "500", marginLeft: 6 }}>Edit</Text>
                </Pressable>
                {status === "draft" ? (
                  profile?.stripeConnected ? (
                    <Pressable
                      onPress={() => handleGoLiveService(service.id, service.name)}
                      disabled={publishingServiceId === service.id}
                      style={{
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: publishingServiceId === service.id ? "#86efac" : "#22c55e",
                        paddingVertical: 10,
                        borderRadius: 8,
                        opacity: publishingServiceId === service.id ? 0.7 : 1,
                      }}
                    >
                      {publishingServiceId === service.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Feather name="zap" size={16} color="#fff" />
                          <Text style={{ color: "#fff", fontWeight: "600", marginLeft: 6 }}>Go Live</Text>
                        </>
                      )}
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={handleConnectStripe}
                      style={{
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "#6366f1",
                        paddingVertical: 10,
                        borderRadius: 8,
                      }}
                    >
                      <Feather name="credit-card" size={16} color="#fff" />
                      <Text style={{ color: "#fff", fontWeight: "600", marginLeft: 6 }}>Finish Stripe Setup</Text>
                    </Pressable>
                  )
                ) : (status === "live" || status === "active") ? (
                  <Pressable
                    onPress={() => handleArchiveService(service.id, service.name)}
                    style={{
                      flex: 1,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: theme.backgroundSecondary,
                      paddingVertical: 10,
                      borderRadius: 8,
                    }}
                  >
                    <Feather name="archive" size={16} color={theme.textSecondary} />
                    <Text style={{ color: theme.textSecondary, fontWeight: "500", marginLeft: 6 }}>Archive</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => handleDeleteService(service.id, service.name)}
                  style={{
                    width: 44,
                    height: 44,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#fee2e2",
                    borderRadius: 8,
                  }}
                >
                  <Feather name="trash-2" size={18} color="#dc2626" />
                </Pressable>
              </View>
            </View>
          );
        })
      )}
    </>
  );

  const renderBookingPage = () => renderPageScroll(
    <>
      <Text style={styles.sectionDesc}>These apply to every service you offer.</Text>
      <View style={styles.hubCard}>
        {renderHubRow({
          first: true,
          icon: "clock",
          title: "Hours",
          sub: !hasAvailabilitySet ? "Not set yet" : `Open ${openDays} day${openDays === 1 ? "" : "s"} a week`,
          tag: hasAvailabilitySet ? null : "Set up",
          onPress: () => openSection("hours"),
        })}
        {renderHubRow({
          icon: "x-circle",
          title: "Blocked dates",
          sub: blockedDates.length ? `${blockedDates.length} blocked` : "Days or times you can't shoot",
          onPress: () => openSection("blocked"),
        })}
      </View>
    </>
  );

  const renderHoursPage = () => renderPageScroll(
    <HoursEditor
      hours={hours}
      onChange={setHours}
      onSave={handleSaveHours}
      isSaving={saving}
      title="Weekly Schedule"
      description="Set your recurring working hours. These act as constraints for when clients can book you. You can block specific dates separately."
    />
  );

  const renderBlockedPage = () => renderPageScroll(
    <DateBlocker
      blockedDates={blockedDates}
      onAdd={handleAddBlockedDate}
      onRemove={handleRemoveBlockedDate}
      onSave={handleSaveBlockedDates}
      isSaving={saving}
    />
  );

  const renderPayoutsPage = () => renderPageScroll(
    <>
      <Text style={styles.sectionDesc}>
        {payoutsReady
          ? "Payouts are on. Open Stripe to see your balance and payout history."
          : "Connect your Stripe account to accept bookings and receive payments."}
      </Text>
      {stripeError ? (
        <View style={{ backgroundColor: "rgba(255,59,48,0.1)", padding: 10, borderRadius: 8, marginBottom: 12 }}>
          <Text style={{ color: "#FF3B30", fontSize: 13 }}>{stripeError}</Text>
        </View>
      ) : null}
      <View style={styles.hubCard}>
        {payoutsReady
          ? renderHubRow({
              first: true,
              icon: "dollar-sign",
              title: loadingPayoutLink ? "Opening Stripe..." : "Manage payouts",
              sub: "View your balance and payout history",
              onPress: () => { if (!loadingPayoutLink) handleManagePayouts(); },
            })
          : renderHubRow({
              first: true,
              icon: "link",
              title: connectingStripe ? "Opening Stripe..." : "Connect Stripe",
              sub: "Required to accept bookings and receive payments",
              tag: "Set up",
              onPress: () => { if (!connectingStripe) handleConnectStripe(); },
            })}
      </View>
    </>
  );

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }, { justifyContent: "flex-start", alignItems: "stretch" }]}>
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Feather name="arrow-left" size={24} color={theme.brandCream} />
          </Pressable>
        </View>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={theme.brandGold} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => (section === "hub" ? navigation.goBack() : goUp())}
          accessibilityRole="button"
          accessibilityLabel={
            section === "hub" || isEntryPage ? "Back" : `Back to ${SECTION_TITLES[PARENT[section] ?? "hub"]}`
          }
        >
          <Feather name="arrow-left" size={24} color={theme.brandCream} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {SECTION_TITLES[section]}
        </Text>
        {section === "hub" ? (
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>Photographer</Text>
          </View>
        ) : null}
      </View>

      {loadError ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>{loadError}</Text>
          <Pressable
            onPress={() => { setLoading(true); fetchData(); }}
            style={[styles.saveButton, { paddingHorizontal: 24 }]}
            accessibilityRole="button"
          >
            <Text style={styles.saveButtonText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {section === "hub" && renderHub()}
          {section === "services" && renderServicesPage()}
          {section === "branding" && renderBrandingPage()}
          {section === "profile" && renderProfilePage()}
          {section === "booking" && renderBookingPage()}
          {section === "hours" && renderHoursPage()}
          {section === "blocked" && renderBlockedPage()}
          {section === "payouts" && renderPayoutsPage()}
        </>
      )}

      <ServiceEditorModal
        visible={showServiceEditor}
        onClose={() => {
          setShowServiceEditor(false);
          setEditingService(null);
          setDepositServerError(null);
        }}
        onSave={handleSaveService}
        initialData={editingService}
        brandColor={profile?.profileTheme ? resolveBrandColor({ type: "custom", hex: profile.profileTheme }, isDark ? "dark" : "light") : theme.primary}
        depositMode="always"
        depositServerError={depositServerError}
        onClearDepositServerError={() => setDepositServerError(null)}
        onUploadImage={handleUploadServiceImage}
        fullScreen
        addons={{
          api: PHOTOGRAPHER_ADDONS_API,
          // Other services the photographer still offers: not archived, not
          // deleted, not contact-for-pricing (those can't have add-ons).
          copyTargets: rawServices
            .filter(
              (s) =>
                s.id !== editingService?.id &&
                s.status !== "archived" &&
                s.isActive !== false &&
                !s.isContactForPricing,
            )
            .map((s) => ({ id: s.id, name: s.name })),
          isContactForPricing: Boolean(
            rawServices.find((s) => s.id === editingService?.id)?.isContactForPricing,
          ),
        }}
      />
    </View>
  );
}
