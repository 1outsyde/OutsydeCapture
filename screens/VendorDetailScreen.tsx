import React, { useEffect, useState } from "react";
import { View, StyleSheet, ActivityIndicator, Pressable, Alert, ScrollView } from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import api, { VendorProduct, VendorService } from "@/services/api";
import { RootStackParamList } from "@/navigation/types";
import { useAuth } from "@/context/AuthContext";

type Props = NativeStackScreenProps<RootStackParamList, "VendorDetail">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function VendorDetailScreen({ route }: Props) {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();

  const { vendorId } = route.params;

  const [vendor, setVendor] = useState<any | null>(null);
  const [products, setProducts] = useState<VendorProduct[]>([]);
  const [services, setServices] = useState<VendorService[]>([]);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);
  const [servicesLoading, setServicesLoading] = useState(true);

  const isVideoBanner = vendor?.coverMediaType === "video" && vendor?.coverImage;
  const bannerVideoPlayer = useVideoPlayer(isVideoBanner ? vendor.coverImage : null, player => {
    player.loop = true;
    player.muted = true;
    player.play();
  });

  useEffect(() => {
    loadVendor();
    loadProducts();
    loadServices();
  }, [vendorId]);

  const loadVendor = async () => {
    try {
      const data = await api.getBusiness(vendorId);
      setVendor(data);
    } catch (err) {
      console.error("Failed to load vendor:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const data = await api.getBusinessPublicProducts(vendorId);
      const liveProducts = (data.products || []).filter(p => p.status === "live");
      setProducts(liveProducts);
    } catch (err) {
      console.error("Failed to load products:", err);
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  };

  const loadServices = async () => {
    try {
      const data = await api.getBusinessPublicServices(vendorId);
      const liveServices = (data.services || []).filter(s => s.status === "live");
      setServices(liveServices);
    } catch (err) {
      console.error("Failed to load services:", err);
      setServices([]);
    } finally {
      setServicesLoading(false);
    }
  };

  const handleAddToCart = (product: VendorProduct) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      "Added to Cart",
      `${product.name} has been added to your cart.`,
      [
        { text: "Continue Shopping", style: "cancel" },
        { text: "View Cart", onPress: () => navigation.navigate("CartOrders") },
      ]
    );
  };

  const handleBuyNow = (product: VendorProduct) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!isAuthenticated) {
      navigation.navigate("Auth", { returnTo: "VendorDetail" });
      return;
    }
    navigation.navigate("CartOrders");
  };

  const handleBookService = (service: VendorService) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!isAuthenticated) {
      navigation.navigate("Auth", { returnTo: "VendorDetail" });
      return;
    }
    Alert.alert(
      "Book Service",
      `Would you like to book ${service.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Book Now", onPress: () => navigation.navigate("CartOrders") },
      ]
    );
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  if (loading || !vendor) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: theme.backgroundRoot }} contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText type="body" style={{ marginTop: Spacing.md, color: theme.textSecondary }}>
            Loading business...
          </ThemedText>
        </View>
      </ScrollView>
    );
  }

  const renderProductCard = (product: VendorProduct) => (
    <View key={product.id} style={[styles.productCard, { backgroundColor: theme.card }]}>
      {product.imageUrl ? (
        <Image
          source={{ uri: product.imageUrl }}
          style={styles.productImage}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.productImagePlaceholder, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="package" size={32} color={theme.textSecondary} />
        </View>
      )}
      
      <View style={styles.productInfo}>
        <ThemedText type="h4" numberOfLines={1}>{product.name}</ThemedText>
        {product.description ? (
          <ThemedText type="caption" style={{ color: theme.textSecondary }} numberOfLines={2}>
            {product.description}
          </ThemedText>
        ) : null}
        <ThemedText type="h3" style={{ color: theme.primary, marginTop: Spacing.xs }}>
          {formatPrice(product.priceCents)}
        </ThemedText>
        
        {product.inventory != null && product.inventory > 0 ? (
          <ThemedText type="caption" style={{ color: theme.success }}>
            In Stock ({product.inventory})
          </ThemedText>
        ) : null}
      </View>

      <View style={styles.productActions}>
        <Pressable
          onPress={() => handleAddToCart(product)}
          style={({ pressed }) => [
            styles.actionBtn,
            styles.addToCartBtn,
            { backgroundColor: theme.backgroundDefault, borderColor: theme.primary, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="shopping-cart" size={14} color={theme.primary} />
          <ThemedText type="small" style={{ color: theme.primary, marginLeft: 4 }}>
            Add
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={() => handleBuyNow(product)}
          style={({ pressed }) => [
            styles.actionBtn,
            styles.buyNowBtn,
            { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Feather name="zap" size={14} color="#FFFFFF" />
          <ThemedText type="small" style={{ color: "#FFFFFF", marginLeft: 4 }}>
            Buy Now
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );

  const renderServiceCard = (service: VendorService) => (
    <View key={service.id} style={[styles.serviceCard, { backgroundColor: theme.card }]}>
      <View style={styles.serviceInfo}>
        <ThemedText type="h4" numberOfLines={1}>{service.name}</ThemedText>
        {service.description ? (
          <ThemedText type="caption" style={{ color: theme.textSecondary }} numberOfLines={2}>
            {service.description}
          </ThemedText>
        ) : null}
        <View style={styles.serviceDetails}>
          <ThemedText type="h3" style={{ color: theme.primary }}>
            {formatPrice(service.priceCents)}
          </ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: Spacing.sm }}>
            {service.durationMinutes} min
          </ThemedText>
        </View>
      </View>

      <Pressable
        onPress={() => handleBookService(service)}
        style={({ pressed }) => [
          styles.bookServiceBtn,
          { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Feather name="calendar" size={16} color="#FFFFFF" />
        <ThemedText type="body" style={{ color: "#FFFFFF", marginLeft: Spacing.xs, fontWeight: "600" }}>
          Book
        </ThemedText>
      </Pressable>
    </View>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.backgroundRoot }} contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}>
      <View style={styles.coverContainer}>
        {isVideoBanner ? (
          <VideoView
            player={bannerVideoPlayer}
            style={styles.coverImage}
            contentFit="cover"
            nativeControls={false}
          />
        ) : (
          <Image
            source={{ uri: vendor.coverImage || vendor.avatar }}
            style={styles.coverImage}
            contentFit="cover"
          />
        )}
        
        <View style={[styles.headerOverlay, { paddingTop: insets.top + Spacing.sm }]}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [
              styles.closeBtn,
              { backgroundColor: "rgba(0,0,0,0.4)", opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Feather name="x" size={22} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      <View style={styles.content}>
        <ThemedText type="h2">{vendor.name}</ThemedText>

        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {vendor.city ? `${vendor.city}${vendor.state ? `, ${vendor.state}` : ""}` : "Local Business"}
        </ThemedText>

        <View style={styles.ratingRow}>
          <Feather name="star" size={16} color="#FFD700" />
          <ThemedText type="small" style={{ marginLeft: 4 }}>
            {vendor.rating?.toFixed(1) || "New"}
          </ThemedText>
          {vendor.category ? (
            <>
              <View style={[styles.dot, { backgroundColor: theme.textSecondary }]} />
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {vendor.category}
              </ThemedText>
            </>
          ) : null}
        </View>

        {vendor.description ? (
          <ThemedText style={styles.description}>{vendor.description}</ThemedText>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="package" size={18} color={theme.primary} />
            <ThemedText type="h3" style={styles.sectionTitle}>Products</ThemedText>
          </View>
          
          {productsLoading ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : products.length > 0 ? (
            <View style={styles.productGrid}>
              {products.map(renderProductCard)}
            </View>
          ) : (
            <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign: "center", paddingVertical: Spacing.lg }}>
              No products available yet.
            </ThemedText>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="scissors" size={18} color={theme.primary} />
            <ThemedText type="h3" style={styles.sectionTitle}>Services</ThemedText>
          </View>
          
          {servicesLoading ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : services.length > 0 ? (
            <View style={styles.servicesList}>
              {services.map(renderServiceCard)}
            </View>
          ) : (
            <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign: "center", paddingVertical: Spacing.lg }}>
              No services available yet.
            </ThemedText>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
  },
  coverContainer: {
    position: "relative",
  },
  coverImage: {
    width: "100%",
    height: 230,
    borderBottomLeftRadius: BorderRadius.lg,
    borderBottomRightRadius: BorderRadius.lg,
  },
  headerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.md,
    zIndex: 10,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    padding: Spacing.lg,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginHorizontal: Spacing.sm,
  },
  description: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
    lineHeight: 22,
  },
  section: {
    marginTop: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    marginLeft: Spacing.sm,
  },
  productGrid: {
    gap: Spacing.md,
  },
  productCard: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    marginBottom: Spacing.sm,
  },
  productImage: {
    width: "100%",
    height: 160,
  },
  productImagePlaceholder: {
    width: "100%",
    height: 120,
    justifyContent: "center",
    alignItems: "center",
  },
  productInfo: {
    padding: Spacing.md,
  },
  productActions: {
    flexDirection: "row",
    padding: Spacing.md,
    paddingTop: 0,
    gap: Spacing.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  addToCartBtn: {
    borderWidth: 1,
  },
  buyNowBtn: {},
  servicesList: {
    gap: Spacing.md,
  },
  serviceCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceDetails: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  bookServiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginLeft: Spacing.md,
  },
});
