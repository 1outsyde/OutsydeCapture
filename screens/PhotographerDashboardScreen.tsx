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
  Modal,
  TextInput,
  AppState,
  AppStateStatus,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import api, {
  PhotographerDashboardStats,
  PhotographerDashboardProfile,
  PhotographerBooking,
  PhotographerService,
  PhotographerHours,
  BlockedDate,
} from "@/services/api";
import { RootStackParamList } from "@/navigation/types";
import HoursEditor, { DayHours, getDefaultHours, convertTo24Hour, convertTo12Hour } from "@/components/HoursEditor";
import DateBlocker from "@/components/DateBlocker";
import ServiceEditorModal, { ServiceFormData } from "@/components/ServiceEditorModal";
import { VendorBookerPhotographerService } from "@/services/api";
import { uploadImageToCloudinary, uploadVideoToCloudinary } from "@/services/cloudinary";
import { useVideoPlayer, VideoView } from "expo-video";

const SPECIALTIES = [
  "Portraits", "Weddings", "Events", "Products",
  "Fashion", "Real Estate", "Concerts", "Sports",
];

const PROFILE_THEME_COLORS = [
  { name: "Default Gold", color: "#D4A84B" },
  { name: "Rose Pink", color: "#ec4899" },
  { name: "Ocean Blue", color: "#3b82f6" },
  { name: "Forest Green", color: "#22c55e" },
  { name: "Royal Purple", color: "#8b5cf6" },
  { name: "Sunset Orange", color: "#f97316" },
  { name: "Teal", color: "#14b8a6" },
  { name: "Slate Gray", color: "#64748b" },
];

type ModalType = "profile" | "hours" | "services" | "bookings" | "blocked" | null;

