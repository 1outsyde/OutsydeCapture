import React from "react";
import { StyleSheet, View, Pressable, SectionList } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useFavorites, FavoriteItem, FavoriteType } from "@/context/FavoritesContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const TYPE_LABELS: Record<FavoriteType, string> = {
  photographer: "Photographers",
  business: "Businesses",
  product: "Products",
};

const TYPE_ICONS: Record<FavoriteType, keyof typeof Feather.glyphMap> = {
  photographer: "camera",
  business: "briefcase",
  product: "shopping-bag",
};

export default function FavoritesScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { favorites, removeFavorite, getFavoritesByType } = useFavorites();

  const sections = (["photographer", "business", "product"] as FavoriteType[])
    .map((type) => ({
      title: TYPE_LABELS[type],
      icon: TYPE_ICONS[type],
      type,
      data: getFavoritesByType(type),
    }))
    .filter((section) => section.data.length > 0);

  const handleRemove = (item: FavoriteItem) => {
    removeFavorite(item.id, item.type);
  };

  const renderItem = ({ item }: { item: FavoriteItem }) => (
    <View style={[styles.itemCard, { backgroundColor: theme.backgroundDefault }]}>
      <Image source={{ uri: item.image }} style={styles.itemImage} contentFit="cover" />
      <View style={styles.itemInfo}>
        <ThemedText type="h4" numberOfLines={1}>
          {item.name}
        </ThemedText>
        {item.subtitle ? (
          <ThemedText type="caption" style={{ color: theme.textSecondary }} numberOfLines={1}>
            {item.subtitle}
          </ThemedText>
        ) : null}
      </View>
      <Pressable
        onPress={() => handleRemove(item)}
        style={({ pressed }) => [styles.removeButton, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Feather name="x" size={20} color={theme.textSecondary} />
      </Pressable>
    </View>
  );

  const renderSectionHeader = ({ section }: { section: { title: string; icon: keyof typeof Feather.glyphMap } }) => (
    <View style={styles.sectionHeader}>
      <Feather name={section.icon} size={18} color={theme.primary} />
      <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
        {section.title}
      </ThemedText>
    </View>
  );

  const ListEmpty = () => (
    <View style={styles.emptyState}>
      <Feather name="bookmark" size={64} color={theme.textSecondary} />
      <ThemedText type="h3" style={styles.emptyTitle}>
        No Saved Items
      </ThemedText>
      <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
        Tap the bookmark icon on posts and businesses to save them here
      </ThemedText>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h2">Saved</ThemedText>
        <View style={styles.placeholder} />
      </View>

      {favorites.length === 0 ? (
        <ListEmpty />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => `${item.type}_${item.id}`}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholder: {
    width: 40,
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing["3xl"],
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    marginTop: Spacing.md,
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.sm,
  },
  itemInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  removeButton: {
    padding: Spacing.sm,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },
});
