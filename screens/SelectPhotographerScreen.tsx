import React from "react";
import { StyleSheet, View, Pressable, FlatList } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { Photographer, CATEGORY_LABELS } from "@/types";
import { RootStackParamList } from "@/navigation/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SelectPhotographerScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { photographers } = useData();
  const { isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();

  const handlePhotographerSelect = (photographer: Photographer) => {
    if (!isAuthenticated) {
      navigation.navigate("Auth");
      return;
    }
    navigation.replace("Booking", { photographer });
  };

  const renderPhotographerItem = ({ item }: { item: Photographer }) => (
    <Pressable
      onPress={() => handlePhotographerSelect(item)}
      style={({ pressed }) => [
        styles.photographerCard,
        {
          backgroundColor: theme.backgroundDefault,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <Image
        source={{ uri: item.avatar }}
        style={styles.photographerImage}
        contentFit="cover"
        transition={200}
      />
      <View style={styles.photographerInfo}>
        <View style={styles.photographerHeader}>
          <ThemedText type="h4" numberOfLines={1} style={styles.photographerName}>
            {item.name}
          </ThemedText>
          <ThemedText type="body" style={{ color: theme.secondary }}>
            {item.priceRange}
          </ThemedText>
        </View>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {CATEGORY_LABELS[item.specialty]}
        </ThemedText>
        <View style={styles.photographerMeta}>
          <View style={styles.ratingContainer}>
            <Feather name="star" size={14} color="#FFD700" />
            <ThemedText type="small">
              {" "}{item.rating}
            </ThemedText>
          </View>
          <View style={styles.locationContainer}>
            <Feather name="map-pin" size={14} color={theme.textSecondary} />
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {" "}{item.location}
            </ThemedText>
          </View>
        </View>
        <View style={styles.availabilityRow}>
          <Feather name="calendar" size={14} color={theme.success} />
          <ThemedText type="caption" style={{ color: theme.success, marginLeft: Spacing.xs }}>
            {item.availability.length} days available
          </ThemedText>
        </View>
      </View>
    </Pressable>
  );

  const ListHeader = () => (
    <View style={styles.header}>
      <ThemedText type="h3" style={styles.title}>
        Select a Photographer
      </ThemedText>
      <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
        Choose who will capture your special moments
      </ThemedText>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.headerBar, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.closeButton, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Feather name="x" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h4">Book a Session</ThemedText>
        <View style={styles.closeButton} />
      </View>

      <FlatList
        data={photographers}
        renderItem={renderPhotographerItem}
        keyExtractor={item => item.id}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + Spacing.xl }
        ]}
        showsVerticalScrollIndicator={false}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  title: {
    marginBottom: Spacing.xs,
  },
  subtitle: {},
  photographerCard: {
    flexDirection: "row",
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    marginBottom: Spacing.lg,
  },
  photographerImage: {
    width: 100,
    height: 120,
  },
  photographerInfo: {
    flex: 1,
    padding: Spacing.md,
    justifyContent: "center",
  },
  photographerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  photographerName: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  photographerMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  availabilityRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
});
