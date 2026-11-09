/**
 * Request forms, the business side (step F1, Nov 2026). Pure: no React Native, no network.
 * Tested in utils/requestFormEditor.test.ts.
 *
 * The backend has kept forms since Nov 4 (backend #408, server/requests/requestForms.ts). These checks match its
 * normalizeQuestions / checkResolvedLimits so vendors see a problem before saving; the backend checks again and
 * its message is shown as is.
 *
 * Legend 2026-11-08 (calls 5 to 8, all as recommended):
 *   - 6: a service picks "Base form", "A saved form" or "Just this service" (with a switch to put the base form's
 *        questions first). These map onto the backend settings { formId, useBase, questions }.
 *   - 7: a first base form starts with three ready questions the vendor can edit.
 * Copy uses commas and periods only.
 */
import type { RequestQuestion } from "./requestLogic";

export type QuestionType = RequestQuestion["type"];

export const FORM_MAX_QUESTIONS = 25;
export const FORM_MAX_NAME = 80;
export const MAX_LABEL = 200;
export const MAX_HELP = 300;
export const MAX_OPTIONS = 20;
export const MAX_OPTION = 100;
export const MAX_PHOTOS_PER_QUESTION = 5;
export const MAX_REQUIRED_PHOTO_QUESTIONS = 10;

export const QUESTION_TYPES: {
  type: QuestionType;
  label: string;
  sub: string;
}[] = [
  {
    type: "short_text",
    label: "Short answer",
    sub: "A few words, like a color or a size.",
  },
  {
    type: "long_text",
    label: "Long answer",
    sub: "A description in their own words.",
  },
  { type: "choice", label: "Choices", sub: "They pick from your options." },
  { type: "date", label: "Date", sub: "They pick a day on a calendar." },
  { type: "photos", label: "Photos", sub: "They add up to 5 photos." },
];

export function typeLabel(t: QuestionType): string {
  return QUESTION_TYPES.find((x) => x.type === t)?.label ?? "Question";
}

/** A question while it's being edited. `id` is kept from the saved form so old answers stay matched. */
export type DraftQuestion = {
  /** Local key for lists and edits; never sent. */
  key: string;
  id?: string;
  type: QuestionType;
  label: string;
  help: string;
  required: boolean;
  /** choice only: one line per option while editing */
  options: string[];
  multiple: boolean;
  /** photos only */
  maxPhotos: number;
};

let keySeq = 0;
export function newKey(): string {
  keySeq += 1;
  return `q${Date.now().toString(36)}${keySeq}`;
}

export function blankQuestion(type: QuestionType): DraftQuestion {
  return {
    key: newKey(),
    type,
    label: "",
    help: "",
    required: false,
    options: type === "choice" ? ["", ""] : [],
    multiple: false,
    maxPhotos: MAX_PHOTOS_PER_QUESTION,
  };
}

export function toDraft(q: RequestQuestion): DraftQuestion {
  return {
    key: newKey(),
    id: q.id,
    type: q.type,
    label: q.label,
    help: q.help ?? "",
    required: q.required === true,
    options: q.type === "choice" ? [...(q.options ?? [])] : [],
    multiple: q.multiple === true,
    maxPhotos:
      q.type === "photos"
        ? (q.maxPhotos ?? MAX_PHOTOS_PER_QUESTION)
        : MAX_PHOTOS_PER_QUESTION,
  };
}

/** Call 7: a first base form starts with these, all editable. */
export function starterQuestions(): DraftQuestion[] {
  return [
    {
      ...blankQuestion("long_text"),
      label: "What do you need done?",
      required: true,
    },
    {
      ...blankQuestion("date"),
      label: "When do you need it?",
      required: false,
    },
    {
      ...blankQuestion("photos"),
      label: "Photos that help explain it",
      help: "Optional. Inspiration, the space, or what needs fixing.",
      required: false,
      maxPhotos: 5,
    },
  ];
}

const clean = (s: string) => s.trim().replace(/\s+/g, " ");

