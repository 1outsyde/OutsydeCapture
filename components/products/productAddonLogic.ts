/**
 * Product add-ons (backend #371 / #373, migration 075): pure logic for the customer picker on the
 * product page, the cart line, checkout, and the business editor in the product form.
 *
 *   npx tsx components/products/productAddonLogic.test.ts
 *
 * The rules mirror server/productAddons.ts so the app catches a problem before checkout does:
 *  - a group with minSelect > 0 is required; maxSelect null = no limit
 *  - a choice that takes text (name frosting) needs that text, up to textMaxLength characters
 *  - per unit price = product (or variation) price + every picked choice
 */

// ── Shapes from the backend ─────────────────────────────────────────────────

/** GET /api/products/:id → addonGroups[] (only groups and choices that are on). */
export interface PublicAddon {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  acceptsText: boolean;
  textLabel: string | null;
  textMaxLength: number;
}
export interface PublicAddonGroup {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number | null;
  required: boolean;
  addons: PublicAddon[];
}

/** GET/PUT /api/business/products/:id/addons → groups[] (switched-off ones included). */
export interface VendorAddonChoice {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  acceptsText: boolean;
  textLabel: string | null;
  textMaxLength: number;
  isActive: boolean;
  businessAddonId: string | null;
  priceSynced: boolean;
  libraryPriceCents: number | null;
  needsPriceReview: boolean;
}
export interface VendorAddonGroup {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number | null;
  isActive: boolean;
  addons: VendorAddonChoice[];
}

/** What a cart line keeps for each picked choice (also shown on the cart and checkout). */
export interface CartAddon {
  addonId: string;
  groupName: string;
  name: string;
  priceCents: number;
  text?: string;
}

// ── Limits (same as the backend) ────────────────────────────────────────────
export const MAX_GROUPS = 10;
export const MAX_CHOICES = 30;
export const MAX_SELECT = 20;
export const MAX_GROUP_NAME = 60;
export const MAX_CHOICE_NAME = 80;
export const MAX_TEXT_LABEL = 60;
export const MAX_TEXT_LENGTH = 200;
export const DEFAULT_TEXT_LENGTH = 40;
export const MAX_PRICE_CENTS = 100_000;

