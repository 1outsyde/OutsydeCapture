import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  Switch,
  FlatList,
  Image,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import {
  SOLID_COLOR_IDS,
  COLOR_VALUES,
  SolidColorId,
  parseBrandColorSpec,
} from "@/constants/colorOptions";
import api, {
  VendorBookerBusiness,
  VendorProduct,
  VendorService,
  VendorProductInput,
  VendorServiceInput,
  HoursOfOperationData,
  VendorEligibility,
} from "@/services/api";
import { RootStackParamList } from "@/navigation/types";
import HoursEditor, {
  DayHours,
  getDefaultHours,
  hoursArrayToObject,
  hoursObjectToArray,
  convertTo24Hour,
} from "@/components/HoursEditor";
import ImageUploader from "@/components/ImageUploader";
import MediaUploader from "@/components/MediaUploader";
import { uploadImage } from "@/services/mediaUpload";
import { availabilityEvents } from "@/services/availabilityEvents";
import { ScreenKeyboardAwareScrollView } from "@/components/ScreenKeyboardAwareScrollView";

type TabType = "branding" | "profile" | "hours" | "products" | "services";
type ResponseTimeUnit = "minutes" | "hours" | "business_days";

const RESPONSE_TIME_VALUES = [1, 2, 3, 4, 5, 10, 15, 20, 30, 45, 60];
const RESPONSE_TIME_UNITS: Array<{ label: string; value: ResponseTimeUnit }> = [
  { label: "Minutes", value: "minutes" },
  { label: "Hours", value: "hours" },
  { label: "Business Days", value: "business_days" },
];

// Swatches are driven by SOLID_COLOR_IDS from constants/colorOptions.ts.
// Each swatch's display hex is resolved per theme mode via COLOR_VALUES.

const SPECIALTY_OPTIONS = [
  "Fast Service",
  "Premium Quality",
  "Eco-Friendly",
  "Local Favorite",
  "Award Winning",
  "Family Owned",
  "Best Price",
  "Custom Orders",
];

