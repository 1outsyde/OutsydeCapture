// The quote screen (Quotes step 6c-1, call 2): everything for one quote and its booking. The customer pays, updates
// a card, approves or declines extras, pays for extras, and confirms or reports the job; the business sees the same
// screen without the buttons. Opened from a chat card (route param start runs that card's step once). Wording
// matches goutsyde.com/q. Copy: commas and periods only, never the fee rate.
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import {
  Box,
  Centered,
  ErrorText,
  Field,
  Hint,
  HostHeader,
  OkText,
  OutlineButton,
  PrimaryButton,
  TextButton,
} from "@/components/host/hostUi";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useQuotePayments, type StepResult } from "@/hooks/useQuotePayments";
import { Spacing, BorderRadius } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/types";
import api, { type ApiError } from "@/services/api";
import { uploadImage } from "@/services/mediaUpload";
import {
  MAX_PHOTOS,
  balanceLine,
  closedLine,
  decidedLine,
  errorMessage,
  extraStatusLine,
  extrasPaymentLine,
  money,
  parseStart,
  payLines,
  quoteChip,
  reportProblem,
  stageOf,
  whenLine,
  windowLeft,
  type Quote,
} from "@/utils/quoteLogic";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Busy =
  | null
  | "pay"
  | "decline"
  | "card"
  | "confirm"
  | "report"
  | `approve:${string}`
  | `decline:${string}`;