/** Same as the backend's cleanText: no line breaks or control characters, single spaces, trimmed. */
export function cleanText(v: string): string {
  return v
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Customer picker ─────────────────────────────────────────────────────────

/** Picked choice ids, and the text typed for choices that take text. */
export interface AddonPicks {
  ids: string[];
  text: Record<string, string>;
}
export const emptyPicks = (): AddonPicks => ({ ids: [], text: {} });

const groupOf = (groups: PublicAddonGroup[], addonId: string) =>
  groups.find((g) => g.addons.some((a) => a.id === addonId));

export function countInGroup(
  group: PublicAddonGroup,
  picks: AddonPicks,
): number {
  return group.addons.filter((a) => picks.ids.includes(a.id)).length;
}

/**
 * Tap a choice. Picked → unpicked. A pick-one group swaps its choice. A group at its limit
 * stays as it is (limitReached tells the screen to say so).
 */
export function togglePick(
  groups: PublicAddonGroup[],
  picks: AddonPicks,
  addonId: string,
): { picks: AddonPicks; limitReached: boolean } {
  const group = groupOf(groups, addonId);
  if (!group) return { picks, limitReached: false };
  if (picks.ids.includes(addonId)) {
    return {
      picks: { ...picks, ids: picks.ids.filter((id) => id !== addonId) },
      limitReached: false,
    };
  }
  if (group.maxSelect === 1) {
    const others = new Set(group.addons.map((a) => a.id));
    return {
      picks: {
        ...picks,
        ids: [...picks.ids.filter((id) => !others.has(id)), addonId],
      },
      limitReached: false,
    };
  }
  if (
    group.maxSelect !== null &&
    countInGroup(group, picks) >= group.maxSelect
  ) {
    return { picks, limitReached: true };
  }
  return {
    picks: { ...picks, ids: [...picks.ids, addonId] },
    limitReached: false,
  };
}

export function setPickText(
  picks: AddonPicks,
  addonId: string,
  text: string,
): AddonPicks {
  return { ...picks, text: { ...picks.text, [addonId]: text } };
}

/** "Pick 1", "Pick up to 3", "Pick at least 2", "Pick 2 to 4", "Optional". */
export function groupHint(
  group: Pick<PublicAddonGroup, "minSelect" | "maxSelect">,
): string {
  const { minSelect: min, maxSelect: max } = group;
  if (min === 0) {
    if (max === 1) return "Optional, pick 1";
    if (max !== null) return `Optional, up to ${max}`;
    return "Optional";
  }
  if (max === min) return `Pick ${min}`;
  if (max === null)
    return min === 1 ? "Pick at least 1" : `Pick at least ${min}`;
  return `Pick ${min} to ${max}`;
}

/**
 * First thing the customer still has to do, or null when the picks can go to checkout.
 * Same checks and order as the backend (text first, then each group's limits).
 */
export function missingPick(
  groups: PublicAddonGroup[],
  picks: AddonPicks,
): string | null {
  for (const g of groups) {
    for (const a of g.addons) {
      if (!picks.ids.includes(a.id) || !a.acceptsText) continue;
      const text = cleanText(picks.text[a.id] ?? "");
      const what = a.textLabel || a.name;
      if (!text) return `Fill in ${what}`;
      if ([...text].length > a.textMaxLength)
        return `${what} can be up to ${a.textMaxLength} characters`;
    }
  }
  for (const g of groups) {
    const count = countInGroup(g, picks);
    if (g.maxSelect !== null && count > g.maxSelect)
      return `${g.name}: pick up to ${g.maxSelect}`;
    if (count < g.minSelect)
      return g.minSelect === 1
        ? `Choose ${g.name.toLowerCase()}`
        : `${g.name}: pick at least ${g.minSelect}`;
  }
  return null;
}

/** Picked choices in group order then choice order (the order the backend stores them in). */
export function pickedAddons(
  groups: PublicAddonGroup[],
  picks: AddonPicks,
): CartAddon[] {
  const out: CartAddon[] = [];
  for (const g of groups) {
    for (const a of g.addons) {
      if (!picks.ids.includes(a.id)) continue;
      out.push({
        addonId: a.id,
        groupName: g.name,
        name: a.name,
        priceCents: a.priceCents,
        ...(a.acceptsText ? { text: cleanText(picks.text[a.id] ?? "") } : {}),
      });
    }
  }
  return out;
}

export const addonsPerUnitCents = (addons: CartAddon[] | undefined): number =>
  (addons ?? []).reduce((sum, a) => sum + a.priceCents, 0);

/** Same as the backend's addonsLabel, e.g. `Sprinkles, Name frosting: "Happy 5th Mia"`. */
export function addonsLabel(addons: CartAddon[] | undefined): string {
  return (addons ?? [])
    .map((a) => (a.text !== undefined ? `${a.name}: "${a.text}"` : a.name))
    .join(", ");
}

/** What a checkout line sends as `addons` (the backend prices them from the database). */
export function checkoutAddons(
  addons: CartAddon[],
): { addonId: string; text?: string }[] {
  return addons.map((a) =>
    a.text !== undefined
      ? { addonId: a.addonId, text: a.text }
      : { addonId: a.addonId },
  );
}

/**
 * Cart line identity. Lines without an addons list keep the key carts were saved with before
 * add-ons, so a saved cart still matches. Two cakes with different add-ons are two lines.
 */
export function cartLineKey(
  productId: string,
  variantId?: string,
  addons?: CartAddon[],
): string {
  const base = `${productId}::${variantId ?? ""}`;
  if (addons === undefined) return base;
  const sig = [...addons]
    .map((a) => `${a.addonId}=${a.text ?? ""}`)
    .sort()
    .join("|");
  return `${base}::+${sig}`;
}

/** Variation and add-ons for one line of a cart, checkout or order, e.g. `Pink · Sprinkles`. */
export function lineDetail(
  variantLabel?: string | null,
  addonsText?: string | null,
): string | null {
  const parts = [variantLabel, addonsText].filter(
    (p): p is string => typeof p === "string" && p.trim().length > 0,
  );
  return parts.length > 0 ? parts.join(" · ") : null;
}

// ── Business editor ─────────────────────────────────────────────────────────

export type PickRule = "one" | "any" | "upTo";

export interface ChoiceDraft {
  key: string;
  id: string | null;
  businessAddonId: string | null;
  name: string;
  priceInput: string;
  description: string;
  acceptsText: boolean;
  textLabel: string;
  textMaxInput: string;
  isActive: boolean;
  /** From the server: library price changed and this choice kept its own price. */
  needsPriceReview: boolean;
  libraryPriceCents: number | null;
}

export interface GroupDraft {
  key: string;
  id: string | null;
  name: string;
  required: boolean;
  rule: PickRule;
  upToInput: string;
  isActive: boolean;
  choices: ChoiceDraft[];
}

let keySeq = 0;
export const newKey = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${(keySeq++).toString(36)}`;

export const centsToInput = (cents: number): string =>
  cents > 0 ? (cents / 100).toFixed(2) : "";

/** Dollars typed → cents. "" = $0 (free choice). null = not a valid price. */
export function priceInputToCents(input: string): number | null {
  const t = input.trim().replace(/^\$/, "");
  if (t === "") return 0;
  if (!/^\d+(\.\d{0,2})?$/.test(t)) return null;
  const cents = Math.round(parseFloat(t) * 100);
  return cents >= 0 && cents <= MAX_PRICE_CENTS ? cents : null;
}

export function ruleOf(
  minSelect: number,
  maxSelect: number | null,
): { required: boolean; rule: PickRule; upToInput: string } {
  const required = minSelect > 0;
  if (maxSelect === 1) return { required, rule: "one", upToInput: "" };
  if (maxSelect === null) return { required, rule: "any", upToInput: "" };
  return { required, rule: "upTo", upToInput: String(maxSelect) };
}

export function draftChoice(partial: Partial<ChoiceDraft> = {}): ChoiceDraft {
  return {
    key: newKey("c"),
    id: null,
    businessAddonId: null,
    name: "",
    priceInput: "",
    description: "",
    acceptsText: false,
    textLabel: "",
    textMaxInput: "",
    isActive: true,
    needsPriceReview: false,
    libraryPriceCents: null,
    ...partial,
  };
}

export function draftGroup(partial: Partial<GroupDraft> = {}): GroupDraft {
  return {
    key: newKey("g"),
    id: null,
    name: "",
    required: false,
    rule: "any",
    upToInput: "",
    isActive: true,
    choices: [draftChoice()],
    ...partial,
  };
}

export function draftsFrom(
  groups: VendorAddonGroup[] | null | undefined,
): GroupDraft[] {
  return (groups ?? []).map((g) => ({
    key: newKey("g"),
    id: g.id,
    name: g.name,
    ...ruleOf(g.minSelect, g.maxSelect),
    isActive: g.isActive,
    choices: g.addons.map((a) =>
      draftChoice({
        id: a.id,
        businessAddonId: a.businessAddonId,
        name: a.name,
        priceInput: centsToInput(a.priceCents),
        description: a.description ?? "",
        acceptsText: a.acceptsText,
        textLabel: a.textLabel ?? "",
        textMaxInput: a.acceptsText ? String(a.textMaxLength) : "",
        isActive: a.isActive,
        needsPriceReview: a.needsPriceReview,
        libraryPriceCents: a.libraryPriceCents,
      }),
    ),
  }));
}

export interface SaveAddonChoice {
  id?: string;
  businessAddonId?: string;
  name: string;
  description: string | null;
  priceCents: number;
  acceptsText: boolean;
  textLabel?: string | null;
  textMaxLength?: number;
  isActive: boolean;
}
export interface SaveAddonGroup {
  id?: string;
  name: string;
  minSelect: number;
  maxSelect: number | null;
  isActive: boolean;
  addons: SaveAddonChoice[];
}

/**
 * Drafts → PUT body, with the backend's checks so the business sees the problem in the form.
 * A group with no name and only empty choices is dropped (an untouched "Add a group").
 */
export function saveBodyFrom(
  drafts: GroupDraft[],
): { error: string } | { body: { groups: SaveAddonGroup[] } } {
  const isBlankChoice = (c: ChoiceDraft) =>
    !c.id && !cleanText(c.name) && c.priceInput.trim() === "";
  const used = drafts.filter(
    (g) =>
      g.id || cleanText(g.name) || g.choices.some((c) => !isBlankChoice(c)),
  );
  if (used.length > MAX_GROUPS)
    return { error: `A product can have up to ${MAX_GROUPS} add-on groups` };

  const groups: SaveAddonGroup[] = [];
  for (const g of used) {
    const name = cleanText(g.name);
    if (!name)
      return { error: "Every add-on group needs a name, like Toppings" };
    if (name.length > MAX_GROUP_NAME)
      return { error: `Group names can be up to ${MAX_GROUP_NAME} characters` };
    const choices = g.choices.filter((c) => !isBlankChoice(c));
    if (choices.length === 0)
      return { error: `${name}: add at least one choice` };
    if (choices.length > MAX_CHOICES)
      return { error: `${name}: up to ${MAX_CHOICES} choices per group` };

    const seen = new Set<string>();
    const addons: SaveAddonChoice[] = [];
    for (const c of choices) {
      const cName = cleanText(c.name);
      if (!cName) return { error: `${name}: every choice needs a name` };
      if (cName.length > MAX_CHOICE_NAME)
        return {
          error: `${name}: choice names can be up to ${MAX_CHOICE_NAME} characters`,
        };
      if (seen.has(cName.toLowerCase()))
        return { error: `${name}: "${cName}" is listed twice` };
      seen.add(cName.toLowerCase());
      const priceCents = priceInputToCents(c.priceInput);
      if (priceCents === null)
        return {
          error: `${cName}: enter a price like 5 or 5.50 (up to $${MAX_PRICE_CENTS / 100})`,
        };
      const choice: SaveAddonChoice = {
        ...(c.id
          ? { id: c.id }
          : c.businessAddonId
            ? { businessAddonId: c.businessAddonId }
            : {}),
        name: cName,
        description: c.description.trim() || null,
        priceCents,
        acceptsText: c.acceptsText,
        isActive: c.isActive,
      };
      if (c.acceptsText) {
        const label = cleanText(c.textLabel);
        if (label.length > MAX_TEXT_LABEL)
          return {
            error: `${cName}: the box name can be up to ${MAX_TEXT_LABEL} characters`,
          };
        const maxRaw = c.textMaxInput.trim();
        const max = maxRaw === "" ? DEFAULT_TEXT_LENGTH : Number(maxRaw);
        if (!Number.isInteger(max) || max < 1 || max > MAX_TEXT_LENGTH) {
          return {
            error: `${cName}: the letter limit must be 1 to ${MAX_TEXT_LENGTH}`,
          };
        }
        choice.textLabel = label || null;
        choice.textMaxLength = max;
      }
      addons.push(choice);
    }

    let maxSelect: number | null;
    if (g.rule === "one") maxSelect = 1;
    else if (g.rule === "any") maxSelect = null;
    else {
      const n = Number(g.upToInput.trim());
      if (!Number.isInteger(n) || n < 1 || n > MAX_SELECT)
        return { error: `${name}: "up to" must be 1 to ${MAX_SELECT}` };
      maxSelect = n;
    }
    const minSelect = g.required ? 1 : 0;
    const onCount = addons.filter((a) => a.isActive).length;
    if (g.isActive && minSelect > onCount)
      return {
        error: `${name}: it's required, so turn on at least one choice`,
      };

    groups.push({
      ...(g.id ? { id: g.id } : {}),
      name,
      minSelect,
      maxSelect,
      isActive: g.isActive,
      addons,
    });
  }
  return { body: { groups } };
}
