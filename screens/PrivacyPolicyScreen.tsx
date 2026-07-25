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
        Last Updated: July 23, 2026
      </ThemedText>

      <Paragraph>
        Welcome to Outsyde LLC ("Outsyde," "we," "our," or "us"). Outsyde values your privacy and is committed to protecting your personal information. This Privacy Policy explains how we collect, use, disclose, store, and protect information when you use the Outsyde mobile application, website, and related services (collectively, the "Platform").
      </Paragraph>
      <Paragraph>
        By creating an account or using the Platform, you agree to this Privacy Policy.
      </Paragraph>

      <Section title="1. Information We Collect">
        <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>A. Account Information (All Users)</ThemedText>
        <Paragraph>When creating an account, we collect:</Paragraph>
        <BulletPoint>Full name (first and last)</BulletPoint>
        <BulletPoint>Username (public handle)</BulletPoint>
        <BulletPoint>Email address</BulletPoint>
        <BulletPoint>Phone number</BulletPoint>
        <BulletPoint>Password (encrypted; never stored in plaintext)</BulletPoint>
        <BulletPoint>Profile photo</BulletPoint>
        <BulletPoint>Date of birth</BulletPoint>
        <BulletPoint>Gender (optional)</BulletPoint>
        <BulletPoint>Ethnicity (optional)</BulletPoint>
        <BulletPoint>Shopping frequency and lifestyle preferences (optional)</BulletPoint>

        <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>B. Consumer-Specific Information</ThemedText>
        <Paragraph>In addition to account information, consumers may provide:</Paragraph>
        <BulletPoint>Home address: Street address, apartment/unit, city, state, ZIP code, and country</BulletPoint>
        <BulletPoint>Billing address: Separate billing address if different from home address</BulletPoint>
        <BulletPoint>Shipping addresses: Saved for order delivery</BulletPoint>
        <BulletPoint>Selected industries, niches, and values: Used to personalize your experience</BulletPoint>
        <BulletPoint>Household size, income range, education level, and occupation (optional)</BulletPoint>

        <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>C. Business (Vendor) Information</ThemedText>
        <Paragraph>If you register as a business or service provider, we collect:</Paragraph>
        <BulletPoint>Business name, category, tagline, and description</BulletPoint>
        <BulletPoint>Business address, city, state, ZIP code, and country</BulletPoint>
        <BulletPoint>Business type, years in business, and employee count</BulletPoint>
        <BulletPoint>Whether you have a physical location</BulletPoint>
        <BulletPoint>Website URL and social media handles</BulletPoint>
        <BulletPoint>Billing address</BulletPoint>
        <BulletPoint>Service listings, product listings, hours of operation</BulletPoint>
        <BulletPoint>Brand colors, logo, cover images, and cover videos</BulletPoint>
        <BulletPoint>Stripe Connect account status and onboarding information</BulletPoint>

        <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>D. Photographer-Specific Information</ThemedText>
        <Paragraph>Photographers additionally provide:</Paragraph>
        <BulletPoint>Display name and biography</BulletPoint>
        <BulletPoint>Studio name and address (if applicable)</BulletPoint>
        <BulletPoint>Shoot location type, travel radius, and pricing</BulletPoint>
        <BulletPoint>Specialties, equipment level, and experience level</BulletPoint>
        <BulletPoint>Portfolio URL, portfolio images and videos</BulletPoint>
        <BulletPoint>Delivery turnaround time</BulletPoint>

        <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>E. Payment and Financial Information</ThemedText>
        <Paragraph>Payments are processed by Stripe. Outsyde does not store full credit card numbers, CVV codes, or bank account credentials. We store:</Paragraph>
        <BulletPoint>Stripe Customer ID — a token reference for saved payment methods</BulletPoint>
        <BulletPoint>Stripe Payment Method ID — a token reference for your default saved card</BulletPoint>
        <BulletPoint>Stripe Connect Account ID — for businesses, photographers, staff, and influencers who receive payouts</BulletPoint>
        <BulletPoint>Payment Intent IDs — references linking transactions to bookings or orders</BulletPoint>
        <BulletPoint>Computed fee breakdowns — platform fee, vendor net, and payout amounts</BulletPoint>
        <Paragraph>Stripe may collect additional identity and financial verification information through their hosted onboarding flow, governed by Stripe's Privacy Policy (stripe.com/privacy).</Paragraph>

        <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>F. Booking Information</ThemedText>
        <Paragraph>When using booking services we collect:</Paragraph>
        <BulletPoint>Appointment dates, times, and duration</BulletPoint>
        <BulletPoint>Selected services and assigned staff members</BulletPoint>
        <BulletPoint>Booking status and history (confirmed, cancelled, rescheduled)</BulletPoint>
        <BulletPoint>Cancellation and refund history</BulletPoint>
        <BulletPoint>Notes associated with appointments</BulletPoint>
        <BulletPoint>Customer service address (when service is performed at your location)</BulletPoint>

        <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>G. Order Information</ThemedText>
        <Paragraph>For marketplace purchases we collect:</Paragraph>
        <BulletPoint>Products purchased and quantities</BulletPoint>
        <BulletPoint>Order history and transaction amounts</BulletPoint>
        <BulletPoint>Shipping address at time of order</BulletPoint>
        <BulletPoint>Carrier, tracking, delivery, and fulfillment status</BulletPoint>
        <BulletPoint>Refund and return status</BulletPoint>

        <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>H. Location Information</ThemedText>
        <Paragraph>With your permission, Outsyde may collect location data to display nearby businesses, pre-fill forms, improve discovery, and record service locations for bookings. We collect:</Paragraph>
        <BulletPoint>GPS coordinates (latitude and longitude) — when you use location-enabled features</BulletPoint>
        <BulletPoint>Address-derived coordinates — geocoded via Google Places API when you enter an address</BulletPoint>
        <BulletPoint>City and state — reverse-geocoded from GPS during signup for form pre-fill</BulletPoint>
        <Paragraph>Location permissions may be disabled at any time through your device settings.</Paragraph>

        <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>I. Media and Uploaded Files</ThemedText>
        <Paragraph>We collect images and videos you upload, including profile photos, cover photos, business logos, product images, portfolio media, and feed posts.</Paragraph>
        <Paragraph>Images are stored by Cloudflare R2. Videos are hosted and streamed by Mux. When you delete a video, we instruct Mux to delete the asset from their servers.</Paragraph>

        <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>J. Staff Member Information</ThemedText>
        <Paragraph>Staff members of a business provide: display name, biography, profile photo, email, phone, assigned services, role, availability, and Stripe Connect account information for direct payouts.</Paragraph>

        <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>K. Influencer Information</ThemedText>
        <Paragraph>Influencer Program applicants provide: Instagram and TikTok handles, total follower count, and a biography.</Paragraph>

        <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>L. Messaging</ThemedText>
        <Paragraph>Messages exchanged through the Platform are stored in plaintext in our database. Messages are not end-to-end encrypted. Users should avoid sharing passwords, financial details, or government IDs through Platform messaging.</Paragraph>

        <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>M. Automatically Collected Information</ThemedText>
        <Paragraph>When you use Outsyde we automatically collect:</Paragraph>
        <BulletPoint>Device type and operating system</BulletPoint>
        <BulletPoint>IP address</BulletPoint>
        <BulletPoint>App usage sessions and timestamps</BulletPoint>
        <BulletPoint>Expo push notification token (device-level identifier)</BulletPoint>
        <BulletPoint>Log files and error reports</BulletPoint>
        <BulletPoint>Behavioral engagement data (watch time, completion rate, share rate, save rate, comment rate, like rate) — used solely to personalize your feed; retained for up to your last 100 interactions; not sold to advertisers</BulletPoint>
      </Section>

      <Section title="2. How We Use Your Information">
        <Paragraph>We use your information to:</Paragraph>
        <BulletPoint>Create and manage your account</BulletPoint>
        <BulletPoint>Process bookings, marketplace purchases, and payments</BulletPoint>
        <BulletPoint>Facilitate vendor and staff payouts via Stripe Connect</BulletPoint>
        <BulletPoint>Deliver orders and provide shipping updates</BulletPoint>
        <BulletPoint>Provide customer support and resolve disputes</BulletPoint>
        <BulletPoint>Verify accounts and prevent fraud</BulletPoint>
        <BulletPoint>Personalize your discovery feed and recommendations</BulletPoint>
        <BulletPoint>Operate loyalty and rewards programs (Outsyde Points)</BulletPoint>
        <BulletPoint>Send transactional communications and push notifications</BulletPoint>
        <BulletPoint>Sync booking events to your Google Calendar (if you connect it)</BulletPoint>
        <BulletPoint>Improve Platform performance and search functionality</BulletPoint>
        <BulletPoint>Generate analytics for vendors about their own business performance</BulletPoint>
        <BulletPoint>Enforce our Terms of Service and comply with legal obligations</BulletPoint>
      </Section>

      <Section title="3. Push Notifications">
        <Paragraph>If enabled, Outsyde may send push notifications regarding bookings, orders, messages, promotions, and security alerts.</Paragraph>
        <Paragraph>Push notifications are delivered via Expo's push notification infrastructure. Your device's Expo push token is stored in our database and transmitted to Expo's servers solely to deliver notifications to your device.</Paragraph>
        <Paragraph>You may disable notifications at any time through your device settings.</Paragraph>
      </Section>

      <Section title="4. Third-Party Services">
        <Paragraph>Outsyde integrates with the following third-party service providers. Each provider maintains its own privacy practices.</Paragraph>
        <BulletPoint>Stripe — Payment processing, saved cards, vendor/staff payouts (Stripe Connect), KYC onboarding</BulletPoint>
        <BulletPoint>Mux — Video hosting and streaming</BulletPoint>
        <BulletPoint>Cloudflare R2 — Image storage (profile photos, banners, product images, post images)</BulletPoint>
        <BulletPoint>Resend — Transactional email delivery (booking confirmations, invites, password resets)</BulletPoint>
        <BulletPoint>Expo Push Notifications — Mobile push notification delivery (uses your Expo push token)</BulletPoint>
        <BulletPoint>Google Places API — Address autocomplete and geocoding (coordinates stored in our database)</BulletPoint>
        <BulletPoint>Google OAuth — Sign-in with Google (name, email, profile photo URL, and Google account ID)</BulletPoint>
        <BulletPoint>Apple Sign-In — Sign-in with Apple (Apple ID, name if provided, and email address)</BulletPoint>
        <BulletPoint>Google Calendar API — Booking calendar sync for providers (booking details written to your connected calendar)</BulletPoint>
        <BulletPoint>Neon — Managed PostgreSQL database hosting (all user data stored in our database is hosted on Neon's infrastructure)</BulletPoint>
        <BulletPoint>Render — Backend server hosting (all server traffic passes through Render's infrastructure)</BulletPoint>
      </Section>

      <Section title="5. Sharing Your Information">
        <Paragraph>We may share your information with:</Paragraph>
        <BulletPoint>Service Providers — The third-party services listed in Section 4, as necessary to operate the Platform</BulletPoint>
        <BulletPoint>Vendors and Service Providers on the Platform — When you place an order or booking, relevant details (name, shipping address, contact) are shared with the fulfilling party</BulletPoint>
        <BulletPoint>Other Users — Public information such as your name, username, profile photo, bio, reviews, ratings, and public listings</BulletPoint>
        <BulletPoint>Legal Authorities — When required by law, legal process, or governmental request</BulletPoint>
        <BulletPoint>Business Transfers — In connection with a merger, acquisition, financing, or sale of assets</BulletPoint>
      </Section>

      <Section title="6. Reviews and Ratings">
        <Paragraph>Reviews you submit may become publicly visible on vendor or staff profiles. Vendors and staff may respond to reviews. We reserve the right to remove reviews that violate our policies.</Paragraph>
      </Section>

      <Section title="7. Influencer Referral Tracking">
        <Paragraph>If you use an influencer referral or promo code, Outsyde records the referral event including the associated click, purchase, and revenue attributed to that code. This data is used to calculate influencer commissions.</Paragraph>
      </Section>

      <Section title="8. Data Security">
        <Paragraph>We implement administrative, technical, and physical safeguards designed to protect your information, including encrypted credential storage and PCI-compliant payment processing via Stripe.</Paragraph>
        <Paragraph>No internet transmission or electronic storage system can be guaranteed completely secure. We encourage you to use a strong, unique password and contact us immediately if you suspect unauthorized access.</Paragraph>
      </Section>

      <Section title="9. Data Retention">
        <Paragraph>We retain your information only as long as necessary to provide our services, resolve disputes, detect fraud, meet legal and tax obligations, and enforce our agreements.</Paragraph>
        <Paragraph>Some financial and transaction records may be retained as required by law even after account deletion.</Paragraph>
      </Section>

      <Section title="10. Account Deletion">
        <Paragraph>You may request deletion of your account through the Platform settings or by contacting us at info@goutsyde.com.</Paragraph>
        <Paragraph>Following deletion, personal information will be deleted or anonymized where reasonably possible. Certain records may be retained for tax compliance, fraud prevention, legal obligations, or dispute resolution.</Paragraph>
      </Section>

      <Section title="11. Your Rights">
        <Paragraph>Depending on your jurisdiction, you may have the right to:</Paragraph>
        <BulletPoint>Access your personal information</BulletPoint>
        <BulletPoint>Correct inaccurate information</BulletPoint>
        <BulletPoint>Request deletion of your personal information</BulletPoint>
        <BulletPoint>Restrict or object to certain processing</BulletPoint>
        <BulletPoint>Export your information where applicable</BulletPoint>
        <BulletPoint>Opt out of certain marketing communications</BulletPoint>
        <Paragraph>To exercise any of these rights, contact us at info@goutsyde.com.</Paragraph>
      </Section>

      <Section title="12. Children's Privacy">
        <Paragraph>Outsyde is not intended for individuals under 18 years of age. We do not knowingly collect personal information from minors. If we become aware that such information has been collected, we will take appropriate steps to delete it promptly.</Paragraph>
      </Section>

      <Section title="13. Sensitive Personal Information">
        <Paragraph>During signup, consumers may optionally provide gender, ethnicity, and demographic information. This information is used solely to personalize your experience and generate aggregate, anonymized platform insights. We do not sell this information or use it for targeted advertising.</Paragraph>
      </Section>

      <Section title="14. Cookies and Tracking Technologies">
        <Paragraph>Our website may use cookies and similar technologies to remember preferences, maintain sessions, analyze traffic, and improve performance. Users may manage cookie preferences through their browser settings.</Paragraph>
      </Section>

      <Section title="15. New York SHIELD Act">
        <Paragraph>For users located in New York, Outsyde maintains reasonable administrative, technical, and physical safeguards designed to protect private information in compliance with the New York SHIELD Act.</Paragraph>
      </Section>

      <Section title="16. Changes to This Privacy Policy">
        <Paragraph>We may update this Privacy Policy periodically. When material changes occur, we will update the "Last Updated" date and, where appropriate, notify users through the Platform. Continued use of Outsyde after changes become effective constitutes acceptance of the updated Privacy Policy.</Paragraph>
      </Section>

      <Section title="17. Contact Information">
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
