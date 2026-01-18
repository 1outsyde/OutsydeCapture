import React, { useState } from "react";
import { StyleSheet, View, ScrollView, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

type TabType = "privacy" | "cookies";

export default function PrivacyPolicyScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<TabType>("privacy");

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={styles.section}>
      <ThemedText type="h3" style={styles.sectionTitle}>{title}</ThemedText>
      {children}
    </View>
  );

  const Paragraph = ({ children }: { children: string }) => (
    <ThemedText type="body" style={[styles.paragraph, { color: theme.textSecondary }]}>
      {children}
    </ThemedText>
  );

  const BulletPoint = ({ children }: { children: string }) => (
    <View style={styles.bulletRow}>
      <ThemedText type="body" style={{ color: theme.textSecondary }}>•</ThemedText>
      <ThemedText type="body" style={[styles.bulletText, { color: theme.textSecondary }]}>
        {children}
      </ThemedText>
    </View>
  );

  const renderPrivacyPolicy = () => (
    <>
      <ThemedText type="small" style={[styles.lastUpdated, { color: theme.textSecondary }]}>
        Last Updated: 01/23/2026
      </ThemedText>

      <Paragraph>
        Outsyde ("Outsyde," "we," "our," or "us") values your privacy. This Privacy Policy explains how we collect, use, disclose, and protect personal information when you use the Outsyde mobile application, website, and related services (collectively, the "Platform").
      </Paragraph>

      <Paragraph>
        By using Outsyde, you consent to the practices described in this Privacy Policy.
      </Paragraph>

      <Section title="1. Information We Collect">
        <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>
          A. Information You Provide
        </ThemedText>
        <Paragraph>We may collect personal information you provide, including:</Paragraph>
        <BulletPoint>Name</BulletPoint>
        <BulletPoint>Email address</BulletPoint>
        <BulletPoint>Phone number</BulletPoint>
        <BulletPoint>Profile information (photos, bios, business details)</BulletPoint>
        <BulletPoint>Booking details and communications</BulletPoint>
        <BulletPoint>Content you upload (images, videos, text)</BulletPoint>

        <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>
          B. Payment Information
        </ThemedText>
        <Paragraph>All payments are processed through third-party payment processors, such as Stripe.</Paragraph>
        <Paragraph>Outsyde does not store your full credit card or banking information. Payment processors collect and store this information in accordance with their own privacy policies.</Paragraph>

        <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>
          C. Automatically Collected Information
        </ThemedText>
        <Paragraph>When you use Outsyde, we may automatically collect:</Paragraph>
        <BulletPoint>Device type and operating system</BulletPoint>
        <BulletPoint>IP address</BulletPoint>
        <BulletPoint>App usage data</BulletPoint>
        <BulletPoint>Log data and performance analytics</BulletPoint>
        <BulletPoint>Cookies or similar technologies (for web use)</BulletPoint>
      </Section>

      <Section title="2. How We Use Information">
        <Paragraph>We use your information to:</Paragraph>
        <BulletPoint>Operate and improve the Platform</BulletPoint>
        <BulletPoint>Facilitate bookings, payments, and transactions</BulletPoint>
        <BulletPoint>Verify accounts and prevent fraud</BulletPoint>
        <BulletPoint>Communicate with users</BulletPoint>
        <BulletPoint>Provide customer support</BulletPoint>
        <BulletPoint>Enforce our Terms of Service</BulletPoint>
        <BulletPoint>Comply with legal obligations</BulletPoint>
        <Paragraph>Outsyde does not sell your personal information.</Paragraph>
      </Section>

      <Section title="3. Sharing of Information">
        <Paragraph>We may share information with:</Paragraph>
        <BulletPoint>Service providers (e.g., payment processors, hosting providers)</BulletPoint>
        <BulletPoint>Other users, as necessary for bookings or transactions</BulletPoint>
        <BulletPoint>Legal authorities, if required by law</BulletPoint>
        <BulletPoint>Parties involved in business transfers (e.g., merger or acquisition)</BulletPoint>
        <Paragraph>Only the minimum necessary information is shared.</Paragraph>
      </Section>

      <Section title="4. User-to-User Visibility">
        <Paragraph>Certain information may be visible to other users, including:</Paragraph>
        <BulletPoint>Profile names, photos, and business details</BulletPoint>
        <BulletPoint>Public listings and uploaded content</BulletPoint>
        <BulletPoint>Reviews or ratings</BulletPoint>
        <Paragraph>You control what information is publicly visible through your account settings.</Paragraph>
      </Section>

      <Section title="5. Data Security">
        <Paragraph>Outsyde implements reasonable administrative, technical, and physical safeguards to protect your information.</Paragraph>
        <Paragraph>However, no system is completely secure. You acknowledge that data transmission over the internet is not guaranteed to be 100% secure.</Paragraph>
      </Section>

      <Section title="6. Data Retention">
        <Paragraph>We retain personal information only as long as necessary to:</Paragraph>
        <BulletPoint>Provide services</BulletPoint>
        <BulletPoint>Comply with legal obligations</BulletPoint>
        <BulletPoint>Resolve disputes</BulletPoint>
        <BulletPoint>Enforce agreements</BulletPoint>
        <Paragraph>You may request account deletion, subject to legal and contractual requirements.</Paragraph>
      </Section>

      <Section title="7. Your Rights & Choices">
        <Paragraph>Depending on your location, you may have the right to:</Paragraph>
        <BulletPoint>Access your personal information</BulletPoint>
        <BulletPoint>Correct inaccurate information</BulletPoint>
        <BulletPoint>Request deletion of your data</BulletPoint>
        <BulletPoint>Opt out of certain communications</BulletPoint>
        <Paragraph>Requests may be submitted to info@goutsyde.com.</Paragraph>
      </Section>

      <Section title="8. Children's Privacy">
        <Paragraph>Outsyde is not intended for individuals under the age of 18.</Paragraph>
        <Paragraph>We do not knowingly collect personal information from minors. If such data is identified, it will be deleted promptly.</Paragraph>
      </Section>

      <Section title="9. New York SHIELD Act Compliance">
        <Paragraph>For users located in New York, Outsyde complies with the New York SHIELD Act and maintains reasonable safeguards to protect private information.</Paragraph>
      </Section>

      <Section title="10. Third-Party Links & Services">
        <Paragraph>The Platform may contain links to third-party websites or services.</Paragraph>
        <Paragraph>Outsyde is not responsible for the privacy practices or content of third parties. Use them at your own discretion.</Paragraph>
      </Section>

      <Section title="11. Changes to This Policy">
        <Paragraph>Outsyde may update this Privacy Policy at any time. Continued use of the Platform constitutes acceptance of the revised policy.</Paragraph>
      </Section>

      <Section title="12. Contact Information">
        <Paragraph>Outsyde LLC</Paragraph>
        <Paragraph>Email: info@goutsyde.com</Paragraph>
        <Paragraph>Website: https://goutsyde.com</Paragraph>
      </Section>
    </>
  );

  const renderCookiesNotice = () => (
    <>
      <ThemedText type="small" style={[styles.lastUpdated, { color: theme.textSecondary }]}>
        Last Updated: 01/23/2026
      </ThemedText>

      <Paragraph>
        This Cookies Notice explains how Outsyde ("Outsyde," "we," "our," or "us") uses cookies and similar technologies when you visit or interact with our website, mobile application, and related services (collectively, the "Platform").
      </Paragraph>

      <Paragraph>
        By continuing to use Outsyde, you agree to our use of cookies as described in this notice.
      </Paragraph>

      <Section title="1. What Are Cookies?">
        <Paragraph>Cookies are small text files stored on your device when you visit a website or use an application. They help platforms remember information about your visit and improve user experience.</Paragraph>
        <Paragraph>Cookies may be:</Paragraph>
        <BulletPoint>Session cookies (deleted when you close your browser)</BulletPoint>
        <BulletPoint>Persistent cookies (remain until deleted or expired)</BulletPoint>
      </Section>

      <Section title="2. Types of Cookies We Use">
        <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>
          A. Essential Cookies
        </ThemedText>
        <Paragraph>These cookies are required for the Platform to function properly, including:</Paragraph>
        <BulletPoint>Account authentication</BulletPoint>
        <BulletPoint>Security and fraud prevention</BulletPoint>
        <BulletPoint>Session management</BulletPoint>
        <Paragraph>Without these cookies, core features may not work.</Paragraph>

        <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>
          B. Performance & Analytics Cookies
        </ThemedText>
        <Paragraph>These cookies help us understand how users interact with Outsyde by collecting information such as:</Paragraph>
        <BulletPoint>Pages visited</BulletPoint>
        <BulletPoint>Feature usage</BulletPoint>
        <BulletPoint>Error reports</BulletPoint>
        <BulletPoint>Performance metrics</BulletPoint>
        <Paragraph>This data is used to improve the Platform's functionality and experience.</Paragraph>

        <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>
          C. Functionality Cookies
        </ThemedText>
        <Paragraph>These cookies allow Outsyde to:</Paragraph>
        <BulletPoint>Remember user preferences</BulletPoint>
        <BulletPoint>Save login sessions</BulletPoint>
        <BulletPoint>Personalize content and settings</BulletPoint>

        <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>
          D. Third-Party Cookies
        </ThemedText>
        <Paragraph>We may use third-party services (such as analytics or payment providers) that place cookies on your device.</Paragraph>
        <Paragraph>These third parties are governed by their own privacy and cookie policies. Outsyde does not control their use of cookies.</Paragraph>
      </Section>

      <Section title="3. Cookies in Mobile Applications">
        <Paragraph>While cookies are primarily associated with web browsers, mobile applications may use similar technologies (such as SDKs or device identifiers) to:</Paragraph>
        <BulletPoint>Maintain sessions</BulletPoint>
        <BulletPoint>Track performance</BulletPoint>
        <BulletPoint>Improve stability and security</BulletPoint>
      </Section>

      <Section title="4. How to Manage Cookies">
        <Paragraph>You may control or delete cookies through your browser or device settings.</Paragraph>
        <Paragraph>Please note:</Paragraph>
        <BulletPoint>Disabling cookies may impact Platform functionality</BulletPoint>
        <BulletPoint>Certain features may not work properly without cookies</BulletPoint>
      </Section>

      <Section title="5. Do Not Track Signals">
        <Paragraph>Outsyde does not currently respond to browser "Do Not Track" signals, as there is no consistent industry standard for compliance.</Paragraph>
      </Section>

      <Section title="6. Changes to This Cookies Notice">
        <Paragraph>Outsyde may update this Cookies Notice at any time. Changes become effective when posted. Continued use of the Platform constitutes acceptance of the updated notice.</Paragraph>
      </Section>

      <Section title="7. Contact Information">
        <Paragraph>If you have questions about this Cookies Notice, contact us at:</Paragraph>
        <Paragraph>Outsyde LLC</Paragraph>
        <Paragraph>Email: info@goutsyde.com</Paragraph>
        <Paragraph>Website: https://goutsyde.com</Paragraph>
      </Section>
    </>
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
        <ThemedText type="h2">Legal</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabContainer}>
        <Pressable
          onPress={() => setActiveTab("privacy")}
          style={[
            styles.tab,
            {
              backgroundColor: activeTab === "privacy" ? theme.primary : theme.backgroundDefault,
              borderColor: activeTab === "privacy" ? theme.primary : theme.border,
            },
          ]}
        >
          <Feather
            name="shield"
            size={16}
            color={activeTab === "privacy" ? "#000" : theme.text}
          />
          <ThemedText
            type="body"
            style={{
              marginLeft: Spacing.xs,
              color: activeTab === "privacy" ? "#000" : theme.text,
              fontWeight: "600",
            }}
          >
            Privacy Policy
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab("cookies")}
          style={[
            styles.tab,
            {
              backgroundColor: activeTab === "cookies" ? theme.primary : theme.backgroundDefault,
              borderColor: activeTab === "cookies" ? theme.primary : theme.border,
            },
          ]}
        >
          <Feather
            name="info"
            size={16}
            color={activeTab === "cookies" ? "#000" : theme.text}
          />
          <ThemedText
            type="body"
            style={{
              marginLeft: Spacing.xs,
              color: activeTab === "cookies" ? "#000" : theme.text,
              fontWeight: "600",
            }}
          >
            Cookies Notice
          </ThemedText>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === "privacy" ? renderPrivacyPolicy() : renderCookiesNotice()}
      </ScrollView>
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
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  lastUpdated: {
    marginBottom: Spacing.lg,
    fontStyle: "italic",
  },
  section: {
    marginTop: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  subheading: {
    fontWeight: "600",
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  paragraph: {
    marginBottom: Spacing.sm,
    lineHeight: 22,
  },
  bulletRow: {
    flexDirection: "row",
    paddingLeft: Spacing.md,
    marginBottom: Spacing.xs,
  },
  bulletText: {
    marginLeft: Spacing.sm,
    flex: 1,
    lineHeight: 22,
  },
});
