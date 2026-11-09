import test from "node:test";
import assert from "node:assert/strict";
import {
  FORM_MAX_QUESTIONS,
  blankQuestion,
  choiceOf,
  cleanOptions,
  formProblems,
  limitsProblem,
  moveQuestion,
  questionProblem,
  questionSummary,
  serviceChoiceProblem,
  settingsFor,
  starterQuestions,
  toDraft,
  toWire,
} from "./requestFormEditor";

const q = (
  over: Partial<ReturnType<typeof blankQuestion>> & {
    type?: Parameters<typeof blankQuestion>[0];
  },
) => ({
  ...blankQuestion(over.type ?? "short_text"),
  label: "What color?",
  ...over,
});

test("limits match the backend (25 questions, 10 required photo questions)", () => {
  assert.equal(FORM_MAX_QUESTIONS, 25);
  assert.equal(limitsProblem(Array.from({ length: 25 }, () => q({}))), null);
  assert.match(
    limitsProblem(Array.from({ length: 26 }, () => q({})))!,
    /up to 25 questions/,
  );
  assert.match(
    limitsProblem(
      Array.from({ length: 26 }, () => q({})),
      true,
    )!,
    /counting the base form/,
  );
  const photos = Array.from({ length: 11 }, () =>
    q({ type: "photos", required: true }),
  );
  assert.match(limitsProblem(photos)!, /at most 10 photo questions/);
  assert.equal(
    limitsProblem(photos.map((p) => ({ ...p, required: false }))),
    null,
  );
});

test("each question needs words, and choices need two options", () => {
  assert.equal(questionProblem(q({}), 1), null);
  assert.equal(
    questionProblem(q({ label: "   " }), 2),
    "Question 2 needs a question",
  );
  assert.match(
    questionProblem(q({ label: "x".repeat(201) }), 1)!,
    /longer than 200/,
  );
  assert.match(questionProblem(q({ help: "x".repeat(301) }), 1)!, /help text/);
  assert.equal(
    questionProblem(q({ type: "choice", options: ["Red", " "] }), 3),
    "Question 3 needs at least two choices",
  );
  assert.equal(
    questionProblem(q({ type: "choice", options: ["Red", "Red ", " Red"] }), 1),
    "Question 1 needs at least two choices",
  );
  assert.equal(
    questionProblem(q({ type: "choice", options: ["Red", "Blue"] }), 1),
    null,
  );
  assert.match(
    questionProblem(
      q({
        type: "choice",
        options: Array.from({ length: 21 }, (_, i) => `O${i}`),
      }),
      1,
    )!,
    /up to 20 choices/,
  );
  assert.match(
    questionProblem(q({ type: "choice", options: ["x".repeat(101), "B"] }), 1)!,
    /option longer than 100/,
  );
  assert.match(
    questionProblem(q({ type: "photos", maxPhotos: 6 }), 1)!,
    /1 to 5 photos/,
  );
  assert.match(
    questionProblem(q({ type: "photos", maxPhotos: 0 }), 1)!,
    /1 to 5 photos/,
  );
});

test("cleanOptions trims, drops blanks and repeats", () => {
  assert.deepEqual(
    cleanOptions(["  Red ", "", "Blue", "Red", "Light   blue"]),
    ["Red", "Blue", "Light blue"],
  );
});

test("formProblems checks the name and every question", () => {
  assert.deepEqual(formProblems("Knotless braids", [q({})]), []);
  assert.equal(formProblems("  ", [q({})])[0].message, "Give the form a name");
  assert.match(formProblems("x".repeat(81), [])[0].message, /80 characters/);
  const bad = q({ label: "" });
  const probs = formProblems(null, [q({}), bad]);
  assert.equal(probs.length, 1);
  assert.equal(probs[0].key, bad.key);
});

test("toWire sends what the backend keeps, and keeps saved ids", () => {
  assert.deepEqual(
    toWire(
      q({ label: "  What   color? ", help: " Pick one ", required: true }),
    ),
    {
      type: "short_text",
      label: "What color?",
      required: true,
      help: "Pick one",
    },
  );
  const choice = toWire(
    q({
      id: "abc12345",
      type: "choice",
      options: ["Red", "", "Blue"],
      multiple: true,
    }),
  );
  assert.deepEqual(choice, {
    id: "abc12345",
    type: "choice",
    label: "What color?",
    required: false,
    options: ["Red", "Blue"],
    multiple: true,
  });
  assert.deepEqual(toWire(q({ type: "photos", maxPhotos: 3 })).maxPhotos, 3);
  assert.equal("options" in toWire(q({ type: "date" })), false);
});

