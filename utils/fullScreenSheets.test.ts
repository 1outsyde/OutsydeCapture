// Guard for full screen pass 2a: the business tool pop-ups must open as full
// pages (FullScreenSheet), never as transparent partial-height sheets, and
// text-entry pop-ups must handle the keyboard.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`ok - ${name}`);
}

// Every <Modal ...> opening tag in a source file.
function modalTags(src: string): string[] {
  const tags: string[] = [];
  let i = src.indexOf("<Modal");
  while (i !== -1) {
    const next = src[i + 6];
    if (next === " " || next === "\n") {
      let depth = 0;
      let j = i;
      for (; j < src.length; j++) {
        const c = src[j];
        if (c === "{") depth++;
        else if (c === "}") depth--;
        else if (c === ">" && depth === 0) break;
      }
      tags.push(src.slice(i, j + 1));
    }
    i = src.indexOf("<Modal", i + 6);
  }
  return tags;
}

const FILES_2A = [
  "screens/StaffDashboardScreen.tsx",
  "screens/PhotographerDashboardScreen.tsx",
  "screens/DashboardBookingsScreen.tsx",
  "screens/DashboardOrdersScreen.tsx",
  "screens/StaffCalendarScreen.tsx",
  "components/ProviderCalendar.tsx",
  "components/InviteTeamModal.tsx",
];

