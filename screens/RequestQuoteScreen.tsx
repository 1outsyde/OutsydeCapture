// Request a quote (Quotes step 6c-2b, calls 2 and 3): a contact for pricing service's own questions, the city when
// the business lists cities, and a phone number. Name and email come from the account. Photos upload to the
// requests folder. Sending opens the chat with the business, where the request card and the quote arrive.
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
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
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

import { ThemedView } from "@/components/ThemedView";
import { QuoteCard } from "@/components/quotes/QuoteCard";
import { ThemedText } from "@/components/ThemedText";
import {
  Centered,
  Chip,
  ErrorText,
  Field,
  Hint,
  HostHeader,
  OutlineButton,
  Label,
  PickerBox,
  PrimaryButton,
} from "@/components/host/hostUi";
import DateTimeSheet, {
  type PickerTarget,
} from "@/components/host/DateTimeSheet";
import OptionSheet from "@/components/host/OptionSheet";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useStartChat } from "@/hooks/useStartChat";
import { Spacing, BorderRadius } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/types";
import api, { type ApiError } from "@/services/api";
import { uploadImage } from "@/services/mediaUpload";
import { errorMessage, dateLabel } from "@/utils/quoteLogic";
import {
  MAX_PHOTOS_EACH,
  checkRequest,
  requestBody,
  type Answers,
  type RequestForm,
  type RequestQuestion,
} from "@/utils/requestLogic";
import { monthOf } from "@/utils/host/pickerLogic";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Photo = { uri: string; mime: string };

const todayYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function RequestQuoteScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<Nav>();
  const {
    serviceId,
    serviceName,
    businessId,
    businessName,
    photographerId,
    photographerName,
  } = useRoute<RouteProp<RootStackParamList, "RequestQuote">>().params;
  // F2b: a photographer's contact for pricing service (backend F2a). Same screen, the photographer's form.
  const isPhotographer = !!photographerId;
  const { user, getToken, isAuthenticated } = useAuth();
  const signedIn = isAuthenticated && !!user && !user.isGuest;

  const [form, setForm] = useState<RequestForm | null>(null);
  const [loadError, setLoadError] = useState("");
  const [answers, setAnswers] = useState<Answers>({});
  const [photos, setPhotos] = useState<Record<string, Photo[]>>({});
  // null until the customer edits it: until then it shows the account's phone (review minor 7).
  const [phoneEdit, setPhone] = useState<string | null>(null);
  const phone = phoneEdit ?? user?.phone ?? "";
  const [city, setCity] = useState("");
  const [picker, setPicker] = useState<
    (PickerTarget & { field: string }) | null
  >(null);
  const [cityOpen, setCityOpen] = useState(false);
  const [error, setError] = useState<{ field: string; message: string } | null>(
    null,
  );
  const [sending, setSending] = useState(false);
  // Review minor 6: a ref stops a double send; each photo is uploaded once even if a send is retried.
  const sendingRef = useRef(false);
  const uploadedByUri = useRef<Record<string, string>>({});
  const { startChat } = useStartChat();

  useEffect(() => {
    let live = true;
    (isPhotographer
      ? api.getPhotographerRequestForm(serviceId)
      : api.getRequestForm(serviceId)
    )
      .then((f) => {
        if (live) {
          setForm(f);
          if (f.cities.length === 1) setCity(f.cities[0]);
        }
      })
      .catch((err: ApiError) => {
        if (live)
          setLoadError(
            err?.status === 404
              ? isPhotographer
                ? "This service isn't taking requests right now. Message the photographer instead."
                : "This service isn't taking requests right now. Message the business instead."
              : errorMessage(err),
          );
      });
    return () => {
      live = false;
    };
  }, [serviceId, isPhotographer]);

  const set = (id: string, v: string | string[] | undefined) =>
    setAnswers((a) => ({ ...a, [id]: v }));
  const photoCount = Object.values(photos).reduce(
    (n, list) => n + list.length,
    0,
  );

  const addPhotos = async (q: RequestQuestion) => {
    const have = photos[q.id]?.length ?? 0;
    const room = Math.min(
      (q.maxPhotos ?? MAX_PHOTOS_EACH) - have,
      10 - photoCount,
    );
    if (room <= 0) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: room,
      quality: 0.8,
    });
    if (res.canceled || !res.assets?.length) return;
    setPhotos((p) => ({
      ...p,
      [q.id]: [
        ...(p[q.id] ?? []),
        ...res.assets
          .slice(0, room)
          .map((a) => ({ uri: a.uri, mime: a.mimeType || "image/jpeg" })),
      ],
    }));
  };

  const send = useCallback(async () => {
    if (!form || !user || sendingRef.current) return;
    const withPhotos: Answers = { ...answers };
    for (const [id, list] of Object.entries(photos))
      withPhotos[id] = list.map((p) => p.uri);
    const problem = checkRequest(form, withPhotos, phone, city, photoCount);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    sendingRef.current = true;
    setSending(true);
    try {
      const token = await getToken();
      if (!token) {
        setError({ field: "", message: "Sign in again to send your request." });
        return;
      }
      const uploaded: Record<string, string[]> = {};
      for (const [id, list] of Object.entries(photos)) {
        uploaded[id] = [];
        for (const p of list) {
          const done = uploadedByUri.current[p.uri];
          const up: any = done
            ? { url: done }
            : await uploadImage(p.uri, p.mime, "requests", token).catch(
                () => null,
              );
          if (up?.url) uploadedByUri.current[p.uri] = up.url;
          if (!up?.url) {
            setError({
              field: id,
              message:
                "A photo didn't upload. Try again, or remove it and send.",
            });
            return;
          }
          uploaded[id].push(up.url);
        }
      }
      const res = await api.submitRequest(
        token,
        requestBody(form, user, answers, uploaded, phone, city),
      );
      const conv = res.request?.conversationId;
      if (conv) navigation.replace("Chat", { conversationId: conv });
      else navigation.goBack();
    } catch (err) {
      const e = err as ApiError;
      setError({
        field: String(e?.body?.field ?? ""),
        message:
          e?.status === 429
            ? "You've sent a few requests in a row. Try again in a little while."
            : errorMessage(e),
      });
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }, [
    form,
    user,
    answers,
    photos,
    phone,
    city,
    photoCount,
    getToken,
    navigation,
  ]);

  const back = {
    icon: "chevron-left" as const,
    label: "Back",
    onPress: () => navigation.goBack(),
  };
  const title = form?.service.name || serviceName || "Request a quote";
  if (!signedIn) {
    return (
      <ThemedView style={{ flex: 1, backgroundColor: theme.brandBg }}>
        <HostHeader title="Request a quote" left={back} />
        <Centered>
          <Hint>Sign in to ask for a quote.</Hint>
          <PrimaryButton
            label="Sign in"
            onPress={() => navigation.navigate("Auth", {})}
          />
        </Centered>
      </ThemedView>
    );
  }
  // Never a dead end (Legend 2026-11-05): wherever the form can't be sent, message the business instead.
  const bizId =
    form?.business.id ?? (isPhotographer ? photographerId : businessId);
  const bizName =
    form?.business.name ??
    (isPhotographer
      ? (photographerName ?? "the photographer")
      : (businessName ?? "the business"));
  const messageButton = bizId ? (
    <OutlineButton
      label={`Message ${bizName}`}
      onPress={() =>
        startChat({
          participantId: bizId,
          participantType: isPhotographer ? "photographer" : "business",
          name: bizName,
        })
      }
    />
  ) : null;
  if (!form) {
    return (
      <ThemedView style={{ flex: 1, backgroundColor: theme.brandBg }}>
        <HostHeader title="Request a quote" left={back} />
        <Centered>
          {loadError ? (
            <>
              <ErrorText>{loadError}</ErrorText>
              {messageButton}
            </>
          ) : (
            <ActivityIndicator color={theme.brandGold} />
          )}
        </Centered>
      </ThemedView>
    );
  }

  const fieldError = (id: string) =>
    error && error.field === id ? <ErrorText>{error.message}</ErrorText> : null;

  return (
    <ThemedView style={{ flex: 1, backgroundColor: theme.brandBg }}>
      <HostHeader
        title="Request a quote"
        sub={form.business.name}
        left={back}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top card (restyle): what's being requested and how it works. */}
        <View style={[styles.hero, { backgroundColor: theme.brandPrimary }]}>
          <ThemedText
            style={[styles.title, { color: theme.brandPrimaryText }]}
            accessibilityRole="header"
          >
            {title}
          </ThemedText>
          <ThemedText
            style={[styles.heroLine, { color: theme.brandPrimaryText }]}
          >
            {`${form.business.name} prices this after a few questions. They answer in your Messages.`}
          </ThemedText>
        </View>

        {form.cities.length > 0 ||
        form.cityRequired ||
        form.questions.length > 0 ? (
          <QuoteCard title="About the job">
            {form.cities.length > 0 ? (
              <View>
                <PickerBox
                  label="Your city"
                  value={city || "Choose your city"}
                  onPress={() => setCityOpen(true)}
                />
                {fieldError("city")}
              </View>
            ) : form.cityRequired ? (
              // Review minor 4: the business lists cities but none for this service yet.
              <View style={{ gap: Spacing.sm }}>
                <ErrorText>{`${bizName} doesn't offer this in any of its cities yet. Message them to ask.`}</ErrorText>
                {messageButton}
              </View>
            ) : null}

            {form.questions.map((q) => (
              <View key={q.id} style={styles.question}>
                {q.type === "short_text" || q.type === "long_text" ? (
                  <Field
                    label={q.required ? q.label : `${q.label} (optional)`}
                    value={
                      typeof answers[q.id] === "string"
                        ? (answers[q.id] as string)
                        : ""
                    }
                    onChangeText={(t) => set(q.id, t)}
                    multiline={q.type === "long_text"}
                    maxLength={q.type === "short_text" ? 200 : 2000}
                  />
                ) : q.type === "date" ? (
                  <PickerBox
                    label={q.required ? q.label : `${q.label} (optional)`}
                    value={
                      typeof answers[q.id] === "string" && answers[q.id]
                        ? dateLabel(answers[q.id] as string)
                        : "Pick a date"
                    }
                    onPress={() => {
                      const today = todayYmd();
                      const v =
                        typeof answers[q.id] === "string"
                          ? (answers[q.id] as string)
                          : "";
                      setPicker({
                        field: q.id,
                        mode: "date",
                        title: q.label,
                        value: v,
                        min: today,
                        fallbackMonth: monthOf(v) ?? monthOf(today)!,
                      });
                    }}
                  />
                ) : q.type === "choice" ? (
                  <View style={{ gap: 6 }}>
                    <Label>
                      {q.required ? q.label : `${q.label} (optional)`}
                    </Label>
                    <View style={styles.chips}>
                      {(q.options ?? []).map((o) => {
                        const cur = answers[q.id];
                        const on = q.multiple
                          ? Array.isArray(cur) && cur.includes(o)
                          : cur === o;
                        return (
                          <Chip
                            key={o}
                            label={o}
                            on={on}
                            onPress={() => {
                              if (q.multiple) {
                                const list = Array.isArray(cur) ? cur : [];
                                set(
                                  q.id,
                                  on
                                    ? list.filter((x) => x !== o)
                                    : [...list, o],
                                );
                              } else set(q.id, on ? undefined : o);
                            }}
                          />
                        );
                      })}
                    </View>
                  </View>
                ) : (
                  <View style={{ gap: 6 }}>
                    <Label>
                      {q.required ? q.label : `${q.label} (optional)`}
                    </Label>
                    <View style={styles.photos}>
                      {(photos[q.id] ?? []).map((p, i) => (
                        <Pressable
                          key={`${i}-${p.uri}`}
                          onPress={() =>
                            setPhotos((all) => ({
                              ...all,
                              [q.id]: (all[q.id] ?? []).filter(
                                (_, j) => j !== i,
                              ),
                            }))
                          }
                          accessibilityRole="button"
                          accessibilityLabel={`Remove photo ${i + 1}`}
                        >
                          <Image
                            source={{ uri: p.uri }}
                            style={styles.thumb}
                            accessibilityLabel={`Photo ${i + 1}`}
                          />
                        </Pressable>
                      ))}
                      {(photos[q.id]?.length ?? 0) <
                        (q.maxPhotos ?? MAX_PHOTOS_EACH) && photoCount < 10 ? (
                        <Pressable
                          onPress={() => addPhotos(q)}
                          style={[
                            styles.thumb,
                            styles.add,
                            { borderColor: theme.brandSurfaceBorder },
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={`Add photos for ${q.label}`}
                        >
                          <Feather
                            name="plus"
                            size={22}
                            color={theme.brandTextDim}
                          />
                        </Pressable>
                      ) : null}
                    </View>
                    <Hint>{`Up to ${q.maxPhotos ?? MAX_PHOTOS_EACH} photos. Tap a photo to remove it.`}</Hint>
                  </View>
                )}
                {q.help ? <Hint>{q.help}</Hint> : null}
                {fieldError(q.id)}
              </View>
            ))}
          </QuoteCard>
        ) : null}

        <QuoteCard title="How to reach you">
          <Field
            label="Phone number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
            maxLength={40}
          />
          <Hint>{`So ${form.business.name} can call you about the job.`}</Hint>
          {fieldError("phone")}
          <Hint>{`Sent with your name and email from your Outsyde account (${user?.email ?? ""}).`}</Hint>
        </QuoteCard>

        {error &&
        !["city", "phone", ...form.questions.map((q) => q.id)].includes(
          error.field,
        ) ? (
          <ErrorText>{error.message}</ErrorText>
        ) : null}
        <PrimaryButton
          label="Send request"
          busy={sending}
          disabled={sending}
          onPress={send}
        />
      </ScrollView>

      <DateTimeSheet
        target={picker}
        onDone={(v) => {
          if (picker) set(picker.field, v);
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
      <OptionSheet
        title="Your city"
        options={
          cityOpen ? form.cities.map((c) => ({ value: c, label: c })) : null
        }
        selected={city}
        onPick={(v) => {
          setCity(v);
          setCityOpen(false);
        }}
        onClose={() => setCityOpen(false)}
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
  title: { fontSize: 22, lineHeight: 28, fontWeight: "800" },
  hero: { borderRadius: 18, padding: Spacing.md, paddingVertical: 18, gap: 6 },
  heroLine: { fontSize: 14, lineHeight: 20, opacity: 0.85 },
  question: { gap: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  photos: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  thumb: { width: 64, height: 64, borderRadius: BorderRadius.sm },
  add: {
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
});