export default function PhotographerDashboardScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { getToken, logout, user, isLoading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);
  const hasFetchedRef = useRef(false);

  const [stats, setStats] = useState<PhotographerDashboardStats>({
    earnings: 0,
    upcomingBookings: 0,
    unreadMessages: 0,
    rating: 0,
    reviewCount: 0,
    profileViews: 0,
    completedShoots: 0,
  });
  const [profile, setProfile] = useState<PhotographerDashboardProfile | null>(null);
  const [rawPhotographer, setRawPhotographer] = useState<any>(null); // Store raw API response for accurate comparison
  const [bookings, setBookings] = useState<PhotographerBooking[]>([]);
  const [services, setServices] = useState<PhotographerService[]>([]);
  const [hours, setHours] = useState<DayHours[]>(getDefaultHours());
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);

  const [editProfile, setEditProfile] = useState({
    name: "",
    hourlyRate: "",
    bio: "",
    city: "",
    state: "",
    portfolioUrl: "",
    specialties: [] as string[],
    profileTheme: "#D4A84B",
    avatar: "" as string,
    bannerType: "color" as "color" | "image" | "video" | "mock",
    bannerImage: "" as string,
    bannerVideo: "" as string,
    bannerMock: "" as string,
  });

  const MOCK_BANNERS = [
    { id: "studio", label: "Studio", url: "https://images.unsplash.com/photo-1598128558393-70ff21433be0?w=800&q=80" },
    { id: "outdoor", label: "Outdoor", url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80" },
    { id: "urban", label: "Urban", url: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800&q=80" },
    { id: "nature", label: "Nature", url: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&q=80" },
    { id: "minimal", label: "Minimal", url: "https://images.unsplash.com/photo-1557683316-973673baf926?w=800&q=80" },
    { id: "creative", label: "Creative", url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80" },
  ];

  const VideoPreview = ({ uri }: { uri: string }) => {
    const player = useVideoPlayer(uri, (p) => {
      p.loop = true;
      p.muted = true;
      p.play();
    });

    return (
      <View style={{ flex: 1, position: "relative" }}>
        <VideoView
          player={player}
          style={{ flex: 1 }}
          contentFit="cover"
          nativeControls={false}
        />
        <View 
          style={{ 
            position: "absolute", 
            top: 4, 
            right: 4, 
            backgroundColor: "rgba(0,0,0,0.6)", 
            paddingHorizontal: 6, 
            paddingVertical: 2, 
            borderRadius: 4,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Feather name="video" size={10} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 10 }}>Video</Text>
        </View>
      </View>
    );
  };

  const [showServiceEditor, setShowServiceEditor] = useState(false);
  const [editingService, setEditingService] = useState<ServiceFormData | null>(null);
  const [rawServices, setRawServices] = useState<VendorBookerPhotographerService[]>([]);

  const fetchDashboard = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setAuthError("Please sign in to access your dashboard");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setAuthError(null);
      setNeedsProfileSetup(false);
      const photographer = await api.getPhotographerMe(token) as any;
      console.log("[Dashboard] Raw photographer from API:", JSON.stringify(photographer, null, 2));
      
      // Store raw response for accurate comparison in handleSaveProfile
      setRawPhotographer(photographer);
      
      setStats({
        earnings: photographer.totalEarnings || 0,
        upcomingBookings: 0,
        unreadMessages: 0,
        rating: photographer.rating || 0,
        reviewCount: photographer.reviewCount || 0,
        profileViews: 0,
        completedShoots: photographer.completedShoots || 0,
      });
      
      // Parse brandColors - handle both object and JSON string formats
      let brandColors: { primary?: string } = {};
      if (photographer.brandColors) {
        if (typeof photographer.brandColors === 'string') {
          try {
            brandColors = JSON.parse(photographer.brandColors);
          } catch {
            brandColors = {};
          }
        } else {
          brandColors = photographer.brandColors as { primary?: string };
        }
      }
      const originalTheme = brandColors.primary || "#D4A84B";
      
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
        profileTheme: originalTheme,
      });
      
      setEditProfile({
        name: photographer.displayName || "",
        hourlyRate: photographer.hourlyRate ? (photographer.hourlyRate / 100).toString() : "",
        bio: photographer.bio || "",
        city: photographer.city || "",
        state: photographer.state || "",
        portfolioUrl: photographer.portfolioUrl || "",
        specialties: photographer.specialties || [],
        profileTheme: originalTheme,
        avatar: photographer.logoImage || "",
        bannerType: photographer.coverImage ? "image" : "color",
        bannerImage: photographer.coverImage || "",
        bannerVideo: "",
        bannerMock: "",
      });

      try {
        const { bookings: bookingsData } = await api.getPhotographerMeBookings(token);
        setBookings(bookingsData.map((b: any) => ({
          id: b.id,
          clientName: b.customerName || b.clientName || "Client",
          clientAvatar: b.customerAvatar || b.clientAvatar,
          date: b.date,
          time: b.startTime || b.time,
          sessionType: b.serviceName || b.sessionType || "Session",
          status: b.status,
          amount: b.totalAmount ? b.totalAmount / 100 : (b.amount || 0),
        })));
      } catch {
        setBookings([]);
      }

      try {
        const { services: servicesData } = await api.getPhotographerMeServices(token);
        setRawServices(servicesData || []);
        setServices((servicesData || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          description: s.description || "",
          duration: s.estimatedDurationMinutes || s.durationMinutes || 60,
          price: s.priceCents ? s.priceCents / 100 : 0,
          isActive: s.status === "active",
          status: s.status || "draft",
          pricingModel: s.pricingModel || "package",
          category: s.category || "Other",
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
            const dayData = availabilityData.hoursOfOperation[dayName];
            if (dayData && !dayData.closed) {
              // Day is available (has open/close times and not marked closed)
              return {
                dayOfWeek: index,
                isAvailable: true,
                startTime: convertTo12Hour(dayData.open),
                endTime: convertTo12Hour(dayData.close),
              };
            }
            // Day is closed (either no data, or has closed: true flag)
            return {
              dayOfWeek: index,
              isAvailable: false,
              startTime: "9:00 AM",
              endTime: "5:00 PM",
            };
          });
          setHours(parsedHours);
        }
        if (availabilityData.blackoutDates && availabilityData.blackoutDates.length > 0) {
          setBlockedDates(availabilityData.blackoutDates.map((bd) => ({
            id: bd.id.toString(),
            date: bd.date,
            isFullDay: true,
            reason: bd.reason,
          })));
        }
      } catch {
        // Keep default hours and no blocked dates
      }

    } catch (error: any) {
      console.error("Failed to fetch photographer dashboard:", error);
      
      const status = error?.status || error?.response?.status;
      const message = error?.message || "";
      const is401 = status === 401 || message.includes("401") || message.toLowerCase().includes("unauthorized");
      const is404 = status === 404 || message.includes("404") || message.toLowerCase().includes("not found");
      
      if (is401) {
        setAuthError("Your session has expired. Please sign in again.");
        await logout();
        return;
      }
      
      if (is404) {
        // Profile doesn't exist yet in backend - use data from auth context
        // Don't block dashboard access, just show setup prompts
        console.log("[Dashboard] No photographer profile found (404), using user data from context");
        const defaultProfile = {
          id: "",
          name: user?.displayName || user?.firstName || "Photographer",
          hourlyRate: user?.hourlyRate ? user.hourlyRate / 100 : 0,
          bio: user?.bio,
          city: user?.city,
          state: user?.state,
          portfolioUrl: user?.portfolioUrl,
          specialties: user?.specialties || [],
          stripeConnected: false,
        };
        setProfile(defaultProfile);
        setEditProfile({
          name: defaultProfile.name,
          hourlyRate: defaultProfile.hourlyRate > 0 ? defaultProfile.hourlyRate.toString() : "",
          bio: defaultProfile.bio || "",
          city: defaultProfile.city || "",
          state: defaultProfile.state || "",
          portfolioUrl: defaultProfile.portfolioUrl || "",
          specialties: defaultProfile.specialties,
          profileTheme: "#D4A84B",
          avatar: "",
          bannerType: "color",
          bannerImage: "",
          bannerVideo: "",
          bannerMock: "",
        });
        // Don't set needsProfileSetup - allow dashboard access
      } else if (status === 403 || message.includes("403") || message.toLowerCase().includes("forbidden")) {
        setAuthError("You don't have permission to access this dashboard.");
      } else {
        // Other errors - still allow dashboard access with default data
        console.log("[Dashboard] Error fetching profile, using default data");
        setProfile({
          id: "",
          name: user?.displayName || user?.firstName || "Photographer",
          hourlyRate: user?.hourlyRate ? user.hourlyRate / 100 : 0,
          specialties: user?.specialties || [],
          stripeConnected: false,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [getToken, logout, user]);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      setAuthError("Please sign in to access your dashboard");
      setLoading(false);
      return;
    }
    
    if (user.role !== "photographer") {
      setAuthError("This dashboard is only available for photographers");
      setLoading(false);
      return;
    }
    
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchDashboard();
    }
  }, [authLoading, user?.id, user?.role]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboard();
    setRefreshing(false);
  };

  const [stripeError, setStripeError] = useState<string | null>(null);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  
  const STRIPE_RETURN_URL = "outsyde://stripe-return";
  
  const refreshStripeStatus = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    
    try {
      console.log("[Dashboard] Fetching fresh Stripe status...");
      const stripeStatus = await api.getPhotographerStripeStatus(token);
      console.log("[Dashboard] Stripe status response:", stripeStatus);
      
      const isConnected = stripeStatus.chargesEnabled && stripeStatus.payoutsEnabled;
      
      setProfile(prev => prev ? { ...prev, stripeConnected: isConnected } : prev);
      
      if (isConnected) {
        Alert.alert("Success", "Your Stripe account is now connected! You can start accepting bookings.");
      }
    } catch (error) {
      console.error("[Dashboard] Failed to fetch Stripe status:", error);
    }
  }, [getToken]);
  
  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      if (event.url.includes("stripe-return")) {
        console.log("[Dashboard] Stripe return deep link received, refreshing status...");
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
        console.log("[Dashboard] App came to foreground, checking Stripe status...");
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

  const handleSaveProfile = async () => {
    const token = await getToken();
    if (!token) return;

    try {
      setSaving(true);
      
      // Compare against RAW API response, not reconstructed profile state
      // Backend expects hourlyRate in DOLLARS (it converts to cents internally)
      const updateData: Record<string, any> = {};
      
      // Debug: Log what we're comparing
      console.log("[Dashboard] === SAVE PROFILE DEBUG ===");
      console.log("[Dashboard] editProfile:", JSON.stringify(editProfile, null, 2));
      console.log("[Dashboard] rawPhotographer:", JSON.stringify(rawPhotographer, null, 2));
      
      // Compare against raw API response values
      // Only filter out undefined and null - empty strings and 0 are valid values
      
      // displayName
      const currentName = editProfile.name ?? "";
      const originalName = rawPhotographer?.displayName ?? "";
      console.log(`[Dashboard] displayName: current="${currentName}" vs original="${originalName}"`);
      if (currentName !== originalName) {
        updateData.displayName = currentName;
      }
      
      // hourlyRate - raw API stores in cents, we display/edit in dollars
      const currentRate = parseFloat(editProfile.hourlyRate) || 0;
      const originalRateCents = rawPhotographer?.hourlyRate ?? 0;
      const originalRate = originalRateCents / 100;
      console.log(`[Dashboard] hourlyRate: current=${currentRate} vs original=${originalRate} (raw cents: ${originalRateCents})`);
      if (currentRate !== originalRate) {
        updateData.hourlyRate = currentRate; // Send in dollars
      }
      
      // bio
      const currentBio = editProfile.bio ?? "";
      const originalBio = rawPhotographer?.bio ?? "";
      console.log(`[Dashboard] bio: current="${currentBio}" vs original="${originalBio}"`);
      if (currentBio !== originalBio) {
        updateData.bio = currentBio;
      }
      
      // city
      const currentCity = editProfile.city ?? "";
      const originalCity = rawPhotographer?.city ?? "";
      console.log(`[Dashboard] city: current="${currentCity}" vs original="${originalCity}"`);
      if (currentCity !== originalCity) {
        updateData.city = currentCity;
      }
      
      // state
      const currentState = editProfile.state ?? "";
      const originalState = rawPhotographer?.state ?? "";
      console.log(`[Dashboard] state: current="${currentState}" vs original="${originalState}"`);
      if (currentState !== originalState) {
        updateData.state = currentState;
      }
      
      // portfolioUrl
      const currentPortfolioUrl = editProfile.portfolioUrl ?? "";
      const originalPortfolioUrl = rawPhotographer?.portfolioUrl ?? "";
      console.log(`[Dashboard] portfolioUrl: current="${currentPortfolioUrl}" vs original="${originalPortfolioUrl}"`);
      if (currentPortfolioUrl !== originalPortfolioUrl) {
        updateData.portfolioUrl = currentPortfolioUrl;
      }
      
      // specialties
      const currentSpecialties = editProfile.specialties || [];
      const originalSpecialties = rawPhotographer?.specialties || [];
      const currentSorted = [...currentSpecialties].sort();
      const originalSorted = [...originalSpecialties].sort();
      console.log(`[Dashboard] specialties: current=${JSON.stringify(currentSorted)} vs original=${JSON.stringify(originalSorted)}`);
      if (JSON.stringify(currentSorted) !== JSON.stringify(originalSorted)) {
        updateData.specialties = currentSpecialties;
      }
      
      // brandColors - parse raw value (could be object or string)
      const currentTheme = editProfile.profileTheme || "#D4A84B";
      let originalTheme = "#D4A84B";
      if (rawPhotographer?.brandColors) {
        if (typeof rawPhotographer.brandColors === 'string') {
          try {
            const parsed = JSON.parse(rawPhotographer.brandColors);
            originalTheme = parsed.primary || "#D4A84B";
          } catch {
            originalTheme = "#D4A84B";
          }
        } else if (rawPhotographer.brandColors.primary) {
          originalTheme = rawPhotographer.brandColors.primary;
        }
      }
      console.log(`[Dashboard] profileTheme: current="${currentTheme}" vs original="${originalTheme}"`);
      if (currentTheme !== originalTheme) {
        updateData.brandColors = { primary: currentTheme };
      }
      
      // logoImage (avatar)
      const currentAvatar = editProfile.avatar || "";
      const originalAvatar = rawPhotographer?.logoImage || "";
      console.log(`[Dashboard] avatar: current="${currentAvatar.slice(0, 50)}..." vs original="${originalAvatar.slice(0, 50)}..."`);
      if (currentAvatar && currentAvatar !== originalAvatar) {
        updateData.logoImage = currentAvatar;
      }
      
      // coverImage (banner) - determine based on banner type
      let finalBannerImage = "";
      if (editProfile.bannerType === "image" && editProfile.bannerImage) {
        finalBannerImage = editProfile.bannerImage;
      } else if (editProfile.bannerType === "mock" && editProfile.bannerMock) {
        finalBannerImage = editProfile.bannerMock;
      } else if (editProfile.bannerType === "video" && editProfile.bannerVideo) {
        finalBannerImage = editProfile.bannerVideo; // Store video URL in coverImage
      }
      // For "color" type, we leave coverImage empty and the profile theme is used
      
      const originalCover = rawPhotographer?.coverImage || "";
      console.log(`[Dashboard] coverImage: current="${finalBannerImage.slice(0, 50)}..." vs original="${originalCover.slice(0, 50)}..."`);
      if (finalBannerImage !== originalCover) {
        updateData.coverImage = finalBannerImage;
      }
      
      console.log("[Dashboard] === FINAL UPDATE DATA ===");
      console.log("[Dashboard] updateData:", JSON.stringify(updateData, null, 2));
      console.log("[Dashboard] updateData keys:", Object.keys(updateData));
      console.log("[Dashboard] updateData length:", Object.keys(updateData).length);
      
      // Check if any fields changed
      if (Object.keys(updateData).length === 0) {
        Alert.alert("No Changes", "No profile changes detected to save.");
        setSaving(false);
        return;
      }
      
      console.log("[Dashboard] Calling api.updatePhotographerMe with:", JSON.stringify(updateData, null, 2));
      
      await api.updatePhotographerMe(token, updateData);
      Alert.alert("Success", "Profile updated successfully");
      setActiveModal(null);
      fetchDashboard();
    } catch (error: any) {
      console.error("[Dashboard] Failed to save profile:", error);
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
      // Convert DayHours array to hoursOfOperation object for backend
      const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      const hoursOfOperation: Record<string, { open: string; close: string; closed?: boolean }> = {};
      
      hours.forEach((h) => {
        const dayName = dayNames[h.dayOfWeek];
        if (h.isAvailable) {
          hoursOfOperation[dayName] = { 
            open: convertTo24Hour(h.startTime), 
            close: convertTo24Hour(h.endTime) 
          };
        } else {
          // Backend requires { open: "00:00", close: "00:00", closed: true } for closed days
          hoursOfOperation[dayName] = { 
            open: "00:00", 
            close: "00:00", 
            closed: true 
          };
        }
      });
      
      await api.updatePhotographerMeAvailability(token, { hoursOfOperation });
      Alert.alert("Success", "Your availability has been updated");
      setActiveModal(null);
      fetchDashboard();
    } catch (error: any) {
      console.error("[Dashboard] Failed to save availability:", error);
      Alert.alert("Error", error.message || "Failed to save availability");
    } finally {
      setSaving(false);
    }
  };

  const handleAddBlockedDate = async (blockedDate: BlockedDate) => {
    const exists = blockedDates.some(b => b.date === blockedDate.date);
    if (exists) {
      Alert.alert("Already Blocked", "This date is already blocked.");
      return;
    }
    
    const token = await getToken();
    if (!token) return;
    
    try {
      setSaving(true);
      const result = await api.addPhotographerBlackoutDate(token, {
        date: blockedDate.date,
        reason: blockedDate.reason,
      });
      setBlockedDates(prev => [...prev, {
        id: result.blackoutDate.id.toString(),
        date: result.blackoutDate.date,
        isFullDay: true,
        reason: result.blackoutDate.reason,
      }]);
    } catch (error: any) {
      console.error("[Dashboard] Failed to add blocked date:", error);
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
        await api.removePhotographerBlackoutDate(token, parseInt(dateToRemove.id, 10));
        setBlockedDates(prev => prev.filter((_, i) => i !== index));
      } catch (error: any) {
        console.error("[Dashboard] Failed to remove blocked date:", error);
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
    setActiveModal(null);
  };

  const handleAddService = () => {
    setActiveModal(null); // Close services modal first to prevent freeze
    setEditingService(null);
    setTimeout(() => setShowServiceEditor(true), 100); // Small delay for modal transition
  };

  const handleEditService = (service: PhotographerService) => {
    const rawService = rawServices.find(s => s.id === service.id);
    setActiveModal(null); // Close services modal first to prevent freeze
    setEditingService({
      id: service.id,
      name: service.name,
      description: service.description || "",
      category: rawService?.category || "Other",
      pricingModel: (rawService?.pricingModel as "package" | "hourly") || "package",
      price: service.price.toString(),
      duration: service.duration.toString(),
      packageHours: rawService?.packageHours?.toString() || "",
      status: rawService?.status || "draft",
    });
    setTimeout(() => setShowServiceEditor(true), 100); // Small delay for modal transition
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
        priceCents: Math.round(parseFloat(data.price) * 100),
        estimatedDurationMinutes: parseInt(data.duration) || 60,
      };

      if (data.pricingModel === "hourly" && data.packageHours) {
        payload.packageHours = parseInt(data.packageHours);
      }

      if (data.id) {
        await api.updatePhotographerMeService(token, data.id, payload);
        Alert.alert("Success", "Service updated successfully");
      } else {
        await api.createPhotographerMeService(token, payload);
        Alert.alert("Success", "Service created successfully");
      }
      
      setShowServiceEditor(false);
      setEditingService(null);
      fetchDashboard();
    } catch (error: any) {
      console.error("[Dashboard] Failed to save service:", error);
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
              fetchDashboard();
            } catch (error: any) {
              console.error("[Dashboard] Failed to delete service:", error);
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
            
            try {
              await api.goLivePhotographerService(token, serviceId);
              Alert.alert("Success", "Service is now live!");
              fetchDashboard();
            } catch (error: any) {
              console.error("[Dashboard] Failed to publish service:", error);
              Alert.alert("Error", error.message || "Failed to publish service");
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
              fetchDashboard();
            } catch (error: any) {
              console.error("[Dashboard] Failed to archive service:", error);
              Alert.alert("Error", error.message || "Failed to archive service");
            }
          },
        },
      ]
    );
  };

  const toggleSpecialty = (specialty: string) => {
    setEditProfile(prev => ({
      ...prev,
      specialties: prev.specialties.includes(specialty)
        ? prev.specialties.filter(s => s !== specialty)
        : [...prev.specialties, specialty],
    }));
  };

  const handleBookingAction = async (bookingId: string, action: "confirm" | "cancel") => {
    const token = await getToken();
    if (!token) return;

    try {
      await api.updateBookingStatus(token, "photographer", bookingId, action === "confirm" ? "confirmed" : "cancelled");
      Alert.alert("Success", `Booking ${action}ed successfully`);
      fetchDashboard();
    } catch {
      Alert.alert("Error", `Failed to ${action} booking`);
    }
  };

  const handleLogout = () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log Out", style: "destructive", onPress: () => logout() },
    ]);
  };

  const hasAvailabilitySet = hours.some(h => h.isAvailable);
  const hasProfileDetails = Boolean(profile?.name && profile?.hourlyRate);
  const hasStripeConnected = profile?.stripeConnected;

  const profileSetupItems = [
    { 
      key: "profile", 
      label: "Profile details", 
      complete: hasProfileDetails,
      action: () => setActiveModal("profile"),
    },
    { 
      key: "availability", 
      label: "Availability", 
      complete: hasAvailabilitySet,
      action: () => setActiveModal("hours"),
    },
  ];

  const stripeSetupItem = { 
    key: "stripe", 
    label: "Connect Stripe", 
    complete: hasStripeConnected,
    action: handleConnectStripe,
    isOptional: true,
    description: hasStripeConnected ? "Connected" : "Required to accept bookings & receive payments",
  };

  const setupItems = [...profileSetupItems, stripeSetupItem];

  const profileComplete = profileSetupItems.every(item => item.complete);
  const allSetupComplete = profileComplete;
  const statusText = hasStripeConnected ? "Active" : (profileComplete ? "Ready (Stripe pending)" : "Pending Setup");
  const statusColor = allSetupComplete ? "#34C759" : "#FF9500";

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.backgroundRoot,
    },
    scrollContent: {
      paddingBottom: insets.bottom + 24,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop: insets.top + 16,
      paddingBottom: 20,
    },
    headerLeft: {
      flex: 1,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.text,
      letterSpacing: -0.5,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 6,
    },
    statusPill: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: statusColor + "20",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: statusColor,
      marginRight: 6,
    },
    statusText: {
      fontSize: 12,
      fontWeight: "600",
      color: statusColor,
    },
    backButton: {
      padding: 8,
      marginRight: 8,
    },
    logoutButton: {
      padding: 8,
    },
    section: {
      paddingHorizontal: 20,
      marginBottom: 24,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: "600",
      color: theme.text,
      letterSpacing: -0.3,
    },
    sectionSubtitle: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },
    setupCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: 16,
      padding: 20,
    },
    setupItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.border + "40",
    },
    setupItemLast: {
      borderBottomWidth: 0,
    },
    setupIcon: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 14,
    },
    setupIconComplete: {
      backgroundColor: "#34C75920",
    },
    setupIconIncomplete: {
      backgroundColor: theme.backgroundSecondary,
      borderWidth: 2,
      borderColor: theme.border,
    },
    setupLabel: {
      flex: 1,
      fontSize: 15,
      color: theme.text,
    },
    setupLabelComplete: {
      color: theme.textSecondary,
    },
    statsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
    },
    statCard: {
      width: "48%",
      backgroundColor: theme.backgroundDefault,
      borderRadius: 14,
      padding: 16,
    },
    statHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 10,
    },
    statIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 10,
    },
    statLabel: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    statValue: {
      fontSize: 26,
      fontWeight: "700",
      color: theme.text,
      letterSpacing: -0.5,
    },
    profileCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: 16,
      padding: 20,
    },
    profileHeader: {
      flexDirection: "row",
      alignItems: "center",
    },
    profileAvatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 16,
    },
    profileAvatarImage: {
      width: 64,
      height: 64,
      borderRadius: 32,
    },
    profileAvatarText: {
      fontSize: 24,
      fontWeight: "600",
      color: "#FFFFFF",
    },
    profileInfo: {
      flex: 1,
    },
    profileName: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.text,
    },
    profileRate: {
      fontSize: 14,
      color: theme.primary,
      fontWeight: "500",
      marginTop: 2,
    },
    profileLocation: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },
    profileBio: {
      fontSize: 14,
      color: theme.textSecondary,
      lineHeight: 20,
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: theme.border + "40",
    },
    editButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.primary,
      paddingVertical: 14,
      borderRadius: 12,
      marginTop: 20,
    },
    editButtonText: {
      fontSize: 15,
      fontWeight: "600",
      color: "#FFFFFF",
      marginLeft: 8,
    },
    quickActionsRow: {
      flexDirection: "row",
      gap: 12,
    },
    quickActionCard: {
      flex: 1,
      backgroundColor: theme.backgroundDefault,
      borderRadius: 14,
      padding: 16,
      alignItems: "center",
    },
    quickActionIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 10,
    },
    quickActionLabel: {
      fontSize: 13,
      fontWeight: "500",
      color: theme.text,
      textAlign: "center",
    },
    quickActionCount: {
      fontSize: 11,
      color: theme.textSecondary,
      marginTop: 2,
    },
    emptyCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: 14,
      padding: 24,
      alignItems: "center",
    },
    emptyIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.backgroundSecondary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },
    emptyText: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: "center",
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: theme.backgroundRoot,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: "90%",
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border + "40",
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.text,
    },
    modalCloseButton: {
      padding: 4,
    },
    modalScroll: {
      padding: 20,
    },
    formGroup: {
      marginBottom: 20,
    },
    formLabel: {
      fontSize: 13,
      fontWeight: "500",
      color: theme.textSecondary,
      marginBottom: 8,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    formInput: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: theme.text,
    },
    formTextarea: {
      minHeight: 100,
      textAlignVertical: "top",
    },
    formRow: {
      flexDirection: "row",
      gap: 12,
    },
    formHalf: {
      flex: 1,
    },
    specialtiesGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    specialtyChip: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: theme.backgroundDefault,
      borderWidth: 1,
      borderColor: theme.border,
    },
    specialtyChipActive: {
      backgroundColor: theme.primary + "20",
      borderColor: theme.primary,
    },
    specialtyChipText: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    specialtyChipTextActive: {
      color: theme.primary,
      fontWeight: "500",
    },
    saveButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.primary,
      paddingVertical: 16,
      borderRadius: 12,
      marginTop: 8,
      marginBottom: insets.bottom + 20,
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: "#FFFFFF",
      marginLeft: 8,
    },
    bookingCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: 14,
      padding: 16,
      marginBottom: 12,
    },
    bookingHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    bookingAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.primary + "30",
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    bookingAvatarText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.primary,
    },
    bookingInfo: {
      flex: 1,
    },
    bookingClient: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.text,
    },
    bookingService: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },
    bookingAmount: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.primary,
    },
    bookingDetails: {
      flexDirection: "row",
      alignItems: "center",
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.border + "30",
    },
    bookingDate: {
      flexDirection: "row",
      alignItems: "center",
      marginRight: 16,
    },
    bookingDateText: {
      fontSize: 13,
      color: theme.textSecondary,
      marginLeft: 6,
    },
    bookingActions: {
      flexDirection: "row",
      gap: 10,
      marginTop: 12,
    },
    bookingActionButton: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 8,
      alignItems: "center",
    },
    bookingConfirmButton: {
      backgroundColor: "#34C759",
    },
    bookingDeclineButton: {
      backgroundColor: theme.backgroundSecondary,
    },
    bookingActionText: {
      fontSize: 14,
      fontWeight: "600",
    },
    bookingStatusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6,
    },
    bookingStatusText: {
      fontSize: 12,
      fontWeight: "600",
      textTransform: "capitalize",
    },
    // Error screen styles
    errorContainer: {
      justifyContent: "center",
      alignItems: "center",
    },
    errorContent: {
      alignItems: "center",
      paddingHorizontal: 32,
      maxWidth: 320,
    },
    errorIconContainer: {
      width: 96,
      height: 96,
      borderRadius: 48,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 24,
    },
    errorTitle: {
      fontSize: 20,
      fontWeight: "700",
      textAlign: "center",
      marginBottom: 8,
    },
    errorMessage: {
      fontSize: 15,
      textAlign: "center",
      lineHeight: 22,
      marginBottom: 32,
    },
    errorActions: {
      flexDirection: "row",
      gap: 12,
    },
    errorButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 12,
    },
    errorButtonText: {
      fontSize: 15,
      fontWeight: "600",
      color: "#000",
    },
    errorButtonOutline: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
    },
    errorButtonOutlineText: {
      fontSize: 15,
      fontWeight: "600",
    },
    formHint: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
      marginBottom: 12,
    },
    themeColorGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
      marginBottom: 16,
    },
    themeColorPreset: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
    },
    themeColorPresetSelected: {
      borderWidth: 3,
      borderColor: "#fff",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 4,
    },
    themePreviewBar: {
      height: 8,
      borderRadius: 4,
    },
  });

  const renderProfileModal = () => (
    <Modal visible={activeModal === "profile"} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <Pressable style={{ flex: 1 }} onPress={() => setActiveModal(null)} />
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <Pressable onPress={() => setActiveModal(null)} style={styles.modalCloseButton}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>
          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {/* Banner Editor */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Profile Banner</Text>
              <Text style={styles.formHint}>Choose a banner style for your public profile</Text>
              
              {/* Banner Type Selector */}
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                {[
                  { type: "color" as const, label: "Color", icon: "droplet" as const },
                  { type: "image" as const, label: "Photo", icon: "image" as const },
                  { type: "video" as const, label: "Video", icon: "video" as const },
                  { type: "mock" as const, label: "Presets", icon: "grid" as const },
                ].map(opt => (
                  <Pressable
                    key={opt.type}
                    onPress={() => setEditProfile({ ...editProfile, bannerType: opt.type })}
                    style={{
                      flex: 1,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      paddingVertical: 10,
                      borderRadius: 8,
                      backgroundColor: editProfile.bannerType === opt.type ? theme.primary : theme.backgroundSecondary,
                    }}
                  >
                    <Feather name={opt.icon} size={14} color={editProfile.bannerType === opt.type ? "#000" : theme.text} />
                    <Text style={{ marginLeft: 4, fontSize: 12, fontWeight: "600", color: editProfile.bannerType === opt.type ? "#000" : theme.text }}>
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
                  backgroundColor: editProfile.profileTheme,
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <Text style={{ color: "#fff", fontSize: 13, opacity: 0.8 }}>Uses your profile theme color</Text>
                </View>
              )}

              {editProfile.bannerType === "image" && (
                <Pressable
                  onPress={async () => {
                    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                    if (status !== "granted") {
                      Alert.alert("Permission Required", "Please allow access to your photo library.");
                      return;
                    }
                    const result = await ImagePicker.launchImageLibraryAsync({
                      mediaTypes: ImagePicker.MediaTypeOptions.Images,
                      allowsEditing: true,
                      aspect: [16, 9],
                      quality: 0.8,
                    });
                    if (!result.canceled && result.assets[0]) {
                      try {
                        setEditProfile({ ...editProfile, bannerImage: result.assets[0].uri });
                        const cloudinaryUrl = await uploadImageToCloudinary(result.assets[0].uri, "banners");
                        setEditProfile(prev => ({ ...prev, bannerImage: cloudinaryUrl }));
                      } catch (error) {
                        console.error("[Dashboard] Banner upload failed:", error);
                        Alert.alert("Upload Failed", "Could not upload banner image. Please try again.");
                        setEditProfile(prev => ({ ...prev, bannerImage: "" }));
                      }
                    }
                  }}
                  style={{ 
                    height: 120, 
                    borderRadius: 12, 
                    backgroundColor: theme.backgroundSecondary,
                    overflow: "hidden",
                  }}
                >
                  {editProfile.bannerImage ? (
                    <Image source={{ uri: editProfile.bannerImage }} style={{ width: "100%", height: "100%" }} />
                  ) : (
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                      <Feather name="upload" size={24} color={theme.textSecondary} />
                      <Text style={{ color: theme.textSecondary, marginTop: 8, fontSize: 13 }}>Tap to upload banner photo</Text>
                    </View>
                  )}
                </Pressable>
              )}

              {editProfile.bannerType === "video" && (
                <Pressable
                  onPress={async () => {
                    if (uploadingVideo) return;
                    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                    if (status !== "granted") {
                      Alert.alert("Permission Required", "Please allow access to your photo library.");
                      return;
                    }
                    const result = await ImagePicker.launchImageLibraryAsync({
                      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
                      allowsEditing: true,
                      videoMaxDuration: 15,
                      quality: 0.8,
                    });
                    if (!result.canceled && result.assets[0]) {
                      const localUri = result.assets[0].uri;
                      setUploadingVideo(true);
                      try {
                        console.log("[Dashboard] Starting video upload to Cloudinary...");
                        const cloudinaryUrl = await uploadVideoToCloudinary(localUri, "banners");
                        console.log("[Dashboard] Video uploaded successfully:", cloudinaryUrl);
                        setEditProfile(prev => ({ ...prev, bannerVideo: cloudinaryUrl }));
                      } catch (error) {
                        console.error("[Dashboard] Video upload failed:", error);
                        Alert.alert("Upload Failed", "Could not upload banner video. Please try again.");
                        setEditProfile(prev => ({ ...prev, bannerVideo: "" }));
                      } finally {
                        setUploadingVideo(false);
                      }
                    }
                  }}
                  style={{ 
                    height: 120, 
                    borderRadius: 12, 
                    backgroundColor: theme.backgroundSecondary,
                    overflow: "hidden",
                  }}
                >
                  {uploadingVideo ? (
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                      <ActivityIndicator size="large" color={theme.primary} />
                      <Text style={{ color: theme.textSecondary, marginTop: 8, fontSize: 12 }}>Uploading video...</Text>
                    </View>
                  ) : editProfile.bannerVideo ? (
                    <VideoPreview uri={editProfile.bannerVideo} />
                  ) : (
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                      <Feather name="video" size={24} color={theme.textSecondary} />
                      <Text style={{ color: theme.textSecondary, marginTop: 8, fontSize: 13 }}>Tap to upload video (max 15s)</Text>
                    </View>
                  )}
                </Pressable>
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
                          borderColor: theme.primary,
                        }}
                      >
                        <Image source={{ uri: mock.url }} style={{ width: "100%", height: "100%" }} />
                        {editProfile.bannerMock === mock.url && (
                          <View style={{ position: "absolute", top: 4, right: 4, backgroundColor: theme.primary, borderRadius: 10, padding: 2 }}>
                            <Feather name="check" size={12} color="#000" />
                          </View>
                        )}
                      </Pressable>
                    ))}
                  </ScrollView>
                  <Text style={{ color: theme.textSecondary, fontSize: 11, marginTop: 8 }}>Swipe to see more preset banners</Text>
                </View>
              )}
            </View>

            {/* Profile Picture Editor */}
            <View style={[styles.formGroup, { alignItems: "center", marginBottom: 24 }]}>
              <Text style={[styles.formLabel, { textAlign: "center", marginBottom: 8 }]}>Profile Photo</Text>
              <Pressable
                onPress={async () => {
                  Alert.alert("Update Profile Photo", "Choose an option", [
                    {
                      text: "Take Photo",
                      onPress: async () => {
                        const { status } = await ImagePicker.requestCameraPermissionsAsync();
                        if (status !== "granted") {
                          Alert.alert("Permission Required", "Please allow camera access.");
                          return;
                        }
                        const result = await ImagePicker.launchCameraAsync({
                          allowsEditing: true,
                          aspect: [1, 1],
                          quality: 0.8,
                        });
                        if (!result.canceled && result.assets[0]) {
                          try {
                            setEditProfile(prev => ({ ...prev, avatar: result.assets[0].uri }));
                            const cloudinaryUrl = await uploadImageToCloudinary(result.assets[0].uri, "profiles");
                            setEditProfile(prev => ({ ...prev, avatar: cloudinaryUrl }));
                          } catch (error) {
                            console.error("[Dashboard] Profile photo upload failed:", error);
                            Alert.alert("Upload Failed", "Could not upload photo. Please try again.");
                            setEditProfile(prev => ({ ...prev, avatar: "" }));
                          }
                        }
                      },
                    },
                    {
                      text: "Choose from Library",
                      onPress: async () => {
                        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                        if (status !== "granted") {
                          Alert.alert("Permission Required", "Please allow photo library access.");
                          return;
                        }
                        const result = await ImagePicker.launchImageLibraryAsync({
                          mediaTypes: ImagePicker.MediaTypeOptions.Images,
                          allowsEditing: true,
                          aspect: [1, 1],
                          quality: 0.8,
                        });
                        if (!result.canceled && result.assets[0]) {
                          try {
                            setEditProfile(prev => ({ ...prev, avatar: result.assets[0].uri }));
                            const cloudinaryUrl = await uploadImageToCloudinary(result.assets[0].uri, "profiles");
                            setEditProfile(prev => ({ ...prev, avatar: cloudinaryUrl }));
                          } catch (error) {
                            console.error("[Dashboard] Profile photo upload failed:", error);
                            Alert.alert("Upload Failed", "Could not upload photo. Please try again.");
                            setEditProfile(prev => ({ ...prev, avatar: "" }));
                          }
                        }
                      },
                    },
                    { text: "Cancel", style: "cancel" },
                  ]);
                }}
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: 50,
                  backgroundColor: theme.backgroundSecondary,
                  overflow: "hidden",
                  borderWidth: 3,
                  borderColor: theme.primary,
                }}
              >
                {editProfile.avatar ? (
                  <Image source={{ uri: editProfile.avatar }} style={{ width: "100%", height: "100%" }} />
                ) : (
                  <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <Feather name="camera" size={28} color={theme.textSecondary} />
                  </View>
                )}
                <View style={{ 
                  position: "absolute", 
                  bottom: 0, 
                  right: 0, 
                  backgroundColor: theme.primary, 
                  borderRadius: 12, 
                  padding: 6,
                }}>
                  <Feather name="edit-2" size={12} color="#000" />
                </View>
              </Pressable>
              <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 8 }}>Tap to change photo</Text>
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, styles.formHalf]}>
                <Text style={styles.formLabel}>Display Name</Text>
                <TextInput
                  style={styles.formInput}
                  value={editProfile.name}
                  onChangeText={(text) => setEditProfile({ ...editProfile, name: text })}
                  placeholder="Your name"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
              <View style={[styles.formGroup, styles.formHalf]}>
                <Text style={styles.formLabel}>Hourly Rate ($)</Text>
                <TextInput
                  style={styles.formInput}
                  value={editProfile.hourlyRate}
                  onChangeText={(text) => setEditProfile({ ...editProfile, hourlyRate: text })}
                  placeholder="150"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Bio</Text>
              <TextInput
                style={[styles.formInput, styles.formTextarea]}
                value={editProfile.bio}
                onChangeText={(text) => setEditProfile({ ...editProfile, bio: text })}
                placeholder="Tell clients about yourself..."
                placeholderTextColor={theme.textSecondary}
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
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
              <View style={[styles.formGroup, styles.formHalf]}>
                <Text style={styles.formLabel}>State</Text>
                <TextInput
                  style={styles.formInput}
                  value={editProfile.state}
                  onChangeText={(text) => setEditProfile({ ...editProfile, state: text })}
                  placeholder="NY"
                  placeholderTextColor={theme.textSecondary}
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
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Specialties</Text>
              <View style={styles.specialtiesGrid}>
                {SPECIALTIES.map(specialty => (
                  <Pressable
                    key={specialty}
                    onPress={() => toggleSpecialty(specialty)}
                    style={[
                      styles.specialtyChip,
                      editProfile.specialties.includes(specialty) && styles.specialtyChipActive,
                    ]}
                  >
                    <Text style={[
                      styles.specialtyChipText,
                      editProfile.specialties.includes(specialty) && styles.specialtyChipTextActive,
                    ]}>
                      {specialty}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Profile Theme</Text>
              <Text style={styles.formHint}>Choose a color for your public profile</Text>
              <View style={styles.themeColorGrid}>
                {PROFILE_THEME_COLORS.map((preset) => (
                  <Pressable
                    key={preset.color}
                    style={[
                      styles.themeColorPreset,
                      { backgroundColor: preset.color },
                      editProfile.profileTheme === preset.color && styles.themeColorPresetSelected,
                    ]}
                    onPress={() => setEditProfile({ ...editProfile, profileTheme: preset.color })}
                  >
                    {editProfile.profileTheme === preset.color && (
                      <Feather name="check" size={16} color="#fff" />
                    )}
                  </Pressable>
                ))}
              </View>
              <View style={[styles.themePreviewBar, { backgroundColor: editProfile.profileTheme }]} />
            </View>

            <Pressable onPress={handleSaveProfile} style={styles.saveButton} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="check" size={18} color="#FFFFFF" />
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderHoursModal = () => (
    <Modal visible={activeModal === "hours"} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <Pressable style={{ flex: 1 }} onPress={() => setActiveModal(null)} />
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Base Availability</Text>
            <Pressable onPress={() => setActiveModal(null)} style={styles.modalCloseButton}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>
          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            <HoursEditor
              hours={hours}
              onChange={setHours}
              onSave={handleSaveHours}
              isSaving={saving}
              title="Weekly Schedule"
              description="Set your recurring working hours. These act as constraints for when clients can book you. You can block specific dates separately."
            />
            <View style={{ height: insets.bottom + 20 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderBlockedDatesModal = () => (
    <Modal visible={activeModal === "blocked"} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <Pressable style={{ flex: 1 }} onPress={() => setActiveModal(null)} />
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Block Dates</Text>
            <Pressable onPress={() => setActiveModal(null)} style={styles.modalCloseButton}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>
          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            <DateBlocker
              blockedDates={blockedDates}
              onAdd={handleAddBlockedDate}
              onRemove={handleRemoveBlockedDate}
              onSave={handleSaveBlockedDates}
              isSaving={saving}
            />
            <View style={{ height: insets.bottom + 20 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderBookingsModal = () => (
    <Modal visible={activeModal === "bookings"} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <Pressable style={{ flex: 1 }} onPress={() => setActiveModal(null)} />
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Bookings</Text>
            <Pressable onPress={() => setActiveModal(null)} style={styles.modalCloseButton}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>
          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {bookings.length === 0 ? (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIcon}>
                  <Feather name="calendar" size={24} color={theme.textSecondary} />
                </View>
                <Text style={styles.emptyText}>No bookings yet</Text>
              </View>
            ) : (
              bookings.map(booking => {
                const isPending = booking.status === "pending";
                const getStatusColor = (status: string) => {
                  switch (status) {
                    case "confirmed": return "#34C759";
                    case "pending": return "#FF9500";
                    case "cancelled": return "#FF3B30";
                    default: return theme.textSecondary;
                  }
                };
                return (
                  <View key={booking.id} style={styles.bookingCard}>
                    <View style={styles.bookingHeader}>
                      <View style={styles.bookingAvatar}>
                        <Text style={styles.bookingAvatarText}>
                          {booking.clientName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.bookingInfo}>
                        <Text style={styles.bookingClient}>{booking.clientName}</Text>
                        <Text style={styles.bookingService}>{booking.sessionType}</Text>
                      </View>
                      <Text style={styles.bookingAmount}>${booking.amount}</Text>
                    </View>
                    <View style={styles.bookingDetails}>
                      <View style={styles.bookingDate}>
                        <Feather name="calendar" size={14} color={theme.textSecondary} />
                        <Text style={styles.bookingDateText}>{booking.date}</Text>
                      </View>
                      <View style={styles.bookingDate}>
                        <Feather name="clock" size={14} color={theme.textSecondary} />
                        <Text style={styles.bookingDateText}>{booking.time}</Text>
                      </View>
                      <View style={[styles.bookingStatusBadge, { backgroundColor: getStatusColor(booking.status) + "20" }]}>
                        <Text style={[styles.bookingStatusText, { color: getStatusColor(booking.status) }]}>
                          {booking.status}
                        </Text>
                      </View>
                    </View>
                    {isPending && (
                      <View style={styles.bookingActions}>
                        <Pressable
                          onPress={() => handleBookingAction(booking.id, "confirm")}
                          style={[styles.bookingActionButton, styles.bookingConfirmButton]}
                        >
                          <Text style={[styles.bookingActionText, { color: "#FFFFFF" }]}>Accept</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => handleBookingAction(booking.id, "cancel")}
                          style={[styles.bookingActionButton, styles.bookingDeclineButton]}
                        >
                          <Text style={[styles.bookingActionText, { color: theme.text }]}>Decline</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })
            )}
            <View style={{ height: insets.bottom + 20 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const getServiceStatusColor = (status: string) => {
    switch (status) {
      case "active": return "#22c55e";
      case "draft": return "#f97316";
      case "archived": return "#64748b";
      default: return theme.textSecondary;
    }
  };

  const renderServicesModal = () => (
    <Modal visible={activeModal === "services"} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <Pressable style={{ flex: 1 }} onPress={() => setActiveModal(null)} />
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>My Services</Text>
            <Pressable onPress={() => setActiveModal(null)} style={styles.modalCloseButton}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>
          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
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
                        <Text style={styles.bookingDateText}>{service.duration} min</Text>
                      </View>
                      <View style={[styles.bookingDate, { marginLeft: 12 }]}>
                        <Feather name="tag" size={14} color={theme.textSecondary} />
                        <Text style={styles.bookingDateText}>{(service as any).category || "Other"}</Text>
                      </View>
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
                            style={{
                              flex: 1,
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: "#22c55e",
                              paddingVertical: 10,
                              borderRadius: 8,
                            }}
                          >
                            <Feather name="zap" size={16} color="#fff" />
                            <Text style={{ color: "#fff", fontWeight: "600", marginLeft: 6 }}>Go Live</Text>
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
                      ) : status === "active" ? (
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
            <View style={{ height: insets.bottom + 20 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const handleGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate("Main", { screen: "AccountTab", params: { screen: "Account" } });
    }
  };

  // Auth error screen with back navigation
  if (authError) {
    return (
      <View style={[styles.container, styles.errorContainer, { paddingTop: insets.top + 20 }]}>
        <View style={styles.errorContent}>
          <View style={[styles.errorIconContainer, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="alert-circle" size={48} color={theme.textSecondary} />
          </View>
          <Text style={[styles.errorTitle, { color: theme.text }]}>Unable to Load Dashboard</Text>
          <Text style={[styles.errorMessage, { color: theme.textSecondary }]}>{authError}</Text>
          <View style={styles.errorActions}>
            <Pressable
              style={[styles.errorButton, { backgroundColor: theme.primary }]}
              onPress={handleGoBack}
            >
              <Feather name="arrow-left" size={18} color="#000" />
              <Text style={styles.errorButtonText}>Go Back</Text>
            </Pressable>
            <Pressable
              style={[styles.errorButtonOutline, { borderColor: theme.border }]}
              onPress={() => {
                setAuthError(null);
                setLoading(true);
                fetchDashboard();
              }}
            >
              <Feather name="refresh-cw" size={18} color={theme.text} />
              <Text style={[styles.errorButtonOutlineText, { color: theme.text }]}>Try Again</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // Note: Removed the blocking needsProfileSetup screen
  // Dashboard now shows with whatever data is available, with setup prompts instead of blocking access

  if (loading || authLoading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleGoBack} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>{profile?.name || "Photographer"}</Text>
            <View style={styles.headerRow}>
              <View style={styles.statusPill}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>{statusText}</Text>
              </View>
            </View>
          </View>
          <Pressable onPress={handleLogout} style={styles.logoutButton}>
            <Feather name="log-out" size={22} color={theme.textSecondary} />
          </Pressable>
        </View>

        {/* Setup Progress - show if profile setup incomplete */}
        {!profileComplete && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Setup Progress</Text>
                <Text style={styles.sectionSubtitle}>Complete your profile to start receiving bookings</Text>
              </View>
            </View>
            <View style={styles.setupCard}>
              {profileSetupItems.map((item, index) => (
                <Pressable
                  key={item.key}
                  onPress={item.action}
                  style={[
                    styles.setupItem,
                    index === profileSetupItems.length - 1 && styles.setupItemLast,
                  ]}
                >
                  <View style={[
                    styles.setupIcon,
                    item.complete ? styles.setupIconComplete : styles.setupIconIncomplete,
                  ]}>
                    {item.complete ? (
                      <Feather name="check" size={14} color="#34C759" />
                    ) : null}
                  </View>
                  <Text style={[
                    styles.setupLabel,
                    item.complete && styles.setupLabelComplete,
                  ]}>
                    {item.label}
                  </Text>
                  <Feather name="chevron-right" size={18} color={theme.textSecondary} />
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Stripe Connect Banner - always show if not connected */}
        {!hasStripeConnected && (
          <View style={styles.section}>
            <View style={[styles.setupCard, { backgroundColor: theme.primary + "10", borderWidth: 1, borderColor: theme.primary + "30" }]}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                <Feather name="credit-card" size={24} color={theme.primary} />
                <Text style={[styles.sectionTitle, { marginLeft: 12, flex: 1 }]}>Connect Stripe</Text>
              </View>
              <Text style={{ color: theme.textSecondary, fontSize: 14, marginBottom: 16 }}>
                Connect your Stripe account to accept bookings and receive payments. Until connected, your profile won't be visible to clients.
              </Text>
              {stripeError && (
                <View style={{ backgroundColor: "#fee2e2", padding: 12, borderRadius: 8, marginBottom: 12 }}>
                  <Text style={{ color: "#b91c1c", fontSize: 14 }}>{stripeError}</Text>
                </View>
              )}
              <Pressable
                onPress={handleConnectStripe}
                disabled={connectingStripe}
                style={({ pressed }) => [{
                  backgroundColor: theme.primary,
                  paddingVertical: 14,
                  paddingHorizontal: 20,
                  borderRadius: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed || connectingStripe ? 0.7 : 1,
                }]}
              >
                {connectingStripe ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <>
                    <Feather name="link" size={18} color="#000" />
                    <Text style={{ color: "#000", fontWeight: "600", fontSize: 16, marginLeft: 8 }}>
                      Connect Stripe
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        )}

        {/* Stats Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={[styles.statsGrid, { marginTop: 12 }]}>
            <View style={styles.statCard}>
              <View style={styles.statHeader}>
                <View style={[styles.statIcon, { backgroundColor: theme.primary + "20" }]}>
                  <Feather name="dollar-sign" size={16} color={theme.primary} />
                </View>
                <Text style={styles.statLabel}>Earnings</Text>
              </View>
              <Text style={styles.statValue}>${stats.earnings}</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statHeader}>
                <View style={[styles.statIcon, { backgroundColor: "#34C75920" }]}>
                  <Feather name="calendar" size={16} color="#34C759" />
                </View>
                <Text style={styles.statLabel}>Bookings</Text>
              </View>
              <Text style={styles.statValue}>{stats.upcomingBookings}</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statHeader}>
                <View style={[styles.statIcon, { backgroundColor: "#007AFF20" }]}>
                  <Feather name="message-circle" size={16} color="#007AFF" />
                </View>
                <Text style={styles.statLabel}>Messages</Text>
              </View>
              <Text style={styles.statValue}>{stats.unreadMessages}</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statHeader}>
                <View style={[styles.statIcon, { backgroundColor: "#FF950020" }]}>
                  <Feather name="star" size={16} color="#FF9500" />
                </View>
                <Text style={styles.statLabel}>Rating</Text>
              </View>
              <Text style={styles.statValue}>{stats.rating > 0 ? stats.rating.toFixed(1) : "N/A"}</Text>
            </View>
          </View>
        </View>

        {/* Profile Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <View style={[styles.profileCard, { marginTop: 12 }]}>
            <View style={styles.profileHeader}>
              {profile?.avatar ? (
                <Image source={{ uri: profile.avatar }} style={styles.profileAvatarImage} />
              ) : (
                <View style={styles.profileAvatar}>
                  <Text style={styles.profileAvatarText}>
                    {profile?.name?.charAt(0)?.toUpperCase() || "P"}
                  </Text>
                </View>
              )}
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{profile?.name || "Your Name"}</Text>
                <Text style={styles.profileRate}>
                  {profile?.hourlyRate ? `$${profile.hourlyRate}/hour` : "Set your rate"}
                </Text>
                {profile?.city && profile?.state && (
                  <Text style={styles.profileLocation}>{profile.city}, {profile.state}</Text>
                )}
              </View>
            </View>
            {profile?.bio && (
              <Text style={styles.profileBio} numberOfLines={3}>{profile.bio}</Text>
            )}
            <Pressable onPress={() => setActiveModal("profile")} style={styles.editButton}>
              <Feather name="edit-2" size={16} color="#FFFFFF" />
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </Pressable>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={[styles.quickActionsRow, { marginTop: 12 }]}>
            <Pressable onPress={() => setActiveModal("bookings")} style={styles.quickActionCard}>
              <View style={[styles.quickActionIcon, { backgroundColor: "#34C75920" }]}>
                <Feather name="calendar" size={22} color="#34C759" />
              </View>
              <Text style={styles.quickActionLabel}>Bookings</Text>
              <Text style={styles.quickActionCount}>{bookings.length} total</Text>
            </Pressable>
            <Pressable onPress={() => setActiveModal("services")} style={styles.quickActionCard}>
              <View style={[styles.quickActionIcon, { backgroundColor: theme.primary + "20" }]}>
                <Feather name="camera" size={22} color={theme.primary} />
              </View>
              <Text style={styles.quickActionLabel}>Services</Text>
              <Text style={styles.quickActionCount}>{services.length} active</Text>
            </Pressable>
            <Pressable onPress={() => setActiveModal("hours")} style={styles.quickActionCard}>
              <View style={[styles.quickActionIcon, { backgroundColor: "#007AFF20" }]}>
                <Feather name="clock" size={22} color="#007AFF" />
              </View>
              <Text style={styles.quickActionLabel}>Base Hours</Text>
              <Text style={styles.quickActionCount}>
                {hasAvailabilitySet ? "Set" : "Not set"}
              </Text>
            </Pressable>
            <Pressable onPress={() => setActiveModal("blocked")} style={styles.quickActionCard}>
              <View style={[styles.quickActionIcon, { backgroundColor: "#FF3B3020" }]}>
                <Feather name="x-circle" size={22} color="#FF3B30" />
              </View>
              <Text style={styles.quickActionLabel}>Block Dates</Text>
              <Text style={styles.quickActionCount}>
                {blockedDates.length} blocked
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {renderProfileModal()}
      {renderHoursModal()}
      {renderBlockedDatesModal()}
      {renderBookingsModal()}
      {renderServicesModal()}

      <ServiceEditorModal
        visible={showServiceEditor}
        onClose={() => {
          setShowServiceEditor(false);
          setEditingService(null);
        }}
        onSave={handleSaveService}
        initialData={editingService}
        brandColor={profile?.profileTheme || theme.primary}
      />
    </>
  );
}
