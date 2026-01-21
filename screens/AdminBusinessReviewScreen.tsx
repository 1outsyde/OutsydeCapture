import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import api, { AdminBusinessDetail } from "@/services/api";
import { RootStackParamList } from "@/navigation/types";
import { Spacing, BorderRadius } from "@/constants/theme";

type RouteParams = RouteProp<RootStackParamList, "AdminBusinessReview">;

export default function AdminBusinessReviewScreen() {
  console.log("[AdminBusinessReviewScreen] Screen mounting...");
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteParams>();
  const { businessId } = route.params;
  console.log("[AdminBusinessReviewScreen] businessId from route:", businessId);
  const { getToken } = useAuth();
  const { addNotification } = useNotifications();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [business, setBusiness] = useState<AdminBusinessDetail | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const fetchBusinessDetail = useCallback(async () => {
    const token = await getToken();
    console.log(`[AdminBusinessReview] Token retrieved:`, token ? `${token.substring(0, 30)}...` : "null");
    if (!token) {
      setFetchError("Authentication required. Please log in again.");
      setLoading(false);
      return;
    }
    
    if (token.startsWith("session_")) {
      console.log("[AdminBusinessReview] WARNING: Token is a session indicator, not a JWT. Backend may return 401.");
      setFetchError("Your session token is not a valid JWT. The backend requires a JWT access token for admin operations. Please log out and log back in, or contact the backend team to ensure /api/auth/login returns an accessToken.");
      setLoading(false);
      return;
    }

    try {
      console.log(`[AdminBusinessReview] Fetching business detail for ID: ${businessId}`);
      const data = await api.getAdminBusinessDetail(token, businessId);
      console.log(`[AdminBusinessReview] Business detail loaded:`, data?.name);
      setBusiness(data);
      setFetchError(null);
    } catch (error: any) {
      console.log("[AdminBusinessReview] Error fetching business detail:", error?.message || error, "status:", error?.status);
      if (error?.status === 401 || error?.message?.includes("401") || error?.message?.includes("Not authenticated")) {
        setFetchError("Authentication failed (401). Your token may be invalid or expired. Please log out and log back in. If this persists, the backend may need to return a valid JWT in the login response.");
      } else if (error?.status === 404 || error?.message?.includes("404")) {
        setFetchError("Business detail view is not yet available from the backend. The GET /api/admin/businesses/:id endpoint may need to be implemented. You can still approve or reject businesses from the list.");
      } else {
        setFetchError(`Failed to load business details: ${error?.message || "Unknown error"}`);
      }
    } finally {
      setLoading(false);
    }
  }, [getToken, businessId]);

  useEffect(() => {
    console.log("[AdminBusinessReviewScreen] useEffect triggered, calling fetchBusinessDetail");
    Alert.alert("Debug", `Screen mounted with businessId: ${businessId}`);
    fetchBusinessDetail();
  }, [fetchBusinessDetail]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchBusinessDetail();
    setRefreshing(false);
  };

  const handleApprove = async () => {
    const token = await getToken();
    if (!token || !business) return;

    Alert.alert(
      "Approve Business",
      `Are you sure you want to approve "${business.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          style: "default",
          onPress: async () => {
            setApproving(true);
            try {
              await api.approveApplication(token, "business", businessId);
              
              if (business.ownerEmail) {
                addNotification({
                  title: "Business Approved",
                  body: `Your business "${business.name}" has been approved on Outsyde! Complete your subscription to go live.`,
                  type: "system",
                });
              }

              Alert.alert(
                "Success",
                `"${business.name}" has been approved. The owner will receive a notification to complete their subscription.`,
                [{ text: "OK", onPress: () => navigation.goBack() }]
              );
            } catch (error) {
              console.error("Failed to approve business:", error);
              Alert.alert("Error", "Failed to approve business. Please try again.");
            } finally {
              setApproving(false);
            }
          },
        },
      ]
    );
  };

  const handleReject = () => {
    if (!business) return;
    setRejectionReason("");
    setShowRejectModal(true);
  };

  const confirmReject = async () => {
    const token = await getToken();
    if (!token || !business) return;

    if (!rejectionReason.trim()) {
      Alert.alert("Required", "Please provide a reason for rejection.");
      return;
    }

    setRejecting(true);
    try {
      await api.rejectApplication(token, "business", businessId, rejectionReason.trim());
      setShowRejectModal(false);
      
      Alert.alert(
        "Rejected",
        `"${business.name}" has been rejected.`,
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error("Failed to reject business:", error);
      Alert.alert("Error", "Failed to reject business. Please try again.");
    } finally {
      setRejecting(false);
    }
  };

  const openUrl = (url: string) => {
    const fullUrl = url.startsWith("http") ? url : `https://${url}`;
    Linking.openURL(fullUrl).catch(() => {
      Alert.alert("Error", "Could not open link");
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.backgroundRoot,
    },
    scrollContent: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: 120 + insets.bottom,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    section: {
      backgroundColor: theme.background,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: Spacing.md,
    },
    coverImage: {
      width: "100%",
      height: 180,
      borderRadius: BorderRadius.lg,
      backgroundColor: theme.backgroundSecondary,
      marginBottom: Spacing.md,
    },
    logoRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: Spacing.md,
    },
    logo: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.backgroundSecondary,
      marginRight: Spacing.md,
    },
    businessName: {
      fontSize: 22,
      fontWeight: "700",
      color: theme.text,
      flex: 1,
    },
    statusBadge: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
      borderRadius: BorderRadius.sm,
      alignSelf: "flex-start",
      marginTop: Spacing.xs,
    },
    pendingBadge: {
      backgroundColor: "#FFF3E0",
    },
    approvedBadge: {
      backgroundColor: "#E8F5E9",
    },
    rejectedBadge: {
      backgroundColor: "#FFEBEE",
    },
    statusText: {
      fontSize: 12,
      fontWeight: "600",
      textTransform: "capitalize",
    },
    pendingText: {
      color: "#E65100",
    },
    approvedText: {
      color: "#2E7D32",
    },
    rejectedText: {
      color: "#C62828",
    },
    infoRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: Spacing.sm,
    },
    infoIcon: {
      marginRight: Spacing.sm,
      marginTop: 2,
    },
    infoLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      marginBottom: 2,
    },
    infoValue: {
      fontSize: 15,
      color: theme.text,
      flex: 1,
    },
    linkText: {
      color: theme.primary,
      textDecorationLine: "underline",
    },
    description: {
      fontSize: 15,
      color: theme.text,
      lineHeight: 22,
    },
    servicesList: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: Spacing.xs,
    },
    servicePill: {
      backgroundColor: theme.backgroundSecondary,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 6,
      borderRadius: BorderRadius.md,
    },
    servicePillText: {
      fontSize: 13,
      color: theme.text,
    },
    socialRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: Spacing.sm,
    },
    socialButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.backgroundSecondary,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 8,
      borderRadius: BorderRadius.md,
      gap: 6,
    },
    socialText: {
      fontSize: 13,
      color: theme.text,
    },
    imageGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: Spacing.sm,
    },
    gridImage: {
      width: 100,
      height: 100,
      borderRadius: BorderRadius.md,
      backgroundColor: theme.backgroundSecondary,
    },
    hoursRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: Spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    hoursDay: {
      fontSize: 14,
      color: theme.text,
      fontWeight: "500",
    },
    hoursTime: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    closedText: {
      fontSize: 14,
      color: "#FF3B30",
    },
    metaRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: Spacing.xs,
    },
    metaLabel: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    metaValue: {
      fontSize: 14,
      color: theme.text,
      fontWeight: "500",
    },
    trueValue: {
      color: "#34C759",
    },
    falseValue: {
      color: "#FF3B30",
    },
    actionBar: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: theme.background,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: insets.bottom + Spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      flexDirection: "row",
      gap: Spacing.md,
    },
    actionButton: {
      flex: 1,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.lg,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: Spacing.xs,
    },
    approveButton: {
      backgroundColor: "#34C759",
    },
    rejectButton: {
      backgroundColor: "#FF3B30",
    },
    disabledButton: {
      opacity: 0.6,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: "600",
      color: "#FFFFFF",
    },
    emptyText: {
      fontSize: 14,
      color: theme.textSecondary,
      fontStyle: "italic",
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: Spacing.lg,
    },
    modalContent: {
      backgroundColor: theme.background,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      width: "100%",
      maxWidth: 400,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: Spacing.md,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.text,
    },
    modalSubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      marginBottom: Spacing.md,
      lineHeight: 20,
    },
    reasonInput: {
      backgroundColor: theme.backgroundSecondary,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      fontSize: 15,
      color: theme.text,
      minHeight: 100,
      marginBottom: Spacing.lg,
    },
    modalActions: {
      flexDirection: "row",
      gap: Spacing.md,
    },
    modalButton: {
      flex: 1,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.md,
      alignItems: "center",
      justifyContent: "center",
    },
    cancelButton: {
      backgroundColor: theme.backgroundSecondary,
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.text,
    },
    confirmRejectButton: {
      backgroundColor: "#FF3B30",
    },
    confirmRejectText: {
      fontSize: 16,
      fontWeight: "600",
      color: "#FFFFFF",
    },
  });

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={{ marginTop: Spacing.md, color: theme.textSecondary }}>
          Loading business details...
        </Text>
      </View>
    );
  }

  if (fetchError || !business) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Feather name="alert-circle" size={48} color={theme.textSecondary} />
        <Text style={{ marginTop: Spacing.md, color: theme.textSecondary, textAlign: "center", paddingHorizontal: Spacing.xl }}>
          {fetchError || "Business not found"}
        </Text>
        <Pressable
          style={{ marginTop: Spacing.lg, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg, backgroundColor: theme.primary, borderRadius: BorderRadius.md }}
          onPress={() => navigation.goBack()}
        >
          <Text style={{ color: "#FFFFFF", fontWeight: "600" }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const businessStatus = business.approvalStatus || business.status || "pending";
  const isPending = businessStatus === "pending";
  const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {business.coverImage ? (
          <Image source={{ uri: business.coverImage }} style={styles.coverImage} contentFit="cover" />
        ) : null}

        <View style={styles.section}>
          <View style={styles.logoRow}>
            {business.logo ? (
              <Image source={{ uri: business.logo }} style={styles.logo} contentFit="cover" />
            ) : (
              <View style={styles.logo}>
                <Feather name="briefcase" size={28} color={theme.textSecondary} style={{ alignSelf: "center", marginTop: 18 }} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.businessName}>{business.name}</Text>
              <View style={[
                styles.statusBadge,
                businessStatus === "pending" ? styles.pendingBadge :
                businessStatus === "approved" ? styles.approvedBadge : styles.rejectedBadge
              ]}>
                <Text style={[
                  styles.statusText,
                  businessStatus === "pending" ? styles.pendingText :
                  businessStatus === "approved" ? styles.approvedText : styles.rejectedText
                ]}>
                  {businessStatus}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Feather name="tag" size={16} color={theme.textSecondary} style={styles.infoIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Category</Text>
              <Text style={styles.infoValue}>{business.category || "Not specified"}</Text>
            </View>
          </View>

          {business.priceRange ? (
            <View style={styles.infoRow}>
              <Feather name="dollar-sign" size={16} color={theme.textSecondary} style={styles.infoIcon} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>Price Range</Text>
                <Text style={styles.infoValue}>{business.priceRange}</Text>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          
          <View style={styles.infoRow}>
            <Feather name="map-pin" size={16} color={theme.textSecondary} style={styles.infoIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Address</Text>
              <Text style={styles.infoValue}>
                {[business.address, business.city, business.state, business.zipCode]
                  .filter(Boolean)
                  .join(", ") || "Not provided"}
              </Text>
            </View>
          </View>

          {business.email ? (
            <View style={styles.infoRow}>
              <Feather name="mail" size={16} color={theme.textSecondary} style={styles.infoIcon} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={[styles.infoValue, styles.linkText]} onPress={() => Linking.openURL(`mailto:${business.email}`)}>
                  {business.email}
                </Text>
              </View>
            </View>
          ) : null}

          {business.phone ? (
            <View style={styles.infoRow}>
              <Feather name="phone" size={16} color={theme.textSecondary} style={styles.infoIcon} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>Phone</Text>
                <Text style={[styles.infoValue, styles.linkText]} onPress={() => Linking.openURL(`tel:${business.phone}`)}>
                  {business.phone}
                </Text>
              </View>
            </View>
          ) : null}

          {business.website ? (
            <View style={styles.infoRow}>
              <Feather name="globe" size={16} color={theme.textSecondary} style={styles.infoIcon} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>Website</Text>
                <Text style={[styles.infoValue, styles.linkText]} onPress={() => openUrl(business.website!)}>
                  {business.website}
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        {business.owner || business.ownerName || business.ownerEmail ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Owner Information</Text>
            
            {(business.owner?.name || business.ownerName) ? (
              <View style={styles.infoRow}>
                <Feather name="user" size={16} color={theme.textSecondary} style={styles.infoIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoLabel}>Owner Name</Text>
                  <Text style={styles.infoValue}>{business.owner?.name || business.ownerName}</Text>
                </View>
              </View>
            ) : null}

            {(business.owner?.email || business.ownerEmail) ? (
              <View style={styles.infoRow}>
                <Feather name="mail" size={16} color={theme.textSecondary} style={styles.infoIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoLabel}>Owner Email</Text>
                  <Text style={[styles.infoValue, styles.linkText]} onPress={() => Linking.openURL(`mailto:${business.owner?.email || business.ownerEmail}`)}>
                    {business.owner?.email || business.ownerEmail}
                  </Text>
                </View>
              </View>
            ) : null}

            {business.owner?.phone ? (
              <View style={styles.infoRow}>
                <Feather name="phone" size={16} color={theme.textSecondary} style={styles.infoIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoLabel}>Owner Phone</Text>
                  <Text style={[styles.infoValue, styles.linkText]} onPress={() => Linking.openURL(`tel:${business.owner?.phone}`)}>
                    {business.owner?.phone}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {(business.productCount !== undefined || business.serviceCount !== undefined || business.staffCount !== undefined) ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Business Stats</Text>
            <View style={{ flexDirection: "row", justifyContent: "space-around", paddingVertical: Spacing.sm }}>
              {business.productCount !== undefined ? (
                <View style={{ alignItems: "center" }}>
                  <Text style={{ fontSize: 24, fontWeight: "700", color: theme.primary }}>{business.productCount}</Text>
                  <Text style={{ fontSize: 12, color: theme.textSecondary }}>Products</Text>
                </View>
              ) : null}
              {business.serviceCount !== undefined ? (
                <View style={{ alignItems: "center" }}>
                  <Text style={{ fontSize: 24, fontWeight: "700", color: theme.primary }}>{business.serviceCount}</Text>
                  <Text style={{ fontSize: 12, color: theme.textSecondary }}>Services</Text>
                </View>
              ) : null}
              {business.staffCount !== undefined ? (
                <View style={{ alignItems: "center" }}>
                  <Text style={{ fontSize: 24, fontWeight: "700", color: theme.primary }}>{business.staffCount}</Text>
                  <Text style={{ fontSize: 12, color: theme.textSecondary }}>Staff</Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description & Bio</Text>
          <Text style={styles.description}>
            {business.description || business.bio || "No description provided."}
          </Text>
        </View>

        {business.services && business.services.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Services Offered</Text>
            <View style={styles.servicesList}>
              {business.services.map((service, index) => (
                <View key={index} style={styles.servicePill}>
                  <Text style={styles.servicePillText}>{service}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {(business.instagram || business.facebook || business.twitter || business.tiktok || business.linkedin) ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Social Media</Text>
            <View style={styles.socialRow}>
              {business.instagram ? (
                <Pressable style={styles.socialButton} onPress={() => openUrl(`https://instagram.com/${business.instagram}`)}>
                  <Feather name="instagram" size={16} color={theme.text} />
                  <Text style={styles.socialText}>@{business.instagram}</Text>
                </Pressable>
              ) : null}
              {business.facebook ? (
                <Pressable style={styles.socialButton} onPress={() => openUrl(`https://facebook.com/${business.facebook}`)}>
                  <Feather name="facebook" size={16} color={theme.text} />
                  <Text style={styles.socialText}>{business.facebook}</Text>
                </Pressable>
              ) : null}
              {business.twitter ? (
                <Pressable style={styles.socialButton} onPress={() => openUrl(`https://twitter.com/${business.twitter}`)}>
                  <Feather name="twitter" size={16} color={theme.text} />
                  <Text style={styles.socialText}>@{business.twitter}</Text>
                </Pressable>
              ) : null}
              {business.tiktok ? (
                <Pressable style={styles.socialButton} onPress={() => openUrl(`https://tiktok.com/@${business.tiktok}`)}>
                  <Feather name="video" size={16} color={theme.text} />
                  <Text style={styles.socialText}>@{business.tiktok}</Text>
                </Pressable>
              ) : null}
              {business.linkedin ? (
                <Pressable style={styles.socialButton} onPress={() => openUrl(`https://linkedin.com/company/${business.linkedin}`)}>
                  <Feather name="linkedin" size={16} color={theme.text} />
                  <Text style={styles.socialText}>{business.linkedin}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        {business.images && business.images.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Uploaded Images</Text>
            <View style={styles.imageGrid}>
              {business.images.map((img, index) => (
                <Image key={index} source={{ uri: img }} style={styles.gridImage} contentFit="cover" />
              ))}
            </View>
          </View>
        ) : null}

        {business.documents && business.documents.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Uploaded Documents</Text>
            {business.documents.map((doc, index) => (
              <Pressable key={index} onPress={() => openUrl(doc)} style={styles.infoRow}>
                <Feather name="file-text" size={16} color={theme.primary} style={styles.infoIcon} />
                <Text style={[styles.infoValue, styles.linkText]}>Document {index + 1}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {business.businessHours ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Business Hours</Text>
            {daysOfWeek.map((day) => {
              const hours = business.businessHours?.[day.toLowerCase()];
              return (
                <View key={day} style={styles.hoursRow}>
                  <Text style={styles.hoursDay}>{day}</Text>
                  {hours?.closed ? (
                    <Text style={styles.closedText}>Closed</Text>
                  ) : hours ? (
                    <Text style={styles.hoursTime}>{hours.open} - {hours.close}</Text>
                  ) : (
                    <Text style={styles.hoursTime}>Not set</Text>
                  )}
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Status</Text>
          
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Subscription Active</Text>
            <Text style={[styles.metaValue, business.subscriptionActive ? styles.trueValue : styles.falseValue]}>
              {business.subscriptionActive ? "Yes" : "No"}
            </Text>
          </View>

          {business.subscriptionTier ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Subscription Tier</Text>
              <Text style={styles.metaValue}>{business.subscriptionTier}</Text>
            </View>
          ) : null}

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Stripe Connected</Text>
            <Text style={[styles.metaValue, business.stripeOnboardingComplete ? styles.trueValue : styles.falseValue]}>
              {business.stripeOnboardingComplete ? "Yes" : "No"}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Live on Platform</Text>
            <Text style={[styles.metaValue, business.isLive ? styles.trueValue : styles.falseValue]}>
              {business.isLive ? "Yes" : "No"}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Searchable</Text>
            <Text style={[styles.metaValue, business.isSearchable ? styles.trueValue : styles.falseValue]}>
              {business.isSearchable ? "Yes" : "No"}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Created</Text>
            <Text style={styles.metaValue}>{formatDate(business.createdAt)}</Text>
          </View>

          {business.updatedAt ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Last Updated</Text>
              <Text style={styles.metaValue}>{formatDate(business.updatedAt)}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {isPending ? (
        <View style={styles.actionBar}>
          <Pressable
            style={[styles.actionButton, styles.rejectButton, rejecting && styles.disabledButton]}
            onPress={handleReject}
            disabled={rejecting || approving}
          >
            {rejecting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Feather name="x" size={18} color="#FFFFFF" />
                <Text style={styles.buttonText}>Reject</Text>
              </>
            )}
          </Pressable>

          <Pressable
            style={[styles.actionButton, styles.approveButton, approving && styles.disabledButton]}
            onPress={handleApprove}
            disabled={approving || rejecting}
          >
            {approving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Feather name="check" size={18} color="#FFFFFF" />
                <Text style={styles.buttonText}>Approve</Text>
              </>
            )}
          </Pressable>
        </View>
      ) : null}

      <Modal
        visible={showRejectModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRejectModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reject Business</Text>
              <Pressable onPress={() => setShowRejectModal(false)} hitSlop={16}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            
            <Text style={styles.modalSubtitle}>
              Please provide a reason for rejecting "{business?.name}". This will be shared with the business owner.
            </Text>

            <TextInput
              style={styles.reasonInput}
              placeholder="Enter rejection reason..."
              placeholderTextColor={theme.textSecondary}
              value={rejectionReason}
              onChangeText={setRejectionReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.modalActions}>
              <Pressable 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => setShowRejectModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable 
                style={[styles.modalButton, styles.confirmRejectButton, rejecting && styles.disabledButton]} 
                onPress={confirmReject}
                disabled={rejecting}
              >
                {rejecting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmRejectText}>Reject</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