test("FullScreenSheet is a full screen modal with keyboard handling", () => {
  const p = "components/FullScreenSheet.tsx";
  assert.ok(existsSync(join(root, p)), `${p} missing`);
  const src = read(p);
  assert.match(src, /presentationStyle="fullScreen"/);
  assert.match(src, /KeyboardAvoidingView/);
  assert.match(src, /onRequestClose=\{\(\) => \{\s*if \(!closeDisabled\) onClose\(\);/);
  assert.match(src, /accessibilityLabel=/);
  assert.doesNotMatch(src, /\btransparent\b/);
});

for (const f of FILES_2A) {
  test(`${f}: no transparent sheets, uses FullScreenSheet`, () => {
    const src = read(f);
    const bad = modalTags(src).filter((t) => /\btransparent\b/.test(t));
    assert.deepEqual(bad, [], `${f} still has transparent Modal(s)`);
    assert.match(
      src,
      /import \{ FullScreenSheet \} from ["']@\/components\/FullScreenSheet["']/,
    );
  });
}

test("StaffDashboard opens the service editor full screen", () => {
  const src = read("screens/StaffDashboardScreen.tsx");
  const tag = /<ServiceEditorModal[\s\S]*?\/>/.exec(src)?.[0] ?? "";
  assert.match(tag, /\bfullScreen\b/);
});

test("ServiceEditorModal handles the keyboard", () => {
  assert.match(
    read("components/ServiceEditorModal.tsx"),
    /KeyboardAvoidingView/,
  );
});

test("RefundModal stays a dialog but handles the keyboard", () => {
  const src = read("components/RefundModal.tsx");
  assert.match(src, /KeyboardAvoidingView/);
});

test("StaffDashboard opens the service editor after My Services has closed", () => {
  const src = read("screens/StaffDashboardScreen.tsx");
  assert.doesNotMatch(src, /setTimeout\(\(\) => setShowServiceEditor\(true\)/);
  const sheet =
    /<FullScreenSheet\s+visible=\{activeModal === "services"\}[\s\S]*?title="My Services"/.exec(src)?.[0] ?? "";
  assert.match(sheet, /onDismiss=\{servicesAfterClose\.onDismiss\}/);
  assert.match(src, /servicesAfterClose\.queue\(\(\) => setShowServiceEditor\(true\)\)/);
});

test("Photographer Bookings does not add the home-bar inset twice", () => {
  const src = read("screens/PhotographerDashboardScreen.tsx");
  const start = src.indexOf("const renderBookingsModal");
  const body = src.slice(start, src.indexOf("</FullScreenSheet>", start));
  assert.doesNotMatch(body, /insets\.bottom/);
});

test("Appointment details keeps showing the booking while it closes", () => {
  const src = read("screens/DashboardBookingsScreen.tsx");
  assert.match(src, /const shown = booking \?\? lastBooking/);
});

// ---- 2b: add-on pop-ups ----

test("FullScreenSheet: closeDisabled blocks the close button and Android back", () => {
  const src = read("components/FullScreenSheet.tsx");
  assert.match(src, /closeDisabled\?: boolean/);
  assert.match(src, /onRequestClose=\{\(\) => \{\s*if \(!closeDisabled\) onClose\(\);\s*\}\}/);
  assert.match(src, /disabled=\{closeDisabled\}/);
});

test("FullScreenSheet: androidKeyboardBehavior is used on Android", () => {
  const src = read("components/FullScreenSheet.tsx");
  assert.match(src, /androidKeyboardBehavior\?: "height"/);
  assert.match(src, /Platform\.OS === "ios" \? "padding" : androidKeyboardBehavior/);
});

const FILES_2B = [
  "screens/StorefrontEditorScreen.tsx",
  "components/ServiceAddonsEditor.tsx",
  "components/addons/AddonLibraryTab.tsx",
];

for (const f of FILES_2B) {
  test(`${f}: no transparent sheets, uses FullScreenSheet`, () => {
    const src = read(f);
    const bad = modalTags(src).filter((t) => /\btransparent\b/.test(t));
    assert.deepEqual(bad, [], `${f} still has transparent Modal(s)`);
    assert.match(src, /import \{ FullScreenSheet \} from ["']@\/components\/FullScreenSheet["']/);
  });
}

// An add-on editor sheet: the FullScreenSheet whose title mentions "New Add-on".
function editorSheets(src: string): string[] {
  const out: string[] = [];
  // From the opening tag to the ">" line at the same indentation.
  const re = /\n( *)<FullScreenSheet\b[\s\S]*?\n\1>\n/g;
  for (const m of src.matchAll(re)) if (m[0].includes('"New Add-on"')) out.push(m[0]);
  return out;
}

for (const f of FILES_2B) {
  test(`${f}: add-on editor has Cancel left, Done right, Android height`, () => {
    const sheets = editorSheets(read(f));
    assert.ok(sheets.length >= 1, `${f}: no add-on editor FullScreenSheet`);
    for (const s of sheets) {
      assert.match(s, /closeLabel="cancel"/);
      assert.match(s, /androidKeyboardBehavior="height"/);
      assert.match(s, /right=\{[\s\S]*Keyboard\.dismiss[\s\S]*Done/);
    }
  });
}

test("copy and checklist sheets block closing while busy", () => {
  assert.match(read("screens/StorefrontEditorScreen.tsx"), /closeDisabled=\{copyingAddon\}/);
  assert.match(read("components/ServiceAddonsEditor.tsx"), /closeDisabled=\{copying\}/);
  const lib = read("components/addons/AddonLibraryTab.tsx");
  assert.match(lib, /closeDisabled=\{sheetBusy\}/);
  assert.match(lib, /closeDisabled=\{saving\}/);
});

// ---- 2c: customer pop-ups ----

const FILES_2C = [
  "components/ratings/RatingBottomSheet.tsx",
  "components/events/BuyTicketsModal.tsx",
  "components/events/ReportEventSheet.tsx",
  "screens/PostDetailScreen.tsx",
  "components/plan-offer/PlanOfferSheet.tsx",
  "screens/StoryViewerScreen.tsx",
];

for (const f of FILES_2C) {
  test(`${f}: no transparent sheets, uses FullScreenSheet`, () => {
    const src = read(f);
    const bad = modalTags(src).filter((t) => /\btransparent\b/.test(t));
    assert.deepEqual(bad, [], `${f} still has transparent Modal(s)`);
    assert.match(src, /import \{ FullScreenSheet \} from ["']@\/components\/FullScreenSheet["']/);
  });
}

test("Story viewers no longer use the swipe sheet library", () => {
  assert.doesNotMatch(read("screens/StoryViewerScreen.tsx"), /@gorhom\/bottom-sheet/);
});

test("Story viewers pause the story and resume with the remaining time", () => {
  const src = read("screens/StoryViewerScreen.tsx");
  assert.match(src, /remainingStoryMs\(/);
  assert.match(src, /paused=\{viewersOpen\}/);
  assert.match(src, /if \(viewersOpen\) \{\s*cancelAnimation\(progress\);\s*return;/);
  assert.match(src, /\}, \[currentStory\?\.id, advance, viewersOpen\]\);/);
  // A new story starts from 0 without reading the old bar's live value.
  assert.match(src, /resumeProgress\(isNewStory, /);
});

test("Edit caption: Cancel left, Save right", () => {
  const sheets = [...read("screens/PostDetailScreen.tsx").matchAll(/\n( *)<FullScreenSheet\b[\s\S]*?\n\1>\n/g)].map((m) => m[0]);
  const edit = sheets.find((s) => s.includes('"Edit Caption"')) ?? "";
  assert.match(edit, /closeLabel="cancel"/);
  assert.match(edit, /right=\{[\s\S]*Save/);
});

test("Report keeps the older Android keyboard setting and blocks close while sending", () => {
  const src = read("components/events/ReportEventSheet.tsx");
  assert.match(src, /androidKeyboardBehavior="height"/);
  assert.match(src, /closeDisabled=\{/);
});

test("Buy tickets and the plan offer block closing while busy", () => {
  assert.match(read("components/events/BuyTicketsModal.tsx"), /closeDisabled=\{closeBlocked\}/);
  assert.match(read("components/events/BuyTicketsModal.tsx"), /const closeBlocked = step === "starting" \|\| step === "pay" \|\| step === "confirming";/);
  assert.match(read("components/plan-offer/PlanOfferSheet.tsx"), /closeDisabled=\{busy\}/);
});

for (const f of ["screens/DiscoverScreen.tsx", "screens/PulseFeedScreenV2.tsx"]) {
  test(`${f}: comments stay a sheet (Legend's exception)`, () => {
    const tags = modalTags(read(f));
    assert.ok(tags.some((t) => /comments/i.test(t) && /\btransparent\b/.test(t)), "comments sheet is no longer transparent");
  });
  test(`${f}: story ring opens the story after comments close`, () => {
    const src = read(f);
    assert.match(src, /commentsAfterClose\.queue\(\(\) =>\s*navigation\.navigate\("StoryViewer"/);
    assert.match(src, /onDismiss=\{commentsAfterClose\.onDismiss\}/);
    assert.match(src, /commentsAfterClose\.queue\([\s\S]*?\);\s*handleCloseComments\(\);\s*commentsAfterClose\.runIfImmediate\(\);/);
  });
}

test("FullScreenSheet: Android shrinks for the keyboard by default (edge to edge, the window doesn't resize)", () => {
  assert.match(read("components/FullScreenSheet.tsx"), /androidKeyboardBehavior = "height"/);
});

// ---- 2d: event hosting pop-ups ----

const FILES_2D = [
  "components/host/TicketTypeSheet.tsx",
  "components/host/TeamPersonSheet.tsx",
  "components/host/AgreementSheet.tsx",
  "components/host/OptionSheet.tsx",
];

for (const f of FILES_2D) {
  test(`${f}: no transparent sheets, uses FullScreenSheet`, () => {
    const src = read(f);
    const bad = modalTags(src).filter((t) => /\btransparent\b/.test(t));
    assert.deepEqual(bad, [], `${f} still has transparent Modal(s)`);
    assert.match(src, /import \{ FullScreenSheet \} from ["']@\/components\/FullScreenSheet["']/);
  });
}

// The part of a file between <FullScreenSheet and </FullScreenSheet>.
function insideSheet(src: string): string {
  const a = src.indexOf("<FullScreenSheet");
  const b = src.indexOf("</FullScreenSheet>");
  assert.ok(a !== -1 && b > a, "no FullScreenSheet block");
  return src.slice(a, b);
}

test("Ticket type: its date picker and option list stay inside the page (else they open behind it on iPhone)", () => {
  const inner = insideSheet(read("components/host/TicketTypeSheet.tsx"));
  assert.match(inner, /<DateTimeSheet\b/);
  assert.match(inner, /<OptionSheet\b/);
});

test("Team person: both date pickers stay inside the page, close blocked while busy", () => {
  const src = read("components/host/TeamPersonSheet.tsx");
  const inner = insideSheet(src);
  assert.equal((inner.match(/<DateTimeSheet\b/g) ?? []).length, 2);
  assert.match(src, /closeDisabled=\{!!busy\}/);
  assert.match(src, /testID="person-sheet"/);
  assert.doesNotMatch(src, /label="Close"/);
});

test("Agreement: close blocked while publishing", () => {
  assert.match(read("components/host/AgreementSheet.tsx"), /closeDisabled=\{working\}/);
});

test("Option list opens only when it has options", () => {
  assert.match(read("components/host/OptionSheet.tsx"), /visible=\{!!options\}/);
});

test("Date and time pickers stay small (Legend's exception)", () => {
  assert.ok(modalTags(read("components/host/DateTimeSheet.tsx")).some((t) => /\btransparent\b/.test(t)));
});

test("Door scanner: Type a code stays small and rises above the keyboard", () => {
  const src = read("screens/host/DoorScannerScreen.tsx");
  const tag = modalTags(src).find((t) => /visible=\{typing\}/.test(t)) ?? "";
  assert.match(tag, /\btransparent\b/);
  const block = src.slice(src.indexOf(tag), src.indexOf("</Modal>", src.indexOf(tag)));
  assert.match(block, /<KeyboardAvoidingView[\s\S]*behavior=\{Platform\.OS === "ios" \? "padding" : "height"\}/);
});

console.log(`\n${passed} passed`);
