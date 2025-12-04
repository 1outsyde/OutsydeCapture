import React, { useState, useRef } from "react";
import { StyleSheet, View, Pressable, Dimensions, FlatList, StatusBar } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useData } from "@/context/DataContext";
import { Spacing } from "@/constants/theme";
import { SessionPhoto } from "@/types";
import { RootStackParamList } from "@/navigation/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteType = RouteProp<RootStackParamList, "PhotoGallery">;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function PhotoGalleryScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { sessionId, initialIndex = 0 } = route.params;
  const { sessions } = useData();
  const insets = useSafeAreaInsets();
  
  const session = sessions.find(s => s.id === sessionId);
  const photos = session?.photos || [];
  
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showControls, setShowControls] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  const handleScroll = (event: any) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setCurrentIndex(index);
  };

  const toggleControls = () => {
    setShowControls(!showControls);
  };

  if (!session || photos.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: "#000000" }]}>
        <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.closeButton, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather name="x" size={24} color="#FFFFFF" />
          </Pressable>
        </View>
        <View style={styles.emptyState}>
          <Feather name="image" size={48} color="rgba(255,255,255,0.5)" />
          <ThemedText type="h4" style={styles.emptyText}>
            No photos available
          </ThemedText>
        </View>
      </View>
    );
  }

  const currentPhoto = photos[currentIndex];

  const renderPhoto = ({ item }: { item: SessionPhoto }) => (
    <Pressable onPress={toggleControls} style={styles.photoContainer}>
      <Image
        source={{ uri: item.url }}
        style={styles.fullscreenPhoto}
        contentFit="contain"
        transition={200}
      />
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: "#000000" }]}>
      <StatusBar barStyle="light-content" />
      
      <FlatList
        ref={flatListRef}
        data={photos}
        renderItem={renderPhoto}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        initialScrollIndex={initialIndex}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      {showControls ? (
        <>
          <View
            style={[
              styles.header,
              { paddingTop: insets.top + Spacing.md },
            ]}
          >
            <Pressable
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [styles.closeButton, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Feather name="x" size={24} color="#FFFFFF" />
            </Pressable>
            <ThemedText type="body" style={styles.counter}>
              {currentIndex + 1} / {photos.length}
            </ThemedText>
            <View style={styles.closeButton} />
          </View>

          <View
            style={[
              styles.footer,
              { paddingBottom: insets.bottom + Spacing.lg },
            ]}
          >
            {currentPhoto.caption ? (
              <ThemedText type="body" style={styles.caption}>
                {currentPhoto.caption}
              </ThemedText>
            ) : null}
            
            <View style={styles.pagination}>
              {photos.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    {
                      backgroundColor:
                        currentIndex === index
                          ? "#FFFFFF"
                          : "rgba(255,255,255,0.3)",
                    },
                  ]}
                />
              ))}
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: "rgba(0,0,0,0.4)",
    zIndex: 10,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  counter: {
    color: "#FFFFFF",
  },
  photoContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  fullscreenPhoto: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.8,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  caption: {
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: "rgba(255,255,255,0.7)",
    marginTop: Spacing.lg,
  },
});