export default function QuoteScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, "Quote">>();
  const { quoteId, start } = route.params;
  const { user, getToken } = useAuth();
  const steps = useQuotePayments(getToken);

  const [q, setQ] = useState<Quote | null>(null);
  const [loadError, setLoadError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [declinedCard, setDeclinedCard] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [photos, setPhotos] = useState<{ uri: string; mime: string }[]>([]);
  const started = useRef(false);
  const hasQuote = useRef(false);
  // When the quote was last read (the window's time left is shown from it, not the clock during render).
  const [readAt, setReadAt] = useState(0);
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  const load = useCallback(async (): Promise<Quote | null> => {
    try {
      const token = await getToken();
      if (!token) {
        setLoadError("Sign in to see this quote.");
        return null;
      }
      const fresh = await api.getQuote(token, quoteId);
      if (alive.current) {
        setQ(fresh);
        setLoadError("");
        hasQuote.current = true;
        setReadAt(Date.now());
      }
      return fresh;
    } catch (err) {
      const e = err as ApiError;
      if (alive.current && !hasQuote.current)
        setLoadError(
          e?.status === 404 ? "This quote isn't available." : errorMessage(e),
        );
      return null;
    }
  }, [getToken, quoteId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  /** After a payment step the webhook finishes it: read the quote a few times until it shows the change. */
  const settle = useCallback(
    async (done: (fresh: Quote) => boolean) => {
      for (let i = 0; i < 8 && alive.current; i++) {
        const fresh = await load();
        if (fresh && done(fresh)) return;
        await new Promise((r) => setTimeout(r, 1500));
      }
    },
    [load],
  );

  const isCustomer = !!q && q.customerId === user?.id;

  const finish = useCallback(
    async (r: StepResult, okText: string, done: (fresh: Quote) => boolean) => {
      if (r.ok) {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
        setOk(okText);
        await settle(done);
      } else if ("message" in r) {
        setError(r.message);
        await load();
      }
    },
    [load, settle],
  );

  const run = useCallback(
    async (b: Busy, fn: () => Promise<void>) => {
      if (busy) return;
      setBusy(b);
      setError("");
      setOk("");
      try {
        await fn();
      } finally {
        if (alive.current) setBusy(null);
      }
    },
    [busy],
  );

  const pay = (cur: Quote) =>
    run("pay", async () =>
      finish(
        await steps.pay(cur),
        "Paid. You're booked.",
        (f) => f.status === "paid",
      ),
    );
  const card = (cur: Quote, which: "balance" | "extras") =>
    run("card", async () =>
      finish(
        await steps.card(cur, which),
        which === "balance" ? "Your card is updated." : "Done. Thanks.",
        (f) =>
          which === "balance"
            ? !f.balance?.needsNewCard
            : !f.extrasPayment?.needsNewCard && !f.extrasPayment?.unpaid,
      ),
    );
  const approve = (cur: Quote, extraId: string, newCard = false) =>
    run(`approve:${extraId}`, async () => {
      const r = await steps.approve(cur, extraId, newCard);
      setDeclinedCard(!r.ok && "declined" in r && r.declined ? extraId : null);
      await finish(
        r,
        "Approved.",
        (f) => f.extras.find((x) => x.id === extraId)?.status !== "proposed",
      );
    });
  const declineExtra = (cur: Quote, extraId: string) =>
    run(`decline:${extraId}`, async () =>
      finish(
        await steps.declineExtra(cur, extraId),
        "Declined. Nothing was added.",
        () => true,
      ),
    );
  const confirm = (cur: Quote) =>
    run("confirm", async () =>
      finish(await steps.confirm(cur), "Thanks for confirming.", () => true),
    );
  const declineQuote = (cur: Quote) =>
    Alert.alert("Decline this quote?", "The business is told in your chat.", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Decline",
        style: "destructive",
        onPress: () =>
          run("decline", async () =>
            finish(
              await steps.declineQuote(cur),
              "You declined this quote.",
              () => true,
            ),
          ),
      },
    ]);

  const pickPhotos = async () => {
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: room,
      quality: 0.8,
    });
    if (res.canceled || !res.assets?.length) return;
    setPhotos((p) => [
      ...p,
      ...res.assets
        .slice(0, room)
        .map((a) => ({ uri: a.uri, mime: a.mimeType || "image/jpeg" })),
    ]);
  };
  const sendReport = (cur: Quote) => {
    const problem = reportProblem(reason, photos.length);
    if (problem) {
      setError(problem);
      return;
    }
    return run("report", async () => {
      const token = await getToken();
      if (!token) {
        setError("Sign in again to continue.");
        return;
      }
      const urls: string[] = [];
      for (const p of photos) {
        try {
          const up: any = await uploadImage(p.uri, p.mime, "requests", token);
          if (up?.url) urls.push(up.url);
        } catch {
          setError(
            "A photo didn't upload. Try again, or send the report without it.",
          );
          return;
        }
      }
      const r = await steps.report(cur, reason.trim(), urls);
      if (r.ok) {
        setReportOpen(false);
        setReason("");
        setPhotos([]);
      }
      await finish(r, "Report sent. Outsyde will review it.", () => true);
    });
  };

  const runStart = (
    q: Quote,
    s: NonNullable<ReturnType<typeof parseStart>>,
  ) => {
    if (s.kind === "pay" && stageOf(q) === "pay") pay(q);
    else if (s.kind === "balance-card" && q.balance?.needsNewCard)
      card(q, "balance");
    else if (
      s.kind === "extras-card" &&
      (q.extrasPayment?.needsNewCard || q.extrasPayment?.unpaid)
    )
      card(q, "extras");
    else if (
      s.kind === "approve" &&
      q.extras.find((x) => x.id === s.extraId)?.canApprove
    )
      approve(q, s.extraId);
    else if (
      s.kind === "decline" &&
      q.extras.find((x) => x.id === s.extraId)?.canDecline
    )
      declineExtra(q, s.extraId);
  };

  // The card's step, once, after the first load (and only for the customer, only while it is still due).
  useEffect(() => {
    if (!q || started.current || !isCustomer) return;
    started.current = true;
    const s = parseStart(start);
    if (!s) return;
    // Next tick, so the step's own state changes never run inside this effect.
    setTimeout(() => runStart(q, s), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, isCustomer, start]);

  const back = {
    icon: "chevron-left" as const,
    label: "Back",
    onPress: () => navigation.goBack(),
  };
  if (!q) {
    return (
      <ThemedView style={{ flex: 1 }}>
        <HostHeader title="Quote" left={back} />
        <Centered>
          {loadError ? (
            <ErrorText>{loadError}</ErrorText>
          ) : (
            <ActivityIndicator color={theme.brandGold} />
          )}
        </Centered>
      </ThemedView>
    );
  }

  const stage = stageOf(q);
  const name = q.businessName || "The business";
  const bal = balanceLine(q);
  const xp = extrasPaymentLine(q.extrasPayment);
  const when = whenLine(q);

  return (
    <ThemedView style={{ flex: 1 }}>
      <HostHeader title={name} sub={quoteChip(q)} left={back} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={theme.brandGold}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: 4 }}>
          <ThemedText style={[styles.title, { color: theme.brandCream }]}>
            {q.title}
          </ThemedText>
          {when ? (
            <ThemedText style={[styles.dim, { color: theme.brandTextDim }]}>
              {when}
            </ThemedText>
          ) : null}
          {q.details ? (
            <ThemedText style={[styles.body, { color: theme.brandCream }]}>
              {q.details}
            </ThemedText>
          ) : null}
          {q.extrasNote ? (
            <ThemedText style={[styles.dim, { color: theme.brandTextDim }]}>
              {q.extrasNote}
            </ThemedText>
          ) : null}
        </View>

        {!isCustomer ? <Hint>This is what the customer sees.</Hint> : null}

        {stage === "pay" || stage === "paying" ? (
          <Box title="Payment">
            {payLines(q.amounts, q.paymentMode).map((l) => (
              <View key={l.label} style={styles.line}>
                <ThemedText
                  style={[
                    l.total ? styles.total : styles.body,
                    {
                      color: l.muted ? theme.brandTextDim : theme.brandCream,
                      flex: 1,
                    },
                  ]}
                >
                  {l.label}
                </ThemedText>
                <ThemedText
                  style={[
                    l.total ? styles.total : styles.body,
                    { color: l.muted ? theme.brandTextDim : theme.brandCream },
                  ]}
                >
                  {money(l.cents)}
                </ThemedText>
              </View>
            ))}
            <Hint>
              You earn Outsyde loyalty rewards points on what you pay.
            </Hint>
            {stage === "paying" ? (
              <Hint>Your payment is being confirmed.</Hint>
            ) : null}
            {isCustomer && stage === "pay" ? (
              q.kind === "product" ? (
                <Hint>
                  Paying for custom products in Outsyde is coming soon. Message
                  the business to arrange payment for now.
                </Hint>
              ) : !q.jobDate || !q.startTime ? (
                <Hint>
                  {
                    "This quote doesn't have a date and time yet. Ask the business to add them, then pay."
                  }
                </Hint>
              ) : (
                <>
                  <PrimaryButton
                    label={`Pay ${money(q.amounts.payNowCents)}`}
                    busy={busy === "pay"}
                    disabled={!!busy}
                    onPress={() => pay(q)}
                  />
                  <OutlineButton
                    label="Decline quote"
                    disabled={!!busy}
                    onPress={() => declineQuote(q)}
                  />
                </>
              )
            ) : null}
          </Box>
        ) : null}

        {stage === "closed" ? <Hint>{closedLine(q.status)}</Hint> : null}

        {q.status === "paid" ? (
          <Box title="Your booking">
            <ThemedText style={[styles.body, { color: theme.brandCream }]}>
              {q.paymentMode === "full"
                ? `Paid in full, ${money(q.amounts.payNowCents)}.`
                : `Deposit paid, ${money(q.amounts.payNowCents)}.`}
            </ThemedText>
            {bal ? (
              <ThemedText style={[styles.body, { color: theme.brandCream }]}>
                {bal.text}
              </ThemedText>
            ) : null}
            {bal?.action && isCustomer ? (
              <PrimaryButton
                label={bal.action.label}
                busy={busy === "card"}
                disabled={!!busy}
                onPress={() => card(q, "balance")}
              />
            ) : null}
          </Box>
        ) : null}

        {q.extras.length ? (
          <Box title="Extras">
            {q.extras.map((x) => (
              <View
                key={x.id}
                style={[
                  styles.extra,
                  { borderColor: theme.brandSurfaceBorder },
                ]}
              >
                <View style={styles.line}>
                  <ThemedText
                    style={[
                      styles.strong,
                      { color: theme.brandCream, flex: 1 },
                    ]}
                  >
                    {x.description}
                  </ThemedText>
                  <ThemedText
                    style={[styles.strong, { color: theme.brandCream }]}
                  >
                    {money(x.totalCents)}
                  </ThemedText>
                </View>
                <ThemedText style={[styles.dim, { color: theme.brandTextDim }]}>
                  {money(x.amountCents)} plus a service fee.{" "}
                  {x.status === "approved" &&
                  q.extrasPayment?.status === "captured"
                    ? "Approved and charged."
                    : extraStatusLine(x)}
                </ThemedText>
                {isCustomer && x.canApprove ? (
                  <View style={styles.pair}>
                    <PrimaryButton
                      style={{ flex: 1 }}
                      label="Approve"
                      busy={busy === `approve:${x.id}`}
                      disabled={!!busy}
                      onPress={() => approve(q, x.id)}
                    />
                    <OutlineButton
                      style={{ flex: 1 }}
                      label="Decline"
                      disabled={!!busy}
                      onPress={() => declineExtra(q, x.id)}
                    />
                  </View>
                ) : null}
                {isCustomer && x.canApprove && declinedCard === x.id ? (
                  <TextButton
                    gold
                    label="Use another card"
                    disabled={!!busy}
                    onPress={() => approve(q, x.id, true)}
                  />
                ) : null}
              </View>
            ))}
            {xp ? (
              <ThemedText style={[styles.body, { color: theme.brandCream }]}>
                {xp.text}
              </ThemedText>
            ) : null}
            {xp?.action && isCustomer ? (
              <PrimaryButton
                label={xp.action.label}
                busy={busy === "card"}
                disabled={!!busy}
                onPress={() => card(q, "extras")}
              />
            ) : null}
          </Box>
        ) : null}

        {stage === "window" && q.window ? (
          <Box title="How did it go?">
            <ThemedText style={[styles.body, { color: theme.brandCream }]}>
              {`If something went wrong, report a problem within 6 hours. Otherwise ${name} is paid.`}
            </ThemedText>
            <Hint>{windowLeft(q.window.endsAt, readAt)}</Hint>
            {isCustomer && q.window.canConfirm ? (
              <PrimaryButton
                label="Everything went well"
                busy={busy === "confirm"}
                disabled={!!busy}
                onPress={() => confirm(q)}
              />
            ) : null}
            {isCustomer && q.window.canReport && !reportOpen ? (
              <OutlineButton
                label="Report a problem"
                disabled={!!busy}
                onPress={() => setReportOpen(true)}
              />
            ) : null}
            {isCustomer && reportOpen ? (
              <View style={{ gap: Spacing.sm }}>
                <Field
                  label="What went wrong"
                  value={reason}
                  onChangeText={setReason}
                  multiline
                  maxLength={1000}
                  placeholder="Tell Outsyde what happened"
                />
                <View style={styles.photos}>
                  {photos.map((p, i) => (
                    <Pressable
                      key={p.uri}
                      onPress={() =>
                        setPhotos((all) => all.filter((_, j) => j !== i))
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`Remove photo ${i + 1}`}
                    >
                      <Image source={{ uri: p.uri }} style={styles.thumb} />
                    </Pressable>
                  ))}
                  {photos.length < MAX_PHOTOS ? (
                    <Pressable
                      onPress={pickPhotos}
                      style={[
                        styles.thumb,
                        styles.add,
                        { borderColor: theme.brandSurfaceBorder },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Add photos"
                    >
                      <Feather
                        name="plus"
                        size={22}
                        color={theme.brandTextDim}
                      />
                    </Pressable>
                  ) : null}
                </View>
                <Hint>Up to 5 photos. Tap a photo to remove it.</Hint>
                <PrimaryButton
                  label="Send report"
                  busy={busy === "report"}
                  disabled={!!busy}
                  onPress={() => sendReport(q)}
                />
                <TextButton
                  label="Cancel"
                  onPress={() => setReportOpen(false)}
                />
              </View>
            ) : null}
          </Box>
        ) : null}

        {stage === "reported" ? (
          <Hint>
            Outsyde is reviewing your report. The payment to the business is
            paused until then.
          </Hint>
        ) : null}
        {stage === "decided" && q.report ? (
          <Hint>{decidedLine(q.report, name)}</Hint>
        ) : null}
        {stage === "complete" ? (
          <Hint>This job is complete. Thanks for booking through Outsyde.</Hint>
        ) : null}

        {error ? <ErrorText>{error}</ErrorText> : null}
        {ok ? <OkText>{ok}</OkText> : null}

        <OutlineButton
          label={`Message ${name}`}
          onPress={() =>
            navigation.navigate("Chat", { conversationId: q.conversationId })
          }
        />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: Spacing.md,
    gap: Spacing.md,
    paddingBottom: Spacing["3xl"],
  },
  title: { fontSize: 22, fontWeight: "800" },
  body: { fontSize: 15, lineHeight: 21 },
  strong: { fontSize: 15, fontWeight: "700" },
  total: { fontSize: 16, fontWeight: "800" },
  dim: { fontSize: 13, lineHeight: 19 },
  line: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  extra: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.sm,
    gap: 6,
  },
  pair: { flexDirection: "row", gap: Spacing.sm },
  photos: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  thumb: { width: 64, height: 64, borderRadius: BorderRadius.sm },
  add: {
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
});
