/**
 * Pure logic for the product options editor (no React, no network), so it can
 * be tested directly: npx tsx components/products/productOptionsLogic.test.ts
 * The server rules it mirrors live in outsyde-backend server/productOptions.ts.
 */
import type {
  EditorVariant,
  ProductOptionValue,
  ProductOptionsResponse,
  SaveProductOptionsBody,
} from "@/services/api";

export const MAX_OPTIONS = 3;
export const MAX_VARIATIONS = 250;
export const MAX_NAME = 40;

export const QUICK_FILLS: {
  label: string;
  name: string;
  values: string[];
}[] = [
  { label: "S to XL", name: "Size", values: ["S", "M", "L", "XL"] },
  {
    label: 'Inches 12" to 32"',
    name: "Length",
    values: [12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32].map((n) => `${n}"`),
  },
  {
    label: "Shoe sizes 6 to 12",
    name: "Size",
    values: ["6", "7", "8", "9", "10", "11", "12"],
  },
];

export interface OptionDraft {
  key: string;
  name: string;
  values: ProductOptionValue[];
  newValue: string;
}
export interface RowDraft {
  id?: string;
  priceInput: string; // "" = product price
  stockInput: string; // "" = product stock
  isActive: boolean;
  imageUrl: string | null;
}

export const norm = (s: string) => s.trim().replace(/\s+/g, " ");
export const keyOf = (values: string[]) =>
  values.map((v) => v.toLowerCase()).join("\u0000");
export const centsToInput = (c: number) => (c / 100).toFixed(2);
export const formatCents = (c: number) => `$${(c / 100).toFixed(2)}`;
let keySeq = 0;
export const newKey = () => `opt-${Date.now()}-${keySeq++}`;

export function cartesian(lists: string[][]): string[][] {
  return lists.reduce<string[][]>(
    (acc, list) => acc.flatMap((prefix) => list.map((v) => [...prefix, v])),
    [[]],
  );
}

/** Editor state from GET /api/business/products/:id/options (null = new product). */
export function initialState(initial: ProductOptionsResponse | null): {
  options: OptionDraft[];
  rows: Record<string, RowDraft>;
  legacyLabels: string[];
} {
  if (!initial) return { options: [], rows: {}, legacyLabels: [] };
  const options = [...initial.options]
    .sort((a, b) => a.position - b.position)
    .map((o) => ({
      key: newKey(),
      name: o.name,
      values: o.values ?? [],
      newValue: "",
    }));
  const rows: Record<string, RowDraft> = {};
  const legacyLabels: string[] = [];
  for (const v of initial.variants as EditorVariant[]) {
    const picked = [v.option1, v.option2, v.option3].filter(
      (x): x is string => !!x,
    );
    if (picked.length === 0) {
      if (v.isActive) legacyLabels.push(v.label);
      continue;
    }
    rows[keyOf(picked)] = {
      id: v.id,
      priceInput: v.hasOwnPrice ? centsToInput(v.priceCents) : "",
      stockInput:
        v.inventory === null || v.inventory === undefined
          ? ""
          : String(v.inventory),
      isActive: v.isActive !== false,
      imageUrl: v.imageUrl ?? null,
    };
  }
  return { options, rows, legacyLabels };
}

const emptyRow = (): RowDraft => ({
  priceInput: "",
  stockInput: "",
  isActive: true,
  imageUrl: null,
});

/** Options that count: a name and at least one value. */
export function liveOptionsOf(options: OptionDraft[]): OptionDraft[] {
  return options.filter((o) => norm(o.name) && o.values.length > 0);
}

/** Every combination of the live options' values, in option order. */
export function combosOf(options: OptionDraft[]): string[][] {
  const live = liveOptionsOf(options);
  return live.length > 0
    ? cartesian(live.map((o) => o.values.map((v) => v.value)))
    : [];
}

/**
 * The body for PUT /api/business/products/:id/options, or a message to show.
 * Blank price → null (product price); blank stock → null (product stock).
 */
export function buildSaveBody(
  options: OptionDraft[],
  rows: Record<string, RowDraft>,
): { error: string } | { body: SaveProductOptionsBody } {
  const named = options.filter((o) => norm(o.name) || o.values.length > 0);
  for (const o of named) {
    if (!norm(o.name))
      return { error: "Give every option a name, like Size or Color." };
    if (o.values.length === 0)
      return { error: `Add at least one ${norm(o.name)}.` };
  }
  const names = named.map((o) => norm(o.name).toLowerCase());
  if (new Set(names).size !== names.length)
    return { error: "Two options have the same name." };
  const combos = combosOf(named);
  if (combos.length > MAX_VARIATIONS)
    return {
      error: `That makes ${combos.length} variations. The limit is ${MAX_VARIATIONS}.`,
    };

  const variants: SaveProductOptionsBody["variants"] = [];
  for (const c of combos) {
    const r = rows[keyOf(c)] ?? emptyRow();
    let priceCents: number | null = null;
    if (r.priceInput.trim() !== "") {
      const n = Number(r.priceInput);
      if (!Number.isFinite(n) || n <= 0)
        return { error: `Check the price for ${c.join(" / ")}.` };
      priceCents = Math.round(n * 100);
    }
    let inventory: number | null = null;
    if (r.stockInput.trim() !== "") {
      const n = Number(r.stockInput);
      if (!Number.isInteger(n) || n < 0)
        return { error: `Check the stock for ${c.join(" / ")}.` };
      inventory = n;
    }
    variants.push({
      ...(r.id ? { id: r.id } : {}),
      option1: c[0] ?? null,
      option2: c[1] ?? null,
      option3: c[2] ?? null,
      priceCents,
      inventory,
      imageUrl: r.imageUrl,
      isActive: r.isActive,
    });
  }
  return {
    body: {
      options: named.map((o) => ({ name: norm(o.name), values: o.values })),
      variants,
    },
  };
}
