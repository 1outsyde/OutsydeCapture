/**
 * Product add-ons editor (business side, Manage Business step 4, 2026-10-28).
 *
 * Extras a customer adds on top of the product: toppings, a cake topper, a name in frosting.
 * Variations pick the one version (cake color); add-ons are on top and each adds its price.
 *
 * The business makes groups (Toppings, Message), says whether customers must pick and how many,
 * and lists the choices with a price. A choice can ask the customer to type something (the name on
 * the cake). Choices can come from the shared add-on library, or a typed choice lands in the
 * library by name (backend #373, same rules as service add-ons).
 *
 * Saved by the parent through the ref: getSaveBody() → PUT /api/business/products/:id/addons.
 * Nothing is sent unless something changed here.
 */
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { api, getAddonLibrary, type LibraryAddon } from "@/services/api";
import {
  DEFAULT_TEXT_LENGTH,
  MAX_CHOICES,
  MAX_GROUPS,
  centsToInput,
  draftChoice,
  draftGroup,
  draftsFrom,
  saveBodyFrom,
  type ChoiceDraft,
  type GroupDraft,
  type PickRule,
  type SaveAddonGroup,
  type VendorAddonGroup,
} from "./productAddonLogic";

export interface ProductAddonsEditorHandle {
  /** null = nothing changed; { error } = show it, don't save; { body } = send to the add-ons route. */
  getSaveBody():
    | null
    | { error: string }
    | { body: { groups: SaveAddonGroup[] } };
}

interface Props {
  /** What GET /api/business/products/:id/addons returned; [] for a new product. */
  initial: VendorAddonGroup[];
  /** Saved product id (price prompts call the server right away); null for a new product. */
  productId: string | null;
  authToken: string;
}

