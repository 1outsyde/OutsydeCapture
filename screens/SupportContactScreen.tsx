import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { API_BASE_URL } from "@/services/api";

const C = {
  background: "#0E0E0E",
  surface: "rgba(255,255,255,0.05)",
  border: "rgba(255,255,255,0.08)",
  cream: "#F0EAD6",
  creamDim: "rgba(200,191,168,0.55)",
  accent: "#E8B930",
};

const FAQ = [
  {
    q: "How do I book a photographer?",
    a: "Browse photographers on the Discover tab, tap their profile, select a service, pick a date and time, and confirm your booking.",
  },
  {
    q: "How do I track my order?",
    a: "Go to your profile → Orders to see real-time status updates on all your purchases.",
  },
  {
    q: "How do I become a vendor?",
    a: "Tap the menu icon, select \"Become a Vendor,\" and complete the vendor onboarding wizard. Approval takes 1–2 business days.",
  },
  {
    q: "How do I cancel a booking?",
    a: "Open the booking from your profile → Bookings and tap \"Cancel Booking.\" Cancellations must be made 24 hours before the session.",
  },
  {
    q: "How do I get a refund?",
    a: "Refunds are processed within 5–7 business days. Contact us using the form below if you haven't received yours.",
  },
];

export default function SupportContactScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await fetch(`${API_BASE_URL}/api/user/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.firstName || data.lastName) {
          setName(`${data.firstName ?? ""} ${data.lastName ?? ""}`.trim());
        }
        if (data.email) setEmail(data.email);
      } catch {
        // Non-fatal — user can fill in manually
      }
    })();
  }, []);

  const handleSend = async () => {
    if (!name.trim()) {
      Alert.alert("Required", "Please enter your name.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      Alert.alert("Required", "Please enter a valid email address.");
      return;
    }
    if (!message.trim() || message.trim().length < 10) {
      Alert.alert("Required", "Please enter a message (at least 10 characters).");
      return;
    }

    setSending(true);
    try {
      const token = await getToken().catch(() => null);
      let userId: string | undefined;
      if (token) {
        try {
          const meRes = await fetch(`${API_BASE_URL}/api/user/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (meRes.ok) {
            const me = await meRes.json();
            userId = me.id ?? undefined;
          }
        } catch {
          // Non-fatal
        }
      }

      const res = await fetch(`${API_BASE_URL}/api/support/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), userId, message: message.trim() }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to send");
      }

      Alert.alert("Message Sent", "We received your message and will respond to your email shortly.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert("Error", "Could not send your message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={12}>
          <Feather name="arrow-left" size={22} color={C.cream} />
        </Pressable>
        <Text style={styles.headerTitle}>Help Center</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.note}>
          Have a question or need help? Find answers below or send us a message.
        </Text>

        {FAQ.map((item, i) => (
          <View key={i} style={styles.faqItem}>
            <Text style={styles.faqQ}>{item.q}</Text>
            <Text style={styles.faqA}>{item.a}</Text>
          </View>
        ))}

        <View style={styles.divider} />
        <Text style={styles.dividerLabel}>Still need help? Send us a message.</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Name <Text style={styles.req}>*</Text></Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={C.creamDim}
            autoCapitalize="words"
            returnKeyType="next"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Email <Text style={styles.req}>*</Text></Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            placeholderTextColor={C.creamDim}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="next"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Message <Text style={styles.req}>*</Text></Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={message}
            onChangeText={setMessage}
            placeholder="Describe your issue or question..."
            placeholderTextColor={C.creamDim}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            returnKeyType="default"
            maxLength={2000}
          />
          <Text style={styles.charCount}>{message.length}/2000</Text>
        </View>

        <Pressable
          style={[styles.sendButton, sending && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={sending}
        >
          {sending ? (
            <ActivityIndicator color="#000000" />
          ) : (
            <Text style={styles.sendButtonText}>Send Message</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backButton: { width: 36, height: 36, justifyContent: "center", alignItems: "flex-start" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700", color: C.cream, letterSpacing: 0.2 },
  headerRight: { width: 36 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24, gap: 16 },
  note: { fontSize: 14, color: C.creamDim, lineHeight: 20, marginBottom: 8 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: "600", color: C.cream, letterSpacing: 0.2 },
  req: { color: C.accent },
  input: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: C.cream,
  },
  textarea: { minHeight: 130, paddingTop: 13 },
  faqItem: { gap: 4 },
  faqQ: { fontSize: 14, fontWeight: "700", color: C.cream, letterSpacing: 0.1 },
  faqA: { fontSize: 14, color: C.creamDim, lineHeight: 20 },
  divider: { height: 1, backgroundColor: C.accent, opacity: 0.4, marginVertical: 4 },
  dividerLabel: { fontSize: 15, fontWeight: "600", color: C.cream, textAlign: "center", marginBottom: 4 },
  charCount: { fontSize: 12, color: C.creamDim, textAlign: "right", marginTop: 4 },
  sendButton: {
    backgroundColor: C.accent,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  sendButtonDisabled: { opacity: 0.6 },
  sendButtonText: { color: "#000000", fontSize: 16, fontWeight: "700", letterSpacing: 0.3 },
});
