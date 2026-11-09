// Create a quote, Review and send, and Edit (Quotes step 6d-1, calls 2 to 4). Opened from the chat's + menu, from a
// request card (Send a quote, prefilled from the request) or from the quote screen (Edit, quoteId). Services only.
// The checks follow the backend's (utils/quoteSendLogic.ts formToBody); the backend checks again and its message is
// shown next to the field it names. Copy: commas and periods only, never the fee rate.
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import {
  Box,
  Centered,
  Chip,
  ErrorText,
  Field,
  Hint,
  HostHeader,
  Label,
  ON_GOLD,
  OutlineButton,
  PickerBox,
  PrimaryButton,
  RadioRow,
} from "@/components/host/hostUi";
import DateTimeSheet, {
  type PickerTarget,
} from "@/components/host/DateTimeSheet";
import OptionSheet, { type Option } from "@/components/host/OptionSheet";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/types";
import api, { type ApiError } from "@/services/api";
import { monthOf, todayIn } from "@/utils/host/pickerLogic";
import {
  dateLabel,
  errorMessage,
  money,
  timeLabel,
  whenLine,
} from "@/utils/quoteLogic";
import {
  EXPIRY_LINE,
  DELIVERABLE_EXPIRY_LINE,
  durationOptions,
  editBody,
  emptyForm,
  formFromQuote,
  formFromRequest,
  formToBody,
  lengthLabel,
  reviewLines,
  type QuoteBody,
  type QuoteForm,
} from "@/utils/quoteSendLogic";
import {
  DELIVERABLE_COPY,
  deliverableWhenLine,
} from "@/utils/deliverableLogic";
import OutsydeLoader from "@/components/OutsydeLoader";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Svc = { id: string; name: string; durationMinutes?: number | null };
type Sheet = null | "service" | "length" | "product";

const localZone = () => {
  try {
    return (
      Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York"
    );
  } catch {
    return "America/New_York";
  }
};

