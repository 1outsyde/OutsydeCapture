import React, { useState, useEffect, useCallback, useRef } from "react";
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
  AppState,
  KeyboardAvoidingView,
  Keyboard,
  InputAccessoryView,
  Platform,
  Linking,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect, usePreventRemove } from "@react-navigation/native";
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
  ProductVariant,
  LocalVariant,
  ProductOptionsResponse,
  ServiceAddon,
  getServiceAddons,
  createServiceAddon,
  updateServiceAddon,
  deleteServiceAddon,
  attachLibraryAddon,
  reviewServiceAddonPrice,
  type BusinessTaxonomy,
  type TaxonomySpecialty,
  type BusinessSetupStatus,
} from "@/services/api";
import VariantBuilderSection from "@/components/products/VariantBuilderSection";
import ProductOptionsEditor, { ProductOptionsEditorHandle } from "@/components/products/ProductOptionsEditor";
import ProductAddonsEditor, { ProductAddonsEditorHandle } from "@/components/products/ProductAddonsEditor";
import type { VendorAddonGroup } from "@/components/products/productAddonLogic";
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
import { MIN_DEPOSIT_CENTS, parseDepositInput } from "@/utils/deposit";
import { formatDuration, joinMinutes, splitMinutes } from "@/utils/duration";
import AddonLibraryTab from "@/components/addons/AddonLibraryTab";
import { readableApiError } from "@/utils/apiError";
import { money } from "@/utils/addonLibrary";
import {
  OTHER_DESCRIPTION_MAX,
  findCategory,
  industryFrom,
  industryPayload,
  industryProblem,
  needsOtherDescription,
  offerTypeOf,
  specialtiesFor,
  type IndustryValue,
} from "@/utils/industry";
import { knownForFrom, profilePayload, termsPayload } from "@/utils/storefrontProfile";
import { buildSetupSteps, hasHours, type SetupTarget } from "@/utils/setupChecklist";
import { customerStock, stockLabel, stockModeOf, stockPayload, type StockMode } from "@/utils/productStock";
import {
  REFUND_WINDOWS,
  depositInputFrom,
  parseDefaultDepositInput,
  policyDraftFrom,
  policyFromDraft,
  stepsFromSetupStatus,
  type PolicyDraft,
} from "@/utils/businessDefaults";

// The backend rejects vendor service durations under 5 minutes.
const MIN_SERVICE_DURATION_MINUTES = 5;

// Manage business (2026-10-28): a hub page plus one page per area, replacing
// the six tabs. Every page keeps the exact save it had as a tab.
type SectionKey =
  | "hub"
  | "products"
  | "services"
  | "addons"
  | "booking"
  | "hours"
  | "branding"
  | "profile"
  | "payouts";

const SECTION_TITLES: Record<SectionKey, string> = {
  hub: "Manage business",
  products: "Products",
  services: "Services",
  addons: "Add-ons",
  booking: "Booking settings",
  hours: "Hours",
  branding: "Look and branding",
  profile: "Profile and contact",
  payouts: "Payouts and plan",
};

// Pages with their own Save button; leaving one with unsaved edits asks first.
type EditableSection = "branding" | "profile" | "hours" | "booking";
const EDITABLE_SECTIONS: EditableSection[] = ["branding", "profile", "hours", "booking"];

const STRIPE_RETURN_URL = "outsyde://stripe-return";

// The setup card is always the dark brand green, so its gold stays the bright
// one in both themes (the light theme's darker gold is too faint on green).
const SETUP_GOLD = "#E8B930";
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

const normalizeService = (s: any): VendorService => ({
  ...s,
  priceCents:
    Number.isFinite(Number(s.priceCents)) && s.priceCents > 0
      ? Number(s.priceCents)
      : Number.isFinite(Number(s.price)) && s.price > 0
        ? Number(s.price)
        : 0,
});

// Keyboard toolbar with a "Done" button for the add-on sheet (number pads have no return key on iOS).
const ADDON_KEYBOARD_DONE_ID = "addonKeyboardDone";