const RULES: { key: PickRule; label: string }[] = [
  { key: "one", label: "Only one" },
  { key: "any", label: "Any number" },
  { key: "upTo", label: "Up to" },
];

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const ProductAddonsEditor = forwardRef<ProductAddonsEditorHandle, Props>(
  function ProductAddonsEditor({ initial, productId, authToken }, ref) {
    const { theme } = useTheme();
    const styles = useMemo(() => makeStyles(theme), [theme]);
    const [groups, setGroups] = useState<GroupDraft[]>(() =>
      draftsFrom(initial),
    );
    const [dirty, setDirty] = useState(false);
    const [library, setLibrary] = useState<LibraryAddon[] | null>(null);
    const [libraryFor, setLibraryFor] = useState<string | null>(null);
    const [reviewBusy, setReviewBusy] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
      getSaveBody: () => (dirty ? saveBodyFrom(groups) : null),
    }));

    useEffect(() => {
      if (!libraryFor || library !== null || !authToken) return;
      let cancelled = false;
      getAddonLibrary(authToken)
        .then((list) => !cancelled && setLibrary(list))
        .catch(() => !cancelled && setLibrary([]));
      return () => {
        cancelled = true;
      };
    }, [libraryFor, library, authToken]);

    const change = (fn: (prev: GroupDraft[]) => GroupDraft[]) => {
      setDirty(true);
      setGroups(fn);
    };
    const patchGroup = (key: string, patch: Partial<GroupDraft>) =>
      change((prev) =>
        prev.map((g) => (g.key === key ? { ...g, ...patch } : g)),
      );
    const patchChoice = (
      gKey: string,
      cKey: string,
      patch: Partial<ChoiceDraft>,
    ) =>
      change((prev) =>
        prev.map((g) =>
          g.key === gKey
            ? {
                ...g,
                choices: g.choices.map((c) =>
                  c.key === cKey ? { ...c, ...patch } : c,
                ),
              }
            : g,
        ),
      );
    const addChoice = (gKey: string, choice: ChoiceDraft = draftChoice()) =>
      change((prev) =>
        prev.map((g) =>
          g.key === gKey ? { ...g, choices: [...g.choices, choice] } : g,
        ),
      );
    const removeChoice = (gKey: string, cKey: string) =>
      change((prev) =>
        prev.map((g) =>
          g.key === gKey
            ? { ...g, choices: g.choices.filter((c) => c.key !== cKey) }
            : g,
        ),
      );
    const removeGroup = (g: GroupDraft) => {
      const doRemove = () =>
        change((prev) => prev.filter((x) => x.key !== g.key));
      if (!g.id) return doRemove();
      Alert.alert(
        "Remove this group?",
        `${g.name || "This group"} and its choices come off this product when you save. Past orders keep what was bought.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Remove", style: "destructive", onPress: doRemove },
        ],
      );
    };

    // "Library price is now $X": Use = put the library price in the form (saved with the product).
    // Keep = remember the answer on the server now, so it isn't asked again for this price.
    const keepOwnPrice = async (c: ChoiceDraft, g: GroupDraft) => {
      if (!productId || !c.id) return;
      setReviewBusy(c.key);
      try {
        await api.reviewProductAddonPrice(authToken, productId, c.id, "keep");
        setGroups((prev) =>
          prev.map((x) =>
            x.key === g.key
              ? {
                  ...x,
                  choices: x.choices.map((y) =>
                    y.key === c.key ? { ...y, needsPriceReview: false } : y,
                  ),
                }
              : x,
          ),
        );
      } catch (e: any) {
        Alert.alert(
          "Couldn't save that",
          e?.body?.error?.message || e?.message || "Please try again.",
        );
      } finally {
        setReviewBusy(null);
      }
    };

    const pickFromLibrary = (g: GroupDraft, entry: LibraryAddon) => {
      addChoice(
        g.key,
        draftChoice({
          businessAddonId: entry.id,
          name: entry.name,
          priceInput: centsToInput(entry.priceCents),
          description: entry.description ?? "",
        }),
      );
      setLibraryFor(null);
    };

    return (
      <View style={styles.wrap}>
        <Text style={styles.help}>
          Add-ons are extras customers can add on top, like toppings or a name
          on the cake. Each one adds its price to the item.
        </Text>

        {groups.map((g, gi) => {
          const groupNames = new Set(
            g.choices.map((c) => c.name.trim().toLowerCase()),
          );
          const libraryChoices = (library ?? []).filter(
            (l) => !groupNames.has(l.name.trim().toLowerCase()),
          );
          return (
            <View
              key={g.key}
              style={[styles.card, !g.isActive && { opacity: 0.6 }]}
            >
              <View style={styles.cardHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.smallLabel}>GROUP {gi + 1}</Text>
                  <TextInput
                    value={g.name}
                    onChangeText={(name) => patchGroup(g.key, { name })}
                    placeholder="Group name, like Toppings"
                    placeholderTextColor={theme.brandTextDim}
                    style={styles.nameInput}
                    maxLength={60}
                    accessibilityLabel={`Group ${gi + 1} name`}
                  />
                </View>
                <Pressable
                  onPress={() => removeGroup(g)}
                  style={styles.iconBtn}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${g.name || `group ${gi + 1}`}`}
                >
                  <Feather
                    name="trash-2"
                    size={18}
                    color={theme.brandTextDim}
                  />
                </Pressable>
              </View>

              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>Required</Text>
                  <Text style={styles.sub}>
                    Customers must pick before they can buy
                  </Text>
                </View>
                <Switch
                  value={g.required}
                  onValueChange={(required) => patchGroup(g.key, { required })}
                  trackColor={{ true: theme.brandGold }}
                  accessibilityLabel="Required"
                />
              </View>

              <Text style={styles.smallLabel}>HOW MANY CAN THEY PICK</Text>
              <View style={styles.segment}>
                {RULES.map((r) => {
                  const on = g.rule === r.key;
                  return (
                    <Pressable
                      key={r.key}
                      onPress={() =>
                        patchGroup(g.key, {
                          rule: r.key,
                          upToInput:
                            r.key === "upTo" && !g.upToInput
                              ? "2"
                              : g.upToInput,
                        })
                      }
                      style={[styles.segmentBtn, on && styles.segmentOn]}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                    >
                      <Text
                        style={[styles.segmentText, on && styles.segmentTextOn]}
                      >
                        {r.label}
                      </Text>
                    </Pressable>
                  );
                })}
                {g.rule === "upTo" ? (
                  <TextInput
                    value={g.upToInput}
                    onChangeText={(t) =>
                      patchGroup(g.key, {
                        upToInput: t.replace(/[^0-9]/g, "").slice(0, 2),
                      })
                    }
                    keyboardType="number-pad"
                    style={styles.upToInput}
                    accessibilityLabel="Up to how many"
                  />
                ) : null}
              </View>

              {g.choices.map((c, ci) => (
                <View
                  key={c.key}
                  style={[styles.choice, !c.isActive && { opacity: 0.6 }]}
                >
                  <View style={styles.choiceRow}>
                    <TextInput
                      value={c.name}
                      onChangeText={(name) =>
                        patchChoice(g.key, c.key, { name })
                      }
                      placeholder={
                        ci === 0 ? "Choice, like Sprinkles" : "Choice name"
                      }
                      placeholderTextColor={theme.brandTextDim}
                      style={[styles.choiceName]}
                      maxLength={80}
                      accessibilityLabel={`Choice ${ci + 1} name`}
                    />
                    <View style={styles.priceBox}>
                      <Text style={styles.priceSign}>$</Text>
                      <TextInput
                        value={c.priceInput}
                        onChangeText={(t) =>
                          patchChoice(g.key, c.key, {
                            priceInput: t.replace(/[^0-9.]/g, ""),
                          })
                        }
                        placeholder="0.00"
                        placeholderTextColor={theme.brandTextDim}
                        keyboardType="decimal-pad"
                        style={styles.priceInput}
                        accessibilityLabel={`${c.name || `Choice ${ci + 1}`} price`}
                      />
                    </View>
                    <Pressable
                      onPress={() => removeChoice(g.key, c.key)}
                      style={styles.iconBtn}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${c.name || `choice ${ci + 1}`}`}
                    >
                      <Feather name="x" size={18} color={theme.brandTextDim} />
                    </Pressable>
                  </View>
                  {c.businessAddonId || c.id || !c.name.trim() ? null : (
                    <Text style={styles.sub}>
                      Saved to your add-on library too, so you can use it on
                      other items.
                    </Text>
                  )}

                  {c.needsPriceReview && c.libraryPriceCents !== null ? (
                    <View style={styles.note}>
                      <Text style={styles.noteText}>
                        Your library price for {c.name} is now{" "}
                        {money(c.libraryPriceCents)}. Use it here?
                      </Text>
                      <View style={styles.noteActions}>
                        <Pressable
                          onPress={() =>
                            patchChoice(g.key, c.key, {
                              priceInput: centsToInput(c.libraryPriceCents!),
                              needsPriceReview: false,
                            })
                          }
                          style={styles.noteBtn}
                          accessibilityRole="button"
                        >
                          <Text style={styles.noteBtnText}>
                            Use {money(c.libraryPriceCents)}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => keepOwnPrice(c, g)}
                          disabled={reviewBusy === c.key}
                          style={styles.noteBtn}
                          accessibilityRole="button"
                        >
                          {reviewBusy === c.key ? (
                            <ActivityIndicator
                              size="small"
                              color={theme.brandCream}
                            />
                          ) : (
                            <Text style={styles.noteBtnText}>
                              Keep{" "}
                              {c.priceInput ? `$${c.priceInput}` : "this price"}
                            </Text>
                          )}
                        </Pressable>
                      </View>
                    </View>
                  ) : null}

                  <View style={styles.switchRow}>
                    <Text style={[styles.sub, { flex: 1 }]}>
                      Customer types something (like a name)
                    </Text>
                    <Switch
                      value={c.acceptsText}
                      onValueChange={(acceptsText) =>
                        patchChoice(g.key, c.key, {
                          acceptsText,
                          textMaxInput:
                            acceptsText && !c.textMaxInput
                              ? String(DEFAULT_TEXT_LENGTH)
                              : c.textMaxInput,
                        })
                      }
                      trackColor={{ true: theme.brandGold }}
                      accessibilityLabel={`${c.name || "Choice"}: customer types something`}
                    />
                  </View>
                  {c.acceptsText ? (
                    <View style={styles.choiceRow}>
                      <TextInput
                        value={c.textLabel}
                        onChangeText={(textLabel) =>
                          patchChoice(g.key, c.key, { textLabel })
                        }
                        placeholder="What to ask, like Name on the cake"
                        placeholderTextColor={theme.brandTextDim}
                        style={styles.choiceName}
                        maxLength={60}
                        accessibilityLabel="What to ask the customer"
                      />
                      <View style={styles.priceBox}>
                        <TextInput
                          value={c.textMaxInput}
                          onChangeText={(t) =>
                            patchChoice(g.key, c.key, {
                              textMaxInput: t
                                .replace(/[^0-9]/g, "")
                                .slice(0, 3),
                            })
                          }
                          keyboardType="number-pad"
                          style={styles.priceInput}
                          accessibilityLabel="Letter limit"
                        />
                        <Text style={styles.priceSign}>letters</Text>
                      </View>
                    </View>
                  ) : null}

                  <View style={styles.switchRow}>
                    <Text style={[styles.sub, { flex: 1 }]}>
                      {c.isActive
                        ? "Customers can pick it"
                        : "Hidden from customers"}
                    </Text>
                    <Switch
                      value={c.isActive}
                      onValueChange={(isActive) =>
                        patchChoice(g.key, c.key, { isActive })
                      }
                      trackColor={{ true: theme.brandGold }}
                      accessibilityLabel={`${c.name || "Choice"} on`}
                    />
                  </View>
                </View>
              ))}

              <View style={styles.addRow}>
                {g.choices.length < MAX_CHOICES ? (
                  <Pressable
                    onPress={() => addChoice(g.key)}
                    style={styles.addBtn}
                    accessibilityRole="button"
                  >
                    <Feather name="plus" size={16} color={theme.brandGold} />
                    <Text style={styles.addText}>Add a choice</Text>
                  </Pressable>
                ) : null}
                {g.choices.length < MAX_CHOICES ? (
                  <Pressable
                    onPress={() =>
                      setLibraryFor(libraryFor === g.key ? null : g.key)
                    }
                    style={styles.addBtn}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: libraryFor === g.key }}
                  >
                    <Feather
                      name="book-open"
                      size={16}
                      color={theme.brandGold}
                    />
                    <Text style={styles.addText}>From your library</Text>
                  </Pressable>
                ) : null}
              </View>

              {libraryFor === g.key ? (
                <View style={styles.libraryList}>
                  {library === null ? (
                    <ActivityIndicator color={theme.brandGold} />
                  ) : libraryChoices.length === 0 ? (
                    <Text style={styles.sub}>
                      {library.length === 0
                        ? "Your library is empty. Choices you add here are saved to it."
                        : "Everything in your library is already in this group."}
                    </Text>
                  ) : (
                    libraryChoices.map((l) => (
                      <Pressable
                        key={l.id}
                        onPress={() => pickFromLibrary(g, l)}
                        style={styles.libraryRow}
                        accessibilityRole="button"
                        accessibilityLabel={`Add ${l.name}, ${money(l.priceCents)}`}
                      >
                        <Text style={[styles.rowTitle, { flex: 1 }]}>
                          {l.name}
                        </Text>
                        <Text style={styles.sub}>{money(l.priceCents)}</Text>
                        <Feather
                          name="plus-circle"
                          size={18}
                          color={theme.brandGold}
                        />
                      </Pressable>
                    ))
                  )}
                </View>
              ) : null}

              <View style={styles.switchRow}>
                <Text style={[styles.sub, { flex: 1 }]}>
                  {g.isActive
                    ? "Group is shown to customers"
                    : "Group is hidden"}
                </Text>
                <Switch
                  value={g.isActive}
                  onValueChange={(isActive) => patchGroup(g.key, { isActive })}
                  trackColor={{ true: theme.brandGold }}
                  accessibilityLabel={`${g.name || "Group"} shown`}
                />
              </View>
            </View>
          );
        })}

        {groups.length < MAX_GROUPS ? (
          <Pressable
            onPress={() => change((prev) => [...prev, draftGroup()])}
            style={[styles.addBtn, styles.addGroup]}
            accessibilityRole="button"
          >
            <Feather name="plus" size={16} color={theme.brandGold} />
            <Text style={styles.addText}>
              {groups.length === 0 ? "Add add-ons" : "Add another group"}
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  },
);

export default ProductAddonsEditor;

function makeStyles(theme: any) {
  return StyleSheet.create({
    wrap: { marginTop: 8, gap: 12 },
    help: { fontSize: 12, color: theme.brandTextDim, lineHeight: 17 },
    card: {
      backgroundColor: theme.brandSurface,
      borderWidth: 1,
      borderColor: theme.brandSurfaceBorder,
      borderRadius: 14,
      padding: 12,
      gap: 10,
    },
    cardHead: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    smallLabel: {
      fontSize: 11,
      letterSpacing: 0.5,
      color: theme.brandTextDim,
      marginBottom: 2,
    },
    nameInput: {
      minWidth: 0,
      color: theme.brandCream,
      fontSize: 16,
      fontWeight: "600",
      borderBottomWidth: 1,
      borderBottomColor: theme.brandSurfaceBorder,
      paddingVertical: 6,
    },
    iconBtn: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      minHeight: 44,
    },
    rowTitle: { fontSize: 15, fontWeight: "600", color: theme.brandCream },
    sub: { fontSize: 12, color: theme.brandTextDim, lineHeight: 16 },
    segment: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 8,
    },
    segmentBtn: {
      minHeight: 36,
      paddingHorizontal: 12,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.brandSurfaceBorder,
      justifyContent: "center",
    },
    segmentOn: {
      borderColor: theme.brandGold,
      backgroundColor: "rgba(232,185,48,0.14)",
    },
    segmentText: { fontSize: 14, color: theme.brandCream },
    segmentTextOn: { color: theme.brandGold, fontWeight: "700" },
    upToInput: {
      width: 56,
      minHeight: 36,
      borderWidth: 1,
      borderColor: theme.brandGold,
      borderRadius: 10,
      color: theme.brandCream,
      textAlign: "center",
      fontSize: 15,
    },
    choice: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.brandSurfaceBorder,
      paddingTop: 10,
      gap: 4,
    },
    choiceRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    choiceName: {
      flex: 1,
      minWidth: 0,
      color: theme.brandCream,
      fontSize: 15,
      borderBottomWidth: 1,
      borderBottomColor: theme.brandSurfaceBorder,
      paddingVertical: 6,
    },
    priceBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderBottomWidth: 1,
      borderBottomColor: theme.brandSurfaceBorder,
      width: 92,
      flexShrink: 0,
    },
    priceSign: { color: theme.brandTextDim, fontSize: 14 },
    priceInput: {
      flex: 1,
      minWidth: 0,
      color: theme.brandCream,
      fontSize: 15,
      paddingVertical: 6,
    },
    note: {
      borderRadius: 12,
      padding: 10,
      backgroundColor: "rgba(232,185,48,0.12)",
      gap: 8,
    },
    noteText: { fontSize: 13, color: theme.brandCream, lineHeight: 18 },
    noteActions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    noteBtn: {
      minHeight: 36,
      paddingHorizontal: 12,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.brandGold,
      justifyContent: "center",
    },
    noteBtnText: { color: theme.brandGold, fontSize: 13, fontWeight: "700" },
    addRow: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
    addBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      minHeight: 44,
    },
    addGroup: {
      justifyContent: "center",
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: theme.brandSurfaceBorder,
      borderRadius: 14,
    },
    addText: { color: theme.brandGold, fontSize: 14, fontWeight: "700" },
    libraryList: { gap: 4, paddingVertical: 4 },
    libraryRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      minHeight: 44,
    },
  });
}