test("toDraft and back keeps a saved question the same", () => {
  const saved = {
    id: "k9",
    type: "choice" as const,
    label: "Length",
    required: true,
    options: ["Short", "Long"],
    multiple: false,
    help: "Pick one",
  };
  assert.deepEqual(toWire(toDraft(saved)), saved);
  const photo = {
    id: "p1",
    type: "photos" as const,
    label: "Photos",
    required: false,
    maxPhotos: 2,
  };
  assert.deepEqual(toWire(toDraft(photo)), photo);
});

test("the starter base form is valid and editable", () => {
  const s = starterQuestions();
  assert.equal(s.length, 3);
  assert.deepEqual(
    s.map((x) => x.type),
    ["long_text", "date", "photos"],
  );
  assert.deepEqual(formProblems("Base form", s), []);
  assert.equal(new Set(s.map((x) => x.key)).size, 3);
});

test("moveQuestion moves up and down and ignores the ends", () => {
  assert.deepEqual(moveQuestion(["a", "b", "c"], 1, -1), ["b", "a", "c"]);
  assert.deepEqual(moveQuestion(["a", "b", "c"], 1, 1), ["a", "c", "b"]);
  const same = ["a", "b"];
  assert.equal(moveQuestion(same, 0, -1), same);
  assert.equal(moveQuestion(same, 1, 1), same);
});

test("questionSummary reads plainly", () => {
  assert.equal(
    questionSummary({
      type: "choice",
      required: true,
      options: ["A", "B", "C"],
      multiple: true,
    }),
    "Choices · Required · 3 options, pick several",
  );
  assert.equal(
    questionSummary({ type: "photos", required: false, maxPhotos: 3 }),
    "Photos · Optional · Up to 3",
  );
  assert.equal(
    questionSummary({ type: "long_text", required: false }),
    "Long answer · Optional",
  );
});

test("a service's stored settings map to the three choices and back", () => {
  assert.deepEqual(
    choiceOf({ formId: "f1", useBase: false, questions: [] }, true),
    { choice: "saved", withBase: false },
  );
  assert.deepEqual(
    choiceOf({ formId: null, useBase: true, questions: [] }, true),
    { choice: "base", withBase: false },
  );
  const own = [
    { id: "a", type: "short_text" as const, label: "Size", required: false },
  ];
  assert.deepEqual(
    choiceOf({ formId: null, useBase: true, questions: own }, true),
    { choice: "own", withBase: true },
  );
  assert.deepEqual(
    choiceOf({ formId: null, useBase: false, questions: own }, true),
    { choice: "own", withBase: false },
  );
  // Nothing set yet: the base form when there is one, else the service's own (empty = contact details only).
  assert.deepEqual(
    choiceOf({ formId: null, useBase: false, questions: [] }, true),
    { choice: "base", withBase: false },
  );
  assert.deepEqual(
    choiceOf({ formId: null, useBase: false, questions: [] }, false),
    { choice: "own", withBase: false },
  );

  assert.deepEqual(
    settingsFor("saved", { formId: "f1", withBase: true, own }),
    { formId: "f1", useBase: false, questions: [] },
  );
  assert.deepEqual(
    settingsFor("base", { formId: "f1", withBase: false, own }),
    { formId: null, useBase: true, questions: [] },
  );
  assert.deepEqual(settingsFor("own", { formId: "f1", withBase: true, own }), {
    formId: null,
    useBase: true,
    questions: own,
  });
});

test("a service's choice is checked before saving", () => {
  const none: never[] = [];
  assert.equal(
    serviceChoiceProblem("saved", {
      formId: null,
      hasBase: true,
      withBase: false,
      own: none,
      baseQuestions: none,
    }),
    "Choose a saved form",
  );
  assert.match(
    serviceChoiceProblem("base", {
      formId: null,
      hasBase: false,
      withBase: false,
      own: none,
      baseQuestions: none,
    })!,
    /base form first/,
  );
  const twenty = Array.from({ length: 20 }, () => ({
    type: "short_text" as const,
    required: false,
  }));
  assert.equal(
    serviceChoiceProblem("own", {
      formId: null,
      hasBase: true,
      withBase: false,
      own: twenty,
      baseQuestions: twenty,
    }),
    null,
  );
  assert.match(
    serviceChoiceProblem("own", {
      formId: null,
      hasBase: true,
      withBase: true,
      own: twenty,
      baseQuestions: twenty,
    })!,
    /counting the base form/,
  );
});
