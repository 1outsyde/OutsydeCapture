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
          Last Updated: July 2026
        </ThemedText>

        <Paragraph>
          Welcome to Outsyde ("Outsyde," "we," "our," or "us"). These Terms of Service ("Terms") govern your access to and use of the Outsyde mobile application, website, and related services (collectively, the "Platform").
        </Paragraph>

        <Paragraph>
          By accessing or using Outsyde, you agree to be bound by these Terms and our Privacy Policy, which is incorporated herein by reference. If you do not agree, do not use the Platform.
        </Paragraph>

        <Paragraph>
          By creating an account or using the Platform, you also consent to receive electronic communications, notices, and agreements digitally, and agree that electronic records satisfy any legal requirement that such communications be in writing.
        </Paragraph>

        <Section title="1. About Outsyde">
          <Paragraph>
            Outsyde is a technology-based multi-vendor marketplace, booking, and discovery platform that connects consumers with independent local businesses, vendors, photographers, influencers, creatives, and service providers ("Providers").
          </Paragraph>
          <Paragraph>
            Outsyde does not provide services or sell products directly unless explicitly stated. All services and products are offered by independent third-party Providers using the Platform.
          </Paragraph>
          <Paragraph>
            Outsyde acts solely as a facilitator and intermediary — not as a service provider, employer, agent, or partner of any Provider.
          </Paragraph>
        </Section>

        <Section title="2. Eligibility">
          <Paragraph>You must be at least 18 years old to use Outsyde. By using the Platform, you represent that:</Paragraph>
          <BulletPoint>You are legally capable of entering into a binding agreement</BulletPoint>
          <BulletPoint>All information you provide is accurate, current, and complete</BulletPoint>
          <BulletPoint>You are not prohibited from using the Platform under any applicable law</BulletPoint>
        </Section>

        <Section title="3. User Accounts">
          <Paragraph>You are responsible for safeguarding your login credentials and for all activity that occurs under your account.</Paragraph>
          <Paragraph>Outsyde may suspend, restrict, or terminate accounts for:</Paragraph>
          <BulletPoint>Fraud, misrepresentation, or impersonation</BulletPoint>
          <BulletPoint>Violation of these Terms or applicable law</BulletPoint>
          <BulletPoint>Abuse, harassment, or platform manipulation</BulletPoint>
          <BulletPoint>Circumvention of fees, payments, or platform systems</BulletPoint>
          <BulletPoint>Activity that poses risk to users, Providers, or the Platform</BulletPoint>
          <Paragraph>
            Outsyde may request identity verification, business documentation, tax information, or bank verification at any time. Failure to provide requested verification may result in restricted or suspended access.
          </Paragraph>
        </Section>

        <Section title="4. User Roles & Role-Specific Terms">
          <Paragraph>
            Outsyde supports multiple user roles. By using the Platform in a given capacity, you agree to the applicable terms below.
          </Paragraph>

          <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>
            A. Consumers (Clients / Customers)
          </ThemedText>
          <Paragraph>
            Consumers may browse, book services, purchase products, and interact with Providers through the Platform.
          </Paragraph>
          <Paragraph>Consumers acknowledge that:</Paragraph>
          <BulletPoint>All services and products are provided by independent third-party Providers</BulletPoint>
          <BulletPoint>Outsyde is not responsible for fulfillment, quality, safety, or outcomes</BulletPoint>
          <BulletPoint>Refunds and cancellations are governed by Provider policies and these Terms</BulletPoint>
          <BulletPoint>Reviews submitted must reflect genuine personal experiences (see Section 12)</BulletPoint>

          <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>
            B. Businesses & Vendors
          </ThemedText>
          <Paragraph>
            Businesses and vendors may list products and/or services on the Platform after approval by Outsyde.
          </Paragraph>
          <Paragraph>By using Outsyde as a business or vendor, you agree that:</Paragraph>
          <BulletPoint>You are a legally registered or operating business</BulletPoint>
          <BulletPoint>You are solely responsible for product quality, accuracy of listings, fulfillment, shipping, inventory management, taxes, licenses, and legal compliance</BulletPoint>
          <BulletPoint>You will only list and sell products you legally own or have the right to sell</BulletPoint>
          <BulletPoint>You will accurately describe all products and services</BulletPoint>
          <BulletPoint>You will fulfill orders promptly and provide tracking information when applicable</BulletPoint>
          <BulletPoint>You will handle any product recalls or legal compliance issues independently</BulletPoint>
          <BulletPoint>Outsyde does not store, handle, or ship inventory</BulletPoint>
          <BulletPoint>Outsyde is not liable for customer disputes, chargebacks, or business losses</BulletPoint>
          <Paragraph>
            Outsyde may approve, deny, revoke, or suspend vendor access at its sole discretion.
          </Paragraph>

          <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>
            C. Photographers & Service Providers
          </ThemedText>
          <Paragraph>Photographers and service providers operate as independent contractors on the Platform.</Paragraph>
          <Paragraph>They acknowledge that:</Paragraph>
          <BulletPoint>They are solely responsible for their own equipment, conduct, safety, and deliverables</BulletPoint>
          <BulletPoint>Outsyde does not guarantee bookings, clients, or income</BulletPoint>
          <BulletPoint>Pricing, availability, and service quality are their sole responsibility</BulletPoint>
          <BulletPoint>Failure to fulfill confirmed bookings may result in refund obligations, account penalties, or removal from the Platform</BulletPoint>
          <BulletPoint>They must complete Stripe Connect onboarding before accepting payments</BulletPoint>

          <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>
            D. Staff Members
          </ThemedText>
          <Paragraph>Business owners may invite staff members to operate under their business account.</Paragraph>
          <Paragraph>Staff members:</Paragraph>
          <BulletPoint>Are not employees of Outsyde</BulletPoint>
          <BulletPoint>Are granted limited, role-specific access to the Platform</BulletPoint>
          <BulletPoint>May have access revoked by the business owner or by Outsyde at any time</BulletPoint>
          <BulletPoint>Are bound by the same conduct standards as all users under these Terms</BulletPoint>
          <BulletPoint>Are responsible for their own tax obligations</BulletPoint>
          <Paragraph>
            Bookings made with staff members are attributed to the business. The business owner retains oversight of all staff activity and revenue on the Platform.
          </Paragraph>

          <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>
            E. Influencers & Promoters
          </ThemedText>
          <Paragraph>Influencers may promote businesses, services, or products through Outsyde's influencer program.</Paragraph>
          <Paragraph>Influencers acknowledge that:</Paragraph>
          <BulletPoint>Participation in the influencer program requires approval and is subject to eligibility requirements</BulletPoint>
          <BulletPoint>Earnings are commission-based and not guaranteed</BulletPoint>
          <BulletPoint>Compensation is processed through Stripe Connect and subject to verification and payout schedules</BulletPoint>
          <BulletPoint>Misrepresentation, fraudulent promotion, or fake referrals may result in forfeiture of earnings and removal</BulletPoint>
          <BulletPoint>Any off-platform agreements are outside Outsyde's liability</BulletPoint>
        </Section>

        <Section title="5. Subscriptions & Vendor Billing">
          <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>
            Subscription Tiers
          </ThemedText>
          <Paragraph>
            Outsyde offers monthly subscription plans to businesses ("Vendors") to access platform features. Current tiers are Starter, Growth, and Pro.
          </Paragraph>
          <Paragraph>By subscribing, you agree that:</Paragraph>
          <BulletPoint>Subscriptions are billed monthly on a recurring basis</BulletPoint>
          <BulletPoint>Your subscription automatically renews at the end of each billing cycle unless cancelled</BulletPoint>
          <BulletPoint>You authorize Outsyde to charge your payment method on file each billing cycle</BulletPoint>
          <BulletPoint>Subscription fees are non-refundable except as required by law or as stated in these Terms</BulletPoint>

          <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>
            Cancellation
          </ThemedText>
          <Paragraph>
            You may cancel your subscription at any time through your account settings or by contacting support. Cancellation takes effect at the end of the current billing cycle. You retain access to subscription features until the cycle ends.
          </Paragraph>

          <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>
            Failed Payments & Suspension
          </ThemedText>
          <Paragraph>If a payment fails, Outsyde will attempt to retry the charge. If payment cannot be collected:</Paragraph>
          <BulletPoint>Your account may be downgraded or suspended</BulletPoint>
          <BulletPoint>Your active listings and services may be hidden from the Platform</BulletPoint>
          <BulletPoint>Access to vendor dashboard features may be restricted</BulletPoint>

          <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>
            Price Changes
          </ThemedText>
          <Paragraph>
            Outsyde reserves the right to change subscription pricing with reasonable notice. Continued use of the Platform after a price change constitutes acceptance.
          </Paragraph>
        </Section>

        <Section title="6. Payments, Stripe & Platform Fees">
          <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>
            Payment Processing
          </ThemedText>
          <Paragraph>
            All payments on Outsyde are processed through Stripe, Inc. ("Stripe"). By using the Platform, you agree to Stripe's Terms of Service and, where applicable, the Stripe Connect Agreement.
          </Paragraph>
          <Paragraph>Outsyde does not store payment card information. All payment data is handled by Stripe.</Paragraph>

          <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>
            Platform Fees
          </ThemedText>
          <Paragraph>Outsyde charges the following fees, which are deducted from transactions automatically:</Paragraph>
          <BulletPoint>Bookings: A platform fee charged to the vendor, plus a consumer service fee charged to the client</BulletPoint>
          <BulletPoint>Products: A platform fee charged to the vendor, plus a consumer service fee charged to the client (minimum fees apply)</BulletPoint>
          <BulletPoint>Staff Bookings: A reduced platform fee charged to the vendor</BulletPoint>
          <BulletPoint>Influencer Commissions: A percentage of attributed transaction value</BulletPoint>
          <Paragraph>
            Fees are displayed at checkout and in your vendor dashboard. Platform fees are non-refundable except where required by law.
          </Paragraph>
          <Paragraph>
            Circumventing Outsyde fees, payments, or the Stripe payment system is strictly prohibited and may result in immediate account termination and recovery of owed amounts.
          </Paragraph>

          <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>
            Payouts
          </ThemedText>
          <Paragraph>
            Payouts to Providers are processed through Stripe Connect on Stripe's standard payout schedule (typically T+2 rolling). Outsyde is not responsible for Stripe delays, holds, reversals, or account limitations imposed by Stripe.
          </Paragraph>
          <Paragraph>
            Funds may be held due to account verification, risk reviews, disputes, chargebacks, or Stripe compliance requirements.
          </Paragraph>

          <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>
            Chargebacks
          </ThemedText>
          <Paragraph>If a consumer initiates a chargeback or payment dispute:</Paragraph>
          <BulletPoint>Outsyde may suspend the relevant transaction and withhold associated payouts</BulletPoint>
          <BulletPoint>Vendors are required to cooperate with dispute resolution and provide documentation</BulletPoint>
          <BulletPoint>Fraudulent or abusive chargeback activity by consumers may result in account suspension</BulletPoint>
          <BulletPoint>Outsyde reserves the right to recover losses resulting from chargebacks, including by offsetting future payouts</BulletPoint>

          <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>
            Outside Points (Loyalty Program)
          </ThemedText>
          <Paragraph>
            Outsyde operates a loyalty rewards program called "Outside Points." Points are earned on qualifying purchases and may be redeemed for discounts on future transactions on the Platform.
          </Paragraph>
          <Paragraph>
            Points have no cash value, are non-transferable, and may expire or be forfeited upon account termination. Outsyde reserves the right to modify or discontinue the Points program at any time with notice.
          </Paragraph>
        </Section>

        <Section title="7. Bookings, Cancellations & Refunds">
          <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>
            Booking Terms
          </ThemedText>
          <Paragraph>
            Bookings on the Platform are subject to the Provider's published availability, cancellation policy, and service terms. Outsyde does not guarantee availability or service completion.
          </Paragraph>

          <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>
            Cancellations by Consumers
          </ThemedText>
          <Paragraph>When a consumer cancels a booking:</Paragraph>
          <BulletPoint>Refunds are determined by the Provider's cancellation policy selected at the time of service creation</BulletPoint>
          <BulletPoint>Full refunds may be available within a defined window prior to the appointment (e.g., 24 hours, 48 hours, 1 week)</BulletPoint>
          <BulletPoint>Partial refunds or no refunds may apply outside the full-refund window</BulletPoint>
          <BulletPoint>Cancellation fees, if set by the Provider, may be charged to the consumer's saved payment method</BulletPoint>

          <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>
            Cancellations by Providers
          </ThemedText>
          <Paragraph>
            If a Provider cancels a confirmed booking, the consumer will receive a full refund of all amounts paid. Providers who repeatedly cancel may face penalties or removal from the Platform.
          </Paragraph>

          <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>
            No-Shows
          </ThemedText>
          <Paragraph>
            If a consumer fails to appear for a confirmed booking (no-show), the Provider may mark the booking accordingly. Refunds for no-shows are subject to the Provider's cancellation policy.
          </Paragraph>

          <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>
            Product Orders
          </ThemedText>
          <Paragraph>
            All product sales are final unless the Provider offers a return policy. Consumers should review Provider return policies before purchasing. Outsyde is not responsible for lost, damaged, or delayed shipments — disputes regarding shipping are between the consumer, vendor, and carrier.
          </Paragraph>

          <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>
            Shipping & Delivery
          </ThemedText>
          <BulletPoint>Shipping estimates are not guaranteed</BulletPoint>
          <BulletPoint>Vendors are responsible for selecting shipping carriers and providing tracking information</BulletPoint>
          <BulletPoint>Lost or damaged packages are the responsibility of the vendor and carrier</BulletPoint>
          <BulletPoint>Outsyde is not liable for carrier errors, delays, or failures</BulletPoint>

          <ThemedText type="body" style={[styles.subheading, { color: theme.text }]}>
            Event Tickets
          </ThemedText>
          <Paragraph>When the Platform supports ticketed events:</Paragraph>
          <BulletPoint>Tickets are non-refundable unless the event is cancelled by the organizer</BulletPoint>
          <BulletPoint>Postponed events may be eligible for refunds at Outsyde's discretion</BulletPoint>
          <BulletPoint>Event organizers are solely responsible for the event, its cancellation, and any resulting refunds</BulletPoint>
          <BulletPoint>Counterfeit or fraudulently obtained tickets may be voided without refund</BulletPoint>
        </Section>

        <Section title="8. Independent Contractor Status">
          <Paragraph>All Providers on Outsyde operate as independent contractors. Nothing in these Terms creates:</Paragraph>
          <BulletPoint>An employer-employee relationship</BulletPoint>
          <BulletPoint>A partnership or joint venture</BulletPoint>
          <BulletPoint>An agency relationship between Outsyde and any Provider</BulletPoint>
          <Paragraph>
            Providers are solely responsible for their own taxes, insurance, licenses, permits, and legal compliance.
          </Paragraph>
        </Section>

        <Section title="9. Prohibited Businesses & Listings">
          <Paragraph>
            Outsyde reserves the right to prohibit, remove, or restrict any business, listing, or account involving:
          </Paragraph>
          <BulletPoint>Illegal drugs, controlled substances, or drug paraphernalia</BulletPoint>
          <BulletPoint>THC, CBD, or cannabis products where prohibited by law</BulletPoint>
          <BulletPoint>Tobacco, nicotine, or vaping products (unless specifically approved)</BulletPoint>
          <BulletPoint>Firearms, ammunition, or explosives</BulletPoint>
          <BulletPoint>Counterfeit, stolen, or fraudulently obtained goods</BulletPoint>
          <BulletPoint>Adult services, escort services, or sexually explicit content</BulletPoint>
          <BulletPoint>Pyramid schemes, multi-level marketing, or financial scams</BulletPoint>
          <BulletPoint>Hate speech, discriminatory content, or extremist material</BulletPoint>
          <BulletPoint>Gambling services</BulletPoint>
          <BulletPoint>Fake identification or fraudulent documents</BulletPoint>
          <BulletPoint>Any product or service that violates payment processor requirements</BulletPoint>
          <Paragraph>
            Outsyde may remove listings or suspend accounts that conflict with Stripe's or Apple's content policies, regardless of whether the content is otherwise legal.
          </Paragraph>
        </Section>

        <Section title="10. Messaging & Communication">
          <Paragraph>The Platform includes in-app messaging between users and Providers.</Paragraph>
          <Paragraph>You agree that:</Paragraph>
          <BulletPoint>Messages may be monitored for safety, abuse prevention, and compliance purposes</BulletPoint>
          <BulletPoint>Harassment, threats, and hate speech in messages are prohibited</BulletPoint>
          <BulletPoint>Spam, unsolicited advertising, and off-platform solicitation are prohibited</BulletPoint>
          <BulletPoint>Attempting to move transactions off the Platform to avoid fees is prohibited</BulletPoint>
        </Section>

        <Section title="11. Content & Media Rights">
          <Paragraph>You retain ownership of content you upload to the Platform.</Paragraph>
          <Paragraph>
            By uploading content, you grant Outsyde a non-exclusive, royalty-free, worldwide license to host, display, distribute, and use that content to operate the Platform, promote Outsyde, and support discovery features.
          </Paragraph>
          <Paragraph>
            Outsyde owns and retains all rights to the Outsyde name, logo, branding, software, interface, source code, and graphics. Nothing in these Terms transfers any Outsyde intellectual property to you.
          </Paragraph>
          <Paragraph>
            Outsyde may remove any content that violates these Terms, applicable law, or payment processor or app store policies.
          </Paragraph>
        </Section>

        <Section title="12. Reviews & Ratings">
          <Paragraph>Users may leave reviews for Providers following completed transactions or bookings.</Paragraph>
          <Paragraph>You may not:</Paragraph>
          <BulletPoint>Post fake, incentivized, or fabricated reviews</BulletPoint>
          <BulletPoint>Review a Provider for an experience you did not have</BulletPoint>
          <BulletPoint>Exchange reviews with other users</BulletPoint>
          <BulletPoint>Manipulate ratings through coordinated activity</BulletPoint>
          <Paragraph>
            Outsyde reserves the right to remove reviews that violate these Terms or that appear fraudulent. Reviews may be revoked if the associated transaction is refunded.
          </Paragraph>
        </Section>

        <Section title="13. Taxes">
          <Paragraph>
            Consumers may be charged applicable sales tax on purchases where required by law. Tax calculations may rely on third-party services including Stripe Tax.
          </Paragraph>
          <Paragraph>
            Providers (vendors, photographers, staff) are solely responsible for reporting and remitting their own income taxes, self-employment taxes, and any other tax obligations arising from use of the Platform.
          </Paragraph>
          <Paragraph>Outsyde may issue tax forms (e.g., 1099-K) to Providers where required by law.</Paragraph>
        </Section>

        <Section title="14. Fraud Prevention">
          <Paragraph>Outsyde reserves the right to:</Paragraph>
          <BulletPoint>Investigate suspicious transactions, accounts, or activity</BulletPoint>
          <BulletPoint>Freeze or hold transactions pending review</BulletPoint>
          <BulletPoint>Request identity or business verification at any time</BulletPoint>
          <BulletPoint>Report suspected illegal activity to law enforcement</BulletPoint>
          <BulletPoint>Suspend or terminate accounts involved in fraudulent activity</BulletPoint>
        </Section>

        <Section title="15. Mobile Application">
          <Paragraph>
            Your use of the Outsyde mobile application is also subject to the terms of the Apple App Store or Google Play Store, as applicable.
          </Paragraph>
          <Paragraph>By using the app, you consent to:</Paragraph>
          <BulletPoint>Receiving push notifications (which you may disable in device settings)</BulletPoint>
          <BulletPoint>Location access for discovery and availability features (where permitted)</BulletPoint>
          <BulletPoint>Camera and media access for content creation features (where permitted)</BulletPoint>
          <Paragraph>
            Outsyde may release updates to the app. Continued use of the Platform following an update constitutes acceptance of any revised Terms included with that update.
          </Paragraph>
        </Section>

        <Section title="16. Platform Availability">
          <Paragraph>Outsyde provides the Platform on an "as available" basis. We do not guarantee uninterrupted access.</Paragraph>
          <Paragraph>The Platform may be unavailable due to:</Paragraph>
          <BulletPoint>Scheduled or emergency maintenance</BulletPoint>
          <BulletPoint>Technical failures or bugs</BulletPoint>
          <BulletPoint>Third-party service outages (Stripe, Resend, Cloudflare, etc.)</BulletPoint>
          <BulletPoint>Events beyond our control (force majeure)</BulletPoint>
          <Paragraph>Outsyde is not liable for losses resulting from Platform downtime or interruptions.</Paragraph>
        </Section>

        <Section title="17. Force Majeure">
          <Paragraph>
            Outsyde is not liable for failure to perform any obligation under these Terms due to causes beyond our reasonable control, including natural disasters, internet outages, cyberattacks, pandemics, government actions, or power failures.
          </Paragraph>
        </Section>

        <Section title="18. Disclaimers">
          <Paragraph>THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE."</Paragraph>
          <Paragraph>
            OUTSYDE DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
          </Paragraph>
          <Paragraph>
            OUTSYDE DOES NOT GUARANTEE RESULTS, EARNINGS, BOOKINGS, SALES, REVIEWS, OR ANY SPECIFIC OUTCOME FROM USE OF THE PLATFORM.
          </Paragraph>
        </Section>

        <Section title="19. Limitation of Liability">
          <Paragraph>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUTSYDE SHALL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFITS, LOST DATA, PERSONAL INJURY, OR PROPERTY DAMAGE.
          </Paragraph>
          <Paragraph>
            OUTSYDE'S TOTAL LIABILITY FOR ANY CLAIM ARISING FROM USE OF THE PLATFORM SHALL NOT EXCEED THE TOTAL AMOUNTS PAID TO OUTSYDE IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
          </Paragraph>
        </Section>

        <Section title="20. Indemnification">
          <Paragraph>
            You agree to indemnify, defend, and hold harmless Outsyde LLC, its officers, directors, employees, and agents from any claims, damages, losses, or expenses (including reasonable attorneys' fees) arising from:
          </Paragraph>
          <BulletPoint>Your use of the Platform</BulletPoint>
          <BulletPoint>Your services, products, or content</BulletPoint>
          <BulletPoint>Your violation of these Terms or applicable law</BulletPoint>
          <BulletPoint>Any dispute between you and another user or Provider</BulletPoint>
        </Section>

        <Section title="21. Prohibited Conduct">
          <Paragraph>You may not:</Paragraph>
          <BulletPoint>Commit fraud, impersonation, or misrepresentation</BulletPoint>
          <BulletPoint>Harass, threaten, or abuse other users</BulletPoint>
          <BulletPoint>Upload illegal, infringing, or prohibited content</BulletPoint>
          <BulletPoint>Manipulate reviews, ratings, or the discovery algorithm</BulletPoint>
          <BulletPoint>Bypass payments, fees, or platform systems</BulletPoint>
          <BulletPoint>Solicit users off-platform to avoid fees</BulletPoint>
          <BulletPoint>Create multiple accounts to evade suspension</BulletPoint>
          <Paragraph>Violations may result in immediate account termination and recovery of any owed fees or damages.</Paragraph>
        </Section>

        <Section title="22. Termination">
          <Paragraph>
            Outsyde may suspend or terminate your access to the Platform at any time, with or without notice, for violations of these Terms or for activity that poses risk to users, Providers, or the Platform.
          </Paragraph>
          <Paragraph>
            You may request account deletion at any time through the app. Deletion requests are subject to a 30-day grace period during which your account is scheduled for permanent removal. Active orders, bookings, or outstanding Stripe balances may delay deletion.
          </Paragraph>
        </Section>

        <Section title="23. Governing Law & Dispute Resolution">
          <Paragraph>
            These Terms are governed by the laws of the State of New York, without regard to conflict of law principles.
          </Paragraph>
          <Paragraph>
            Any disputes arising from these Terms or your use of the Platform shall be resolved through binding individual arbitration, except where prohibited by applicable law. You waive any right to participate in class action litigation or class-wide arbitration.
          </Paragraph>
        </Section>

        <Section title="24. Changes to Terms">
          <Paragraph>
            Outsyde may update these Terms at any time. We will notify you of material changes through the app or by email. Continued use of the Platform after the effective date of any update constitutes acceptance of the revised Terms.
          </Paragraph>
        </Section>

        <Section title="25. Entire Agreement">
          <Paragraph>
            These Terms, together with our Privacy Policy, constitute the entire agreement between you and Outsyde LLC regarding your use of the Platform and supersede all prior agreements or understandings.
          </Paragraph>
        </Section>

        <Section title="26. Contact">
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
