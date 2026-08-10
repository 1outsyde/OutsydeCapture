import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/types";

const COLORS = {
  black: "#000000",
  gold: "#C9933A",
  cream: "#F5F0E6",
  surfaceAlt: "#1A1A1A",
  textPrimary: "#FFFFFF",
  textMuted: "#888888",
  emerald: "#1A3C34",
};

// Mock data — replace with /services/api once influencer analytics endpoints exist
const MOCK_OVERVIEW = {
  engagementRate: 4.2,
  followers: 12800,
  avgReachPerPost: 3400,
  collabs: 6,
};

const MOCK_WEEKLY_ENGAGEMENT = [
  { label: "W1", value: 3.6 },
  { label: "W2", value: 3.9 },
  { label: "W3", value: 4.0 },
  { label: "W4", value: 4.2 },
];

const MOCK_TOP_POSTS = [
  { caption: "Golden hour shoot recap", reach: 5800, engagementRate: 6.1 },
  { caption: "Behind the scenes w/ Sunset Studio", reach: 4200, engagementRate: 5.3 },
  { caption: "Q&A: how I edit my photos", reach: 3100, engagementRate: 4.4 },
];

function BarChart({ data, labels, color }: { data: number[]; labels: string[]; color: string }) {
  const maxValue = Math.max(...data, 1);
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", height: 100, gap: 4 }}>
      {data.map((value, i) => (
        <View key={i} style={{ flex: 1, alignItems: "center" }}>
          <View
            style={{
              backgroundColor: color,
              borderRadius: 4,
              width: "80%",
              height: Math.max(16, (value / maxValue) * 100),
            }}
          />
          <Text style={{ fontSize: 9, color: COLORS.textMuted, marginTop: 4, textAlign: "center" }}>
            {labels[i]}
          </Text>
        </View>
      ))}
    </View>
  );
}

function formatCompact(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return String(n);
}

export default function InfluencerAnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.black }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 20,
          paddingBottom: 16,
          backgroundColor: COLORS.black,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <Pressable onPress={() => navigation.goBack()}>
          <Feather name="chevron-left" size={24} color={COLORS.textPrimary} />
        </Pressable>
        <Text
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: 20,
            fontWeight: "bold",
            color: COLORS.textPrimary,
          }}
        >
          Analytics
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* OVERVIEW */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>OVERVIEW</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <View style={[styles.statCard, { flexBasis: "48%" }]}>
              <Text style={styles.statValue}>{MOCK_OVERVIEW.engagementRate.toFixed(1)}%</Text>
              <Text style={styles.statLabel}>Engagement Rate</Text>
            </View>
            <View style={[styles.statCard, { flexBasis: "48%" }]}>
              <Text style={styles.statValue}>{formatCompact(MOCK_OVERVIEW.followers)}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={[styles.statCard, { flexBasis: "48%" }]}>
              <Text style={styles.statValue}>{formatCompact(MOCK_OVERVIEW.avgReachPerPost)}</Text>
              <Text style={styles.statLabel}>Avg Reach / Post</Text>
            </View>
            <View style={[styles.statCard, { flexBasis: "48%" }]}>
              <Text style={styles.statValue}>{MOCK_OVERVIEW.collabs}</Text>
              <Text style={styles.statLabel}>Collabs</Text>
            </View>
          </View>
        </View>

        {/* ENGAGEMENT OVER TIME */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ENGAGEMENT OVER TIME</Text>
          <View style={styles.statCard}>
            <BarChart
              data={MOCK_WEEKLY_ENGAGEMENT.map((w) => w.value)}
              labels={MOCK_WEEKLY_ENGAGEMENT.map((w) => w.label)}
              color={COLORS.gold}
            />
            <Text style={{ color: COLORS.textMuted, fontSize: 11, fontStyle: "italic", marginTop: 8, textAlign: "center" }}>
              Engagement rate by week, last 4 weeks
            </Text>
          </View>
        </View>

        {/* TOP POSTS */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TOP POSTS</Text>
          {MOCK_TOP_POSTS.map((post, i) => (
            <View key={i} style={styles.postCard}>
              <Text style={styles.postCaption} numberOfLines={1}>{post.caption}</Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
                <Text style={styles.postMeta}>{formatCompact(post.reach)} reach</Text>
                <Text style={[styles.postMeta, { color: COLORS.gold }]}>{post.engagementRate.toFixed(1)}% engagement</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 20,
    marginBottom: 28,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: COLORS.gold,
    textTransform: "uppercase",
    marginBottom: 14,
  },
  statCard: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    padding: 14,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: COLORS.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  postCard: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  postCaption: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  postMeta: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
});
