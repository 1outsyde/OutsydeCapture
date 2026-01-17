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
import api, {
  VendorBookerBusiness,
  VendorProduct,
  VendorService,
  VendorProductInput,
  VendorServiceInput,
  HoursOfOperationData,
} from "@/services/api";
import { RootStackParamList } from "@/navigation/types";
import HoursEditor, { DayHours, getDefaultHours, hoursArrayToObject, hoursObjectToArray } from "@/components/HoursEditor";
import ImageUploader from "@/components/ImageUploader";

type TabType = "branding" | "profile" | "hours" | "products" | "services";

const COLOR_PRESETS = [
  { name: "Golden Yellow", color: "#eab308" },
  { name: "Rose Pink", color: "#ec4899" },
  { name: "Ocean Blue", color: "#3b82f6" },
  { name: "Forest Green", color: "#22c55e" },
  { name: "Royal Purple", color: "#8b5cf6" },
  { name: "Sunset Orange", color: "#f97316" },
  { name: "Teal", color: "#14b8a6" },
  { name: "Slate Gray", color: "#64748b" },
];

const SPECIALTY_OPTIONS = [
  "Fast Service", "Premium Quality", "Eco-Friendly", "Local Favorite",
  "Award Winning", "Family Owned", "Best Price", "Custom Orders",
];

