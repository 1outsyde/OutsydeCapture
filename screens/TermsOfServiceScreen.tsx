import React from "react";
import { StyleSheet, View, ScrollView, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

export default function TermsOfServiceScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

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

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h2">Terms of Service</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <ThemedText type="small" style={[styles.lastUpdated, { color: theme.textSecondary }]}>
          Last Updated: January 2026
        </ThemedText>

        <Paragraph>
          Welcome to Outsyde ("Outsyde," "we," "our," or "us"). These Terms of Service ("Terms") govern your access to and use of the Outsyde mobile application, website, and related services (collectively, the "Platform").
        </Paragraph>

        <Paragraph>
          By accessing or using Outsyde, you agree to be bound by these Terms. If you do not agree, do not use the Platform.
        </Paragraph>

        <Section title="1. About Outsyde">
          <Paragraph>
            Outsyde is a technology-based marketplace, booking, and discovery platform that connects users with independent businesses, vendors, photographers, influencers, creatives, and service providers.
          </Paragraph>
          <Paragraph>
            Outsyde does not provide services or sell products directly unless explicitly stated. All services and products are offered by independent third parties using the Platform.
          </Paragraph>
          <Paragraph>
            Outsyde acts solely as a facilitator and intermediary, not as a service provider, employer, agent, or partner.
          </Paragraph>
        </Section>

        <Section title="2. Eligibility">
          <Paragraph>You must be at least 18 years old to use Outsyde.</Paragraph>
          <Paragraph>By using the Platform, you represent that:</Paragraph>
          <BulletPoint>You are legally capable of entering a binding agreement</BulletPoint>
          <BulletPoint>All information you provide is accurate, current, and complete</BulletPoint>
        </Section>

        <Section title="3. User Accounts">
          <Paragraph>You are responsible for:</Paragraph>
          <BulletPoint>Safeguarding your login credentials</BulletPoint>
          <BulletPoint>All activity under your account</BulletPoint>
          <Paragraph>Outsyde may suspend, restrict, or terminate accounts for:</Paragraph>
          <BulletPoint>Fraud or misrepresentation</BulletPoint>
          <BulletPoint>Policy or Terms violations</BulletPoint>
          <BulletPoint>Abuse, harassment, or platform manipulation</BulletPoint>
          <BulletPoint>Circumvention of fees or payments</BulletPoint>
        </Section>

        <Section title="4. User Roles & Role-Specific Terms">
          <Paragraph>
            Outsyde supports multiple user roles. By using the Platform in a given role, you agree to the applicable terms below.
          </Paragraph>

          <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>
            A. Consumers (Clients / Customers)
          </ThemedText>
          <Paragraph>
            Consumers may browse, book services, purchase products, and interact with providers.
          </Paragraph>
          <Paragraph>Consumers acknowledge that:</Paragraph>
          <BulletPoint>All services/products are provided by third parties</BulletPoint>
          <BulletPoint>Outsyde is not responsible for fulfillment, quality, or outcomes</BulletPoint>
          <BulletPoint>Refunds and cancellations are governed by provider policies</BulletPoint>

          <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>
            B. Businesses & Vendors
          </ThemedText>
          <Paragraph>Businesses and vendors may list products and/or services.</Paragraph>
          <Paragraph>By using Outsyde, businesses agree:</Paragraph>
          <BulletPoint>They are legally registered or operating businesses</BulletPoint>
          <BulletPoint>They are solely responsible for product quality, fulfillment, shipping, taxes, and compliance</BulletPoint>
          <BulletPoint>Outsyde does not store or handle inventory</BulletPoint>
          <BulletPoint>Outsyde is not liable for customer disputes, chargebacks, or losses</BulletPoint>
          <Paragraph>
            Outsyde may require verification and may approve, deny, or revoke vendor access at its discretion.
          </Paragraph>

          <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>
            C. Photographers & Service Providers
          </ThemedText>
          <Paragraph>Photographers and service providers operate as independent contractors.</Paragraph>
          <Paragraph>They acknowledge that:</Paragraph>
          <BulletPoint>They are responsible for their own equipment, conduct, and deliverables</BulletPoint>
          <BulletPoint>Outsyde does not guarantee bookings or income</BulletPoint>
          <BulletPoint>Pricing, availability, and performance are their responsibility</BulletPoint>
          <BulletPoint>Failure to fulfill bookings may result in account penalties or removal</BulletPoint>

          <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>
            D. Influencers & Promoters
          </ThemedText>
          <Paragraph>Influencers may promote businesses or services through Outsyde.</Paragraph>
          <Paragraph>Influencers acknowledge:</Paragraph>
          <BulletPoint>Earnings are not guaranteed</BulletPoint>
          <BulletPoint>Compensation may be commission-based, fixed, or promotional</BulletPoint>
          <BulletPoint>Any off-platform agreements are outside Outsyde's liability</BulletPoint>
          <BulletPoint>Misrepresentation or fraudulent promotion may result in removal</BulletPoint>

          <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>
            E. Staff / Contractors
          </ThemedText>
          <Paragraph>Staff or contractor accounts are granted limited access and permissions.</Paragraph>
          <Paragraph>They:</Paragraph>
          <BulletPoint>Are not employees of Outsyde unless explicitly stated in writing</BulletPoint>
          <BulletPoint>May have access revoked at any time</BulletPoint>
          <BulletPoint>Are bound by confidentiality and professional conduct expectations</BulletPoint>
        </Section>

        <Section title="5. Payments, Stripe & Platform Fees">
          <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>
            Payment Processing
          </ThemedText>
          <Paragraph>
            All payments on Outsyde are processed through Stripe or other third-party payment processors.
          </Paragraph>
          <Paragraph>By using Outsyde, you agree to:</Paragraph>
          <BulletPoint>Stripe's Terms of Service</BulletPoint>
          <BulletPoint>Stripe Connect (where applicable)</BulletPoint>
          <Paragraph>Outsyde does not store payment information.</Paragraph>

          <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>
            Payouts & Holds
          </ThemedText>
          <BulletPoint>Payouts to providers are subject to Stripe processing times, verification, and approval</BulletPoint>
          <BulletPoint>Funds may be temporarily held due to account verification, risk reviews, disputes or chargebacks, and Stripe compliance requirements</BulletPoint>
          <Paragraph>
            Outsyde is not responsible for Stripe delays, holds, reversals, or account limitations.
          </Paragraph>

          <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>
            Platform Fees
          </ThemedText>
          <Paragraph>Outsyde may charge:</Paragraph>
          <BulletPoint>Platform fees</BulletPoint>
          <BulletPoint>Service fees</BulletPoint>
          <BulletPoint>Commissions</BulletPoint>
          <Paragraph>Fees are non-refundable, except where required by law.</Paragraph>
          <Paragraph>Circumventing Outsyde payments or fees is strictly prohibited.</Paragraph>
        </Section>

        <Section title="6. Bookings, Cancellations & Disputes">
          <BulletPoint>Booking terms are defined by the service provider</BulletPoint>
          <BulletPoint>Outsyde does not guarantee availability or completion</BulletPoint>
          <BulletPoint>Cancellations and refunds are governed by provider policies and platform rules</BulletPoint>
          <Paragraph>Outsyde is not liable for missed appointments, dissatisfaction, or non-delivery.</Paragraph>
        </Section>

        <Section title="7. Independent Contractor Status">
          <Paragraph>All providers on Outsyde operate as independent contractors.</Paragraph>
          <Paragraph>Nothing in these Terms creates:</Paragraph>
          <BulletPoint>An employer-employee relationship</BulletPoint>
          <BulletPoint>A partnership or joint venture</BulletPoint>
          <BulletPoint>An agency relationship</BulletPoint>
          <Paragraph>Providers are responsible for:</Paragraph>
          <BulletPoint>Taxes</BulletPoint>
          <BulletPoint>Insurance</BulletPoint>
          <BulletPoint>Licenses</BulletPoint>
          <BulletPoint>Legal compliance</BulletPoint>
        </Section>

        <Section title="8. Content & Media Rights">
          <Paragraph>You retain ownership of content you upload.</Paragraph>
          <Paragraph>By uploading content, you grant Outsyde a non-exclusive, royalty-free, worldwide license to:</Paragraph>
          <BulletPoint>Host and display content</BulletPoint>
          <BulletPoint>Promote Outsyde and its users</BulletPoint>
          <BulletPoint>Use content for marketing and discovery</BulletPoint>
          <Paragraph>Outsyde may remove content that violates these Terms or applicable law.</Paragraph>
        </Section>

        <Section title="9. Prohibited Conduct">
          <Paragraph>You may not:</Paragraph>
          <BulletPoint>Commit fraud or impersonation</BulletPoint>
          <BulletPoint>Harass or threaten others</BulletPoint>
          <BulletPoint>Upload illegal or infringing content</BulletPoint>
          <BulletPoint>Manipulate reviews or ratings</BulletPoint>
          <BulletPoint>Bypass payments or platform systems</BulletPoint>
          <Paragraph>Violations may result in immediate termination.</Paragraph>
        </Section>

        <Section title="10. Disclaimers">
          <Paragraph>
            THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE."
          </Paragraph>
          <Paragraph>OUTSYDE DISCLAIMS ALL WARRANTIES, INCLUDING:</Paragraph>
          <BulletPoint>MERCHANTABILITY</BulletPoint>
          <BulletPoint>FITNESS FOR A PARTICULAR PURPOSE</BulletPoint>
          <BulletPoint>NON-INFRINGEMENT</BulletPoint>
          <Paragraph>OUTSYDE DOES NOT GUARANTEE RESULTS, EARNINGS, BOOKINGS, OR SALES.</Paragraph>
        </Section>

        <Section title="11. Limitation of Liability">
          <Paragraph>TO THE MAXIMUM EXTENT PERMITTED BY LAW:</Paragraph>
          <Paragraph>OUTSYDE SHALL NOT BE LIABLE FOR:</Paragraph>
          <BulletPoint>INDIRECT OR CONSEQUENTIAL DAMAGES</BulletPoint>
          <BulletPoint>LOST PROFITS OR DATA</BulletPoint>
          <BulletPoint>PERSONAL INJURY OR PROPERTY DAMAGE</BulletPoint>
          <Paragraph>TOTAL LIABILITY SHALL NOT EXCEED AMOUNTS PAID TO OUTSYDE IN THE PAST 12 MONTHS.</Paragraph>
        </Section>

        <Section title="12. Indemnification">
          <Paragraph>You agree to indemnify and hold harmless Outsyde from claims arising from:</Paragraph>
          <BulletPoint>Your use of the Platform</BulletPoint>
          <BulletPoint>Your services, products, or content</BulletPoint>
          <BulletPoint>Your violation of these Terms or applicable laws</BulletPoint>
        </Section>

        <Section title="13. Termination">
          <Paragraph>
            Outsyde may suspend or terminate access at any time, with or without notice, for violations or risk to the Platform.
          </Paragraph>
        </Section>

        <Section title="14. Governing Law & Arbitration">
          <Paragraph>These Terms are governed by the laws of the State of New York.</Paragraph>
          <Paragraph>Any disputes shall be resolved through binding arbitration, except where prohibited by law.</Paragraph>
        </Section>

        <Section title="15. Changes to Terms">
          <Paragraph>
            Outsyde may update these Terms at any time. Continued use constitutes acceptance of updated Terms.
          </Paragraph>
        </Section>

        <Section title="16. Contact Information">
          <Paragraph>Outsyde LLC</Paragraph>
          <Paragraph>Email: info@goutsyde.com</Paragraph>
          <Paragraph>Website: https://goutsyde.com</Paragraph>
        </Section>
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