/** The cleaned options of a choice question (blank and repeated lines dropped), as the backend keeps them. */
export function cleanOptions(options: string[]): string[] {
  const out: string[] = [];
  for (const o of options) {
    const v = clean(o);
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

export type Problem = { key?: string; message: string };

/** One question's problem, or null. `n` is its 1-based position for the message. */
export function questionProblem(q: DraftQuestion, n: number): string | null {
  const where = `Question ${n}`;
  const label = clean(q.label);
  if (!label) return `${where} needs a question`;
  if (label.length > MAX_LABEL)
    return `${where} is longer than ${MAX_LABEL} characters`;
  if (q.help.trim().length > MAX_HELP)
    return `${where} help text is longer than ${MAX_HELP} characters`;
  if (q.type === "choice") {
    if (q.options.some((o) => clean(o).length > MAX_OPTION)) {
      return `${where} has an option longer than ${MAX_OPTION} characters`;
    }
    const opts = cleanOptions(q.options);
    if (opts.length < 2) return `${where} needs at least two choices`;
    if (opts.length > MAX_OPTIONS)
      return `${where} can have up to ${MAX_OPTIONS} choices`;
  }
  if (q.type === "photos") {
    if (
      !Number.isInteger(q.maxPhotos) ||
      q.maxPhotos < 1 ||
      q.maxPhotos > MAX_PHOTOS_PER_QUESTION
    ) {
      return `${where} can ask for 1 to ${MAX_PHOTOS_PER_QUESTION} photos`;
    }
  }
  return null;
}

/** Limits that hold on what the customer answers (a combined form too). */
export function limitsProblem(
  questions: Pick<DraftQuestion, "type" | "required">[],
  countingBase = false,
): string | null {
  if (questions.length > FORM_MAX_QUESTIONS) {
    return `A form can have up to ${FORM_MAX_QUESTIONS} questions${countingBase ? ", counting the base form" : ""}`;
  }
  const requiredPhotos = questions.filter(
    (q) => q.type === "photos" && q.required,
  ).length;
  if (requiredPhotos > MAX_REQUIRED_PHOTO_QUESTIONS) {
    return `A form can require at most ${MAX_REQUIRED_PHOTO_QUESTIONS} photo questions, because a request holds up to ${MAX_REQUIRED_PHOTO_QUESTIONS} photos`;
  }
  return null;
}

/** Every problem in a form, in order. Empty = ready to save. */
export function formProblems(
  name: string | null,
  questions: DraftQuestion[],
): Problem[] {
  const out: Problem[] = [];
  if (name !== null) {
    const n = clean(name);
    if (!n) out.push({ message: "Give the form a name" });
    else if (n.length > FORM_MAX_NAME)
      out.push({
        message: `The name can be up to ${FORM_MAX_NAME} characters`,
      });
  }
  questions.forEach((q, i) => {
    const p = questionProblem(q, i + 1);
    if (p) out.push({ key: q.key, message: p });
  });
  const lim = limitsProblem(questions);
  if (lim) out.push({ message: lim });
  return out;
}

/** What the backend takes for one question. */
export function toWire(q: DraftQuestion): RequestQuestion {
  const out: RequestQuestion = {
    id: q.id ?? "",
    type: q.type,
    label: clean(q.label),
    required: q.required,
  };
  if (!q.id) delete (out as { id?: string }).id;
  const help = q.help.trim();
  if (help) out.help = help;
  if (q.type === "choice") {
    out.options = cleanOptions(q.options);
    out.multiple = q.multiple;
  }
  if (q.type === "photos") out.maxPhotos = q.maxPhotos;
  return out;
}

export function moveQuestion<T>(list: T[], index: number, by: -1 | 1): T[] {
  const to = index + by;
  if (index < 0 || index >= list.length || to < 0 || to >= list.length)
    return list;
  const next = [...list];
  const [item] = next.splice(index, 1);
  next.splice(to, 0, item);
  return next;
}

/** One line for a question in a list: "Choices · Required · 3 options". */
export function questionSummary(
  q: Pick<
    RequestQuestion,
    "type" | "required" | "options" | "multiple" | "maxPhotos"
  >,
): string {
  const parts = [typeLabel(q.type), q.required ? "Required" : "Optional"];
  if (q.type === "choice") {
    const n = q.options?.length ?? 0;
    parts.push(
      `${n} option${n === 1 ? "" : "s"}${q.multiple ? ", pick several" : ""}`,
    );
  }
  if (q.type === "photos")
    parts.push(`Up to ${q.maxPhotos ?? MAX_PHOTOS_PER_QUESTION}`);
  return parts.join(" · ");
}

// ─── A service's form (call 6) ──────────────────────────────────────────────

export type ServiceFormSettings = {
  formId: string | null;
  useBase: boolean;
  questions: RequestQuestion[];
};
export type ServiceFormChoice = "base" | "saved" | "own";

/** How the editor shows stored settings. Nothing set yet reads as the base form when there is one. */
export function choiceOf(
  s: ServiceFormSettings,
  hasBase: boolean,
): { choice: ServiceFormChoice; withBase: boolean } {
  if (s.formId) return { choice: "saved", withBase: false };
  if (s.questions.length > 0) return { choice: "own", withBase: s.useBase };
  if (s.useBase || hasBase) return { choice: "base", withBase: false };
  return { choice: "own", withBase: false };
}

/** The settings to save for a choice. */
export function settingsFor(
  choice: ServiceFormChoice,
  opts: { formId: string | null; withBase: boolean; own: RequestQuestion[] },
): ServiceFormSettings {
  if (choice === "saved")
    return { formId: opts.formId, useBase: false, questions: [] };
  if (choice === "base") return { formId: null, useBase: true, questions: [] };
  return { formId: null, useBase: opts.withBase, questions: opts.own };
}

/** A problem with a service's choice before saving, or null. */
export function serviceChoiceProblem(
  choice: ServiceFormChoice,
  opts: {
    formId: string | null;
    hasBase: boolean;
    withBase: boolean;
    own: Pick<DraftQuestion, "type" | "required">[];
    baseQuestions: Pick<DraftQuestion, "type" | "required">[];
  },
): string | null {
  if (choice === "saved" && !opts.formId) return "Choose a saved form";
  if (choice === "base" && !opts.hasBase)
    return "Make a base form first, or choose another option";
  if (choice === "own") {
    // F2b (call 9): with nothing saved, the backend asks the base form, so "just this service" needs a question
    // of its own (or the base form first) to mean what it says.
    if (!opts.withBase && opts.own.length === 0)
      return "Add at least one question, or pick Your base form";
    const combined = [
      ...(opts.withBase ? opts.baseQuestions : []),
      ...opts.own,
    ];
    return limitsProblem(combined, opts.withBase);
  }
  return null;
}