export default function QuoteComposeScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, "QuoteCompose">>();
  const p = route.params;
  const editing = !!p.quoteId;
  const { user, getToken } = useAuth();

  const [form, setForm] = useState<QuoteForm>(() =>
    p.requestId
      ? formFromRequest({
          requestId: p.requestId,
          serviceId: p.serviceId ?? null,
          serviceName: p.serviceName ?? null,
          preferredDate: p.preferredDate ?? null,
          // Step P (call Q6): a product request starts a Deliverable with the product picked.
          productId: p.productId ?? null,
        })
      : emptyForm(),
  );
  const [version, setVersion] = useState<number | null>(null);
  const [loading, setLoading] = useState(editing);
  const [loadError, setLoadError] = useState("");
  const [services, setServices] = useState<Svc[]>([]);
  // Deliverables D2: your own products, for the optional Product picker.
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [step, setStep] = useState<"form" | "review">("form");
  const [review, setReview] = useState<QuoteBody | null>(null);
  const [fieldErr, setFieldErr] = useState<{
    field: string;
    message: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState<
    (PickerTarget & { field: "jobDate" | "startTime" | "dueDate" }) | null
  >(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const touched = useRef(false);
  const sending = useRef(false);
  // Review 3: the service saved on the quote; an edit leaves it out unless it changed.
  const [savedServiceId, setSavedServiceId] = useState<string | null>(null);
  const [savedProductId, setSavedProductId] = useState<string | null>(null);
  // Review 1: load once. getToken changes on every auth render (a return to the app), which must never reload the
  // quote over the business's unsaved edits.
  const tokenRef = useRef(getToken);
  useEffect(() => {
    tokenRef.current = getToken;
  }, [getToken]);

  const set = <K extends keyof QuoteForm>(k: K, v: QuoteForm[K]) => {
    touched.current = true;
    setFieldErr((e) =>
      e &&
      (e.field === k ||
        (k === "total" && e.field === "totalCents") ||
        (k === "deposit" && e.field === "depositCents") ||
        (k === "deliveryFee" && e.field === "deliveryFeeCents") ||
        (k === "kind" && e.field === "kind"))
        ? null
        : e,
    );
    setForm((f) => ({ ...f, [k]: v }));
  };

  // Edit: the live quote. Services: the business's own active ones (optional link).
  useEffect(() => {
    let live = true;
    (async () => {
      const token = await tokenRef.current();
      if (!token) {
        if (live) setLoadError("Sign in again to continue.");
        return;
      }
      if (p.quoteId) {
        try {
          const q = await api.getQuote(token, p.quoteId);
          if (!live) return;
          if (q.status !== "sent") {
            setLoadError(
              q.status === "paid"
                ? "This quote is paid, so it can't be changed."
                : "This quote can't be changed now.",
            );
          } else {
            if (!touched.current) setForm(formFromQuote(q));
            setVersion(q.version);
            setSavedServiceId(q.serviceId ?? null);
            setSavedProductId((q as any).productId ?? null);
          }
        } catch (err) {
          if (live) setLoadError(errorMessage(err as ApiError));
        } finally {
          if (live) setLoading(false);
        }
      }
      try {
        const list =
          user?.role === "staff" && p.businessId
            ? (await api.getBusinessPublicServices(p.businessId)).services
            : (await api.getVendorServices(token)).services;
        if (live)
          setServices(
            (list ?? [])
              .filter(
                (s: any) =>
                  s && s.isActive !== false && s.status !== "archived",
              )
              .map((s: any) => ({
                id: s.id,
                name: s.name,
                durationMinutes: s.durationMinutes ?? null,
              })),
          );
      } catch {
        // The service link is optional: no list, no picker.
      }
      // Deliverables D2: the owner's products (staff send without a product link).
      if (user?.role !== "staff") {
        try {
          const pl = (await api.getVendorProducts(token)).products ?? [];
          if (live)
            setProducts(
              pl
                .filter(
                  (x: any) =>
                    x && x.isActive !== false && x.status !== "archived",
                )
                .map((x: any) => ({ id: x.id, name: x.name })),
            );
        } catch {
          // Optional: no list, no picker.
        }
      }
    })();
    return () => {
      live = false;
    };
  }, [p.quoteId, p.businessId, user?.role]);

  // Review 7: every way out (header, Android back, a swipe) is blocked while sending and asks first when there
  // are unsent changes.
  useEffect(
    () =>
      navigation.addListener("beforeRemove", (e) => {
        if (sending.current) {
          e.preventDefault();
          return;
        }
        if (!touched.current) return;
        e.preventDefault();
        Alert.alert(
          editing ? "Discard your changes?" : "Discard this quote?",
          "Nothing has been sent.",
          [
            { text: "Keep editing", style: "cancel" },
            {
              text: "Discard",
              style: "destructive",
              onPress: () => navigation.dispatch(e.data.action),
            },
          ],
        );
      }),
    [navigation, editing],
  );

  const close = () => navigation.goBack();

  const toReview = () => {
    const r = formToBody(form);
    if (!r.ok) {
      setFieldErr({ field: r.field, message: r.message });
      setError("Check the field marked below.");
      return;
    }
    setFieldErr(null);
    setError("");
    setReview(r.body);
    setStep("review");
  };

  const send = async () => {
    if (!review || sending.current) return;
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      const token = await getToken();
      if (!token) {
        setError("Sign in again to continue.");
        return;
      }
      if (editing && p.quoteId && version !== null)
        await api.editQuote(
          token,
          p.quoteId,
          version,
          editBody(review, savedServiceId, savedProductId),
        );
      else await api.sendQuote(token, p.conversationId, review, p.businessId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
      touched.current = false;
      sending.current = false;
      navigation.goBack();
    } catch (err) {
      const e = err as ApiError;
      const field =
        typeof e?.body?.field === "string" ? (e.body.field as string) : "";
      if (
        e?.status === 400 &&
        field &&
        field !== "body" &&
        field !== "version"
      ) {
        // Back to the form, next to the field the backend named (for example a start time already passed).
        setFieldErr({ field, message: errorMessage(e) });
        setError("Check the field marked below.");
        setStep("form");
      } else setError(errorMessage(e));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  const errFor = (...fields: string[]) =>
    fieldErr && fields.includes(fieldErr.field) ? (
      <ErrorText>{fieldErr.message}</ErrorText>
    ) : null;

  const today = useMemo(() => todayIn(localZone()), []);
  const serviceOptions: Option[] = useMemo(
    () => [
      { value: "", label: "No service" },
      ...services.map((s) => ({ value: s.id, label: s.name })),
    ],
    [services],
  );
  const serviceName = services.find((s) => s.id === form.serviceId)?.name;
  // Review 4: a saved product that is no longer listed (archived) still shows, so the owner sees what the quote keeps.
  const productName =
    products.find((x) => x.id === form.productId)?.name ??
    (form.productId ? "Saved product, no longer listed" : undefined);
  const productOptions: Option[] = useMemo(
    () => [
      { value: "", label: DELIVERABLE_COPY.noProduct },
      ...products.map((x) => ({ value: x.id, label: x.name })),
    ],
    [products],
  );
  const isProduct = form.kind === "product";
  const title = editing
    ? "Edit quote"
    : step === "review"
      ? "Review and send"
      : "Create a quote";
  const left = { icon: "x" as const, label: "Close", onPress: close };

  if (loading || loadError) {
    return (
      <ThemedView style={{ flex: 1 }}>
        <HostHeader title={title} left={left} />
        <Centered>
          {loadError ? <ErrorText>{loadError}</ErrorText> : <OutsydeLoader />}
        </Centered>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <HostHeader
        title={title}
        sub={step === "review" ? "A preview of the customer's card" : undefined}
        left={
          step === "review"
            ? {
                icon: "chevron-left",
                label: "Back",
                onPress: () => {
                  if (!busy) setStep("form");
                },
              }
            : left
        }
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {step === "form" ? (
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            {error ? <ErrorText>{error}</ErrorText> : null}
            {/* Review 5: staff at more than one business see which one the quote is from. */}
            {!editing && user?.role === "staff" && user.staffBusinessName ? (
              <Hint>{`Sending as ${user.staffBusinessName}.`}</Hint>
            ) : null}
            <View style={{ gap: 6 }}>
              <View style={styles.chips}>
                <Chip
                  label={DELIVERABLE_COPY.kindService}
                  on={!isProduct}
                  onPress={() => set("kind", "service")}
                />
                <Chip
                  label={DELIVERABLE_COPY.kindDeliverable}
                  on={isProduct}
                  onPress={() => set("kind", "product")}
                />
              </View>
              {isProduct ? <Hint>{DELIVERABLE_COPY.kindHint}</Hint> : null}
            </View>
            {!isProduct && services.length ? (
              <PickerBox
                label="SERVICE (OPTIONAL)"
                value={serviceName || "No service"}
                onPress={() => setSheet("service")}
              />
            ) : null}
            {isProduct && products.length ? (
              <PickerBox
                label="PRODUCT (OPTIONAL)"
                value={productName || DELIVERABLE_COPY.noProduct}
                onPress={() => setSheet("product")}
              />
            ) : null}
            {errFor("productId")}
            {errFor("serviceId", "requestId")}
            <Field
              label="TITLE"
              value={form.title}
              onChangeText={(v) => set("title", v)}
              maxLength={120}
              placeholder="Two bedroom move"
            />
            {errFor("title")}
            {isProduct ? (
              <>
                <PickerBox
                  label="DUE DATE (OPTIONAL)"
                  value={form.dueDate ? dateLabel(form.dueDate) : "No due date"}
                  onPress={() =>
                    setPicker({
                      field: "dueDate",
                      mode: "date",
                      title: "Due date",
                      value: form.dueDate,
                      min: today,
                      fallbackMonth: monthOf(form.dueDate) ?? monthOf(today)!,
                    })
                  }
                />
                {form.dueDate ? (
                  <Chip
                    label="Remove the due date"
                    on={false}
                    onPress={() => set("dueDate", "")}
                  />
                ) : null}
                {errFor("dueDate")}
                <View style={{ gap: 6 }}>
                  <Label>HOW IT GETS TO THEM</Label>
                  <View style={styles.chips}>
                    <Chip
                      label={DELIVERABLE_COPY.pickup}
                      on={form.fulfillment === "pickup"}
                      onPress={() => set("fulfillment", "pickup")}
                    />
                    <Chip
                      label={DELIVERABLE_COPY.delivery}
                      on={form.fulfillment === "delivery"}
                      onPress={() => set("fulfillment", "delivery")}
                    />
                  </View>
                </View>
                {errFor("fulfillment")}
              </>
            ) : null}
            {!isProduct ? (
              <>
                <View style={styles.row}>
                  <PickerBox
                    label="DATE"
                    value={
                      form.jobDate ? dateLabel(form.jobDate) : "Pick a date"
                    }
                    onPress={() =>
                      setPicker({
                        field: "jobDate",
                        mode: "date",
                        title: "Date of the job",
                        value: form.jobDate,
                        min: today,
                        fallbackMonth: monthOf(form.jobDate) ?? monthOf(today)!,
                      })
                    }
                  />
                  <PickerBox
                    label="START"
                    value={
                      form.startTime ? timeLabel(form.startTime) : "Pick a time"
                    }
                    onPress={() =>
                      setPicker({
                        field: "startTime",
                        mode: "time",
                        title: "Start time",
                        value: form.startTime,
                        fallbackMonth: monthOf(today)!,
                      })
                    }
                  />
                </View>
                {errFor("jobDate", "startTime")}
                <PickerBox
                  label="LENGTH"
                  value={
                    form.durationMinutes
                      ? lengthLabel(form.durationMinutes)
                      : "How long it takes"
                  }
                  onPress={() => setSheet("length")}
                />
                {errFor("durationMinutes")}
              </>
            ) : null}
            <Field
              label="WHAT'S INCLUDED (OPTIONAL)"
              value={form.details}
              onChangeText={(v) => set("details", v)}
              multiline
              maxLength={2000}
              placeholder={
                isProduct
                  ? "Vanilla, strawberry filling, name on top"
                  : "Two movers, a truck, blankets and wrap"
              }
            />
            {errFor("details")}
            {!isProduct ? (
              <Field
                label="EXTRAS NOTE (OPTIONAL)"
                value={form.extrasNote}
                onChangeText={(v) => set("extrasNote", v)}
                multiline
                maxLength={300}
                placeholder="Anything that could be added on the day, like extra stairs"
              />
            ) : null}
            {!isProduct ? errFor("extrasNote") : null}
            <Field
              label="TOTAL"
              value={form.total}
              onChangeText={(v) => set("total", v)}
              keyboardType="decimal-pad"
              placeholder="$0.00"
            />
            {errFor("totalCents")}
            {isProduct && form.fulfillment === "delivery" ? (
              <>
                <Field
                  label="DELIVERY FEE (OPTIONAL, PART OF THE TOTAL)"
                  value={form.deliveryFee}
                  onChangeText={(v) => set("deliveryFee", v)}
                  keyboardType="decimal-pad"
                  placeholder="$0.00"
                />
                {errFor("deliveryFeeCents")}
              </>
            ) : null}
            <View style={{ gap: 6 }}>
              <Label>PAYMENT</Label>
              <View style={styles.chips}>
                <Chip
                  label="Deposit now"
                  on={form.paymentMode === "deposit"}
                  onPress={() => set("paymentMode", "deposit")}
                />
                <Chip
                  label="Full payment now"
                  on={form.paymentMode === "full"}
                  onPress={() => set("paymentMode", "full")}
                />
              </View>
            </View>
            {errFor("paymentMode")}
            {form.paymentMode === "deposit" ? (
              <>
                <Field
                  label="DEPOSIT"
                  value={form.deposit}
                  onChangeText={(v) => set("deposit", v)}
                  keyboardType="decimal-pad"
                  placeholder="$0.00"
                />
                {errFor("depositCents")}
                {isProduct ? <Hint>{DELIVERABLE_COPY.depositRest}</Hint> : null}
                {!isProduct ? (
                  <Box title="The rest is paid">
                    <RadioRow
                      label="Through Outsyde"
                      sub="Held on the customer's card the day before, charged when you mark the job complete."
                      on={form.restPaid === "outsyde"}
                      onPress={() => set("restPaid", "outsyde")}
                    />
                    <RadioRow
                      label="Directly to you"
                      sub="For example cash on the day. Outsyde doesn't hold it or protect it."
                      on={form.restPaid === "outside"}
                      onPress={() => set("restPaid", "outside")}
                    />
                  </Box>
                ) : null}
                {errFor("restPaid")}
              </>
            ) : null}
            <Hint>
              {editing
                ? `${isProduct ? DELIVERABLE_EXPIRY_LINE : EXPIRY_LINE} Saving starts the 7 days again.`
                : isProduct
                  ? DELIVERABLE_EXPIRY_LINE
                  : EXPIRY_LINE}
            </Hint>
            <PrimaryButton label="Review quote" onPress={toReview} />
          </ScrollView>
        ) : review ? (
          <ScrollView contentContainerStyle={styles.scroll}>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: theme.brandBgElevated,
                  borderColor: theme.brandSurfaceBorder,
                },
              ]}
            >
              <ThemedText
                style={[
                  styles.pill,
                  { color: theme.brandGold, borderColor: theme.brandGold },
                ]}
              >
                {editing ? "Updated quote" : "Quote"}
              </ThemedText>
              <ThemedText
                style={[styles.cardTitle, { color: theme.brandCream }]}
              >
                {review.title}
              </ThemedText>
              <ThemedText style={[styles.dim, { color: theme.brandTextDim }]}>
                {review.kind === "product"
                  ? deliverableWhenLine({
                      dueDate: review.dueDate ?? null,
                      fulfillment: review.fulfillment ?? "pickup",
                    })
                  : whenLine({
                      kind: "service",
                      jobDate: review.jobDate,
                      startTime: review.startTime,
                      durationMinutes: review.durationMinutes,
                      dueDate: null,
                    })}
              </ThemedText>
              <ThemedText style={[styles.amount, { color: theme.brandCream }]}>
                {money(review.totalCents)}
              </ThemedText>
              <View
                style={[styles.fakeBtn, { backgroundColor: theme.brandGold }]}
                accessible={false}
              >
                <ThemedText style={styles.fakeBtnText}>
                  {review.paymentMode === "full"
                    ? "Pay in full"
                    : `Pay the ${money(review.depositCents)} deposit`}
                </ThemedText>
              </View>
            </View>
            {review.details ? (
              <ThemedText style={[styles.body, { color: theme.brandCream }]}>
                {review.details}
              </ThemedText>
            ) : null}
            {review.extrasNote ? (
              <ThemedText style={[styles.dim, { color: theme.brandTextDim }]}>
                {review.extrasNote}
              </ThemedText>
            ) : null}
            <Box title="Amounts">
              {reviewLines(review).map((l, i) => (
                <View key={l.label} style={styles.line}>
                  <ThemedText
                    style={[
                      i === 0 ? styles.strong : styles.body,
                      { color: theme.brandCream, flex: 1 },
                    ]}
                  >
                    {l.label}
                  </ThemedText>
                  <ThemedText
                    style={[
                      i === 0 ? styles.strong : styles.body,
                      { color: theme.brandCream },
                    ]}
                  >
                    {l.value}
                  </ThemedText>
                </View>
              ))}
              <Hint>
                The customer pays a service fee on top and earns Outsyde loyalty
                rewards points on what they pay.
              </Hint>
            </Box>
            {serviceName && review.serviceId ? (
              <Hint>{`Linked to ${serviceName}.`}</Hint>
            ) : null}
            <Hint>
              {review.kind === "product"
                ? DELIVERABLE_EXPIRY_LINE
                : EXPIRY_LINE}
            </Hint>
            {review.kind === "product" && review.deliveryFeeCents ? (
              <Hint>{`Delivery fee ${money(review.deliveryFeeCents)}, included in the total.`}</Hint>
            ) : null}
            {error ? <ErrorText>{error}</ErrorText> : null}
            <PrimaryButton
              label={editing ? "Save and send update" : "Send quote"}
              busy={busy}
              disabled={busy}
              onPress={send}
            />
            <OutlineButton
              label="Back to edit"
              disabled={busy}
              onPress={() => setStep("form")}
            />
          </ScrollView>
        ) : null}
      </KeyboardAvoidingView>

      <DateTimeSheet
        target={picker}
        onDone={(v) => {
          if (picker) set(picker.field, v);
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
      <OptionSheet
        title={
          sheet === "service"
            ? "Service"
            : sheet === "product"
              ? "Product"
              : "Length"
        }
        options={
          sheet === "service"
            ? serviceOptions
            : sheet === "product"
              ? productOptions
              : sheet === "length"
                ? durationOptions(form.durationMinutes)
                : null
        }
        selected={
          sheet === "service"
            ? (form.serviceId ?? "")
            : sheet === "product"
              ? (form.productId ?? "")
              : String(form.durationMinutes ?? "")
        }
        onPick={(v) => {
          if (sheet === "product") {
            const pr = products.find((x) => x.id === v);
            set("productId", pr ? pr.id : null);
            if (pr && !form.title.trim()) set("title", pr.name.slice(0, 120));
          } else if (sheet === "service") {
            const svc = services.find((s) => s.id === v);
            set("serviceId", svc ? svc.id : null);
            // A new quote picks up the service's name and length when those are still empty.
            if (svc && !form.title.trim()) set("title", svc.name.slice(0, 120));
            if (
              svc?.durationMinutes &&
              !form.durationMinutes &&
              svc.durationMinutes >= 15 &&
              svc.durationMinutes <= 4320
            )
              set("durationMinutes", svc.durationMinutes);
          } else set("durationMinutes", Number(v));
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: Spacing.md,
    gap: Spacing.md,
    paddingBottom: Spacing["3xl"],
  },
  row: { flexDirection: "row", gap: Spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  line: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  body: { fontSize: 15, lineHeight: 21 },
  strong: { fontSize: 15, fontWeight: "700" },
  dim: { fontSize: 13, lineHeight: 19 },
  card: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md - 2,
    gap: 6,
  },
  pill: {
    alignSelf: "flex-start",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    borderWidth: 1,
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: "hidden",
  },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  amount: { fontSize: 15, fontWeight: "700" },
  fakeBtn: {
    minHeight: 44,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.xs,
  },
  fakeBtnText: { fontSize: 15, fontWeight: "700", color: ON_GOLD },
});