export default function StorefrontEditorScreen() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { getToken } = useAuth();

  const [section, setSection] = useState<SectionKey>("hub");
  const [showDoneSteps, setShowDoneSteps] = useState(false);
  const [payoutLinkBusy, setPayoutLinkBusy] = useState(false);
  const [knownForChanged, setKnownForChanged] = useState(false);
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
  // "Run past closing" (backend #294). null = backend didn't send the field, so the switch is hidden.
  const [allowPastClosing, setAllowPastClosing] = useState<boolean | null>(
    null,
  );
  const [savingPastClosing, setSavingPastClosing] = useState(false);

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
  // Industry from the shared list. Sent with Save Profile only after the business changes it,
  // so ordinary profile saves stay exactly as they were.
  const [industry, setIndustry] = useState<IndustryValue>(industryFrom(null));
  const [industryDirty, setIndustryDirty] = useState(false);
  const [taxonomy, setTaxonomy] = useState<BusinessTaxonomy | null>(null);
  const [taxonomyError, setTaxonomyError] = useState(false);
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
  // Booking settings defaults (backend #374): business policy, default deposit, server checklist.
  const [policyDraft, setPolicyDraft] = useState<PolicyDraft>(() => policyDraftFrom(null));
  const [defaultDepositInput, setDefaultDepositInput] = useState("");
  const [setupStatus, setSetupStatus] = useState<BusinessSetupStatus | null>(null);
  // New service form only: the deposit came from the business default (shown as a hint).
  const [depositFromDefault, setDepositFromDefault] = useState(false);
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

  // CTA Button config
  const [ctaButtonType, setCtaButtonType] = useState<"book_now" | "buy_now">("book_now");
  const [ctaProductTarget, setCtaProductTarget] = useState<"most_recent" | "oldest" | "best_selling" | "specific">("most_recent");
  const [ctaSpecificProductId, setCtaSpecificProductId] = useState<string>("");
  const [ctaSpecificProductName, setCtaSpecificProductName] = useState<string>("");

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
    status: "draft",
  });
  // Stock is optional (Legend 2026-10-28): No limit, a count, or Sold out. New products: No limit.
  const [stockMode, setStockMode] = useState<StockMode>("unlimited");
  const [stockInput, setStockInput] = useState("");
  const [localVariants, setLocalVariants] = useState<LocalVariant[]>([]);
  const [initialVariants, setInitialVariants] = useState<ProductVariant[]>([]);
  // Product options editor (backend #310). If the options route can't be
  // reached, the modal falls back to the older label-only variant editor.
  const optionsEditorRef = useRef<ProductOptionsEditorHandle>(null);
  // Product add-ons (backend #371): null = still loading, "failed" = couldn't load (editor hidden).
  const addonsEditorRef = useRef<ProductAddonsEditorHandle>(null);
  const [addonsInitial, setAddonsInitial] = useState<VendorAddonGroup[] | null | "failed">(null);
  const addonsLoadForRef = useRef<string | null>(null);
  const [optionsInitial, setOptionsInitial] = useState<ProductOptionsResponse | null>(null);
  const [optionsFallback, setOptionsFallback] = useState(false);
  const [productModalSession, setProductModalSession] = useState(0);
  const [productModalToken, setProductModalToken] = useState<string>("");

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
    depositAmountCents: null,
  });

  const [depositEnabled, setDepositEnabled] = useState(false);
  const [depositInput, setDepositInput] = useState("");
  // The duration is stored as total minutes in serviceForm.durationMinutes; the
  // two boxes hold what the vendor typed so a box can be cleared while editing.
  const [durationHoursText, setDurationHoursText] = useState("1");
  const [durationMinutesText, setDurationMinutesText] = useState("0");
  const [durationError, setDurationError] = useState<string | null>(null);
  const [depositTouched, setDepositTouched] = useState(false);
  const [depositServerError, setDepositServerError] = useState<string | null>(
    null,
  );

  // Kept out of serviceForm: the form is sent whole on edit, so the image is
  // only sent once the vendor uploads or removes one.
  const [serviceImageUrl, setServiceImageUrl] = useState<string | null>(null);
  const [serviceImageTouched, setServiceImageTouched] = useState(false);

  // Service add-ons editor state (only for saved services)
  const [serviceAddons, setServiceAddons] = useState<ServiceAddon[]>([]);
  const [addonsLoading, setAddonsLoading] = useState(false);
  const [addonModalVisible, setAddonModalVisible] = useState(false);
  const [editingAddon, setEditingAddon] = useState<ServiceAddon | null>(null);
  const [addonForm, setAddonForm] = useState({ name: "", description: "", priceCents: "", durationMinutes: "", sortOrder: "" });
  const [addonAddsTime, setAddonAddsTime] = useState(false);
  const [addonSaving, setAddonSaving] = useState(false);
  const [addonError, setAddonError] = useState<string | null>(null);
  // "Add to other services": one-time copies of a saved add-on (copies don't sync later edits)
  const [copyAddonSource, setCopyAddonSource] = useState<ServiceAddon | null>(null);
  const [priceReviewBusy, setPriceReviewBusy] = useState<string | null>(null);
  const [copyTargetIds, setCopyTargetIds] = useState<string[]>([]);
  const [copyingAddon, setCopyingAddon] = useState(false);
  // Shown inline under the list right after a new add-on is saved: "Use it on your other services too?"
  const [copyPromptAddon, setCopyPromptAddon] = useState<ServiceAddon | null>(null);

  // Request counter: a services response only writes the list if no newer
  // services request has started since.
  const servicesReqRef = useRef(0);
  const serviceModalOpenRef = useRef(false);
  const savingRef = useRef(false);
  const didInitialFocusRef = useRef(false);
  // Unsaved-changes check: a snapshot of each editable page, taken after every
  // load and every successful save.
  const [baselineTick, setBaselineTick] = useState(0);
  const baselineRef = useRef<Partial<Record<EditableSection, string>>>({});

  useEffect(() => {
    serviceModalOpenRef.current = serviceModalVisible;
  }, [serviceModalVisible]);

  useEffect(() => {
    savingRef.current = saving;
  }, [saving]);

  // Sets the deposit toggle and input from a stored value. A stored 0 means
  // no deposit.
  const applyLoadedDeposit = (loaded: number | null | undefined) => {
    const on = typeof loaded === "number" && loaded > 0;
    setDepositEnabled(on);
    setDepositInput(on ? (loaded / 100).toFixed(2) : "");
    setDepositTouched(false);
    setDepositServerError(null);
  };

  const loadServicesList = async (token: string) => {
    const reqId = ++servicesReqRef.current;
    const res = await api.getVendorServices(token).catch(() => null);
    if (!res || reqId !== servicesReqRef.current) return null;
    setServices((res.services || []).map(normalizeService));
    return res;
  };

  // Refreshes only the services list; never touches the open form.
  const refreshServicesOnly = async () => {
    if (serviceModalOpenRef.current || savingRef.current) return;
    const token = await getToken();
    if (!token) return;
    await loadServicesList(token);
  };

  const fetchData = useCallback(async () => {
    const token = await getToken();
    if (!token) return;

    try {
      setLoading(true);
      const servicesReqId = ++servicesReqRef.current;
      const [businessRes, productsRes, servicesRes, eligibilityRes, setupRes] =
        await Promise.all([
          api.getVendorMyBusiness(token),
          api.getVendorProducts(token).catch(() => ({ products: [] })),
          api.getVendorServices(token).catch(() => ({ services: [] })),
          api.getVendorEligibility(token).catch(() => null),
          // One checklist with the website (backend #374). null → the hub builds its own.
          api.getBusinessSetupStatus(token).catch(() => null),
        ]);

      if (eligibilityRes) setEligibility(eligibilityRes);
      setSetupStatus(setupRes);

      const biz = businessRes.business;
      setBusiness(biz);
      setIndustry(industryFrom(biz));
      setIndustryDirty(false);
      setAllowPastClosing(
        typeof biz.allowPastClosing === "boolean" ? biz.allowPastClosing : null,
      );

      const normalizeProduct = (p: any): VendorProduct => ({
        ...p,
        priceCents:
          Number.isFinite(Number(p.priceCents)) && p.priceCents > 0
            ? Number(p.priceCents)
            : Number.isFinite(Number(p.price)) && p.price > 0
              ? Number(p.price)
              : 0,
      });
      setProducts((productsRes.products || []).map(normalizeProduct));
      // Only the latest services request may write the list.
      if (servicesReqId === servicesReqRef.current) {
        setServices((servicesRes.services || []).map(normalizeService));
      }

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
      setPolicyDraft(policyDraftFrom(biz as any));
      setDefaultDepositInput(depositInputFrom((biz as any).defaultDepositCents));
      setResponseTimeValue(Number((biz as any).responseTimeValue ?? 2));
      setResponseTimeUnit(
        ((biz as any).responseTimeUnit || "hours") as ResponseTimeUnit,
      );
      setProfileAddress(biz.address || "");
      setProfileCity(biz.city || "");
      setProfileState(biz.state || "");
      // ZIP and Known For were shown but never loaded or saved (found 2026-10-28).
      setProfileZip((biz as any).zipCode || "");
      setProfileSpecialties(knownForFrom((biz as any).knownFor));
      setKnownForChanged(false);

      // Parse CTA config
      const rawCta = (biz as any).ctaConfig;
      if (rawCta) {
        const parsedCta = typeof rawCta === "string" ? JSON.parse(rawCta) : rawCta;
        setCtaButtonType(parsedCta.buttonType ?? "book_now");
        setCtaProductTarget(parsedCta.productTarget ?? "most_recent");
        setCtaSpecificProductId(parsedCta.specificProductId ?? "");
        setCtaSpecificProductName(parsedCta.specificProductName ?? "");
      }

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
      // What was just loaded is the "nothing unsaved" point for every page.
      setBaselineTick((t) => t + 1);
    }
  }, [getToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refreshServicesRef = useRef(refreshServicesOnly);
  refreshServicesRef.current = refreshServicesOnly;

  // Pick up service changes made elsewhere (another device, the website) when
  // the screen regains focus. The first focus is covered by the mount load.
  useFocusEffect(
    useCallback(() => {
      if (!didInitialFocusRef.current) {
        didInitialFocusRef.current = true;
        return;
      }
      refreshServicesRef.current();
    }, []),
  );

  // Same when the app returns to the foreground while this screen is shown.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && navigation.isFocused()) {
        refreshServicesRef.current();
      }
    });
    return () => subscription.remove();
  }, [navigation]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  // ── Pages and unsaved changes ──────────────────────────────────────────────
  // Each editable page is compared with what was last loaded or saved. Only the
  // values that page saves are compared.
  const sectionSnapshot = (key: EditableSection): string => {
    switch (key) {
      case "branding":
        return JSON.stringify([
          coverImage,
          coverVideo,
          coverMediaType,
          logoImage,
          selectedColorId,
          ctaButtonType,
          ctaProductTarget,
          ctaSpecificProductId,
        ]);
      case "profile":
        return JSON.stringify([
          profileName,
          profileTagline,
          profileDescription,
          profileEmail,
          profilePhone,
          profileWebsite,
          showResponseTime,
          showEmail,
          showPhone,
          showWebsite,
          showStoreHours,
          hasPhysicalLocation,
          showAddress,
          defaultServiceLocationType,
          responseTimeValue,
          responseTimeUnit,
          profileAddress,
          profileCity,
          profileState,
          profileZip,
          profileSpecialties,
          industryDirty,
          industry,
        ]);
      case "hours":
        return JSON.stringify(hours);
      case "booking":
        return JSON.stringify([vendorTermsAndConditions, policyDraft, defaultDepositInput]);
    }
  };

  useEffect(() => {
    const next: Partial<Record<EditableSection, string>> = {};
    EDITABLE_SECTIONS.forEach((key) => {
      next[key] = sectionSnapshot(key);
    });
    baselineRef.current = next;
    // Only a load or a save moves the baseline; edits must not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baselineTick]);

  // Product and service forms: snapshot taken when the form opens.
  const productBaselineRef = useRef("");
  const productSnapshot = () => JSON.stringify([productForm, priceInput, stockMode, stockInput]);
  useEffect(() => {
    if (productModalVisible) productBaselineRef.current = productSnapshot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productModalVisible, productModalSession]);

  const serviceBaselineRef = useRef("");
  const serviceSnapshot = () =>
    JSON.stringify([
      serviceForm,
      depositEnabled,
      depositInput,
      durationHoursText,
      durationMinutesText,
      serviceImageUrl,
    ]);
  useEffect(() => {
    if (serviceModalVisible) serviceBaselineRef.current = serviceSnapshot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceModalVisible, editingService?.id]);

  const isEditable = (key: SectionKey): key is EditableSection =>
    (EDITABLE_SECTIONS as SectionKey[]).includes(key);

  // Checked when leaving, not during render: the snapshot is refreshed in an
  // effect right after a save, and a value computed during that render would
  // still say "unsaved".
  const hasUnsavedChanges = () =>
    isEditable(section) &&
    baselineRef.current[section] !== undefined &&
    sectionSnapshot(section) !== baselineRef.current[section];

  // Leave the current page; asks first when it has unsaved edits. Discard
  // reloads from the server so nothing half edited lingers in other pages.
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

  const openSection = (key: SectionKey) => {
    setShowDoneSteps(false);
    setSection(key);
  };

  // Back from a page goes to Manage business, never straight out of the editor:
  // header arrow, iOS swipe and Android back all land here.
  usePreventRemove(section !== "hub", ({ data }) => {
    const type = data.action.type;
    if (type === "GO_BACK" || type === "POP") {
      leaveSection(() => setSection("hub"));
    } else {
      // Sign out, resets and the like are never blocked.
      navigation.dispatch(data.action);
    }
  });

  const openSubscription = async () => {
    try {
      const token = await getToken();
      const active = Boolean(eligibility?.hasActiveSubscription ?? business?.subscriptionActive);
      // Same links as the settings menu: first timers buy, subscribers manage.
      const path = active ? "/subscription/manage" : "/subscription";
      const url = token
        ? `https://goutsyde.com${path}?from=app&token=${encodeURIComponent(token)}`
        : `https://goutsyde.com${path}?from=app`;
      await Linking.openURL(url);
    } catch {
      Alert.alert("Error", "Could not open subscription page.");
    }
  };

  // Same calls the Business Dashboard makes for payouts.
  const openPayouts = async (connect: boolean) => {
    const token = await getToken();
    if (!token) return;
    try {
      setPayoutLinkBusy(true);
      const { url } = connect
        ? await api.startVendorStripeOnboarding(token, STRIPE_RETURN_URL)
        : await api.getVendorStripeDashboardLink(token);
      if (url) await Linking.openURL(url);
    } catch (error: any) {
      if (!connect && error?.status === 403 && error?.body?.requiresOnboarding) {
        Alert.alert("Stripe Setup Required", "Please complete your Stripe setup before accessing payouts");
      } else {
        Alert.alert("Error", connect ? "Failed to connect Stripe. Please try again." : "Unable to open payout dashboard. Please try again.");
      }
    } finally {
      setPayoutLinkBusy(false);
    }
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
      const ctaPayload = {
        buttonType: ctaButtonType,
        ...(ctaButtonType === "buy_now" && {
          productTarget: ctaProductTarget,
          ...(ctaProductTarget === "specific" && {
            specificProductId: ctaSpecificProductId,
            specificProductName: ctaSpecificProductName,
          }),
        }),
      };

      await api.updateVendorMyBusiness(token, {
        brandColors: brandColorsPayload as any,
        coverImage: finalCoverImage || undefined,
        coverMediaType: finalCoverMediaType,
        logoImage: logoImage || undefined,
        ctaConfig: ctaPayload,
      });
      setBaselineTick((t) => t + 1);
      Alert.alert("Success", "Branding updated successfully");
    } catch (error: any) {
      console.error("[Storefront] Failed to save branding:", error);
      Alert.alert("Error", error.message || "Failed to save branding");
    } finally {
      setSaving(false);
    }
  };

  const loadTaxonomy = useCallback(async () => {
    setTaxonomyError(false);
    try {
      const data = await api.getBusinessTaxonomy();
      if (data && Array.isArray(data.categories)) setTaxonomy(data);
      else setTaxonomyError(true);
    } catch {
      setTaxonomyError(true);
    }
  }, []);

  useEffect(() => {
    if (section === "profile" && !taxonomy && !taxonomyError) loadTaxonomy();
  }, [section, taxonomy, taxonomyError, loadTaxonomy]);

  const changeIndustry = (next: IndustryValue) => {
    setIndustry(next);
    setIndustryDirty(true);
  };

  const handleSaveProfile = async () => {
    const token = await getToken();
    if (!token) return;

    if (!profileName.trim()) {
      Alert.alert("Business name", "Your business needs a name.");
      return;
    }

    if (industryDirty) {
      const problem = industryProblem(industry, offerTypeOf(business?.hasProducts, business?.hasServices));
      if (problem) {
        Alert.alert("Industry", problem);
        return;
      }
    }

    try {
      setSaving(true);
      // Emptied fields now clear (null) instead of silently keeping the old value.
      // Terms moved to Booking settings and save there.
      const profileData: Record<string, any> = {
        ...profilePayload({
          name: profileName,
          tagline: profileTagline,
          description: profileDescription,
          contactEmail: profileEmail,
          contactPhone: profilePhone,
          websiteUrl: profileWebsite,
          showResponseTime,
          showEmail,
          showPhone,
          showWebsite,
          showStoreHours,
          hasPhysicalLocation,
          showAddress,
          defaultServiceLocationType,
          responseTimeValue,
          responseTimeUnit,
          address: profileAddress,
          city: profileCity,
          state: profileState,
          zipCode: profileZip,
          knownFor: profileSpecialties,
          knownForChanged,
        }),
        ...(industryDirty ? industryPayload(industry) : {}),
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

  // Business terms (one set for the whole business, shown as a checkbox at
  // booking). Used to be typed in the service form and only saved by Save Profile.
  // Booking settings defaults (backend #374) ─────────────────────────────────
  const refreshSetupStatus = async (token: string) => {
    const next = await api.getBusinessSetupStatus(token).catch(() => null);
    if (next) setSetupStatus(next);
  };

  // The business default cancellation policy: new services start with it, and saving it marks the
  // policy as chosen for the setup checklist. Existing services keep their own policy.
  const handleSavePolicy = async () => {
    const token = await getToken();
    if (!token) return;
    const result = policyFromDraft(policyDraft);
    if ("error" in result) {
      Alert.alert("Cancellation policy", result.error);
      return;
    }
    try {
      setSaving(true);
      const res = await api.saveBusinessCancellationPolicy(token, result.policy);
      if (res?.business) {
        setBusiness(res.business);
        setPolicyDraft(policyDraftFrom(res.business as any));
      }
      setBaselineTick((t) => t + 1);
      await refreshSetupStatus(token);
      Alert.alert("Saved", "Your cancellation policy is saved. New services start with it.");
    } catch (error: any) {
      Alert.alert("Error", error?.body?.error || error?.message || "Failed to save your cancellation policy");
    } finally {
      setSaving(false);
    }
  };

  // Default deposit: only pre-fills new services; nothing already set up changes.
  const handleSaveDefaultDeposit = async () => {
    const token = await getToken();
    if (!token) return;
    const parsed = parseDefaultDepositInput(defaultDepositInput);
    if ("error" in parsed) {
      Alert.alert("Default deposit", parsed.error);
      return;
    }
    try {
      setSaving(true);
      const res = await api.updateVendorMyBusiness(token, { defaultDepositCents: parsed.cents } as any);
      if (res?.business) {
        setBusiness(res.business);
        setDefaultDepositInput(depositInputFrom((res.business as any).defaultDepositCents));
      }
      setBaselineTick((t) => t + 1);
      Alert.alert(
        "Saved",
        parsed.cents ? "New services will start with this deposit." : "New services start with no deposit.",
      );
    } catch (error: any) {
      Alert.alert("Error", error?.body?.message || error?.message || "Failed to save your default deposit");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTerms = async () => {
    const token = await getToken();
    if (!token) return;
    try {
      setSaving(true);
      const res = await api.updateVendorMyBusiness(token, termsPayload(vendorTermsAndConditions) as any);
      const saved = (res?.business as any)?.vendorTermsAndConditions;
      if (res?.business) setBusiness(res.business);
      setVendorTermsAndConditions(typeof saved === "string" ? saved : "");
      setBaselineTick((t) => t + 1);
      Alert.alert("Saved", vendorTermsAndConditions.trim() ? "Your business terms are saved." : "Your business terms are removed.");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to save your terms");
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePastClosing = async (next: boolean) => {
    const token = await getToken();
    if (!token || savingPastClosing) return;
    const previous = allowPastClosing;
    setAllowPastClosing(next);
    setSavingPastClosing(true);
    try {
      const res = await api.updateVendorMyBusiness(token, {
        allowPastClosing: next,
      });
      const saved = res?.business?.allowPastClosing;
      if (typeof saved === "boolean") setAllowPastClosing(saved);
      availabilityEvents.emit();
    } catch (error: any) {
      setAllowPastClosing(previous);
      Alert.alert(
        "Error",
        error?.message || "Could not save this setting. Please try again.",
      );
    } finally {
      setSavingPastClosing(false);
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
        const syncRes = await api.updateVendorMyBusiness(token, { hoursOfOperation });
        // Keeps the "Set your hours" step on Manage business in step without a reload.
        if (syncRes?.business) setBusiness(syncRes.business);
        console.log("[Storefront] hoursOfOperation synced successfully");
      } catch (syncError) {
        console.warn(
          "[Storefront] Failed to sync hoursOfOperation (non-blocking):",
          syncError,
        );
      }

      // Emit availability changed event so other screens can refresh
      availabilityEvents.emit();

      setBaselineTick((t) => t + 1);
      Alert.alert("Success", "Business hours updated successfully");
    } catch (error: any) {
      console.error("[Storefront] Failed to save hours:", error);
      Alert.alert("Error", error.message || "Failed to save hours");
    } finally {
      setSaving(false);
    }
  };

  const openProductForm = async (product?: VendorProduct) => {
    // Reset variant state before populating
    setLocalVariants([]);
    setInitialVariants([]);
    setOptionsInitial(null);
    setOptionsFallback(false);
    setAddonsInitial(null);
    setProductModalSession((n) => n + 1);

    // Capture token for the modal session (used by VariantBuilderSection)
    const modalToken = await getToken();
    setProductModalToken(modalToken ?? "");

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
        status: product.status,
      });
      setStockMode(stockModeOf(product));
      setStockInput(stockModeOf(product) === "count" ? String(product.inventory) : "");

      // Add-ons (vendor route, switched-off ones included). Loaded alongside the options.
      // Only the latest opened product's answer is used (a slow answer for another item is ignored).
      addonsLoadForRef.current = product.id;
      api
        .getProductAddons(modalToken ?? "", product.id)
        .then((groups) => addonsLoadForRef.current === product.id && setAddonsInitial(groups))
        .catch(() => addonsLoadForRef.current === product.id && setAddonsInitial("failed"));

      // Load options + variations for the editor (vendor route, includes
      // switched-off variations). Fall back to the older editor if it fails.
      try {
        const opts = await api.getProductOptions(modalToken ?? "", product.id);
        setOptionsInitial(opts);
      } catch {
        setOptionsFallback(true);
        try {
          const full = await api.getProductWithVariants(product.id);
          setInitialVariants(full.variants ?? []);
        } catch {
          setInitialVariants([]);
        }
      }
    } else {
      setEditingProduct(null);
      addonsLoadForRef.current = null;
      setAddonsInitial([]);
      setPriceInput("");
      setProductForm({
        name: "",
        description: "",
        priceCents: 0,
        imageUrl: "",
        status: "draft",
      });
      setStockMode("unlimited");
      setStockInput("");
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

    // Options editor: check it before saving anything (null = untouched).
    const optionsSave = optionsFallback ? null : optionsEditorRef.current?.getSaveBody() ?? null;
    if (optionsSave && "error" in optionsSave) {
      Alert.alert("Check your options", optionsSave.error);
      return;
    }
    const addonsSave = addonsEditorRef.current?.getSaveBody() ?? null;
    if (addonsSave && "error" in addonsSave) {
      Alert.alert("Check your add-ons", addonsSave.error);
      return;
    }

    const hasVariantRows = optionsFallback && localVariants.some((v: LocalVariant) => !v.isDeleted);
    if (hasVariantRows) {
      const validVariants = localVariants.filter(
        (v: LocalVariant) => !v.isDeleted && v.label.trim().length > 0 && v.priceCents > 0
      );
      if (validVariants.length === 0) {
        Alert.alert(
          "Variants incomplete",
          "Add at least one variant with a name and price, or turn off variants."
        );
        return;
      }
    }
    const priceCentsValue = Math.round(parsedDollars * 100);

    const stock = stockPayload(stockMode, stockInput);
    if ("error" in stock) {
      Alert.alert("Stock", stock.error);
      return;
    }

    const payload: typeof productForm = {
      ...productForm,
      priceCents: priceCentsValue,
      inventory: stock.inventory,
      trackInventory: stock.trackInventory,
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

      // Options + variations (one call, backend #310)
      if (optionsSave && "body" in optionsSave) {
        try {
          await api.saveProductOptions(token, productId, optionsSave.body);
        } catch (optErr: any) {
          const msg = optErr?.body?.error?.message || optErr?.message || "Please try again.";
          setProductModalVisible(false);
          fetchData();
          Alert.alert("Product saved, options not saved", String(msg));
          return;
        }
      }

      // Add-ons (one call, backend #371). Only when something changed in the add-ons editor.
      if (addonsSave && "body" in addonsSave) {
        try {
          await api.saveProductAddons(token, productId, addonsSave.body);
        } catch (addErr: any) {
          const msg = addErr?.body?.error?.message || addErr?.message || "Please try again.";
          setProductModalVisible(false);
          fetchData();
          Alert.alert("Product saved, add-ons not saved", String(msg));
          return;
        }
      }

      // Older editor only (fallback): new → POST, dirty existing → PATCH
      const validVariants = optionsFallback
        ? localVariants.filter(
            (v: LocalVariant) => !v.isDeleted && v.label.trim().length > 0 && v.priceCents > 0
          )
        : [];
      if (validVariants.length > 0) {
        await Promise.all([
          ...validVariants
            .filter((v: LocalVariant) => v.isNew)
            .map((v: LocalVariant) =>
              api.createProductVariant(token, productId, {
                label: v.label.trim(),
                priceCents: v.priceCents,
                inventory: v.inventory,
                sortOrder: v.sortOrder,
              })
            ),
          ...validVariants
            .filter((v: LocalVariant) => !v.isNew && v.isDirty)
            .map((v: LocalVariant) =>
              api.updateProductVariant(token, productId, v.id!, {
                label: v.label.trim(),
                priceCents: v.priceCents,
                inventory: v.inventory,
                isActive: v.isActive,
                sortOrder: v.sortOrder,
              })
            ),
        ]);
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
        depositAmountCents: s.depositAmountCents ?? null,
      });
      applyLoadedDeposit(s.depositAmountCents);
      setDepositFromDefault(false);
      setServiceImageUrl(s.imageUrl ?? null);
      applyLoadedDuration(service.durationMinutes || 60);
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
        depositAmountCents: null,
      });
      // New services start with the business default deposit (backend #374). Pre-fill only:
      // the business can change or switch it off here before saving.
      const defaultDeposit = typeof biz?.defaultDepositCents === "number" && biz.defaultDepositCents > 0 ? biz.defaultDepositCents : null;
      applyLoadedDeposit(defaultDeposit);
      setDepositFromDefault(defaultDeposit !== null);
      setServiceImageUrl(null);
      applyLoadedDuration(60);
    }
    setServiceImageTouched(false);
    setServiceAddons([]);
    setAddonError(null);
    setServiceModalVisible(true);
    if (service?.id) {
      (async () => {
        setAddonsLoading(true);
        try {
          const token = await getToken();
          if (token) {
            const addons = await getServiceAddons(token, service.id);
            setServiceAddons(addons.slice().sort((a, b) => a.sortOrder - b.sortOrder));
          }
        } catch {
          // non-blocking; addons list stays empty
        } finally {
          setAddonsLoading(false);
        }
      })();
    }
  };

  const parsedDeposit = parseDepositInput(depositInput);
  const depositError = !depositEnabled
    ? null
    : "error" in parsedDeposit
      ? parsedDeposit.error
      : parsedDeposit.cents < MIN_DEPOSIT_CENTS
        ? "Deposit must be at least $7.00."
        : // Checked once a price is typed (a new service can start with the default deposit).
          (serviceForm.priceCents || 0) > 0 && parsedDeposit.cents >= serviceForm.priceCents
          ? "Deposit must be less than the service price."
          : null;

  const applyLoadedDuration = (minutes: number) => {
    const split = splitMinutes(minutes);
    setDurationHoursText(String(split.hours));
    setDurationMinutesText(String(split.minutes));
    setDurationError(null);
  };

  const changeDuration = (hoursText: string, minutesText: string) => {
    setDurationHoursText(hoursText);
    setDurationMinutesText(minutesText);
    setDurationError(null);
    setServiceForm((f) => ({
      ...f,
      durationMinutes: joinMinutes(hoursText, minutesText),
    }));
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

    // The duration error is shown inline under the boxes.
    if (durationError) return;
    if (parseInt(durationMinutesText || "0", 10) > 59) {
      setDurationError("Minutes must be between 0 and 59.");
      return;
    }
    if (joinMinutes(durationHoursText, durationMinutesText) < MIN_SERVICE_DURATION_MINUTES) {
      setDurationError(`Duration must be at least ${MIN_SERVICE_DURATION_MINUTES} minutes.`);
      return;
    }

    // The deposit error is already shown inline under the field.
    if (depositError) return;

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

    // Deposit: sent on create; on edit only when the vendor changed it, so a
    // deposit set elsewhere is never overwritten by an untouched form.
    const { depositAmountCents: _loadedDeposit, ...baseServiceForm } =
      serviceForm;
    const depositValue =
      depositEnabled && "cents" in parsedDeposit ? parsedDeposit.cents : null;

    try {
      setSaving(true);
      let serviceId: string;
      if (editingService) {
        await api.updateVendorService(
          token,
          editingService.id,
          depositTouched
            ? {
                ...baseServiceForm,
                depositAmountCents: depositValue,
                ...(serviceImageTouched ? { imageUrl: serviceImageUrl } : {}),
              }
            : {
                ...baseServiceForm,
                ...(serviceImageTouched ? { imageUrl: serviceImageUrl } : {}),
              },
        );
        serviceId = editingService.id;
      } else {
        const response = await api.createVendorService(token, {
          ...baseServiceForm,
          depositAmountCents: depositValue,
          ...(serviceImageUrl ? { imageUrl: serviceImageUrl } : {}),
        });
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
      if (error.status === 400 && error.body?.code === "INVALID_DEPOSIT") {
        setDepositServerError(error.message);
        if (editingService) {
          // Reload the saved deposit and status; keep the vendor's typed price
          // and other unsaved fields so the conflict shows inline.
          const res = await loadServicesList(token);
          const fresh = res?.services
            .map(normalizeService)
            .find((s) => s.id === editingService.id);
          if (fresh && serviceModalOpenRef.current) {
            setEditingService(fresh);
            setServiceForm((f) => ({
              ...f,
              status: fresh.status,
              depositAmountCents: fresh.depositAmountCents ?? null,
            }));
            applyLoadedDeposit(fresh.depositAmountCents);
            setDepositServerError(error.message);
          }
        }
        return;
      }
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

  const handleServiceImageSelected = async (uri: string) => {
    const token = await getToken();
    if (!token) {
      Alert.alert("Error", "Authentication required. Please log in again.");
      return;
    }
    try {
      setSaving(true);
      const result = await uploadImage(uri, "image/jpeg", "services", token);
      setServiceImageUrl(result.url);
      setServiceImageTouched(true);
    } catch (error: any) {
      Alert.alert("Upload Error", error.message || "Failed to upload service image");
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
    serviceThumb: {
      width: 44,
      height: 44,
      borderRadius: 8,
      marginRight: 10,
      backgroundColor: theme.brandSurface,
    },
    serviceDetails: {
      flexDirection: "row",
      flexWrap: "wrap",
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
    // ── Manage business (2026-10-28) ──
    formSectionTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.brandCream,
      marginTop: 20,
      marginBottom: 10,
    },
    formSectionHelp: {
      fontSize: 13,
      color: theme.brandTextDim,
      lineHeight: 19,
      marginTop: -4,
      marginBottom: 12,
    },
    previewButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      minHeight: 48,
      borderRadius: 12,
      backgroundColor: theme.brandSurface,
      borderWidth: 1,
      borderColor: theme.brandSurfaceBorder,
      marginTop: 16,
      marginBottom: 8,
    },
    previewButtonText: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.brandCream,
    },
    policyChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
    policyChip: {
      minHeight: 36,
      paddingHorizontal: 12,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.brandSurfaceBorder,
      backgroundColor: theme.brandSurface,
      justifyContent: "center",
    },
    policyChipOn: { borderColor: theme.brandGold, backgroundColor: "rgba(232,185,48,0.14)" },
    policyChipText: { fontSize: 14, color: theme.brandCream },
    policyChipTextOn: { color: theme.brandGold, fontWeight: "700" },
    noteBox: {
      flexDirection: "row",
      gap: 10,
      alignItems: "flex-start",
      padding: 12,
      borderRadius: 10,
      backgroundColor: theme.brandSurface,
      marginTop: 8,
      marginBottom: 16,
    },
    noteBoxText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 19,
      color: theme.brandTextDim,
    },
    hubGroupLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.brandTextDim,
      marginTop: 22,
      marginBottom: 8,
      marginHorizontal: 4,
    },
    hubCard: {
      backgroundColor: theme.brandBgElevated,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.brandSurfaceBorder,
      overflow: "hidden",
    },
    hubRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingHorizontal: 16,
      paddingVertical: 12,
      minHeight: 60,
    },
    hubRowDivider: {
      borderTopWidth: 1,
      borderTopColor: theme.brandSurfaceBorder,
    },
    hubIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: theme.brandPrimary,
      alignItems: "center",
      justifyContent: "center",
    },
    hubRowTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.brandCream,
    },
    hubRowSub: {
      fontSize: 13,
      color: theme.brandTextDim,
      marginTop: 2,
    },
    hubTag: {
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: theme.brandGold + "22",
    },
    hubTagText: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.brandGoldDim,
    },
    setupCard: {
      backgroundColor: theme.brandPrimary,
      borderRadius: 16,
      padding: 16,
      marginTop: 4,
    },
    setupTitleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "baseline",
    },
    setupTitle: {
      fontSize: 16,
      fontWeight: "800",
      color: theme.brandPrimaryText,
    },
    setupCount: {
      fontSize: 14,
      fontWeight: "700",
      color: SETUP_GOLD,
    },
    setupBar: {
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.brandPrimaryText + "26",
      marginTop: 12,
      marginBottom: 6,
      overflow: "hidden",
    },
    setupBarFill: {
      height: 8,
      borderRadius: 4,
      backgroundColor: SETUP_GOLD,
    },
    setupStep: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      minHeight: 44,
    },
    setupDot: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 2,
      borderColor: SETUP_GOLD,
      alignItems: "center",
      justifyContent: "center",
    },
    setupStepText: {
      flex: 1,
      fontSize: 15,
      color: theme.brandPrimaryText,
    },
    setupToggle: {
      minHeight: 44,
      justifyContent: "center",
    },
    setupToggleText: {
      fontSize: 14,
      fontWeight: "700",
      color: SETUP_GOLD,
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

        {/* ── Quick Action Button Config ─────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quick Action Button</Text>
          <Text style={styles.cardDesc}>
            The floating button customers see on your profile. Choose whether it books a
            service or buys a product.
          </Text>

          {/* Button type selector */}
          <Text style={styles.inputLabel}>Button Type</Text>
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
            {(["book_now", "buy_now"] as const).map((type) => {
              const isSelected = ctaButtonType === type;
              return (
                <Pressable
                  key={type}
                  onPress={() => setCtaButtonType(type)}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 10,
                    borderWidth: 1.5,
                    alignItems: "center",
                    borderColor: isSelected ? theme.brandGold : theme.brandSurfaceBorder,
                    backgroundColor: isSelected
                      ? theme.brandGold + "22"
                      : theme.brandSurface,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: isSelected ? "700" : "500",
                      color: isSelected ? theme.brandGold : theme.brandTextDim,
                    }}
                  >
                    {type === "book_now" ? "📅  Book Now" : "🛒  Buy Now"}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Book Now — informational only */}
          {ctaButtonType === "book_now" && (
            <View
              style={{
                backgroundColor: theme.brandGold + "14",
                borderRadius: 10,
                padding: 14,
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 10,
              }}
            >
              <Text style={{ fontSize: 16 }}>📅</Text>
              <Text
                style={{ flex: 1, fontSize: 13, color: theme.brandTextDim, lineHeight: 19 }}
              >
                Customers tap this to open your booking flow where they pick a service
                and time. No extra setup needed.
              </Text>
            </View>
          )}

          {/* Buy Now — product target selector */}
          {ctaButtonType === "buy_now" && (
            <>
              <Text style={styles.inputLabel}>Which Product?</Text>
              <Text style={styles.cardDesc}>
                Choose which product gets added to cart when a customer taps Buy Now.
              </Text>

              {/* Target options */}
              {(
                [
                  {
                    value: "most_recent" as const,
                    label: "Most Recent",
                    desc: "Your newest product",
                  },
                  {
                    value: "oldest" as const,
                    label: "Oldest",
                    desc: "Your first product",
                  },
                  {
                    value: "best_selling" as const,
                    label: "Best Selling",
                    desc: "Highest number of orders",
                  },
                  {
                    value: "specific" as const,
                    label: "Specific Product",
                    desc: "You choose exactly which one",
                  },
                ] as const
              ).map((opt) => {
                if (opt.value === "specific" && products.length === 0) return null;
                const isSelected = ctaProductTarget === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => {
                      setCtaProductTarget(opt.value);
                      if (opt.value !== "specific") {
                        setCtaSpecificProductId("");
                        setCtaSpecificProductName("");
                      }
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      padding: 12,
                      borderRadius: 10,
                      borderWidth: 1.5,
                      marginBottom: 8,
                      borderColor: isSelected
                        ? theme.brandGold
                        : theme.brandSurfaceBorder,
                      backgroundColor: isSelected
                        ? theme.brandGold + "14"
                        : theme.brandSurface,
                      gap: 12,
                    }}
                  >
                    {/* Radio dot */}
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
                      >
                        {opt.label}
                      </Text>
                      <Text
                        style={{ fontSize: 12, color: theme.brandTextDim, marginTop: 2 }}
                      >
                        {opt.desc}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}

              {/* Specific product picker — only shown when "specific" is selected */}
              {ctaProductTarget === "specific" && products.length > 0 && (
                <View style={{ marginTop: 8, gap: 8 }}>
                  <Text style={styles.inputLabel}>Select a Product</Text>
                  {products.map((product) => {
                    const isSelected = ctaSpecificProductId === String(product.id);
                    return (
                      <Pressable
                        key={String(product.id)}
                        onPress={() => {
                          setCtaSpecificProductId(String(product.id));
                          setCtaSpecificProductName(product.name);
                        }}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          padding: 12,
                          borderRadius: 10,
                          borderWidth: 1.5,
                          borderColor: isSelected
                            ? theme.brandGold
                            : theme.brandSurfaceBorder,
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
                            borderColor: isSelected
                              ? theme.brandGold
                              : theme.brandTextDim,
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
                            {product.name}
                          </Text>
                          <Text
                            style={{ fontSize: 12, color: theme.brandTextDim, marginTop: 1 }}
                          >
                            ${(product.priceCents / 100).toFixed(2)} · {product.status}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {/* No products warning */}
              {products.length === 0 && (
                <View
                  style={{
                    backgroundColor: theme.brandSurface,
                    borderRadius: 10,
                    padding: 14,
                    marginTop: 8,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{ fontSize: 13, color: theme.brandTextDim, textAlign: "center" }}
                  >
                    Add a product under Manage business, Products first, then come back
                    to set up your Buy Now button.
                  </Text>
                </View>
              )}
            </>
          )}
        </View>
        {/* ── End Quick Action Button Config ─────────────────────────────── */}

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

  const renderIndustryChips = (list: TaxonomySpecialty[], max: number) => (
    <View style={styles.specialtyGrid}>
      {list.map((sp) => {
        const active = industry.specialties.includes(sp.code);
        const full = !active && industry.specialties.length >= max;
        return (
          <Pressable
            key={sp.code}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled: full }}
            disabled={full}
            style={[styles.specialtyChip, active && styles.specialtyChipActive, full && { opacity: 0.4 }]}
            onPress={() =>
              changeIndustry({
                ...industry,
                specialties: active
                  ? industry.specialties.filter((c) => c !== sp.code)
                  : [...industry.specialties, sp.code],
              })
            }
          >
            <Text style={[styles.specialtyText, active && styles.specialtyTextActive]}>{sp.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  const renderIndustryCard = () => {
    const offer = offerTypeOf(business?.hasProducts, business?.hasServices);
    const category = findCategory(taxonomy, industry.categoryCode);
    const max = taxonomy?.maxSpecialties ?? 3;
    const available = specialtiesFor(category, offer);
    const offerText =
      offer === "both" ? "You offer services and sell products." : offer === "services" ? "You offer services." : offer === "products" ? "You sell products." : "";
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Industry</Text>
        <Text style={styles.cardDesc}>
          Helps customers who are looking for what you do find you. {offerText}
        </Text>
        {taxonomyError ? (
          <Pressable onPress={loadTaxonomy} accessibilityRole="button">
            <Text style={styles.cardDesc}>
              We couldn{"\u2019"}t load the industry list. <Text style={{ color: theme.brandGold }}>Try again</Text>
            </Text>
          </Pressable>
        ) : !taxonomy ? (
          <ActivityIndicator color={theme.brandGold} />
        ) : (
          <>
            <Text style={styles.inputLabel}>Your industry</Text>
            <View style={[styles.specialtyGrid, { marginBottom: 12 }]}>
              {taxonomy.categories.map((c) => {
                const active = industry.categoryCode === c.code;
                return (
                  <Pressable
                    key={c.code}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    style={[styles.specialtyChip, active && styles.specialtyChipActive]}
                    onPress={() => {
                      if (!active) changeIndustry({ ...industry, categoryCode: c.code, specialties: [] });
                    }}
                  >
                    <Text style={[styles.specialtyText, active && styles.specialtyTextActive]}>{c.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {category && category.code !== "other" && offer ? (
              <>
                <Text style={styles.inputLabel}>What do you do? (pick up to {max})</Text>
                {offer === "both" ? (
                  <>
                    <Text style={[styles.cardDesc, { marginBottom: 6 }]}>Services</Text>
                    {renderIndustryChips(available.filter((s) => s.kind === "service"), max)}
                    <Text style={[styles.cardDesc, { marginTop: 12, marginBottom: 6 }]}>Products</Text>
                    {renderIndustryChips(available.filter((s) => s.kind === "product"), max)}
                  </>
                ) : (
                  renderIndustryChips(available, max)
                )}
              </>
            ) : null}

            {needsOtherDescription(industry) ? (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.inputLabel}>Tell us what you do</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={industry.otherDescription}
                  onChangeText={(t) => changeIndustry({ ...industry, otherDescription: t.slice(0, OTHER_DESCRIPTION_MAX) })}
                  placeholder="Describe your business in your own words"
                  placeholderTextColor={theme.brandTextDim}
                  maxLength={OTHER_DESCRIPTION_MAX}
                  multiline
                />
                <Text style={styles.cardDesc}>{industry.otherDescription.length}/{OTHER_DESCRIPTION_MAX}</Text>
              </View>
            ) : null}
          </>
        )}
      </View>
    );
  };

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

        {renderIndustryCard()}

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
                    setKnownForChanged(true);
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
        {allowPastClosing !== null && (
          <View style={[styles.card, { marginTop: 16 }]}>
            <View style={styles.visibilityLabelRow}>
              <Text style={styles.inputLabel}>Run past closing</Text>
              <Switch
                value={allowPastClosing}
                onValueChange={handleTogglePastClosing}
                disabled={savingPastClosing}
                trackColor={{ true: theme.brandGold }}
                accessibilityLabel="Run past closing"
              />
            </View>
            <Text style={styles.visibilityHelp}>
              When this is on, clients can book a service that starts during
              your open hours and finishes after you close. Bookings never run
              past midnight.
            </Text>
          </View>
        )}
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
                {!product.imageUrl && product.status !== "archived" ? (
                  <Text style={{ fontSize: 12, fontWeight: "700", color: theme.brandGoldDim, marginBottom: 4 }}>
                    Needs a photo
                  </Text>
                ) : null}
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
                  <Text style={styles.serviceDetailText}>{stockLabel(product)}</Text>
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
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${product.name}`}
                  >
                    <Feather name="edit-2" size={16} color={theme.brandCream} />
                  </Pressable>
                  <Pressable
                    style={styles.actionButton}
                    onPress={() => handleDeleteProduct(product.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${product.name}`}
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
                {service.imageUrl ? (
                  <Image
                    source={{ uri: service.imageUrl }}
                    style={styles.serviceThumb}
                  />
                ) : null}
                <View style={{ flex: 1 }}>
                  <Text style={styles.serviceName}>{service.name}</Text>
                  {!service.imageUrl && service.status !== "archived" ? (
                    <Text style={{ fontSize: 12, fontWeight: "700", color: theme.brandGoldDim, marginTop: 2 }}>
                      Needs a photo
                    </Text>
                  ) : null}
                </View>
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
                    {typeof service.depositAmountCents === "number" &&
                    service.depositAmountCents > 0
                      ? ` · ${formatPrice(service.depositAmountCents)} deposit`
                      : ""}
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
                      {formatDuration(service.durationMinutes)}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.productActions}>
                <Pressable
                  style={styles.actionButton}
                  onPress={() => openServiceForm(service)}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${service.name}`}
                >
                  <Feather name="edit-2" size={16} color={theme.brandCream} />
                </Pressable>
                <Pressable
                  style={styles.actionButton}
                  onPress={() => handleDeleteService(service.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${service.name}`}
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

  // Unsaved edits in the product form: fields, photo, or the variations editor.
  const productHasUnsavedChanges = () =>
    productSnapshot() !== productBaselineRef.current ||
    (optionsFallback
      ? localVariants.some((v: LocalVariant) => v.isNew || v.isDirty || v.isDeleted)
      : optionsEditorRef.current?.getSaveBody() != null) ||
    addonsEditorRef.current?.getSaveBody() != null;

  const closeProductModal = () => {
    if (!productHasUnsavedChanges()) {
      setProductModalVisible(false);
      return;
    }
    Alert.alert("Discard changes?", "Your changes to this product aren't saved yet.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => setProductModalVisible(false) },
    ]);
  };

  // Opens the real customer product page for the saved product.
  const previewProduct = () => {
    const p = editingProduct;
    if (!p || !business) return;
    if (productHasUnsavedChanges()) {
      Alert.alert("Save first", "Save your changes to see them on the customer page.");
      return;
    }
    setProductModalVisible(false);
    navigation.navigate("ProductDetail", {
      id: String(p.id),
      businessId: String(business.id),
      name: p.name,
      description: p.description ?? null,
      priceCents: p.priceCents,
      imageUrl: p.imageUrl ?? null,
      inventory: customerStock(p),
    });
  };

  const renderProductModal = () => (
    <Modal visible={productModalVisible} animationType="slide" onRequestClose={closeProductModal}>
      <View style={styles.modal}>
        <View style={styles.modalHeader}>
          <Pressable onPress={closeProductModal} accessibilityRole="button" accessibilityLabel="Close">
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
          {/* Photo first: it's the first thing customers see. */}
          <Text style={styles.inputLabel}>Photo</Text>
          <ImageUploader
            currentImage={productForm.imageUrl || undefined}
            onImageSelected={handleProductImageSelected}
            onRemove={() =>
              setProductForm((prev) => ({ ...prev, imageUrl: "" }))
            }
            aspectRatio="product"
            placeholder="Upload Product Image"
          />

          <Text style={[styles.formSectionTitle, { marginTop: 8 }]}>Basics</Text>
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

          <Text style={styles.inputLabel}>Stock</Text>
          <View style={styles.policyChips}>
            {([
              ["unlimited", "No limit"],
              ["count", "Count it"],
              ["soldout", "Sold out"],
            ] as const).map(([mode, label]) => {
              const on = stockMode === mode;
              return (
                <Pressable
                  key={mode}
                  onPress={() => setStockMode(mode)}
                  style={[styles.policyChip, on && styles.policyChipOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                >
                  <Text style={[styles.policyChipText, on && styles.policyChipTextOn]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          {stockMode === "count" ? (
            <TextInput
              style={styles.input}
              value={stockInput}
              onChangeText={(v) => setStockInput(v.replace(/[^0-9]/g, "").slice(0, 7))}
              placeholder="How many you have"
              placeholderTextColor={theme.brandTextDim}
              keyboardType="number-pad"
              accessibilityLabel="How many you have"
            />
          ) : null}
          <Text style={[styles.formSectionHelp, { marginTop: -8 }]}>
            {stockMode === "unlimited"
              ? "It never sells out. Good for things you make to order, like baked goods."
              : stockMode === "soldout"
                ? "Customers see Sold out and can't buy it until you change this."
                : "It sells out when this many are bought. Customers never see the number."}
          </Text>

          <Text style={styles.formSectionTitle}>How customers customize it</Text>
          <Text style={styles.formSectionHelp}>
            Variations are versions of the product, like color, size or pack. Customers pick one of each.
          </Text>
          {optionsFallback ? (
            <VariantBuilderSection
              productId={editingProduct?.id}
              initialVariants={initialVariants}
              onVariantsChange={setLocalVariants}
              authToken={productModalToken}
            />
          ) : (
            <ProductOptionsEditor
              key={`options-${productModalSession}-${optionsInitial ? "loaded" : "empty"}`}
              ref={optionsEditorRef}
              initial={optionsInitial}
              productPriceCents={(() => {
                const n = parseFloat(priceInput);
                return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
              })()}
              productInventory={
                stockMode === "unlimited"
                  ? null
                  : stockMode === "soldout"
                    ? 0
                    : (() => {
                        const n = parseInt(stockInput, 10);
                        return Number.isFinite(n) ? n : null;
                      })()
              }
              authToken={productModalToken}
            />
          )}

          <Text style={styles.formSectionTitle}>Add-ons</Text>
          {addonsInitial === null ? (
            <ActivityIndicator color={theme.brandGold} style={{ marginVertical: 12 }} />
          ) : addonsInitial === "failed" ? (
            <Text style={styles.formSectionHelp}>
              {"Add-ons couldn't load. Close this item and open it again to edit them."}
            </Text>
          ) : (
            <ProductAddonsEditor
              key={`addons-${productModalSession}`}
              ref={addonsEditorRef}
              initial={addonsInitial}
              productId={editingProduct?.id ?? null}
              authToken={productModalToken}
            />
          )}

          {editingProduct ? (
            <Pressable
              onPress={previewProduct}
              style={styles.previewButton}
              accessibilityRole="button"
            >
              <Feather name="eye" size={18} color={theme.brandCream} />
              <Text style={styles.previewButtonText}>See what customers see</Text>
            </Pressable>
          ) : null}

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

  // Services an add-on can be copied to: every other service that isn't deleted (archived).
  const copyTargetServices = services.filter(
    (svc) => svc.id !== editingService?.id && svc.status !== "archived"
  );

  const openCopySheet = (addon: ServiceAddon) => {
    setCopyPromptAddon(null);
    setCopyAddonSource(addon);
    setCopyTargetIds(copyTargetServices.map((svc) => svc.id));
  };

  // Answer to "Your add-on price is now $X" for this service (Use = follow the library again).
  const handleAddonPriceReview = async (addon: ServiceAddon, action: "sync" | "keep") => {
    const serviceId = editingService?.id;
    if (!serviceId) return;
    const token = await getToken();
    if (!token) return;
    setPriceReviewBusy(addon.id);
    try {
      await reviewServiceAddonPrice(token, serviceId, addon.id, action);
      const fresh = await getServiceAddons(token, serviceId);
      setServiceAddons(fresh.slice().sort((a, b) => a.sortOrder - b.sortOrder));
    } catch (e) {
      Alert.alert("Couldn't update the price", readableApiError(e));
    } finally {
      setPriceReviewBusy(null);
    }
  };

  const handleCopyAddon = async () => {
    const source = copyAddonSource;
    if (!source || copyTargetIds.length === 0) return;
    const token = await getToken();
    if (!token) return;
    setCopyingAddon(true);
    const added: string[] = [];
    const alreadyHas: string[] = [];
    const atLimit: string[] = [];
    const failed: string[] = [];
    const sourceName = source.name.trim().toLowerCase();
    const labelOf = (id: string) => services.find((svc) => svc.id === id)?.name || "Service";
    if (source.businessAddonId) {
      // In the add-on library: attach the library add-on, so every copy follows
      // later changes made in the Add-ons tab (backend skips duplicates and the 20 limit).
      try {
        const result = await attachLibraryAddon(token, source.businessAddonId, copyTargetIds);
        result.added.forEach((id) => added.push(labelOf(id)));
        result.skipped.forEach((x) => (x.reason === "limit" ? atLimit : alreadyHas).push(labelOf(x.serviceId)));
      } catch {
        copyTargetIds.forEach((id) => failed.push(labelOf(id)));
      }
    }
    // Not in the library (older add-ons): copy one service at a time so a failure
    // on one doesn't stop the rest.
    for (const targetId of source.businessAddonId ? [] : copyTargetIds) {
      const target = services.find((svc) => svc.id === targetId);
      const label = target?.name || "Service";
      try {
        const existing = await getServiceAddons(token, targetId);
        if (existing.some((a) => a.name.trim().toLowerCase() === sourceName)) {
          alreadyHas.push(label);
          continue;
        }
        if (existing.length >= 20) {
          atLimit.push(label);
          continue;
        }
        await createServiceAddon(token, targetId, {
          name: source.name,
          description: source.description ?? null,
          priceCents: source.priceCents,
          durationMinutes: source.durationMinutes,
          sortOrder: existing.length + 1,
          // Keep a switched-off add-on switched off in the copies.
          ...(source.isActive === false ? { isActive: false } : {}),
        });
        added.push(label);
      } catch {
        failed.push(label);
      }
    }
    setCopyingAddon(false);
    setCopyAddonSource(null);
    const lines = [
      `Added to ${added.length} service${added.length === 1 ? "" : "s"}.`,
      alreadyHas.length ? `Skipped (already has it): ${alreadyHas.join(", ")}` : "",
      atLimit.length ? `Skipped (20 add-on limit): ${atLimit.join(", ")}` : "",
      failed.length ? `Couldn't add, try again: ${failed.join(", ")}` : "",
    ].filter(Boolean);
    Alert.alert(failed.length ? "Partly done" : "Done", lines.join("\n"));
  };

  const closeServiceModal = () => {
    if (serviceSnapshot() === serviceBaselineRef.current) {
      setServiceModalVisible(false);
      return;
    }
    Alert.alert("Discard changes?", "Your changes to this service aren't saved yet.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => setServiceModalVisible(false) },
    ]);
  };

  const renderServiceModal = () => (
    <Modal visible={serviceModalVisible} animationType="slide" onRequestClose={closeServiceModal}>
      <View style={styles.modal}>
        <View style={styles.modalHeader}>
          <Pressable onPress={closeServiceModal} accessibilityRole="button" accessibilityLabel="Close">
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
          <Text style={[styles.formSectionTitle, { marginTop: 4 }]}>1. Basics</Text>
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

          <Text style={styles.inputLabel}>Service Image</Text>
          <ImageUploader
            currentImage={serviceImageUrl || undefined}
            onImageSelected={handleServiceImageSelected}
            onRemove={() => {
              setServiceImageUrl(null);
              setServiceImageTouched(true);
            }}
            aspectRatio="product"
            placeholder="Upload Service Image"
          />

          <Text style={styles.formSectionTitle}>2. Price and time</Text>
          <Text style={styles.inputLabel}>Price (in dollars)</Text>
          <TextInput
            style={styles.input}
            value={
              serviceForm.priceCents
                ? (serviceForm.priceCents / 100).toString()
                : ""
            }
            onChangeText={(v) => {
              setServiceForm({
                ...serviceForm,
                priceCents: Math.round(parseFloat(v || "0") * 100),
              });
              setDepositServerError(null);
            }}
            placeholder="0.00"
            placeholderTextColor={theme.brandTextDim}
            keyboardType="decimal-pad"
          />

          <Text style={styles.inputLabel}>Duration</Text>
          <View style={styles.row}>
            <View style={styles.flex1}>
              <Text style={[styles.inputLabel, { fontWeight: "400" }]}>Hours</Text>
              <TextInput
                style={styles.input}
                value={durationHoursText}
                onChangeText={(v) =>
                  changeDuration(v.replace(/\D/g, ""), durationMinutesText)
                }
                placeholder="0"
                placeholderTextColor={theme.brandTextDim}
                keyboardType="number-pad"
                accessibilityLabel="Duration hours"
              />
            </View>
            <View style={styles.flex1}>
              <Text style={[styles.inputLabel, { fontWeight: "400" }]}>Minutes</Text>
              <TextInput
                style={styles.input}
                value={durationMinutesText}
                onChangeText={(v) =>
                  changeDuration(durationHoursText, v.replace(/\D/g, ""))
                }
                placeholder="0"
                placeholderTextColor={theme.brandTextDim}
                keyboardType="number-pad"
                accessibilityLabel="Duration minutes"
              />
            </View>
          </View>
          {durationError && (
            <Text
              style={{
                fontSize: 12,
                color: theme.brandError,
                marginTop: -6,
                marginBottom: 12,
              }}
            >
              {durationError}
            </Text>
          )}

          <View style={styles.switchRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.inputLabel}>Require deposit at booking</Text>
              <Text style={{ fontSize: 13, color: theme.brandTextDim }}>
                Collect a deposit at booking, balance due at appointment
              </Text>
            </View>
            <Switch
              value={depositEnabled}
              onValueChange={(v) => {
                // Turning it off keeps the typed amount so turning it back on
                // restores it; an off toggle always saves as no deposit.
                setDepositEnabled(v);
                setDepositTouched(true);
                setDepositServerError(null);
              }}
              trackColor={{ true: theme.brandGold }}
              accessibilityLabel="Require deposit at booking"
            />
          </View>

          {depositServerError && !depositError && (
            <Text
              style={{
                fontSize: 12,
                color: theme.brandError,
                marginTop: -8,
                marginBottom: 12,
              }}
            >
              {depositServerError}
            </Text>
          )}

          {depositEnabled && (
            <>
              <Text style={styles.inputLabel}>Deposit (in dollars)</Text>
              <TextInput
                style={styles.input}
                value={depositInput}
                onChangeText={(v) => {
                  setDepositInput(v);
                  setDepositTouched(true);
                  setDepositServerError(null);
                }}
                onBlur={() => {
                  if ("cents" in parsedDeposit) {
                    setDepositInput((parsedDeposit.cents / 100).toFixed(2));
                  }
                }}
                placeholder="0.00"
                placeholderTextColor={theme.brandTextDim}
                keyboardType="decimal-pad"
                accessibilityLabel="Deposit amount in dollars"
              />
              {depositError ? (
                <Text
                  style={{
                    fontSize: 12,
                    color: theme.brandError,
                    marginTop: -6,
                    marginBottom: 12,
                  }}
                >
                  {depositError}
                </Text>
              ) : depositFromDefault && !editingService && !depositTouched ? (
                <Text style={{ fontSize: 12, color: theme.brandTextDim, marginTop: -6, marginBottom: 12 }}>
                  Your default deposit. Change it here for this service, or in Booking settings for new ones.
                </Text>
              ) : null}
            </>
          )}

          {/* ── Service Add-ons ── */}
          <View style={{ marginTop: 8, marginBottom: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={[styles.formSectionTitle, { marginTop: 0, marginBottom: 0 }]}>3. Add-ons</Text>
              {editingService?.id ? (
                serviceAddons.length < 20 ? (
                  <Pressable
                    onPress={() => {
                      setEditingAddon(null);
                      setAddonAddsTime(false);
                      setAddonForm({ name: "", description: "", priceCents: "", durationMinutes: "", sortOrder: String(serviceAddons.length + 1) });
                      setAddonError(null);
                      setAddonModalVisible(true);
                    }}
                    style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                  >
                    <Feather name="plus" size={16} color={theme.brandGold} />
                    <Text style={{ color: theme.brandGold, fontSize: 13, fontWeight: "600" }}>Add</Text>
                  </Pressable>
                ) : (
                  <Text style={{ color: theme.brandTextDim, fontSize: 12 }}>Max 20</Text>
                )
              ) : null}
            </View>
            {!editingService?.id ? (
              <Text style={{ color: theme.brandTextDim, fontSize: 13 }}>
                Save the service first to add add-ons.
              </Text>
            ) : addonsLoading ? (
              <ActivityIndicator size="small" color={theme.brandGold} />
            ) : serviceAddons.length === 0 ? (
              <Text style={{ color: theme.brandTextDim, fontSize: 13 }}>No add-ons yet.</Text>
            ) : (
              serviceAddons.map((addon) => (
                <View
                  key={addon.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: theme.brandSurface,
                    backgroundColor: theme.brandSurface,
                    marginBottom: 8,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.brandCream, fontWeight: "600", fontSize: 14 }}>{addon.name}</Text>
                    {addon.description ? (
                      <Text style={{ color: theme.brandTextDim, fontSize: 12 }}>{addon.description}</Text>
                    ) : null}
                    <Text style={{ color: theme.brandTextDim, fontSize: 12 }}>
                      ${(addon.priceCents / 100).toFixed(2)}{addon.durationMinutes > 0 ? ` · +${formatDuration(addon.durationMinutes)}` : ""}
                    </Text>
                    {addon.needsPriceReview && addon.libraryPriceCents != null && editingService?.id ? (
                      <View style={{ marginTop: 6 }}>
                        <Text style={{ color: theme.brandCream, fontSize: 12, marginBottom: 6 }}>
                          Your add-on price is now {money(addon.libraryPriceCents)}. This service charges {money(addon.priceCents)}.
                        </Text>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          {(["sync", "keep"] as const).map((action) => (
                            <Pressable
                              key={action}
                              disabled={priceReviewBusy === addon.id}
                              onPress={() => handleAddonPriceReview(addon, action)}
                              style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: action === "sync" ? theme.brandGold : theme.brandSurfaceBorder, opacity: priceReviewBusy === addon.id ? 0.6 : 1 }}
                              accessibilityRole="button"
                            >
                              <Text style={{ color: action === "sync" ? theme.brandGold : theme.brandTextDim, fontSize: 12, fontWeight: "600" }}>
                                {action === "sync" ? `Use ${money(addon.libraryPriceCents ?? 0)}` : `Keep ${money(addon.priceCents)}`}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    ) : null}
                    {copyTargetServices.length > 0 ? (
                      <Pressable
                        onPress={() => openCopySheet(addon)}
                        hitSlop={8}
                        style={{ alignSelf: "flex-start", marginTop: 6 }}
                        accessibilityRole="button"
                        accessibilityLabel={`Use ${addon.name} on other services`}
                      >
                        <Text style={{ color: theme.brandGold, fontSize: 13, fontWeight: "600" }}>
                          Use on other services
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() => {
                      setEditingAddon(addon);
                      setAddonAddsTime(addon.durationMinutes > 0);
                      setAddonForm({
                        name: addon.name,
                        description: addon.description ?? "",
                        priceCents: (addon.priceCents / 100).toFixed(2),
                        durationMinutes: addon.durationMinutes > 0 ? String(addon.durationMinutes) : "",
                        sortOrder: String(addon.sortOrder),
                      });
                      setAddonError(null);
                      setAddonModalVisible(true);
                    }}
                    style={{ padding: 8 }}
                  >
                    <Feather name="edit-2" size={16} color={theme.brandTextDim} />
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      Alert.alert(
                        "Delete Add-on",
                        `Delete "${addon.name}"?`,
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Delete",
                            style: "destructive",
                            onPress: async () => {
                              const token = await getToken();
                              if (!token || !editingService?.id) return;
                              try {
                                await deleteServiceAddon(token, editingService.id, addon.id);
                                setServiceAddons((prev) => prev.filter((a) => a.id !== addon.id));
                              } catch (e: any) {
                                Alert.alert("Error", e?.message || "Failed to delete add-on");
                              }
                            },
                          },
                        ]
                      );
                    }}
                    style={{ padding: 8 }}
                  >
                    <Feather name="trash-2" size={16} color="#FF3B30" />
                  </Pressable>
                </View>
              ))
            )}
            {copyPromptAddon && copyTargetServices.length > 0 && serviceAddons.some((a) => a.id === copyPromptAddon.id) ? (
              <View
                style={{
                  marginTop: 4,
                  marginBottom: 8,
                  padding: 12,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: theme.brandGold,
                }}
              >
                <Text style={{ color: theme.brandCream, fontSize: 14, marginBottom: 10 }}>
                  Use "{copyPromptAddon.name}" on your other services too?
                </Text>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <Pressable
                    onPress={() => setCopyPromptAddon(null)}
                    style={{ flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: theme.brandTextDim, alignItems: "center" }}
                  >
                    <Text style={{ color: theme.brandCream, fontWeight: "600" }}>Not now</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => openCopySheet(copyPromptAddon)}
                    style={{ flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: theme.brandGold, alignItems: "center" }}
                  >
                    <Text style={{ color: theme.brandBg, fontWeight: "700" }}>Choose services</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>

          {/* ── Service Location ── */}
          <Text style={styles.formSectionTitle}>4. Where it happens</Text>
          <Text style={[styles.inputLabel, { marginTop: 0 }]}>Where does this service take place?</Text>
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
              Turn on Physical Location in Profile and contact to use "At my location".
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
          <Text style={styles.formSectionTitle}>5. Cancellation policy</Text>

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

          {/* Business terms moved to Manage business → Booking settings (2026-10-28):
              they belong to the whole business and were never saved from here. */}
          <View style={styles.noteBox}>
            <Feather name="file-text" size={16} color={theme.brandTextDim} />
            <Text style={styles.noteBoxText}>
              {vendorTermsAndConditions.trim()
                ? "Your business terms apply to this service. Change them in Booking settings."
                : "Want customers to agree to your terms when they book? Add them in Booking settings."}
            </Text>
          </View>

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
      {/* Nested inside the service modal: iOS can't present a second sibling Modal while this one is open. */}
      {/* Add-on editor modal */}
      <Modal
        visible={addonModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAddonModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" }}
        >
          {/* Tapping the dimmed area only hides the keyboard, so nothing typed is lost. */}
          <Pressable style={{ flex: 1 }} onPress={Keyboard.dismiss} accessible={false} />
          <View style={{ backgroundColor: theme.brandBg, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36, maxHeight: "90%" }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <Text style={{ color: theme.brandCream, fontWeight: "700", fontSize: 17 }}>
                {editingAddon ? "Edit Add-on" : "New Add-on"}
              </Text>
              <Pressable onPress={Keyboard.dismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel="Hide keyboard">
                <Text style={{ color: theme.brandGold, fontSize: 15, fontWeight: "600" }}>Done</Text>
              </Pressable>
            </View>
            <ScrollView
              style={{ flexGrow: 0 }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            >
            {addonError ? (
              <Text style={{ color: "#FF3B30", fontSize: 13, marginBottom: 10 }}>{addonError}</Text>
            ) : null}
            <Text style={[styles.inputLabel, { marginTop: 0 }]}>Name *</Text>
            <TextInput
              style={styles.input}
              value={addonForm.name}
              onChangeText={(v) => setAddonForm({ ...addonForm, name: v })}
              placeholder="e.g. Deep Condition"
              placeholderTextColor={theme.brandTextDim}
              maxLength={80}
              returnKeyType="done"
            />
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, { minHeight: 60, textAlignVertical: "top" }]}
              value={addonForm.description}
              onChangeText={(v) => setAddonForm({ ...addonForm, description: v })}
              placeholder="Optional details"
              placeholderTextColor={theme.brandTextDim}
              multiline
              maxLength={300}
              inputAccessoryViewID={ADDON_KEYBOARD_DONE_ID}
            />
            <Text style={styles.inputLabel}>Price ($) *</Text>
            <TextInput
              style={styles.input}
              value={addonForm.priceCents}
              onChangeText={(v) => setAddonForm({ ...addonForm, priceCents: v })}
              placeholder="0.00"
              placeholderTextColor={theme.brandTextDim}
              keyboardType="decimal-pad"
              inputAccessoryViewID={ADDON_KEYBOARD_DONE_ID}
            />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, marginBottom: addonAddsTime ? 4 : 0 }}>
              <Text style={{ color: theme.brandCream, fontSize: 14 }}>Adds time to the appointment</Text>
              <Switch
                value={addonAddsTime}
                onValueChange={(v) => {
                  setAddonAddsTime(v);
                  if (!v) setAddonForm((f) => ({ ...f, durationMinutes: "" }));
                }}
                trackColor={{ false: theme.brandSurface, true: theme.brandGold }}
                thumbColor={theme.brandBg}
              />
            </View>
            {addonAddsTime && (
              <>
                <Text style={[styles.inputLabel, { marginTop: 8 }]}>Duration (minutes) *</Text>
                <TextInput
                  style={styles.input}
                  value={addonForm.durationMinutes}
                  onChangeText={(v) => setAddonForm({ ...addonForm, durationMinutes: v.replace(/\D/g, "") })}
                  placeholder="e.g. 30"
                  placeholderTextColor={theme.brandTextDim}
                  keyboardType="number-pad"
                  inputAccessoryViewID={ADDON_KEYBOARD_DONE_ID}
                />
              </>
            )}
            </ScrollView>
            <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
              <Pressable
                onPress={() => { setAddonModalVisible(false); setAddonError(null); }}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: theme.brandSurface, alignItems: "center" }}
              >
                <Text style={{ color: theme.brandTextDim, fontWeight: "600" }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  setAddonError(null);
                  const name = addonForm.name.trim();
                  if (!name || name.length > 80) { setAddonError("Name is required (max 80 characters)."); return; }
                  const desc = addonForm.description.trim();
                  if (desc.length > 300) { setAddonError("Description must be 300 characters or fewer."); return; }
                  const priceVal = parseFloat(addonForm.priceCents);
                  if (isNaN(priceVal) || priceVal < 0 || priceVal > 1000) { setAddonError("Price must be between $0 and $1,000."); return; }
                  const priceCents = Math.round(priceVal * 100);
                  let durationMinutes = 0;
                  if (addonAddsTime) {
                    const durationVal = parseInt(addonForm.durationMinutes, 10);
                    if (isNaN(durationVal) || durationVal < 5 || durationVal > 480) { setAddonError("Duration must be between 5 and 480 minutes."); return; }
                    durationMinutes = durationVal;
                  }
                  const sortOrder = parseInt(addonForm.sortOrder, 10) || (serviceAddons.length + 1);
                  setAddonSaving(true);
                  try {
                    const token = await getToken();
                    if (!token || !editingService?.id) throw new Error("Not authenticated");
                    const payload = {
                      name,
                      description: desc || null,
                      priceCents,
                      durationMinutes,
                      sortOrder,
                    };
                    if (editingAddon) {
                      const updated = await updateServiceAddon(token, editingService.id, editingAddon.id, payload);
                      setServiceAddons((prev) => prev.map((a) => a.id === editingAddon.id ? updated : a).sort((a, b) => a.sortOrder - b.sortOrder));
                    } else {
                      const created = await createServiceAddon(token, editingService.id, payload);
                      setServiceAddons((prev) => [...prev, created].sort((a, b) => a.sortOrder - b.sortOrder));
                      setCopyPromptAddon(created);
                    }
                    setAddonModalVisible(false);
                  } catch (e: any) {
                    setAddonError(e?.body?.message || readableApiError(e, "Failed to save add-on"));
                  } finally {
                    setAddonSaving(false);
                  }
                }}
                disabled={addonSaving}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: theme.brandGold, alignItems: "center", opacity: addonSaving ? 0.6 : 1 }}
              >
                {addonSaving ? (
                  <ActivityIndicator color={theme.brandBg} />
                ) : (
                  <Text style={{ color: theme.brandBg, fontWeight: "700" }}>Save</Text>
                )}
              </Pressable>
            </View>
          </View>
          {Platform.OS === "ios" ? (
            <InputAccessoryView nativeID={ADDON_KEYBOARD_DONE_ID}>
              <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 16, paddingVertical: 8, backgroundColor: theme.brandSurface }}>
                <Pressable onPress={Keyboard.dismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel="Hide keyboard">
                  <Text style={{ color: theme.brandGold, fontSize: 16, fontWeight: "600" }}>Done</Text>
                </Pressable>
              </View>
            </InputAccessoryView>
          ) : null}
        </KeyboardAvoidingView>
      </Modal>
      {/* "Add to other services" sheet — also nested so it opens over the service modal on iOS. */}
      <Modal
        visible={copyAddonSource !== null}
        animationType="slide"
        transparent
        onRequestClose={() => {
          if (!copyingAddon) setCopyAddonSource(null);
        }}
      >
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" }}>
          <View style={{ backgroundColor: theme.brandBg, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 36, maxHeight: "80%" }}>
            <Text style={{ color: theme.brandCream, fontWeight: "700", fontSize: 17, marginBottom: 4 }}>
              Add "{copyAddonSource?.name}" to other services
            </Text>
            {copyAddonSource ? (
              <Text style={{ color: theme.brandTextDim, fontSize: 13, marginBottom: 12 }}>
                ${(copyAddonSource.priceCents / 100).toFixed(2)}
                {copyAddonSource.durationMinutes > 0 ? ` · +${formatDuration(copyAddonSource.durationMinutes)}` : " · doesn't add time"}
              </Text>
            ) : null}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <Text style={{ color: theme.brandCream, fontSize: 14, fontWeight: "600" }}>
                {copyTargetIds.length} of {copyTargetServices.length} selected
              </Text>
              <Pressable
                disabled={copyingAddon}
                onPress={() =>
                  setCopyTargetIds(
                    copyTargetIds.length === copyTargetServices.length ? [] : copyTargetServices.map((svc) => svc.id)
                  )
                }
                style={{ paddingVertical: 6, paddingHorizontal: 4 }}
              >
                <Text style={{ color: theme.brandGold, fontSize: 13, fontWeight: "600" }}>
                  {copyTargetIds.length === copyTargetServices.length ? "Select none" : "Select all"}
                </Text>
              </Pressable>
            </View>
            <ScrollView style={{ flexGrow: 0, marginBottom: 12 }}>
              {copyTargetServices.map((svc) => {
                const checked = copyTargetIds.includes(svc.id);
                return (
                  <Pressable
                    key={svc.id}
                    disabled={copyingAddon}
                    onPress={() =>
                      setCopyTargetIds((prev) =>
                        prev.includes(svc.id) ? prev.filter((id) => id !== svc.id) : [...prev, svc.id]
                      )
                    }
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                      borderRadius: 8,
                      backgroundColor: theme.brandSurface,
                      marginBottom: 8,
                    }}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                  >
                    <Feather
                      name={checked ? "check-square" : "square"}
                      size={20}
                      color={checked ? theme.brandGold : theme.brandTextDim}
                    />
                    <Text style={{ color: theme.brandCream, fontSize: 14, marginLeft: 12, flex: 1 }} numberOfLines={1}>
                      {svc.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Text style={{ color: theme.brandTextDim, fontSize: 12, marginBottom: 16 }}>
              {"It comes from your add-ons, so changes you make on the Add-ons page reach every service it's on."}
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable
                disabled={copyingAddon}
                onPress={() => setCopyAddonSource(null)}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: theme.brandTextDim, alignItems: "center", opacity: copyingAddon ? 0.6 : 1 }}
              >
                <Text style={{ color: theme.brandCream, fontWeight: "600" }}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={copyingAddon || copyTargetIds.length === 0}
                onPress={handleCopyAddon}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: theme.brandGold, alignItems: "center", opacity: copyingAddon || copyTargetIds.length === 0 ? 0.6 : 1 }}
              >
                {copyingAddon ? (
                  <ActivityIndicator color={theme.brandBg} />
                ) : (
                  <Text style={{ color: theme.brandBg, fontWeight: "700" }}>
                    Add to {copyTargetIds.length} service{copyTargetIds.length === 1 ? "" : "s"}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );

  // ── Manage business pages ──────────────────────────────────────────────────
  const offersServices = Boolean(business.hasServices) || services.length > 0;
  const liveCount = (list: { status: string }[]) => list.filter((i) => i.status === "live").length;
  const activeProducts = products.filter((p) => p.status !== "archived");
  const activeServices = services.filter((s) => s.status !== "archived");
  const productsMissingPhoto = activeProducts.filter((p) => !p.imageUrl).length;
  const servicesMissingPhoto = activeServices.filter((s) => !s.imageUrl).length;
  const openDays = hours.filter((h) => h.isAvailable).length;
  const payoutsReady = eligibility ? !eligibility.requiresOnboarding : Boolean(business.stripeOnboardingComplete);
  const planActive = eligibility ? !eligibility.requiresSubscription : Boolean(business.subscriptionActive);

  const countText = (list: { status: string }[], noun: string) => {
    if (list.length === 0) return `No ${noun}s yet`;
    const live = liveCount(list);
    const other = list.length - live;
    return other > 0 ? `${live} live, ${other} not live` : `${live} live`;
  };

  const goToTarget = (target: SetupTarget) => openSection(target);

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

  const renderSetupCard = () => {
    const steps = stepsFromSetupStatus(setupStatus) ?? buildSetupSteps({
      products,
      services,
      offersServices,
      hoursOfOperation: business.hoursOfOperation,
      vendorTermsAndConditions: (business as any).vendorTermsAndConditions,
      requiresOnboarding: eligibility ? eligibility.requiresOnboarding : null,
      requiresSubscription: eligibility ? eligibility.requiresSubscription : null,
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

  const renderHub = () => (
    <ScrollView
      style={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.brandGold} />}
    >
      {renderApprovalBanner()}
      <View style={[styles.section, { paddingTop: 4 }]}>
        {renderSetupCard()}

        <Text style={styles.hubGroupLabel}>What you sell</Text>
        <View style={styles.hubCard}>
          {renderHubRow({
            first: true,
            icon: "package",
            title: "Products",
            sub: countText(activeProducts, "product"),
            tag: productsMissingPhoto ? `${productsMissingPhoto} ${productsMissingPhoto === 1 ? "needs" : "need"} a photo` : null,
            onPress: () => openSection("products"),
          })}
          {renderHubRow({
            icon: "calendar",
            title: "Services",
            sub: activeServices.length ? countText(activeServices, "service") : "Things customers book a time for",
            tag: servicesMissingPhoto ? `${servicesMissingPhoto} ${servicesMissingPhoto === 1 ? "needs" : "need"} a photo` : null,
            onPress: () => openSection("services"),
          })}
          {renderHubRow({
            icon: "plus-circle",
            title: "Add-ons",
            sub: "Extras customers can add to a service or product",
            onPress: () => openSection("addons"),
          })}
        </View>

        <Text style={styles.hubGroupLabel}>Your storefront</Text>
        <View style={styles.hubCard}>
          {renderHubRow({
            first: true,
            icon: "image",
            title: "Look and branding",
            sub: "Logo, cover, color, main button",
            onPress: () => openSection("branding"),
          })}
          {renderHubRow({
            icon: "user",
            title: "Profile and contact",
            sub: "Name, about, contact, location",
            onPress: () => openSection("profile"),
          })}
        </View>

        <Text style={styles.hubGroupLabel}>Bookings and money</Text>
        <View style={styles.hubCard}>
          {renderHubRow({
            first: true,
            icon: "clock",
            title: offersServices ? "Booking settings" : "Hours",
            sub: offersServices ? "Hours, cancellation policy, business terms" : "When your business is open",
            onPress: () => openSection(offersServices ? "booking" : "hours"),
          })}
          {renderHubRow({
            icon: "credit-card",
            title: "Payouts and plan",
            sub: payoutsReady ? "Payouts are on" : "Connect payouts to get paid",
            tag: payoutsReady ? null : "Set up",
            onPress: () => openSection("payouts"),
          })}
        </View>
      </View>
    </ScrollView>
  );

  const renderBookingTab = () => (
    <ScreenKeyboardAwareScrollView style={styles.content} contentContainerStyle={{ paddingTop: 0 }} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <Text style={styles.sectionDesc}>
          These apply to every service you offer.
        </Text>

        <Text style={[styles.hubGroupLabel, { marginTop: 0 }]}>When customers can book</Text>
        <View style={styles.hubCard}>
          {renderHubRow({
            first: true,
            icon: "clock",
            title: "Hours",
            sub: !hasHours(business.hoursOfOperation)
              ? "Not set yet"
              : openDays === 0
                ? "No open days set"
                : `Open ${openDays} day${openDays === 1 ? "" : "s"} a week`,
            tag: hasHours(business.hoursOfOperation) ? null : "Set up",
            onPress: () => openSection("hours"),
          })}
          {allowPastClosing !== null ? (
            <View style={[styles.hubRow, styles.hubRowDivider]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.hubRowTitle}>Run past closing</Text>
                <Text style={styles.hubRowSub}>Let a booking that starts before closing end after it</Text>
              </View>
              <Switch
                value={allowPastClosing}
                onValueChange={handleTogglePastClosing}
                disabled={savingPastClosing}
                trackColor={{ true: theme.brandGold }}
                accessibilityLabel="Run past closing"
              />
            </View>
          ) : null}
        </View>

        <Text style={styles.hubGroupLabel}>Cancellation policy</Text>
        <View style={styles.card}>
          <Text style={styles.cardDesc}>
            {(business as any).cancellationPolicySetAt
              ? "Your default. New services start with it. Each service can still have its own: open a service to change it, then tap Apply to all services to use it everywhere."
              : "You haven't chosen one yet. Pick what customers get back if they cancel, then save. New services start with it."}
          </Text>

          <Text style={styles.inputLabel}>Full refund if they cancel at least</Text>
          <View style={styles.policyChips}>
            {REFUND_WINDOWS.map((w) => {
              const on = policyDraft.fullRefundWindow === w.value;
              return (
                <Pressable
                  key={w.value}
                  onPress={() => setPolicyDraft((d) => ({ ...d, fullRefundWindow: w.value }))}
                  style={[styles.policyChip, on && styles.policyChipOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                >
                  <Text style={[styles.policyChipText, on && styles.policyChipTextOn]}>
                    {w.value === "never" ? "No full refunds" : `${w.label} before`}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.switchRow}>
            <Text style={[styles.inputLabel, { flex: 1 }]}>Partial refund after that</Text>
            <Switch
              value={policyDraft.hasPartialRefund}
              onValueChange={(v) => setPolicyDraft((d) => ({ ...d, hasPartialRefund: v }))}
              trackColor={{ true: theme.brandGold }}
              accessibilityLabel="Partial refund after that"
            />
          </View>
          {policyDraft.hasPartialRefund ? (
            <>
              <Text style={styles.inputLabel}>If they cancel at least</Text>
              <View style={styles.policyChips}>
                {REFUND_WINDOWS.filter((w) => w.value !== "never").map((w) => {
                  const on = policyDraft.partialRefundWindow === w.value;
                  return (
                    <Pressable
                      key={w.value}
                      onPress={() => setPolicyDraft((d) => ({ ...d, partialRefundWindow: w.value }))}
                      style={[styles.policyChip, on && styles.policyChipOn]}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                    >
                      <Text style={[styles.policyChipText, on && styles.policyChipTextOn]}>{w.label} before</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.inputLabel}>They get back (percent)</Text>
              <TextInput
                style={styles.input}
                value={policyDraft.partialPercentInput}
                onChangeText={(v) => setPolicyDraft((d) => ({ ...d, partialPercentInput: v.replace(/[^0-9]/g, "").slice(0, 3) }))}
                placeholder="50"
                placeholderTextColor={theme.brandTextDim}
                keyboardType="number-pad"
                accessibilityLabel="Partial refund percent"
              />
            </>
          ) : null}

          <View style={styles.switchRow}>
            <Text style={[styles.inputLabel, { flex: 1 }]}>Cancellation fee</Text>
            <Switch
              value={policyDraft.hasCancellationFee}
              onValueChange={(v) => setPolicyDraft((d) => ({ ...d, hasCancellationFee: v }))}
              trackColor={{ true: theme.brandGold }}
              accessibilityLabel="Cancellation fee"
            />
          </View>
          {policyDraft.hasCancellationFee ? (
            <>
              <View style={styles.policyChips}>
                {(["flat", "percentage"] as const).map((t) => {
                  const on = policyDraft.cancellationFeeType === t;
                  return (
                    <Pressable
                      key={t}
                      onPress={() => setPolicyDraft((d) => ({ ...d, cancellationFeeType: t }))}
                      style={[styles.policyChip, on && styles.policyChipOn]}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                    >
                      <Text style={[styles.policyChipText, on && styles.policyChipTextOn]}>
                        {t === "flat" ? "Dollar amount" : "Percent of the price"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput
                style={styles.input}
                value={policyDraft.feeInput}
                onChangeText={(v) => setPolicyDraft((d) => ({ ...d, feeInput: v.replace(/[^0-9.]/g, "") }))}
                placeholder={policyDraft.cancellationFeeType === "flat" ? "20.00" : "10"}
                placeholderTextColor={theme.brandTextDim}
                keyboardType="decimal-pad"
                accessibilityLabel="Cancellation fee amount"
              />
            </>
          ) : null}

          <Pressable
            style={[styles.saveButton, saving && { opacity: 0.6 }]}
            onPress={handleSavePolicy}
            disabled={saving}
            accessibilityRole="button"
          >
            {saving ? (
              <ActivityIndicator color={theme.brandPrimaryText} />
            ) : (
              <Text style={styles.saveButtonText}>Save policy</Text>
            )}
          </Pressable>
          <Pressable
            onPress={() => openSection("services")}
            style={styles.previewButton}
            accessibilityRole="button"
          >
            <Text style={styles.previewButtonText}>Go to services</Text>
          </Pressable>
        </View>

        <Text style={styles.hubGroupLabel}>Default deposit</Text>
        <View style={styles.card}>
          <Text style={styles.cardDesc}>
            New services start with this deposit. Services you already have keep theirs. Leave it empty for no
            deposit.
          </Text>
          <Text style={styles.inputLabel}>Deposit (in dollars)</Text>
          <TextInput
            style={styles.input}
            value={defaultDepositInput}
            onChangeText={(v) => setDefaultDepositInput(v.replace(/[^0-9.]/g, ""))}
            placeholder="No default"
            placeholderTextColor={theme.brandTextDim}
            keyboardType="decimal-pad"
            accessibilityLabel="Default deposit in dollars"
          />
          <Pressable
            style={[styles.saveButton, saving && { opacity: 0.6 }]}
            onPress={handleSaveDefaultDeposit}
            disabled={saving}
            accessibilityRole="button"
          >
            {saving ? (
              <ActivityIndicator color={theme.brandPrimaryText} />
            ) : (
              <Text style={styles.saveButtonText}>Save default deposit</Text>
            )}
          </Pressable>
        </View>

        <Text style={styles.hubGroupLabel}>Business terms</Text>
        <View style={styles.card}>
          <Text style={styles.cardDesc}>
            One set of terms for your whole business. Customers tick a box to agree to them when they book.
            Leave it empty if you don't want the box.
          </Text>
          <TextInput
            style={[styles.input, styles.textArea, { minHeight: 140 }]}
            value={vendorTermsAndConditions}
            onChangeText={setVendorTermsAndConditions}
            placeholder="For example: late arrival policy, photo release, what to bring"
            placeholderTextColor={theme.brandTextDim}
            multiline
            accessibilityLabel="Business terms"
          />
          <Pressable
            style={[styles.saveButton, saving && { opacity: 0.6 }]}
            onPress={handleSaveTerms}
            disabled={saving}
            accessibilityRole="button"
          >
            {saving ? (
              <ActivityIndicator color={theme.brandPrimaryText} />
            ) : (
              <Text style={styles.saveButtonText}>Save terms</Text>
            )}
          </Pressable>
        </View>
      </View>
    </ScreenKeyboardAwareScrollView>
  );

  const renderPayoutsTab = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <View style={[styles.setupCard, { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 0 }]}>
          <View
            style={{
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: payoutsReady ? theme.brandSuccess : SETUP_GOLD,
            }}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.setupTitle}>{payoutsReady ? "Payouts are on" : "Payouts aren't set up yet"}</Text>
            <Text style={[styles.setupStepText, { fontSize: 14, marginTop: 2 }]}>
              {payoutsReady ? "Your bank account is connected" : "Connect a bank account to get paid"}
            </Text>
          </View>
          {payoutLinkBusy ? <ActivityIndicator color={theme.brandPrimaryText} /> : null}
        </View>

        <Text style={styles.hubGroupLabel}>Getting paid</Text>
        <View style={styles.hubCard}>
          {payoutsReady
            ? renderHubRow({
                first: true,
                icon: "dollar-sign",
                title: "Balance and payouts",
                sub: "Earnings, payout history and bank account",
                onPress: () => openPayouts(false),
              })
            : renderHubRow({
                first: true,
                icon: "link",
                title: "Connect payouts",
                sub: "Set up Stripe so you get paid",
                tag: "Set up",
                onPress: () => openPayouts(true),
              })}
          {renderHubRow({
            icon: "map-pin",
            title: "Billing address",
            sub: "Used to verify your payouts",
            onPress: () => navigation.navigate("BusinessBillingAddress"),
          })}
        </View>

        <Text style={styles.hubGroupLabel}>Your plan</Text>
        <View style={styles.hubCard}>
          {renderHubRow({
            first: true,
            icon: "award",
            title: planActive ? "Manage subscription" : "Choose a plan",
            sub: planActive ? "Change plan, update billing, or cancel" : "Pick the plan that fits your business",
            onPress: openSubscription,
          })}
          {renderHubRow({
            icon: "star",
            title: "Credits",
            sub: "Production shoot credits",
            onPress: () => navigation.navigate("DashboardCreditsScreen"),
          })}
        </View>
      </View>
    </ScrollView>
  );

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
          onPress={() =>
            section === "hub"
              ? navigation.goBack()
              : leaveSection(() => setSection("hub"))
          }
          accessibilityRole="button"
          accessibilityLabel={section === "hub" ? "Back" : "Back to Manage business"}
        >
          <Feather name="arrow-left" size={24} color={theme.brandCream} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {SECTION_TITLES[section]}
        </Text>
        {section === "hub" ? (
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>
              {business.category || "Business"}
            </Text>
          </View>
        ) : null}
      </View>

      {section === "hub" && renderHub()}
      {section === "branding" && renderBrandingTab()}
      {section === "profile" && renderProfileTab()}
      {section === "hours" && renderHoursTab()}
      {section === "booking" && renderBookingTab()}
      {section === "products" && renderProductsTab()}
      {section === "services" && renderServicesTab()}
      {section === "addons" && <AddonLibraryTab services={services} getToken={getToken} />}
      {section === "payouts" && renderPayoutsTab()}

      {renderProductModal()}
      {renderServiceModal()}
    </View>
  );
}