export default function StorefrontEditorScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { getToken } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>("branding");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [business, setBusiness] = useState<VendorBookerBusiness | null>(null);
  const [products, setProducts] = useState<VendorProduct[]>([]);
  const [services, setServices] = useState<VendorService[]>([]);
  const [hours, setHours] = useState<DayHours[]>(getDefaultHours());

  const [coverImage, setCoverImage] = useState("");
  const [logoImage, setLogoImage] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#eab308");

  const [profileName, setProfileName] = useState("");
  const [profileTagline, setProfileTagline] = useState("");
  const [profileDescription, setProfileDescription] = useState("");
  const [profileSpecialties, setProfileSpecialties] = useState<string[]>([]);
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileWebsite, setProfileWebsite] = useState("");
  const [profileAddress, setProfileAddress] = useState("");
  const [profileCity, setProfileCity] = useState("");
  const [profileState, setProfileState] = useState("");
  const [profileZip, setProfileZip] = useState("");

  const [productModalVisible, setProductModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<VendorProduct | null>(null);
  const [productForm, setProductForm] = useState<VendorProductInput>({
    name: "",
    description: "",
    priceCents: 0,
    imageUrl: "",
    inventory: 0,
    status: "draft",
  });

  const [serviceModalVisible, setServiceModalVisible] = useState(false);
  const [editingService, setEditingService] = useState<VendorService | null>(null);
  const [serviceForm, setServiceForm] = useState<VendorServiceInput>({
    name: "",
    description: "",
    priceCents: 0,
    durationMinutes: 60,
    status: "draft",
  });

  const fetchData = useCallback(async () => {
    const token = await getToken();
    if (!token) return;

    try {
      setLoading(true);
      const [businessRes, productsRes, servicesRes] = await Promise.all([
        api.getVendorMyBusiness(token),
        api.getVendorProducts(token).catch(() => ({ products: [] })),
        api.getVendorServices(token).catch(() => ({ services: [] })),
      ]);

      const biz = businessRes.business;
      setBusiness(biz);
      setProducts(productsRes.products || []);
      setServices(servicesRes.services || []);

      setCoverImage(biz.coverImage || "");
      setLogoImage(biz.logoImage || "");
      const brandColors = biz.brandColors ? JSON.parse(biz.brandColors) : {};
      setPrimaryColor(brandColors.primary || "#eab308");

      setProfileName(biz.name || "");
      setProfileTagline(biz.tagline || "");
      setProfileDescription(biz.description || "");
      setProfileEmail(biz.contactEmail || "");
      setProfilePhone(biz.contactPhone || "");
      setProfileWebsite(biz.websiteUrl || "");
      setProfileCity(biz.city || "");
      setProfileState(biz.state || "");

      if (biz.hoursOfOperation) {
        try {
          const hoursData = typeof biz.hoursOfOperation === "string" 
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
      await api.updateVendorMyBusiness(token, {
        // Note: coverImage, logoImage, and brandColors would need to be added to BusinessOnboardingData
        // For now, we'll store brandColors as a JSON string
      } as any);
      Alert.alert("Success", "Branding updated successfully");
    } catch (error: any) {
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
      await api.updateVendorMyBusiness(token, {
        name: profileName,
        tagline: profileTagline,
        description: profileDescription,
        contactEmail: profileEmail,
        contactPhone: profilePhone,
        websiteUrl: profileWebsite,
        address: profileAddress,
        city: profileCity,
        state: profileState,
      });
      Alert.alert("Success", "Profile updated successfully");
      fetchData();
    } catch (error: any) {
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
      const hoursOfOperation = hoursArrayToObject(hours);
      await api.updateVendorMyBusiness(token, { hoursOfOperation });
      Alert.alert("Success", "Business hours updated successfully");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to save hours");
    } finally {
      setSaving(false);
    }
  };

  const openProductForm = (product?: VendorProduct) => {
    if (product) {
      setEditingProduct(product);
      setProductForm({
        name: product.name,
        description: product.description || "",
        priceCents: product.priceCents,
        imageUrl: product.imageUrl || "",
        inventory: product.inventory || 0,
        status: product.status,
      });
    } else {
      setEditingProduct(null);
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

    try {
      setSaving(true);
      if (editingProduct) {
        await api.updateVendorProduct(token, editingProduct.id, productForm);
      } else {
        await api.createVendorProduct(token, productForm);
      }
      setProductModalVisible(false);
      fetchData();
      Alert.alert("Success", editingProduct ? "Product updated" : "Product created");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    Alert.alert("Delete Product", "Are you sure you want to delete this product?", [
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
    ]);
  };

  const openServiceForm = (service?: VendorService) => {
    if (service) {
      setEditingService(service);
      setServiceForm({
        name: service.name,
        description: service.description || "",
        priceCents: service.priceCents,
        durationMinutes: service.durationMinutes || 60,
        status: service.status,
      });
    } else {
      setEditingService(null);
      setServiceForm({
        name: "",
        description: "",
        priceCents: 0,
        durationMinutes: 60,
        status: "draft",
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

    try {
      setSaving(true);
      if (editingService) {
        await api.updateVendorService(token, editingService.id, serviceForm);
      } else {
        await api.createVendorService(token, serviceForm);
      }
      setServiceModalVisible(false);
      fetchData();
      Alert.alert("Success", editingService ? "Service updated" : "Service created");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to save service");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    Alert.alert("Delete Service", "Are you sure you want to delete this service?", [
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
    ]);
  };

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "live": return "#22c55e";
      case "draft": return "#f59e0b";
      case "archived": return "#6b7280";
      default: return theme.textSecondary;
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.backgroundRoot,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: insets.top + 8,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    backButton: {
      padding: 8,
      marginRight: 8,
    },
    headerTitle: {
      flex: 1,
      fontSize: 20,
      fontWeight: "700",
      color: theme.text,
    },
    categoryBadge: {
      backgroundColor: theme.cardSecondary,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    categoryText: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    tabContainer: {
      flexDirection: "row",
      paddingHorizontal: 8,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    tab: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 8,
      borderRadius: 8,
      marginHorizontal: 2,
    },
    tabActive: {
      backgroundColor: theme.primary,
    },
    tabText: {
      fontSize: 11,
      color: theme.textSecondary,
      marginTop: 4,
    },
    tabTextActive: {
      color: "#000",
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
      color: theme.text,
      marginBottom: 8,
    },
    sectionDesc: {
      fontSize: 14,
      color: theme.textSecondary,
      marginBottom: 16,
    },
    card: {
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.text,
      marginBottom: 4,
    },
    cardDesc: {
      fontSize: 13,
      color: theme.textSecondary,
      marginBottom: 12,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: "500",
      color: theme.text,
      marginBottom: 6,
    },
    input: {
      backgroundColor: theme.cardSecondary,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      color: theme.text,
      marginBottom: 12,
    },
    textArea: {
      minHeight: 80,
      textAlignVertical: "top",
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
      borderColor: theme.text,
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
      backgroundColor: theme.cardSecondary,
      borderWidth: 1,
      borderColor: theme.border,
    },
    specialtyChipActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    specialtyText: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    specialtyTextActive: {
      color: "#000",
      fontWeight: "500",
    },
    saveButton: {
      backgroundColor: theme.primary,
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: "center",
      marginTop: 8,
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: "#000",
    },
    addButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.primary,
      paddingVertical: 12,
      borderRadius: 10,
      gap: 8,
      marginBottom: 16,
    },
    addButtonText: {
      fontSize: 15,
      fontWeight: "600",
      color: "#000",
    },
    productCard: {
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
      flexDirection: "row",
    },
    productImage: {
      width: 80,
      height: 80,
      borderRadius: 8,
      backgroundColor: theme.cardSecondary,
    },
    productInfo: {
      flex: 1,
      marginLeft: 12,
    },
    productName: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.text,
      marginBottom: 4,
    },
    productPrice: {
      fontSize: 14,
      color: theme.primary,
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
      backgroundColor: theme.cardSecondary,
    },
    serviceCard: {
      backgroundColor: theme.card,
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
      color: theme.text,
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
      color: theme.textSecondary,
    },
    modal: {
      flex: 1,
      backgroundColor: theme.backgroundRoot,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: insets.top + 8,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.text,
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
      color: theme.textSecondary,
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
  });

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!business) {
    return (
      <View style={styles.loading}>
        <Feather name="store" size={48} color={theme.textSecondary} />
        <Text style={[styles.emptyText, { marginTop: 16 }]}>No business found</Text>
        <Pressable style={styles.saveButton} onPress={() => navigation.goBack()}>
          <Text style={styles.saveButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const renderBrandingTab = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Cover Image</Text>
          <Text style={styles.cardDesc}>The banner image at the top of your storefront</Text>
          <ImageUploader
            currentImage={coverImage || undefined}
            onImageSelected={setCoverImage}
            onRemove={() => setCoverImage("")}
            aspectRatio="cover"
            placeholder="Upload Cover Image"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Logo</Text>
          <Text style={styles.cardDesc}>Your business logo appears on cards and your storefront</Text>
          <View style={{ alignItems: "center" }}>
            <ImageUploader
              currentImage={logoImage || undefined}
              onImageSelected={setLogoImage}
              onRemove={() => setLogoImage("")}
              aspectRatio="logo"
              placeholder="Upload Logo"
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Brand Color</Text>
          <Text style={styles.cardDesc}>Choose a color that represents your brand</Text>
          <View style={styles.colorGrid}>
            {COLOR_PRESETS.map((preset) => (
              <Pressable
                key={preset.color}
                style={[
                  styles.colorPreset,
                  { backgroundColor: preset.color },
                  primaryColor === preset.color && styles.colorPresetSelected,
                ]}
                onPress={() => setPrimaryColor(preset.color)}
              />
            ))}
          </View>
          <Text style={styles.inputLabel}>Preview</Text>
          <View style={[styles.colorPreview, { backgroundColor: primaryColor }]} />
        </View>

        <Pressable
          style={[styles.saveButton, saving && { opacity: 0.6 }]}
          onPress={handleSaveBranding}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.saveButtonText}>Save Branding</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );

  const renderProfileTab = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Business Info</Text>
          <Text style={styles.inputLabel}>Business Name</Text>
          <TextInput
            style={styles.input}
            value={profileName}
            onChangeText={setProfileName}
            placeholder="Your business name"
            placeholderTextColor={theme.textSecondary}
          />
          <Text style={styles.inputLabel}>Tagline</Text>
          <TextInput
            style={styles.input}
            value={profileTagline}
            onChangeText={setProfileTagline}
            placeholder="A short catchy phrase"
            placeholderTextColor={theme.textSecondary}
          />
          <Text style={styles.inputLabel}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={profileDescription}
            onChangeText={setProfileDescription}
            placeholder="Tell customers about your business..."
            placeholderTextColor={theme.textSecondary}
            multiline
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Known For</Text>
          <Text style={styles.cardDesc}>Select what your business is known for</Text>
          <View style={styles.specialtyGrid}>
            {SPECIALTY_OPTIONS.map((specialty) => {
              const isSelected = profileSpecialties.includes(specialty);
              return (
                <Pressable
                  key={specialty}
                  style={[styles.specialtyChip, isSelected && styles.specialtyChipActive]}
                  onPress={() => {
                    if (isSelected) {
                      setProfileSpecialties(profileSpecialties.filter((s) => s !== specialty));
                    } else {
                      setProfileSpecialties([...profileSpecialties, specialty]);
                    }
                  }}
                >
                  <Text style={[styles.specialtyText, isSelected && styles.specialtyTextActive]}>
                    {specialty}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Contact Info</Text>
          <Text style={styles.inputLabel}>Email</Text>
          <TextInput
            style={styles.input}
            value={profileEmail}
            onChangeText={setProfileEmail}
            placeholder="contact@business.com"
            placeholderTextColor={theme.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Text style={styles.inputLabel}>Phone</Text>
          <TextInput
            style={styles.input}
            value={profilePhone}
            onChangeText={setProfilePhone}
            placeholder="(555) 123-4567"
            placeholderTextColor={theme.textSecondary}
            keyboardType="phone-pad"
          />
          <Text style={styles.inputLabel}>Website</Text>
          <TextInput
            style={styles.input}
            value={profileWebsite}
            onChangeText={setProfileWebsite}
            placeholder="https://yourbusiness.com"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Location</Text>
          <Text style={styles.inputLabel}>Address</Text>
          <TextInput
            style={styles.input}
            value={profileAddress}
            onChangeText={setProfileAddress}
            placeholder="123 Main Street"
            placeholderTextColor={theme.textSecondary}
          />
          <View style={styles.row}>
            <View style={styles.flex1}>
              <Text style={styles.inputLabel}>City</Text>
              <TextInput
                style={styles.input}
                value={profileCity}
                onChangeText={setProfileCity}
                placeholder="City"
                placeholderTextColor={theme.textSecondary}
              />
            </View>
            <View style={styles.flex1}>
              <Text style={styles.inputLabel}>State</Text>
              <TextInput
                style={styles.input}
                value={profileState}
                onChangeText={setProfileState}
                placeholder="State"
                placeholderTextColor={theme.textSecondary}
              />
            </View>
          </View>
          <Text style={styles.inputLabel}>ZIP Code</Text>
          <TextInput
            style={styles.input}
            value={profileZip}
            onChangeText={setProfileZip}
            placeholder="12345"
            placeholderTextColor={theme.textSecondary}
            keyboardType="number-pad"
          />
        </View>

        <Pressable
          style={[styles.saveButton, saving && { opacity: 0.6 }]}
          onPress={handleSaveProfile}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.saveButtonText}>Save Profile</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );

  const renderHoursTab = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <HoursEditor
          title="Business Hours"
          hours={hours}
          onChange={setHours}
          onSave={handleSaveHours}
          saving={saving}
        />
      </View>
    </ScrollView>
  );

  const renderProductsTab = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <Pressable style={styles.addButton} onPress={() => openProductForm()}>
          <Feather name="plus" size={20} color="#000" />
          <Text style={styles.addButtonText}>Add Product</Text>
        </Pressable>

        {products.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="package" size={48} color={theme.textSecondary} />
            <Text style={styles.emptyText}>No products yet</Text>
          </View>
        ) : (
          products.map((product) => (
            <View key={product.id} style={styles.productCard}>
              {product.imageUrl ? (
                <Image source={{ uri: product.imageUrl }} style={styles.productImage} />
              ) : (
                <View style={[styles.productImage, { justifyContent: "center", alignItems: "center" }]}>
                  <Feather name="image" size={24} color={theme.textSecondary} />
                </View>
              )}
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{product.name}</Text>
                <Text style={styles.productPrice}>{formatPrice(product.priceCents)}</Text>
                <View style={styles.productMeta}>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(product.status) + "20" }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(product.status) }]}>
                      {product.status}
                    </Text>
                  </View>
                  {product.inventory !== null && (
                    <Text style={styles.serviceDetailText}>Stock: {product.inventory}</Text>
                  )}
                </View>
                <View style={styles.productActions}>
                  <Pressable style={styles.actionButton} onPress={() => openProductForm(product)}>
                    <Feather name="edit-2" size={16} color={theme.text} />
                  </Pressable>
                  <Pressable style={styles.actionButton} onPress={() => handleDeleteProduct(product.id)}>
                    <Feather name="trash-2" size={16} color="#ef4444" />
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
          <Feather name="plus" size={20} color="#000" />
          <Text style={styles.addButtonText}>Add Service</Text>
        </Pressable>

        {services.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="clock" size={48} color={theme.textSecondary} />
            <Text style={styles.emptyText}>No services yet</Text>
          </View>
        ) : (
          services.map((service) => (
            <View key={service.id} style={styles.serviceCard}>
              <View style={styles.serviceHeader}>
                <Text style={styles.serviceName}>{service.name}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(service.status) + "20" }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(service.status) }]}>
                    {service.status}
                  </Text>
                </View>
              </View>
              <View style={styles.serviceDetails}>
                <View style={styles.serviceDetail}>
                  <Feather name="dollar-sign" size={14} color={theme.primary} />
                  <Text style={[styles.serviceDetailText, { color: theme.primary }]}>
                    {formatPrice(service.priceCents)}
                  </Text>
                </View>
                {service.durationMinutes && (
                  <View style={styles.serviceDetail}>
                    <Feather name="clock" size={14} color={theme.textSecondary} />
                    <Text style={styles.serviceDetailText}>{service.durationMinutes} min</Text>
                  </View>
                )}
              </View>
              <View style={styles.productActions}>
                <Pressable style={styles.actionButton} onPress={() => openServiceForm(service)}>
                  <Feather name="edit-2" size={16} color={theme.text} />
                </Pressable>
                <Pressable style={styles.actionButton} onPress={() => handleDeleteService(service.id)}>
                  <Feather name="trash-2" size={16} color="#ef4444" />
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
            <Feather name="x" size={24} color={theme.text} />
          </Pressable>
          <Text style={styles.modalTitle}>
            {editingProduct ? "Edit Product" : "Add Product"}
          </Text>
          <Pressable onPress={handleSaveProduct} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Text style={{ color: theme.primary, fontWeight: "600" }}>Save</Text>
            )}
          </Pressable>
        </View>
        <ScrollView style={styles.modalContent}>
          <Text style={styles.inputLabel}>Product Name *</Text>
          <TextInput
            style={styles.input}
            value={productForm.name}
            onChangeText={(v) => setProductForm({ ...productForm, name: v })}
            placeholder="Product name"
            placeholderTextColor={theme.textSecondary}
          />

          <Text style={styles.inputLabel}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={productForm.description}
            onChangeText={(v) => setProductForm({ ...productForm, description: v })}
            placeholder="Product description"
            placeholderTextColor={theme.textSecondary}
            multiline
          />

          <Text style={styles.inputLabel}>Price (in dollars)</Text>
          <TextInput
            style={styles.input}
            value={productForm.priceCents ? (productForm.priceCents / 100).toString() : ""}
            onChangeText={(v) => setProductForm({ ...productForm, priceCents: Math.round(parseFloat(v || "0") * 100) })}
            placeholder="0.00"
            placeholderTextColor={theme.textSecondary}
            keyboardType="decimal-pad"
          />

          <Text style={styles.inputLabel}>Inventory</Text>
          <TextInput
            style={styles.input}
            value={productForm.inventory?.toString() || ""}
            onChangeText={(v) => setProductForm({ ...productForm, inventory: parseInt(v || "0", 10) })}
            placeholder="0"
            placeholderTextColor={theme.textSecondary}
            keyboardType="number-pad"
          />

          <Text style={styles.inputLabel}>Product Image</Text>
          <ImageUploader
            currentImage={productForm.imageUrl || undefined}
            onImageSelected={(uri) => setProductForm({ ...productForm, imageUrl: uri })}
            onRemove={() => setProductForm({ ...productForm, imageUrl: "" })}
            aspectRatio="product"
            placeholder="Upload Product Image"
          />

          <View style={[styles.switchRow, { marginTop: 16 }]}>
            <Text style={styles.inputLabel}>Active (Live)</Text>
            <Switch
              value={productForm.status === "live"}
              onValueChange={(v) => setProductForm({ ...productForm, status: v ? "live" : "draft" })}
              trackColor={{ true: theme.primary }}
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );

  const renderServiceModal = () => (
    <Modal visible={serviceModalVisible} animationType="slide">
      <View style={styles.modal}>
        <View style={styles.modalHeader}>
          <Pressable onPress={() => setServiceModalVisible(false)}>
            <Feather name="x" size={24} color={theme.text} />
          </Pressable>
          <Text style={styles.modalTitle}>
            {editingService ? "Edit Service" : "Add Service"}
          </Text>
          <Pressable onPress={handleSaveService} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Text style={{ color: theme.primary, fontWeight: "600" }}>Save</Text>
            )}
          </Pressable>
        </View>
        <ScrollView style={styles.modalContent}>
          <Text style={styles.inputLabel}>Service Name *</Text>
          <TextInput
            style={styles.input}
            value={serviceForm.name}
            onChangeText={(v) => setServiceForm({ ...serviceForm, name: v })}
            placeholder="Service name"
            placeholderTextColor={theme.textSecondary}
          />

          <Text style={styles.inputLabel}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={serviceForm.description}
            onChangeText={(v) => setServiceForm({ ...serviceForm, description: v })}
            placeholder="Service description"
            placeholderTextColor={theme.textSecondary}
            multiline
          />

          <Text style={styles.inputLabel}>Price (in dollars)</Text>
          <TextInput
            style={styles.input}
            value={serviceForm.priceCents ? (serviceForm.priceCents / 100).toString() : ""}
            onChangeText={(v) => setServiceForm({ ...serviceForm, priceCents: Math.round(parseFloat(v || "0") * 100) })}
            placeholder="0.00"
            placeholderTextColor={theme.textSecondary}
            keyboardType="decimal-pad"
          />

          <Text style={styles.inputLabel}>Duration (minutes)</Text>
          <TextInput
            style={styles.input}
            value={serviceForm.durationMinutes?.toString() || ""}
            onChangeText={(v) => setServiceForm({ ...serviceForm, durationMinutes: parseInt(v || "60", 10) })}
            placeholder="60"
            placeholderTextColor={theme.textSecondary}
            keyboardType="number-pad"
          />

          <View style={styles.switchRow}>
            <Text style={styles.inputLabel}>Active (Live)</Text>
            <Switch
              value={serviceForm.status === "live"}
              onValueChange={(v) => setServiceForm({ ...serviceForm, status: v ? "live" : "draft" })}
              trackColor={{ true: theme.primary }}
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );

  const tabs: { key: TabType; icon: keyof typeof Feather.glyphMap; label: string }[] = [
    { key: "branding", icon: "image", label: "Branding" },
    { key: "profile", icon: "user", label: "Profile" },
    { key: "hours", icon: "clock", label: "Hours" },
    { key: "products", icon: "package", label: "Products" },
    { key: "services", icon: "briefcase", label: "Services" },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Customize Storefront</Text>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{business.category || "Business"}</Text>
        </View>
      </View>

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
              color={activeTab === tab.key ? "#000" : theme.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
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