export default function StorefrontEditorScreen() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { getToken } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>("branding");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [business, setBusiness] = useState<VendorBookerBusiness | null>(null);
  const [eligibility, setEligibility] = useState<VendorEligibility | null>(
    null,
  );
  const [products, setProducts] = useState<VendorProduct[]>([]);
  const [services, setServices] = useState<VendorService[]>([]);
  const [hours, setHours] = useState<DayHours[]>(getDefaultHours());

  const [coverImage, setCoverImage] = useState("");
  const [coverVideo, setCoverVideo] = useState("");
  const [coverMediaType, setCoverMediaType] = useState<
    "image" | "video" | null
  >(null);
  const [logoImage, setLogoImage] = useState("");
  const [selectedColorId, setSelectedColorId] = useState<string>("sunset_gold");

  const [profileName, setProfileName] = useState("");
  const [profileTagline, setProfileTagline] = useState("");
  const [profileDescription, setProfileDescription] = useState("");
  const [profileSpecialties, setProfileSpecialties] = useState<string[]>([]);
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileWebsite, setProfileWebsite] = useState("");
  const [showResponseTime, setShowResponseTime] = useState(true);
  const [showEmail, setShowEmail] = useState(true);
  const [showPhone, setShowPhone] = useState(true);
  const [showWebsite, setShowWebsite] = useState(true);
  const [showStoreHours, setShowStoreHours] = useState(true);
  const [hasPhysicalLocation, setHasPhysicalLocation] = useState(true);
  const [showAddress, setShowAddress] = useState(true);
  const [defaultServiceLocationType, setDefaultServiceLocationType] = useState('business');
  const [vendorTermsAndConditions, setVendorTermsAndConditions] = useState("");
  const [responseTimeValue, setResponseTimeValue] = useState(2);
  const [responseTimeUnit, setResponseTimeUnit] =
    useState<ResponseTimeUnit>("hours");
  const [responseValueDropdownOpen, setResponseValueDropdownOpen] =
    useState(false);
  const [responseUnitDropdownOpen, setResponseUnitDropdownOpen] =
    useState(false);
  const [profileAddress, setProfileAddress] = useState("");
  const [profileCity, setProfileCity] = useState("");
  const [profileState, setProfileState] = useState("");
  const [profileZip, setProfileZip] = useState("");

  const approvalStatus = business?.approvalStatus || "pending";

  const canPublishProducts = eligibility
    ? Boolean(eligibility.canPublishProducts)
    : Boolean(
        business?.stripeOnboardingComplete &&
          business?.subscriptionActive &&
          approvalStatus === "approved",
      );

  const canPublishServices = eligibility
    ? Boolean(eligibility.canPublishServices)
    : Boolean(
        business?.stripeOnboardingComplete &&
          business?.subscriptionActive &&
          approvalStatus === "approved",
      );

  const canPublish = canPublishProducts || canPublishServices;

  const getPublishBlockerMessage = (
    errorBody?: Record<string, any>,
  ): string => {
    const reasons: string[] = [];
    const reqApproval =
      errorBody?.requiresApproval ??
      eligibility?.requiresApproval ??
      approvalStatus !== "approved";
    const reqSubscription =
      errorBody?.requiresSubscription ??
      eligibility?.requiresSubscription ??
      !business?.subscriptionActive;
    const reqOnboarding =
      errorBody?.requiresOnboarding ??
      eligibility?.requiresOnboarding ??
      !business?.stripeOnboardingComplete;

    if (reqApproval) {
      reasons.push(`Storefront approval (currently ${approvalStatus})`);
    }
    if (reqOnboarding) {
      reasons.push("Stripe payment setup (not complete)");
    }
    if (reqSubscription) {
      reasons.push("Active subscription (not active)");
    }
    if (reasons.length === 0) {
      reasons.push("Your account does not meet the requirements to publish.");
    }
    return (
      "To go live, you still need:\n\n" +
      reasons.map((r) => `- ${r}`).join("\n")
    );
  };

  const getGoLiveFailureAlert = (
    error: any,
    itemLabel: "service" | "product",
  ): { title: string; message: string } => {
    const blockerMessage = getPublishBlockerMessage(error?.body);
    const code = error?.body?.code;
    const hasActionableFlags =
      error?.body?.requiresApproval ||
      error?.body?.requiresOnboarding ||
      error?.body?.requiresSubscription;

    if (
      blockerMessage?.trim() &&
      (hasActionableFlags ||
        (code !== "connect_incomplete" && code !== "subscription_inactive"))
    ) {
      return { title: "Cannot Publish", message: blockerMessage };
    }

    if (code === "connect_incomplete") {
      return {
        title: "Cannot Publish",
        message: "Complete Stripe setup before publishing.",
      };
    }
    if (code === "subscription_inactive") {
      return {
        title: "Cannot Publish",
        message: "Your subscription is inactive. Reactivate your subscription to publish.",
      };
    }

    return {
      title: "Saved as Draft",
      message: `Your ${itemLabel} was saved, but could not be published right now. You can try Go Live again from your ${itemLabel} list.`,
    };
  };

  const completeSaveSuccess = (
    itemLabel: "service" | "product",
    isEdit: boolean,
    closeModal: () => void,
  ) => {
    closeModal();
    fetchData();
    Alert.alert(
      "Success",
      isEdit ? `${itemLabel === "service" ? "Service" : "Product"} updated` : `${itemLabel === "service" ? "Service" : "Product"} created`,
    );
  };

  const [productModalVisible, setProductModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<VendorProduct | null>(
    null,
  );
  const [priceInput, setPriceInput] = useState("");
  const [productForm, setProductForm] = useState<VendorProductInput>({
    name: "",
    description: "",
    priceCents: 0,
    imageUrl: "",
    inventory: 0,
    status: "draft",
  });

  const [serviceModalVisible, setServiceModalVisible] = useState(false);
  const [editingService, setEditingService] = useState<VendorService | null>(
    null,
  );
  const [serviceForm, setServiceForm] = useState<VendorServiceInput>({
    name: "",
    description: "",
    priceCents: 0,
    durationMinutes: 60,
    status: "draft",
    fullRefundWindow: undefined,
    hasPartialRefund: false,
    partialRefundWindow: undefined,
    partialRefundPercentage: null,
    hasCancellationFee: false,
    cancellationFeeType: null,
    cancellationFeeAmount: null,
    serviceLocationType: 'business',
    alternateAddress: null,
    alternateCity: null,
    alternateState: null,
    alternateZipCode: null,
    virtualLink: null,
  });

  const fetchData = useCallback(async () => {
    const token = await getToken();
    if (!token) return;

    try {
      setLoading(true);
      const [businessRes, productsRes, servicesRes, eligibilityRes] =
        await Promise.all([
          api.getVendorMyBusiness(token),
          api.getVendorProducts(token).catch(() => ({ products: [] })),
          api.getVendorServices(token).catch(() => ({ services: [] })),
          api.getVendorEligibility(token).catch(() => null),
        ]);

      if (eligibilityRes) setEligibility(eligibilityRes);

      const biz = businessRes.business;
      setBusiness(biz);

      const normalizeProduct = (p: any): VendorProduct => ({
        ...p,
        priceCents:
          Number.isFinite(Number(p.priceCents)) && p.priceCents > 0
            ? Number(p.priceCents)
            : Number.isFinite(Number(p.price)) && p.price > 0
              ? Number(p.price)
              : 0,
      });
      const normalizeService = (s: any): VendorService => ({
        ...s,
        priceCents:
          Number.isFinite(Number(s.priceCents)) && s.priceCents > 0
            ? Number(s.priceCents)
            : Number.isFinite(Number(s.price)) && s.price > 0
              ? Number(s.price)
              : 0,
      });

      setProducts((productsRes.products || []).map(normalizeProduct));
      setServices((servicesRes.services || []).map(normalizeService));

      const isVideo = biz.coverMediaType === "video";
      if (isVideo) {
        setCoverVideo(biz.coverImage || "");
        setCoverImage("");
        setCoverMediaType("video");
      } else {
        setCoverImage(biz.coverImage || "");
        setCoverVideo("");
        setCoverMediaType(biz.coverImage ? "image" : null);
      }
      setLogoImage(biz.logoImage || "");
      const parsedBrandColors = parseBrandColorSpec(biz.brandColors);
      setSelectedColorId(
        parsedBrandColors?.type === "solid" && parsedBrandColors.id
          ? parsedBrandColors.id
          : "sunset_gold",
      );

      setProfileName(biz.name || "");
      setProfileTagline(biz.tagline || "");
      setProfileDescription(biz.description || "");
      setProfileEmail(biz.contactEmail || "");
      setProfilePhone(biz.contactPhone || "");
      setProfileWebsite(biz.websiteUrl || "");
      setShowResponseTime((biz as any).showResponseTime !== false);
      setShowEmail((biz as any).showEmail !== false);
      setShowPhone((biz as any).showPhone !== false);
      setShowWebsite((biz as any).showWebsite !== false);
      setShowStoreHours((biz as any).showStoreHours !== false);
      setHasPhysicalLocation((biz as any).hasPhysicalLocation !== false);
      setShowAddress((biz as any).showAddress !== false);
      setDefaultServiceLocationType((biz as any).defaultServiceLocationType || 'business');
      setVendorTermsAndConditions((biz as any).vendorTermsAndConditions || "");
      setResponseTimeValue(Number((biz as any).responseTimeValue ?? 2));
      setResponseTimeUnit(
        ((biz as any).responseTimeUnit || "hours") as ResponseTimeUnit,
      );
      setProfileAddress(biz.address || "");
      setProfileCity(biz.city || "");
      setProfileState(biz.state || "");

      if (biz.hoursOfOperation) {
        try {
          const hoursData =
            typeof biz.hoursOfOperation === "string"
              ? JSON.parse(biz.hoursOfOperation)
              : biz.hoursOfOperation;
          setHours(hoursObjectToArray(hoursData));
        } catch {
          setHours(getDefaultHours());
        }
      }
    } catch (error) {
      console.error("Failed to fetch storefront data:", error);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleSaveBranding = async () => {
    const token = await getToken();
    if (!token) return;

    try {
      setSaving(true);
      const brandColorsPayload = { type: "solid", id: selectedColorId };
      const finalCoverImage =
        coverMediaType === "video" ? coverVideo : coverImage;
      const finalCoverMediaType =
        coverMediaType || (coverImage ? "image" : undefined);
      console.log("[Storefront] Saving branding:", {
        brandColors: brandColorsPayload,
        coverImage: finalCoverImage,
        coverMediaType: finalCoverMediaType,
        logoImage,
      });
      await api.updateVendorMyBusiness(token, {
        brandColors: brandColorsPayload as any,
        coverImage: finalCoverImage || undefined,
        coverMediaType: finalCoverMediaType,
        logoImage: logoImage || undefined,
      });
      Alert.alert("Success", "Branding updated successfully");
    } catch (error: any) {
      console.error("[Storefront] Failed to save branding:", error);
      Alert.alert("Error", error.message || "Failed to save branding");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    const token = await getToken();
    if (!token) return;

    try {
      setSaving(true);
      const profileData: Record<string, any> = {
        name: profileName || undefined,
        tagline: profileTagline || undefined,
        description: profileDescription || undefined,
        contactEmail: profileEmail || undefined,
        contactPhone: profilePhone || undefined,
        websiteUrl: profileWebsite || undefined,
        showResponseTime,
        showEmail,
        showPhone,
        showWebsite,
        showStoreHours,
        hasPhysicalLocation,
        showAddress,
        defaultServiceLocationType,
        vendorTermsAndConditions: vendorTermsAndConditions || undefined,
        responseTimeValue,
        responseTimeUnit,
        address: profileAddress || undefined,
        city: profileCity || undefined,
        state: profileState || undefined,
      };
      console.log("[Storefront] Saving profile:", profileData);
      await api.updateVendorMyBusiness(token, profileData);
      Alert.alert("Success", "Profile updated successfully");
      fetchData();
    } catch (error: any) {
      console.error("[Storefront] Failed to save profile:", error);
      Alert.alert("Error", error.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveHours = async () => {
    const token = await getToken();
    if (!token) return;

    try {
      setSaving(true);

      // Convert DayHours to WeeklyAvailabilitySlot format for weekly_availability table
      const slots = hours
        .filter((h) => h.isAvailable)
        .map((h) => ({
          dayOfWeek: h.dayOfWeek,
          startTime: convertTo24Hour(h.startTime),
          endTime: convertTo24Hour(h.endTime),
          isActive: true,
        }));

      console.log(
        "[Storefront] Saving weekly availability:",
        JSON.stringify(slots, null, 2),
      );

      // Save to weekly_availability table (primary source of truth)
      await api.updateWeeklyAvailability(token, "business", slots);

      // DUAL-SYNC: Also update hoursOfOperation for legacy banner UI support
      // This is transitional - banner should eventually read from weekly_availability directly
      // Use hoursArrayToObject to produce the { open, close, closed } shape that
      // hoursObjectToArray (the reader) expects, matching HoursOfOperation interface.
      const hoursOfOperation = hoursArrayToObject(hours);
      console.log(
        "[Storefront] Syncing hoursOfOperation for banner:",
        JSON.stringify(hoursOfOperation, null, 2),
      );
      try {
        await api.updateVendorMyBusiness(token, { hoursOfOperation });
        console.log("[Storefront] hoursOfOperation synced successfully");
      } catch (syncError) {
        console.warn(
          "[Storefront] Failed to sync hoursOfOperation (non-blocking):",
          syncError,
        );
      }

      // Emit availability changed event so other screens can refresh
      availabilityEvents.emit();

      Alert.alert("Success", "Business hours updated successfully");
    } catch (error: any) {
      console.error("[Storefront] Failed to save hours:", error);
      Alert.alert("Error", error.message || "Failed to save hours");
    } finally {
      setSaving(false);
    }
  };

  const openProductForm = (product?: VendorProduct) => {
    if (product) {
      setEditingProduct(product);
      const rawProduct = product as any;
      const centValue: number =
        Number.isFinite(Number(product.priceCents)) && product.priceCents > 0
          ? product.priceCents
          : Number.isFinite(Number(rawProduct.price)) && rawProduct.price > 0
            ? Number(rawProduct.price)
            : 0;
      setPriceInput(centValue > 0 ? (centValue / 100).toFixed(2) : "");
      setProductForm({
        name: product.name,
        description: product.description || "",
        priceCents: centValue,
        imageUrl: product.imageUrl || "",
        inventory: product.inventory ?? 0,
        status: product.status,
      });
    } else {
      setEditingProduct(null);
      setPriceInput("");
      setProductForm({
        name: "",
        description: "",
        priceCents: 0,
        imageUrl: "",
        inventory: 0,
        status: "draft",
      });
    }
    setProductModalVisible(true);
  };

  const handleSaveProduct = async () => {
    const token = await getToken();
    if (!token) return;

    if (!productForm.name.trim()) {
      Alert.alert("Error", "Product name is required");
      return;
    }

    const parsedDollars = parseFloat(priceInput.trim());
    if (
      !priceInput.trim() ||
      !Number.isFinite(parsedDollars) ||
      parsedDollars < 7
    ) {
      Alert.alert("Invalid Price", "Price must be at least $7.00");
      return;
    }
    const priceCentsValue = Math.round(parsedDollars * 100);

    const rawInventory = productForm.inventory;
    const inventoryValue =
      rawInventory === undefined ||
      rawInventory === null ||
      isNaN(Number(rawInventory))
        ? 0
        : Math.max(0, Math.floor(Number(rawInventory)));

    const payload: typeof productForm = {
      ...productForm,
      priceCents: priceCentsValue,
      inventory: inventoryValue,
    };

    if (payload.status === "live" && !canPublishProducts) {
      Alert.alert("Cannot Publish", getPublishBlockerMessage());
      setProductForm((prev) => ({
        ...prev,
        status: editingProduct?.status || "draft",
      }));
      fetchData();
      return;
    }

    console.log("[handleSaveProduct] payload:", JSON.stringify(payload));

    const shouldGoLive = productForm.status === "live";

    try {
      setSaving(true);
      let productId: string;
      if (editingProduct) {
        await api.updateVendorProduct(token, editingProduct.id, payload);
        productId = editingProduct.id;
      } else {
        const response = await api.createVendorProduct(token, payload);
        productId = response.product.id;
      }

      if (!shouldGoLive) {
        completeSaveSuccess("product", Boolean(editingProduct), () =>
          setProductModalVisible(false),
        );
        return;
      }

      try {
        await api.goLiveVendorProduct(token, productId);
        completeSaveSuccess("product", Boolean(editingProduct), () =>
          setProductModalVisible(false),
        );
      } catch (goLiveError: any) {
        const { title, message } = getGoLiveFailureAlert(goLiveError, "product");
        setProductModalVisible(false);
        fetchData();
        Alert.alert(title, message);
      }
    } catch (error: any) {
      if (error.status === 403) {
        Alert.alert("Cannot Publish", getPublishBlockerMessage(error.body));
      } else {
        Alert.alert("Error", error.message || "Failed to save product");
      }
      setProductForm((prev) => ({
        ...prev,
        status: editingProduct?.status || "draft",
      }));
      fetchData();
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    Alert.alert(
      "Delete Product",
      "Are you sure you want to delete this product?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const token = await getToken();
            if (!token) return;

            try {
              await api.deleteVendorProduct(token, productId);
              fetchData();
              Alert.alert("Success", "Product deleted");
            } catch (error: any) {
              Alert.alert("Error", error.message || "Failed to delete product");
            }
          },
        },
      ],
    );
  };

  const openServiceForm = (service?: VendorService) => {
    if (service) {
      const s = service as any;
      setEditingService(service);
      setServiceForm({
        name: service.name,
        description: service.description || "",
        priceCents: service.priceCents,
        durationMinutes: service.durationMinutes || 60,
        status: service.status,
        fullRefundWindow: s.fullRefundWindow ?? undefined,
        hasPartialRefund: s.hasPartialRefund ?? false,
        partialRefundWindow: s.partialRefundWindow ?? undefined,
        partialRefundPercentage: s.partialRefundPercentage ?? null,
        hasCancellationFee: s.hasCancellationFee ?? false,
        cancellationFeeType: s.cancellationFeeType ?? null,
        cancellationFeeAmount: s.cancellationFeeAmount ?? null,
        serviceLocationType: s.serviceLocationType ?? 'business',
        alternateAddress: s.alternateAddress ?? null,
        alternateCity: s.alternateCity ?? null,
        alternateState: s.alternateState ?? null,
        alternateZipCode: s.alternateZipCode ?? null,
        virtualLink: s.virtualLink ?? null,
      });
    } else {
      const biz = business as any;
      setEditingService(null);
      setServiceForm({
        name: "",
        description: "",
        priceCents: 0,
        durationMinutes: 60,
        status: "draft",
        fullRefundWindow: biz?.fullRefundWindow ?? undefined,
        hasPartialRefund: biz?.hasPartialRefund ?? false,
        partialRefundWindow: biz?.partialRefundWindow ?? undefined,
        partialRefundPercentage: biz?.partialRefundPercentage ?? null,
        hasCancellationFee: biz?.hasCancellationFee ?? false,
        cancellationFeeType: biz?.cancellationFeeType ?? null,
        cancellationFeeAmount: biz?.cancellationFeeAmount ?? null,
        serviceLocationType: 'business',
        alternateAddress: null,
        alternateCity: null,
        alternateState: null,
        alternateZipCode: null,
        virtualLink: null,
      });
    }
    setServiceModalVisible(true);
  };

  const handleSaveService = async () => {
    const token = await getToken();
    if (!token) return;

    if (!serviceForm.name.trim()) {
      Alert.alert("Error", "Service name is required");
      return;
    }

    if (!serviceForm.priceCents || serviceForm.priceCents < 700) {
      Alert.alert("Invalid Price", "Price must be at least $7.00");
      return;
    }

    if (serviceForm.status === "live" && !canPublishServices) {
      Alert.alert("Cannot Publish", getPublishBlockerMessage());
      setServiceForm({
        ...serviceForm,
        status: editingService?.status || "draft",
      });
      fetchData();
      return;
    }

    const shouldGoLive = serviceForm.status === "live";

    try {
      setSaving(true);
      let serviceId: string;
      if (editingService) {
        await api.updateVendorService(token, editingService.id, serviceForm);
        serviceId = editingService.id;
      } else {
        const response = await api.createVendorService(token, serviceForm);
        serviceId = response.service.id;
      }

      if (!shouldGoLive) {
        completeSaveSuccess("service", Boolean(editingService), () =>
          setServiceModalVisible(false),
        );
        return;
      }

      try {
        await api.goLiveVendorService(token, serviceId);
        completeSaveSuccess("service", Boolean(editingService), () =>
          setServiceModalVisible(false),
        );
      } catch (goLiveError: any) {
        const { title, message } = getGoLiveFailureAlert(goLiveError, "service");
        setServiceModalVisible(false);
        fetchData();
        Alert.alert(title, message);
      }
    } catch (error: any) {
      if (error.status === 403) {
        Alert.alert("Cannot Publish", getPublishBlockerMessage(error.body));
      } else {
        Alert.alert("Error", error.message || "Failed to save service");
      }
      setServiceForm({
        ...serviceForm,
        status: editingService?.status || "draft",
      });
      fetchData();
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    Alert.alert(
      "Delete Service",
      "Are you sure you want to delete this service?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const token = await getToken();
            if (!token) return;

            try {
              await api.deleteVendorService(token, serviceId);
              fetchData();
              Alert.alert("Success", "Service deleted");
            } catch (error: any) {
              Alert.alert("Error", error.message || "Failed to delete service");
            }
          },
        },
      ],
    );
  };

  const handleLogoImageSelected = async (uri: string) => {
    const token = await getToken();
    if (!token) {
      Alert.alert("Error", "Authentication required. Please log in again.");
      return;
    }
    try {
      setSaving(true);
      const result = await uploadImage(uri, "image/jpeg", "logos", token);
      setLogoImage(result.url);
    } catch (error: any) {
      Alert.alert("Upload Error", error.message || "Failed to upload logo image");
    } finally {
      setSaving(false);
    }
  };

  const handleProductImageSelected = async (uri: string) => {
    const token = await getToken();
    if (!token) {
      Alert.alert("Error", "Authentication required. Please log in again.");
      return;
    }
    try {
      setSaving(true);
      const result = await uploadImage(uri, "image/jpeg", "products", token);
      setProductForm((prev) => ({ ...prev, imageUrl: result.url }));
    } catch (error: any) {
      Alert.alert("Upload Error", error.message || "Failed to upload product image");
    } finally {
      setSaving(false);
    }
  };

  const formatPrice = (cents: number | null | undefined) => {
    const n = Number(cents);
    if (!isFinite(n)) return "$0.00";
    return `$${(n / 100).toFixed(2)}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "live":
        return theme.brandSuccess;
      case "draft":
        return theme.brandPending;
      case "paused":
        return theme.brandError;
      case "archived":
        return theme.brandTextDim;
      default:
        return theme.brandTextDim;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "live":
        return "Live";
      case "draft":
        return "Draft";
      case "paused":
        return "Paused";
      case "archived":
        return "Archived";
      default:
        return status;
    }
  };

  const getStatusExplanation = (status: string) => {
    if (status === "paused") {
      return "Subscription inactive - reactivate to publish";
    }
    return null;
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.brandBg,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: insets.top + 8,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.brandSurfaceBorder,
    },
    backButton: {
      padding: 8,
      marginRight: 8,
    },
    headerTitle: {
      flex: 1,
      fontSize: 20,
      fontWeight: "700",
      color: theme.brandCream,
    },
    categoryBadge: {
      backgroundColor: theme.brandSurface,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    categoryText: {
      fontSize: 12,
      color: theme.brandTextDim,
    },
    tabContainer: {
      flexDirection: "row",
      paddingHorizontal: 8,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.brandSurfaceBorder,
    },
    tab: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 8,
      borderRadius: 8,
      marginHorizontal: 2,
    },
    tabActive: {
      backgroundColor: theme.brandGold,
    },
    tabText: {
      fontSize: 11,
      color: theme.brandTextDim,
      marginTop: 4,
    },
    tabTextActive: {
      color: theme.brandCream,
      fontWeight: "600",
    },
    content: {
      flex: 1,
    },
    section: {
      padding: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.brandCream,
      marginBottom: 8,
    },
    sectionDesc: {
      fontSize: 14,
      color: theme.brandTextDim,
      marginBottom: 16,
    },
    card: {
      backgroundColor: theme.brandBgElevated,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.brandCream,
      marginBottom: 4,
    },
    cardDesc: {
      fontSize: 13,
      color: theme.brandTextDim,
      marginBottom: 12,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: "500",
      color: theme.brandCream,
      marginBottom: 6,
    },
    input: {
      backgroundColor: theme.brandSurface,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      color: theme.brandCream,
      marginBottom: 12,
    },
    textArea: {
      minHeight: 80,
      textAlignVertical: "top",
    },
    visibilityLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    visibilityButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.brandSurface,
    },
    visibilityHelp: {
      color: theme.brandTextDim,
      fontSize: 12,
      lineHeight: 17,
      marginTop: -4,
    },
    dropdownButton: {
      backgroundColor: theme.brandSurface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.brandSurfaceBorder,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 8,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    dropdownButtonText: {
      color: theme.brandCream,
      fontSize: 15,
      fontWeight: "600",
    },
    dropdownMenu: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.brandSurfaceBorder,
      backgroundColor: theme.brandSurface,
      marginBottom: 12,
      overflow: "hidden",
    },
    dropdownOption: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.brandSurfaceBorder,
    },
    dropdownOptionActive: {
      backgroundColor: theme.brandGold,
    },
    dropdownOptionText: {
      color: theme.brandCream,
      fontSize: 14,
      fontWeight: "600",
    },
    dropdownOptionTextActive: {
      color: theme.brandCream,
      fontWeight: "800",
    },
    colorGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
      marginBottom: 16,
    },
    colorPreset: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 3,
      borderColor: "transparent",
    },
    colorPresetSelected: {
      borderColor: theme.brandCream,
      transform: [{ scale: 1.1 }],
    },
    colorPreview: {
      height: 8,
      borderRadius: 4,
      marginTop: 8,
    },
    specialtyGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    specialtyChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: theme.brandSurface,
      borderWidth: 1,
      borderColor: theme.brandSurfaceBorder,
    },
    specialtyChipActive: {
      backgroundColor: theme.brandGold,
      borderColor: theme.brandGold,
    },
    specialtyText: {
      fontSize: 13,
      color: theme.brandTextDim,
    },
    specialtyTextActive: {
      color: theme.brandCream,
      fontWeight: "500",
    },
    saveButton: {
      backgroundColor: theme.brandPrimary,
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: "center",
      marginTop: 8,
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.brandPrimaryText,
    },
    addButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.brandPrimary,
      paddingVertical: 12,
      borderRadius: 10,
      gap: 8,
      marginBottom: 16,
    },
    addButtonText: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.brandPrimaryText,
    },
    productCard: {
      backgroundColor: theme.brandBgElevated,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
      flexDirection: "row",
    },
    productImage: {
      width: 80,
      height: 80,
      borderRadius: 8,
      backgroundColor: theme.brandSurface,
    },
    productInfo: {
      flex: 1,
      marginLeft: 12,
    },
    productName: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.brandCream,
      marginBottom: 4,
    },
    productPrice: {
      fontSize: 14,
      color: theme.brandGold,
      fontWeight: "500",
      marginBottom: 4,
    },
    productMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
    },
    statusText: {
      fontSize: 11,
      fontWeight: "600",
      textTransform: "uppercase",
    },
    productActions: {
      flexDirection: "row",
      gap: 8,
      marginTop: 8,
    },
    actionButton: {
      padding: 8,
      borderRadius: 6,
      backgroundColor: theme.brandSurface,
    },
    serviceCard: {
      backgroundColor: theme.brandBgElevated,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    },
    serviceHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 8,
    },
    serviceName: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.brandCream,
      flex: 1,
    },
    serviceDetails: {
      flexDirection: "row",
      gap: 16,
    },
    serviceDetail: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    serviceDetailText: {
      fontSize: 14,
      color: theme.brandTextDim,
    },
    modal: {
      flex: 1,
      backgroundColor: theme.brandBg,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: insets.top + 8,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.brandSurfaceBorder,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.brandCream,
    },
    modalContent: {
      flex: 1,
      padding: 16,
    },
    switchRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    emptyState: {
      alignItems: "center",
      padding: 32,
    },
    emptyText: {
      fontSize: 16,
      color: theme.brandTextDim,
      marginTop: 12,
      marginBottom: 16,
    },
    loading: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    row: {
      flexDirection: "row",
      gap: 12,
    },
    flex1: {
      flex: 1,
    },
    approvalBanner: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    approvalBannerIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: "center",
      alignItems: "center",
    },
    approvalBannerContent: {
      flex: 1,
    },
    approvalBannerTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.brandCream,
      marginBottom: 2,
    },
    approvalBannerDesc: {
      fontSize: 13,
      color: theme.brandTextDim,
    },
    publishGateCard: {
      backgroundColor: theme.brandPending + "20",
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    publishGateCardDark: {
      backgroundColor: theme.brandPending + "20",
    },
    publishGateTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.brandPending,
      marginBottom: 4,
    },
    publishGateTitleDark: {
      color: theme.brandPending,
    },
    publishGateDesc: {
      fontSize: 13,
      color: theme.brandPending,
    },
    publishGateDescDark: {
      color: theme.brandPending,
    },
    publishGateItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 8,
    },
    publishGateItemText: {
      fontSize: 13,
      color: theme.brandPending,
    },
    publishGateItemTextDark: {
      color: theme.brandPending,
    },
    disabledSwitch: {
      opacity: 0.5,
    },
  });

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={theme.brandGold} />
      </View>
    );
  }

  if (!business) {
    return (
      <View style={styles.loading}>
        <Feather name="shopping-bag" size={48} color={theme.brandTextDim} />
        <Text style={[styles.emptyText, { marginTop: 16 }]}>
          No business found
        </Text>
        <Pressable
          style={styles.saveButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.saveButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const renderBrandingTab = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Cover Media</Text>
          <Text style={styles.cardDesc}>
            Upload an image or video banner for your storefront
          </Text>
          <MediaUploader
            currentImage={coverImage || undefined}
            currentVideo={coverVideo || undefined}
            currentMediaType={coverMediaType}
            onMediaUploaded={async (url, mediaType) => {
              const token = await getToken();
              if (!token) {
                Alert.alert("Error", "Authentication required. Please log in again.");
                return;
              }
              console.log("[Storefront] MediaUploader callback:", {
                url: url.substring(0, 50),
                mediaType,
              });
              if (mediaType === "video") {
                setCoverVideo(url);
                setCoverImage("");
                setCoverMediaType("video");
              } else {
                setCoverImage(url);
                setCoverVideo("");
                setCoverMediaType("image");
              }
            }}
            onRemove={() => {
              setCoverImage("");
              setCoverVideo("");
              setCoverMediaType(null);
            }}
            folder="covers"
            maxVideoDuration={15}
            placeholder="Upload cover image"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Logo</Text>
          <Text style={styles.cardDesc}>
            Your business logo appears on cards and your storefront
          </Text>
          <View style={{ alignItems: "center" }}>
            <ImageUploader
              currentImage={logoImage || undefined}
              onImageSelected={handleLogoImageSelected}
              onRemove={() => setLogoImage("")}
              aspectRatio="logo"
              placeholder="Upload Logo"
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Brand Color</Text>
          <Text style={styles.cardDesc}>
            Choose a color that represents your brand
          </Text>
          <View style={styles.colorGrid}>
            {SOLID_COLOR_IDS.map((id) => {
              const hex = (COLOR_VALUES[id as SolidColorId] as { dark: string; light: string })[
                isDark ? "dark" : "light"
              ];
              return (
                <Pressable
                  key={id}
                  style={[
                    styles.colorPreset,
                    { backgroundColor: hex },
                    selectedColorId === id && styles.colorPresetSelected,
                  ]}
                  onPress={() => setSelectedColorId(id)}
                />
              );
            })}
          </View>
          <Text style={styles.inputLabel}>Preview</Text>
          <View
            style={[
              styles.colorPreview,
              {
                backgroundColor: (COLOR_VALUES[selectedColorId as SolidColorId] as { dark: string; light: string } | undefined)?.[
                  isDark ? "dark" : "light"
                ] ?? (isDark ? "#E8B930" : "#B38600"),
              },
            ]}
          />
        </View>

        <Pressable
          style={[styles.saveButton, saving && { opacity: 0.6 }]}
          onPress={handleSaveBranding}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={theme.brandPrimaryText} />
          ) : (
            <Text style={styles.saveButtonText}>Save Branding</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );

  const renderVisibilityToggle = (visible: boolean, onPress: () => void) => (
    <Pressable style={styles.visibilityButton} onPress={onPress}>
      <Feather
        name={visible ? "eye" : "eye-off"}
        size={16}
        color={visible ? theme.brandGold : theme.brandTextDim}
      />
    </Pressable>
  );

  const renderProfileTab = () => (
    <ScreenKeyboardAwareScrollView style={styles.content} contentContainerStyle={{ paddingTop: 0 }} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Business Info</Text>
          <Text style={styles.inputLabel}>Business Name</Text>
          <TextInput
            style={styles.input}
            value={profileName}
            onChangeText={setProfileName}
            placeholder="Your business name"
            placeholderTextColor={theme.brandTextDim}
          />
          <Text style={styles.inputLabel}>Tagline</Text>
          <TextInput
            style={styles.input}
            value={profileTagline}
            onChangeText={setProfileTagline}
            placeholder="A short catchy phrase"
            placeholderTextColor={theme.brandTextDim}
          />
          <Text style={styles.inputLabel}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={profileDescription}
            onChangeText={setProfileDescription}
            placeholder="Tell customers about your business..."
            placeholderTextColor={theme.brandTextDim}
            multiline
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Known For</Text>
          <Text style={styles.cardDesc}>
            Select what your business is known for
          </Text>
          <View style={styles.specialtyGrid}>
            {SPECIALTY_OPTIONS.map((specialty) => {
              const isSelected = profileSpecialties.includes(specialty);
              return (
                <Pressable
                  key={specialty}
                  style={[
                    styles.specialtyChip,
                    isSelected && styles.specialtyChipActive,
                  ]}
                  onPress={() => {
                    if (isSelected) {
                      setProfileSpecialties(
                        profileSpecialties.filter((s) => s !== specialty),
                      );
                    } else {
                      setProfileSpecialties([...profileSpecialties, specialty]);
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.specialtyText,
                      isSelected && styles.specialtyTextActive,
                    ]}
                  >
                    {specialty}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Contact Info</Text>
          <View style={styles.visibilityLabelRow}>
            <Text style={styles.inputLabel}>Email</Text>
            {renderVisibilityToggle(showEmail, () => setShowEmail((v) => !v))}
          </View>
          <TextInput
            style={styles.input}
            value={profileEmail}
            onChangeText={setProfileEmail}
            placeholder="contact@business.com"
            placeholderTextColor={theme.brandTextDim}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <View style={styles.visibilityLabelRow}>
            <Text style={styles.inputLabel}>Phone</Text>
            {renderVisibilityToggle(showPhone, () => setShowPhone((v) => !v))}
          </View>
          <TextInput
            style={styles.input}
            value={profilePhone}
            onChangeText={setProfilePhone}
            placeholder="(555) 123-4567"
            placeholderTextColor={theme.brandTextDim}
            keyboardType="phone-pad"
          />
          <View style={styles.visibilityLabelRow}>
            <Text style={styles.inputLabel}>Website</Text>
            {renderVisibilityToggle(showWebsite, () =>
              setShowWebsite((v) => !v),
            )}
          </View>
          <TextInput
            style={styles.input}
            value={profileWebsite}
            onChangeText={setProfileWebsite}
            placeholder="https://yourbusiness.com"
            placeholderTextColor={theme.brandTextDim}
            autoCapitalize="none"
          />
          <View style={styles.visibilityLabelRow}>
            <Text style={styles.inputLabel}>Store Hours</Text>
            {renderVisibilityToggle(showStoreHours, () =>
              setShowStoreHours((v) => !v),
            )}
          </View>
          <Text style={styles.visibilityHelp}>
            Controls whether your saved business hours appear publicly.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Response Time</Text>
          <View style={styles.visibilityLabelRow}>
            <Text style={styles.inputLabel}>Show response time on profile</Text>
            {renderVisibilityToggle(showResponseTime, () =>
              setShowResponseTime((v) => !v),
            )}
          </View>
          <Text style={styles.cardDesc}>Number</Text>
          <Pressable
            style={styles.dropdownButton}
            onPress={() => setResponseValueDropdownOpen((open) => !open)}
          >
            <Text style={styles.dropdownButtonText}>{responseTimeValue}</Text>
            <Feather
              name={responseValueDropdownOpen ? "chevron-up" : "chevron-down"}
              size={16}
              color={theme.brandTextDim}
            />
          </Pressable>
          {responseValueDropdownOpen ? (
            <View style={styles.dropdownMenu}>
              {RESPONSE_TIME_VALUES.map((value) => {
                const selected = responseTimeValue === value;
                return (
                  <Pressable
                    key={value}
                    style={[
                      styles.dropdownOption,
                      selected && styles.dropdownOptionActive,
                    ]}
                    onPress={() => {
                      setResponseTimeValue(value);
                      setResponseValueDropdownOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownOptionText,
                        selected && styles.dropdownOptionTextActive,
                      ]}
                    >
                      {value}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          <Text style={styles.cardDesc}>Unit</Text>
          <Pressable
            style={styles.dropdownButton}
            onPress={() => setResponseUnitDropdownOpen((open) => !open)}
          >
            <Text style={styles.dropdownButtonText}>
              {RESPONSE_TIME_UNITS.find(
                (unit) => unit.value === responseTimeUnit,
              )?.label || "Hours"}
            </Text>
            <Feather
              name={responseUnitDropdownOpen ? "chevron-up" : "chevron-down"}
              size={16}
              color={theme.brandTextDim}
            />
          </Pressable>
          {responseUnitDropdownOpen ? (
            <View style={styles.dropdownMenu}>
              {RESPONSE_TIME_UNITS.map((unit) => {
                const selected = responseTimeUnit === unit.value;
                return (
                  <Pressable
                    key={unit.value}
                    style={[
                      styles.dropdownOption,
                      selected && styles.dropdownOptionActive,
                    ]}
                    onPress={() => {
                      setResponseTimeUnit(unit.value);
                      setResponseUnitDropdownOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownOptionText,
                        selected && styles.dropdownOptionTextActive,
                      ]}
                    >
                      {unit.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Location</Text>
          <View style={styles.visibilityLabelRow}>
            <Text style={styles.inputLabel}>Physical Location</Text>
            <Switch
              value={hasPhysicalLocation}
              onValueChange={(v) => {
                if (!v && defaultServiceLocationType === 'business') {
                  setDefaultServiceLocationType('virtual');
                }
                setHasPhysicalLocation(v);
              }}
              trackColor={{ true: theme.brandGold }}
            />
          </View>
          <Text style={styles.visibilityHelp}>
            Do you have a primary place customers can visit for this service?
          </Text>
          {hasPhysicalLocation && (
            <>
              <View style={[styles.visibilityLabelRow, { marginTop: 12 }]}>
                <Text style={styles.inputLabel}>Show Address Publicly</Text>
                {renderVisibilityToggle(showAddress, () =>
                  setShowAddress((v) => !v),
                )}
              </View>
              <Text style={styles.visibilityHelp}>
                When on, your exact address is visible to anyone browsing. When
                off, only your city/state show until a customer books.
              </Text>
            </>
          )}
          <Text style={[styles.inputLabel, { marginTop: 12 }]}>Default Service Location</Text>
          <Text style={[styles.visibilityHelp, { marginBottom: 8 }]}>
            Where your services take place by default. Can be overridden per service.
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {((!hasPhysicalLocation ? [['alternate', 'Alternate address'], ['customer', "Customer's location"], ['virtual', 'Virtual']] : [['business', 'At my location'], ['alternate', 'Alternate address'], ['customer', "Customer's location"], ['virtual', 'Virtual']]) as [string, string][]).map(([val, label]) => {
              const selected = defaultServiceLocationType === val;
              return (
                <Pressable
                  key={val}
                  onPress={() => setDefaultServiceLocationType(val)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 8,
                    borderWidth: 1.5,
                    borderColor: selected ? theme.brandGold : theme.brandSurface,
                    backgroundColor: selected ? theme.brandGold + "22" : theme.brandSurface,
                  }}
                >
                  <Text style={{ fontSize: 13, color: selected ? theme.brandGold : theme.brandTextDim, fontWeight: selected ? "600" : "400" }}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.inputLabel, { marginTop: 12 }]}>Address</Text>
          <TextInput
            style={styles.input}
            value={profileAddress}
            onChangeText={setProfileAddress}
            placeholder="123 Main Street"
            placeholderTextColor={theme.brandTextDim}
          />
          <View style={styles.row}>
            <View style={styles.flex1}>
              <Text style={styles.inputLabel}>City</Text>
              <TextInput
                style={styles.input}
                value={profileCity}
                onChangeText={setProfileCity}
                placeholder="City"
                placeholderTextColor={theme.brandTextDim}
              />
            </View>
            <View style={styles.flex1}>
              <Text style={styles.inputLabel}>State</Text>
              <TextInput
                style={styles.input}
                value={profileState}
                onChangeText={setProfileState}
                placeholder="State"
                placeholderTextColor={theme.brandTextDim}
              />
            </View>
          </View>
          <Text style={styles.inputLabel}>ZIP Code</Text>
          <TextInput
            style={styles.input}
            value={profileZip}
            onChangeText={setProfileZip}
            placeholder="12345"
            placeholderTextColor={theme.brandTextDim}
            keyboardType="number-pad"
          />
        </View>

        <Pressable
          style={[styles.saveButton, saving && { opacity: 0.6 }]}
          onPress={handleSaveProfile}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={theme.brandPrimaryText} />
          ) : (
            <Text style={styles.saveButtonText}>Save Profile</Text>
          )}
        </Pressable>
      </View>
    </ScreenKeyboardAwareScrollView>
  );

  const renderHoursTab = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <HoursEditor
          title="Business Hours"
          hours={hours}
          onChange={setHours}
          onSave={handleSaveHours}
          isSaving={saving}
        />
      </View>
    </ScrollView>
  );

  const renderProductsTab = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <Pressable style={styles.addButton} onPress={() => openProductForm()}>
          <Feather name="plus" size={20} color={theme.brandPrimaryText} />
          <Text style={styles.addButtonText}>Add Product</Text>
        </Pressable>

        {products.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="package" size={48} color={theme.brandTextDim} />
            <Text style={styles.emptyText}>No products yet</Text>
          </View>
        ) : (
          products.map((product) => (
            <View key={product.id} style={styles.productCard}>
              {product.imageUrl ? (
                <Image
                  source={{ uri: product.imageUrl }}
                  style={styles.productImage}
                />
              ) : (
                <View
                  style={[
                    styles.productImage,
                    { justifyContent: "center", alignItems: "center" },
                  ]}
                >
                  <Feather name="image" size={24} color={theme.brandTextDim} />
                </View>
              )}
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{product.name}</Text>
                <Text style={styles.productPrice}>
                  {formatPrice(product.priceCents)}
                </Text>
                <View style={styles.productMeta}>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: getStatusColor(product.status) + "20",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        { color: getStatusColor(product.status) },
                      ]}
                    >
                      {getStatusLabel(product.status)}
                    </Text>
                  </View>
                  {product.inventory !== null && (
                    <Text style={styles.serviceDetailText}>
                      Stock: {product.inventory}
                    </Text>
                  )}
                </View>
                {getStatusExplanation(product.status) && (
                  <Text
                    style={{ fontSize: 11, color: theme.brandError, marginTop: 4 }}
                  >
                    {getStatusExplanation(product.status)}
                  </Text>
                )}
                <View style={styles.productActions}>
                  <Pressable
                    style={styles.actionButton}
                    onPress={() => openProductForm(product)}
                  >
                    <Feather name="edit-2" size={16} color={theme.brandCream} />
                  </Pressable>
                  <Pressable
                    style={styles.actionButton}
                    onPress={() => handleDeleteProduct(product.id)}
                  >
                    <Feather name="trash-2" size={16} color={theme.brandError} />
                  </Pressable>
                </View>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );

  const renderServicesTab = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <Pressable style={styles.addButton} onPress={() => openServiceForm()}>
          <Feather name="plus" size={20} color={theme.brandPrimaryText} />
          <Text style={styles.addButtonText}>Add Service</Text>
        </Pressable>

        {services.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="clock" size={48} color={theme.brandTextDim} />
            <Text style={styles.emptyText}>No services yet</Text>
          </View>
        ) : (
          services.map((service) => (
            <View key={service.id} style={styles.serviceCard}>
              <View style={styles.serviceHeader}>
                <Text style={styles.serviceName}>{service.name}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(service.status) + "20" },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      { color: getStatusColor(service.status) },
                    ]}
                  >
                    {getStatusLabel(service.status)}
                  </Text>
                </View>
              </View>
              {getStatusExplanation(service.status) && (
                <Text
                  style={{
                    fontSize: 11,
                    color: theme.brandError,
                    marginTop: 4,
                    marginBottom: 4,
                  }}
                >
                  {getStatusExplanation(service.status)}
                </Text>
              )}
              <View style={styles.serviceDetails}>
                <View style={styles.serviceDetail}>
                  <Feather name="dollar-sign" size={14} color={theme.brandGold} />
                  <Text
                    style={[styles.serviceDetailText, { color: theme.brandGold }]}
                  >
                    {formatPrice(service.priceCents)}
                  </Text>
                </View>
                {service.durationMinutes && (
                  <View style={styles.serviceDetail}>
                    <Feather
                      name="clock"
                      size={14}
                      color={theme.brandTextDim}
                    />
                    <Text style={styles.serviceDetailText}>
                      {service.durationMinutes} min
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.productActions}>
                <Pressable
                  style={styles.actionButton}
                  onPress={() => openServiceForm(service)}
                >
                  <Feather name="edit-2" size={16} color={theme.brandCream} />
                </Pressable>
                <Pressable
                  style={styles.actionButton}
                  onPress={() => handleDeleteService(service.id)}
                >
                    <Feather name="trash-2" size={16} color={theme.brandError} />
                  </Pressable>
                </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );

  const renderProductModal = () => (
    <Modal visible={productModalVisible} animationType="slide">
      <View style={styles.modal}>
        <View style={styles.modalHeader}>
          <Pressable onPress={() => setProductModalVisible(false)}>
            <Feather name="x" size={24} color={theme.brandCream} />
          </Pressable>
          <Text style={styles.modalTitle}>
            {editingProduct ? "Edit Product" : "Add Product"}
          </Text>
          <Pressable onPress={handleSaveProduct} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color={theme.brandPrimary} />
            ) : (
              <Text style={{ color: theme.brandGold, fontWeight: "600" }}>
                Save
              </Text>
            )}
          </Pressable>
        </View>
        <ScreenKeyboardAwareScrollView style={styles.modalContent} contentContainerStyle={{ paddingTop: 0 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.inputLabel}>Product Name *</Text>
          <TextInput
            style={styles.input}
            value={productForm.name}
            onChangeText={(v) =>
              setProductForm((prev) => ({ ...prev, name: v }))
            }
            placeholder="Product name"
            placeholderTextColor={theme.brandTextDim}
          />

          <Text style={styles.inputLabel}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={productForm.description}
            onChangeText={(v) =>
              setProductForm((prev) => ({ ...prev, description: v }))
            }
            placeholder="Product description"
            placeholderTextColor={theme.brandTextDim}
            multiline
          />

          <Text style={styles.inputLabel}>Price (in dollars)</Text>
          <TextInput
            style={styles.input}
            value={priceInput}
            onChangeText={(v) => setPriceInput(v.replace(/[^0-9.]/g, ""))}
            placeholder="0.00"
            placeholderTextColor={theme.brandTextDim}
            keyboardType="decimal-pad"
          />

          <Text style={styles.inputLabel}>Inventory</Text>
          <TextInput
            style={styles.input}
            value={
              productForm.inventory !== undefined &&
              productForm.inventory !== null
                ? String(productForm.inventory)
                : ""
            }
            onChangeText={(v) => {
              const parsed = parseInt(v, 10);
              setProductForm((prev) => ({
                ...prev,
                inventory: isNaN(parsed) ? 0 : Math.max(0, parsed),
              }));
            }}
            placeholder="0"
            placeholderTextColor={theme.brandTextDim}
            keyboardType="number-pad"
          />

          <Text style={styles.inputLabel}>Product Image</Text>
          <ImageUploader
            currentImage={productForm.imageUrl || undefined}
            onImageSelected={handleProductImageSelected}
            onRemove={() =>
              setProductForm((prev) => ({ ...prev, imageUrl: "" }))
            }
            aspectRatio="product"
            placeholder="Upload Product Image"
          />

          {renderPublishGateWarning()}

          {productForm.status === "paused" && (
            <View
              style={{
                backgroundColor: theme.brandError + "14",
                borderRadius: 8,
                padding: 12,
                marginTop: 16,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <Feather name="pause-circle" size={18} color={theme.brandError} />
                <Text
                  style={{ fontSize: 14, fontWeight: "600", color: theme.brandError }}
                >
                  Product Paused
                </Text>
              </View>
              <Text style={{ fontSize: 13, color: theme.brandError, marginTop: 4 }}>
                This product was paused due to subscription lapse. Reactivate
                your subscription to publish it again.
              </Text>
            </View>
          )}

          <View style={[styles.publishGateCard, { marginTop: 16 }]}>
            <View style={[styles.switchRow, { marginBottom: 0 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Publish (Go Live)</Text>
              {productForm.status === "paused" ? (
                <Text style={{ fontSize: 12, color: theme.brandError, marginTop: 2 }}>
                  Reactivate subscription to unpause
                </Text>
              ) : !canPublishProducts ? (
                <Text
                  style={{
                    fontSize: 12,
                    color: theme.brandTextDim,
                    marginTop: 2,
                  }}
                >
                  Requires approval, Stripe setup, and active subscription
                </Text>
              ) : null}
            </View>
            <View
              style={
                !canPublishProducts || productForm.status === "paused"
                  ? styles.disabledSwitch
                  : undefined
              }
            >
              <Switch
                value={productForm.status === "live"}
                onValueChange={(v) => {
                  if (productForm.status === "paused") {
                    Alert.alert(
                      "Product Paused",
                      "This product was paused due to subscription lapse. Reactivate your subscription to publish it again.",
                    );
                    return;
                  }
                  if (v && !canPublishProducts) {
                    Alert.alert("Cannot Publish", getPublishBlockerMessage());
                    return;
                  }
                  setProductForm({
                    ...productForm,
                    status: v ? "live" : "draft",
                  });
                }}
                trackColor={{ true: theme.brandGold }}
                disabled={
                  productForm.status === "paused" ||
                  (!canPublishProducts && productForm.status !== "live")
                }
              />
            </View>
          </View>
          </View>
        </ScreenKeyboardAwareScrollView>
      </View>
    </Modal>
  );

  const renderServiceModal = () => (
    <Modal visible={serviceModalVisible} animationType="slide">
      <View style={styles.modal}>
        <View style={styles.modalHeader}>
          <Pressable onPress={() => setServiceModalVisible(false)}>
            <Feather name="x" size={24} color={theme.brandCream} />
          </Pressable>
          <Text style={styles.modalTitle}>
            {editingService ? "Edit Service" : "Add Service"}
          </Text>
          <Pressable onPress={handleSaveService} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color={theme.brandPrimary} />
            ) : (
              <Text style={{ color: theme.brandGold, fontWeight: "600" }}>
                Save
              </Text>
            )}
          </Pressable>
        </View>
        <ScreenKeyboardAwareScrollView style={styles.modalContent} contentContainerStyle={{ paddingTop: 0 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.inputLabel}>Service Name *</Text>
          <TextInput
            style={styles.input}
            value={serviceForm.name}
            onChangeText={(v) => setServiceForm({ ...serviceForm, name: v })}
            placeholder="Service name"
            placeholderTextColor={theme.brandTextDim}
          />

          <Text style={styles.inputLabel}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={serviceForm.description}
            onChangeText={(v) =>
              setServiceForm({ ...serviceForm, description: v })
            }
            placeholder="Service description"
            placeholderTextColor={theme.brandTextDim}
            multiline
          />

          <Text style={styles.inputLabel}>Price (in dollars)</Text>
          <TextInput
            style={styles.input}
            value={
              serviceForm.priceCents
                ? (serviceForm.priceCents / 100).toString()
                : ""
            }
            onChangeText={(v) =>
              setServiceForm({
                ...serviceForm,
                priceCents: Math.round(parseFloat(v || "0") * 100),
              })
            }
            placeholder="0.00"
            placeholderTextColor={theme.brandTextDim}
            keyboardType="decimal-pad"
          />

          <Text style={styles.inputLabel}>Duration (minutes)</Text>
          <TextInput
            style={styles.input}
            value={serviceForm.durationMinutes?.toString() || ""}
            onChangeText={(v) =>
              setServiceForm({
                ...serviceForm,
                durationMinutes: parseInt(v || "60", 10),
              })
            }
            placeholder="60"
            placeholderTextColor={theme.brandTextDim}
            keyboardType="number-pad"
          />

          {/* ── Service Location ── */}
          <Text style={[styles.inputLabel, { marginTop: 8 }]}>Where does this service take place?</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8, marginBottom: 4 }}>
            {(!hasPhysicalLocation ? [['alternate', 'Alternate address'], ['customer', "Customer's location"], ['virtual', 'Virtual']] : [['business', 'At my location'], ['alternate', 'Alternate address'], ['customer', "Customer's location"], ['virtual', 'Virtual']] as const).map(([val, label]) => {
              const selected = serviceForm.serviceLocationType === val;
              return (
                <Pressable
                  key={val}
                  onPress={() => setServiceForm({ ...serviceForm, serviceLocationType: val as 'business' | 'alternate' | 'customer' | 'virtual', alternateAddress: null, alternateCity: null, alternateState: null, alternateZipCode: null, virtualLink: null })}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 8,
                    borderWidth: 1.5,
                    borderColor: selected ? theme.brandGold : theme.brandSurface,
                    backgroundColor: selected ? theme.brandGold + "22" : theme.brandSurface,
                  }}
                >
                  <Text style={{ fontSize: 13, color: selected ? theme.brandGold : theme.brandTextDim, fontWeight: selected ? "600" : "400" }}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {!hasPhysicalLocation && (
            <Text style={{ fontSize: 12, color: theme.brandTextDim, marginBottom: 8 }}>
              Add a physical location in your Profile to enable "At my location".
            </Text>
          )}

          {serviceForm.serviceLocationType === 'alternate' && (
            <>
              <Text style={[styles.inputLabel, { marginTop: 8 }]}>Address</Text>
              <TextInput
                style={styles.input}
                value={serviceForm.alternateAddress || ""}
                onChangeText={(v) => setServiceForm({ ...serviceForm, alternateAddress: v || null })}
                placeholder="123 Main Street"
                placeholderTextColor={theme.brandTextDim}
              />
              <View style={styles.row}>
                <View style={styles.flex1}>
                  <Text style={styles.inputLabel}>City</Text>
                  <TextInput
                    style={styles.input}
                    value={serviceForm.alternateCity || ""}
                    onChangeText={(v) => setServiceForm({ ...serviceForm, alternateCity: v || null })}
                    placeholder="City"
                    placeholderTextColor={theme.brandTextDim}
                  />
                </View>
                <View style={styles.flex1}>
                  <Text style={styles.inputLabel}>State</Text>
                  <TextInput
                    style={styles.input}
                    value={serviceForm.alternateState || ""}
                    onChangeText={(v) => setServiceForm({ ...serviceForm, alternateState: v || null })}
                    placeholder="State"
                    placeholderTextColor={theme.brandTextDim}
                  />
                </View>
              </View>
              <Text style={styles.inputLabel}>ZIP Code</Text>
              <TextInput
                style={styles.input}
                value={serviceForm.alternateZipCode || ""}
                onChangeText={(v) => setServiceForm({ ...serviceForm, alternateZipCode: v || null })}
                placeholder="12345"
                placeholderTextColor={theme.brandTextDim}
                keyboardType="number-pad"
              />
            </>
          )}

          {serviceForm.serviceLocationType === 'virtual' && (
            <>
              <Text style={[styles.inputLabel, { marginTop: 8 }]}>Meeting Room Link</Text>
              <TextInput
                style={styles.input}
                value={serviceForm.virtualLink || ""}
                onChangeText={(v) => setServiceForm({ ...serviceForm, virtualLink: v || null })}
                placeholder="https://zoom.us/j/..."
                placeholderTextColor={theme.brandTextDim}
                autoCapitalize="none"
                keyboardType="url"
              />
              <Text style={styles.visibilityHelp}>
                Use your permanent Zoom/Meet room — not a one-time scheduled link. Customers will join this same link at their booked appointment time.
              </Text>
            </>
          )}

          {/* ── Cancellation Policy ── */}
          <Text style={[styles.inputLabel, { marginTop: 8 }]}>Cancellation Policy</Text>

          <Text style={{ fontSize: 13, color: theme.brandTextDim, marginBottom: 8 }}>
            Full refund until
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {([ ['1_week', '1 week'], ['48_hours', '48 hours'], ['24_hours', '24 hours'], ['1_hour', '1 hour'], ['never', 'Never'] ] as const).map(([val, label]) => {
              const selected = serviceForm.fullRefundWindow === val;
              return (
                <Pressable
                  key={val}
                  onPress={() => setServiceForm({ ...serviceForm, fullRefundWindow: val })}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 8,
                    borderWidth: 1.5,
                    borderColor: selected ? theme.brandGold : theme.brandSurface,
                    backgroundColor: selected ? theme.brandGold + "22" : theme.brandSurface,
                  }}
                >
                  <Text style={{ fontSize: 13, color: selected ? theme.brandGold : theme.brandTextDim, fontWeight: selected ? "600" : "400" }}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.inputLabel}>Offer partial refund after that?</Text>
            <Switch
              value={serviceForm.hasPartialRefund ?? false}
              onValueChange={(v) => setServiceForm({ ...serviceForm, hasPartialRefund: v })}
              trackColor={{ true: theme.brandGold }}
            />
          </View>

          {serviceForm.hasPartialRefund && (
            <>
              <Text style={{ fontSize: 13, color: theme.brandTextDim, marginBottom: 8 }}>
                Partial refund until
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                {([ ['1_week', '1 week'], ['48_hours', '48 hours'], ['24_hours', '24 hours'], ['1_hour', '1 hour'], ['never', 'Never'] ] as const).map(([val, label]) => {
                  const selected = serviceForm.partialRefundWindow === val;
                  return (
                    <Pressable
                      key={val}
                      onPress={() => setServiceForm({ ...serviceForm, partialRefundWindow: val })}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        borderRadius: 8,
                        borderWidth: 1.5,
                        borderColor: selected ? theme.brandGold : theme.brandSurface,
                        backgroundColor: selected ? theme.brandGold + "22" : theme.brandSurface,
                      }}
                    >
                      <Text style={{ fontSize: 13, color: selected ? theme.brandGold : theme.brandTextDim, fontWeight: selected ? "600" : "400" }}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>Refund percentage</Text>
              <TextInput
                style={styles.input}
                value={serviceForm.partialRefundPercentage != null ? serviceForm.partialRefundPercentage.toString() : ""}
                onChangeText={(v) =>
                  setServiceForm({
                    ...serviceForm,
                    partialRefundPercentage: v ? parseInt(v, 10) : null,
                  })
                }
                placeholder="e.g. 50"
                placeholderTextColor={theme.brandTextDim}
                keyboardType="number-pad"
              />
            </>
          )}

          <View style={styles.switchRow}>
            <Text style={styles.inputLabel}>Cancellation fee?</Text>
            <Switch
              value={serviceForm.hasCancellationFee ?? false}
              onValueChange={(v) => setServiceForm({ ...serviceForm, hasCancellationFee: v })}
              trackColor={{ true: theme.brandGold }}
            />
          </View>

          {serviceForm.hasCancellationFee && (
            <>
              <Text style={{ fontSize: 13, color: theme.brandTextDim, marginBottom: 8 }}>
                Fee type
              </Text>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
                {([ ['flat', 'Flat amount'], ['percentage', 'Percentage of revenue'] ] as const).map(([val, label]) => {
                  const selected = serviceForm.cancellationFeeType === val;
                  return (
                    <Pressable
                      key={val}
                      onPress={() => setServiceForm({ ...serviceForm, cancellationFeeType: val })}
                      style={{
                        flex: 1,
                        paddingHorizontal: 10,
                        paddingVertical: 7,
                        borderRadius: 8,
                        borderWidth: 1.5,
                        borderColor: selected ? theme.brandGold : theme.brandSurface,
                        backgroundColor: selected ? theme.brandGold + "22" : theme.brandSurface,
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ fontSize: 13, color: selected ? theme.brandGold : theme.brandTextDim, fontWeight: selected ? "600" : "400", textAlign: "center" }}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>
                {serviceForm.cancellationFeeType === "flat" ? "Fee amount (in dollars)" : "Fee percentage"}
              </Text>
              <TextInput
                style={styles.input}
                value={
                  serviceForm.cancellationFeeType === "flat"
                    ? serviceForm.cancellationFeeAmount != null
                      ? (serviceForm.cancellationFeeAmount / 100).toString()
                      : ""
                    : serviceForm.cancellationFeeAmount != null
                      ? serviceForm.cancellationFeeAmount.toString()
                      : ""
                }
                onChangeText={(v) => {
                  if (serviceForm.cancellationFeeType === "flat") {
                    setServiceForm({ ...serviceForm, cancellationFeeAmount: v ? Math.round(parseFloat(v) * 100) : null });
                  } else {
                    setServiceForm({ ...serviceForm, cancellationFeeAmount: v ? parseInt(v, 10) : null });
                  }
                }}
                placeholder={serviceForm.cancellationFeeType === "flat" ? "0.00" : "e.g. 10"}
                placeholderTextColor={theme.brandTextDim}
                keyboardType="decimal-pad"
              />
            </>
          )}

          {editingService && (
            <Pressable
              onPress={async () => {
                const doApply = async () => {
                  try {
                    const token = await getToken();
                    if (!token) return;
                    const result = await api.applyCancellationPolicyToAll(token, editingService.id);
                    fetchData();
                    if (result.updatedCount === 0) {
                      Alert.alert("Done", "This is now your default for new services.");
                    } else {
                      Alert.alert("Done", `Applied to ${result.updatedCount} other service(s).`);
                    }
                  } catch (error: any) {
                    Alert.alert("Error", error.message || "Failed to apply policy");
                  }
                };

                if (services.length > 1) {
                  Alert.alert(
                    "Apply to all services?",
                    "This will overwrite the cancellation policy on ALL your other existing services with this one's settings. This can't be undone.",
                    [
                      { text: "Cancel", style: "cancel" },
                      { text: "Confirm", style: "destructive", onPress: doApply },
                    ],
                  );
                } else {
                  doApply();
                }
              }}
              style={{
                borderWidth: 1.5,
                borderColor: theme.brandGold,
                borderRadius: 8,
                paddingVertical: 10,
                paddingHorizontal: 16,
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <Text style={{ color: theme.brandGold, fontSize: 14, fontWeight: "600" }}>
                Apply to all services
              </Text>
            </Pressable>
          )}

          {/* ── Business Terms & Conditions ── */}
          <Text style={[styles.inputLabel, { marginTop: 8 }]}>Business Terms & Conditions</Text>
          <Text style={{ color: theme.brandTextDim, fontSize: 12, marginBottom: 8, marginTop: -4 }}>
            Applies to all your services, not just this one. Customers will be asked to acknowledge these terms when booking.
          </Text>
          <TextInput
            style={[styles.input, styles.textArea, { minHeight: 120 }]}
            value={vendorTermsAndConditions}
            onChangeText={setVendorTermsAndConditions}
            placeholder="e.g. cancellation windows, late arrival policy, photo/video release, etc."
            placeholderTextColor={theme.brandTextDim}
            multiline
          />

          {renderPublishGateWarning()}

          {serviceForm.status === "paused" && (
            <View
              style={{
                backgroundColor: theme.brandError + "14",
                borderRadius: 8,
                padding: 12,
                marginTop: 16,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <Feather name="pause-circle" size={18} color={theme.brandError} />
                <Text
                  style={{ fontSize: 14, fontWeight: "600", color: theme.brandError }}
                >
                  Service Paused
                </Text>
              </View>
              <Text style={{ fontSize: 13, color: theme.brandError, marginTop: 4 }}>
                This service was paused due to subscription lapse. Reactivate
                your subscription to publish it again.
              </Text>
            </View>
          )}

          <View style={styles.publishGateCard}>
            <View style={[styles.switchRow, { marginBottom: 0 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Publish (Go Live)</Text>
              {serviceForm.status === "paused" ? (
                <Text style={{ fontSize: 12, color: theme.brandError, marginTop: 2 }}>
                  Reactivate subscription to unpause
                </Text>
              ) : !canPublishServices ? (
                <Text
                  style={{
                    fontSize: 12,
                    color: theme.brandTextDim,
                    marginTop: 2,
                  }}
                >
                  Requires approval, Stripe setup, and active subscription
                </Text>
              ) : null}
            </View>
            <View
              style={
                !canPublishServices || serviceForm.status === "paused"
                  ? styles.disabledSwitch
                  : undefined
              }
            >
              <Switch
                value={serviceForm.status === "live"}
                onValueChange={(v) => {
                  if (serviceForm.status === "paused") {
                    Alert.alert(
                      "Service Paused",
                      "This service was paused due to subscription lapse. Reactivate your subscription to publish it again.",
                    );
                    return;
                  }
                  if (v && !canPublishServices) {
                    Alert.alert("Cannot Publish", getPublishBlockerMessage());
                    return;
                  }
                  setServiceForm({
                    ...serviceForm,
                    status: v ? "live" : "draft",
                  });
                }}
                trackColor={{ true: theme.brandGold }}
                disabled={
                  serviceForm.status === "paused" ||
                  (!canPublishServices && serviceForm.status !== "live")
                }
              />
            </View>
          </View>
          </View>
        </ScreenKeyboardAwareScrollView>
      </View>
    </Modal>
  );

  const tabs: {
    key: TabType;
    icon: keyof typeof Feather.glyphMap;
    label: string;
  }[] = [
    { key: "branding", icon: "image", label: "Branding" },
    { key: "profile", icon: "user", label: "Profile" },
    { key: "hours", icon: "clock", label: "Hours" },
    { key: "products", icon: "package", label: "Products" },
    { key: "services", icon: "briefcase", label: "Services" },
  ];

  const getApprovalBannerConfig = () => {
    switch (approvalStatus) {
      case "approved":
        return {
          icon: "check-circle" as const,
          iconBg: theme.brandSuccess + "20",
          iconColor: theme.brandSuccess,
          title: "Storefront Approved",
          desc: "Your storefront is visible to customers",
        };
      case "rejected":
        return {
          icon: "x-circle" as const,
          iconBg: theme.brandError + "20",
          iconColor: theme.brandError,
          title: "Application Rejected",
          desc:
            business?.approvalNotes ||
            "Your application was not approved. Please contact support.",
        };
      default:
        return {
          icon: "clock" as const,
          iconBg: theme.brandPending + "20",
          iconColor: theme.brandPending,
          title: "Pending Review",
          desc: "Your storefront is under review (24-48 hours). You can still edit your profile.",
        };
    }
  };

  const renderApprovalBanner = () => {
    const config = getApprovalBannerConfig();
    return (
      <View style={styles.approvalBanner}>
        <View
          style={[
            styles.approvalBannerIcon,
            { backgroundColor: config.iconBg },
          ]}
        >
          <Feather name={config.icon} size={20} color={config.iconColor} />
        </View>
        <View style={styles.approvalBannerContent}>
          <Text style={styles.approvalBannerTitle}>{config.title}</Text>
          <Text style={styles.approvalBannerDesc}>{config.desc}</Text>
        </View>
      </View>
    );
  };

  const renderPublishGateWarning = () => {
    if (canPublish) return null;

    const isDark =
      theme.backgroundRoot === "#000000" || theme.backgroundRoot === "#000";
    const missingStripe = eligibility
      ? eligibility.requiresOnboarding
      : !business?.stripeOnboardingComplete;
    const missingSub = eligibility
      ? eligibility.requiresSubscription
      : !business?.subscriptionActive;
    const missingApproval = eligibility
      ? eligibility.requiresApproval
      : approvalStatus !== "approved";

    return (
      <View
        style={[styles.publishGateCard, isDark && styles.publishGateCardDark]}
      >
        <Text
          style={[
            styles.publishGateTitle,
            isDark && styles.publishGateTitleDark,
          ]}
        >
          Publishing Requirements
        </Text>
        <Text
          style={[styles.publishGateDesc, isDark && styles.publishGateDescDark]}
        >
          You can create and edit drafts, but to publish items you need:
        </Text>
        <View style={styles.publishGateItem}>
          <Feather
            name={missingApproval ? "x-circle" : "check-circle"}
            size={16}
            color={missingApproval ? theme.brandError : theme.brandSuccess}
          />
          <Text
            style={[
              styles.publishGateItemText,
              isDark && styles.publishGateItemTextDark,
            ]}
          >
            Storefront approval{" "}
            {missingApproval ? `(${approvalStatus})` : "(approved)"}
          </Text>
        </View>
        <View style={styles.publishGateItem}>
          <Feather
            name={missingStripe ? "x-circle" : "check-circle"}
            size={16}
            color={missingStripe ? theme.brandError : theme.brandSuccess}
          />
          <Text
            style={[
              styles.publishGateItemText,
              isDark && styles.publishGateItemTextDark,
            ]}
          >
            Stripe payment setup{" "}
            {missingStripe ? "(not complete)" : "(complete)"}
          </Text>
        </View>
        <View style={styles.publishGateItem}>
          <Feather
            name={missingSub ? "x-circle" : "check-circle"}
            size={16}
            color={missingSub ? theme.brandError : theme.brandSuccess}
          />
          <Text
            style={[
              styles.publishGateItemText,
              isDark && styles.publishGateItemTextDark,
            ]}
          >
            Active subscription {missingSub ? "(not active)" : "(active)"}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={24} color={theme.brandCream} />
        </Pressable>
        <Text style={styles.headerTitle}>Customize Storefront</Text>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>
            {business.category || "Business"}
          </Text>
        </View>
      </View>

      {renderApprovalBanner()}

      <View style={styles.tabContainer}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Feather
              name={tab.icon}
              size={18}
              color={activeTab === tab.key ? theme.brandCream : theme.brandTextDim}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === tab.key && styles.tabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {activeTab === "branding" && renderBrandingTab()}
      {activeTab === "profile" && renderProfileTab()}
      {activeTab === "hours" && renderHoursTab()}
      {activeTab === "products" && renderProductsTab()}
      {activeTab === "services" && renderServicesTab()}

      {renderProductModal()}
      {renderServiceModal()}
    </View>
  );
}
