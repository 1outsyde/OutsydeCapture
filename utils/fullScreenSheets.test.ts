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
      /import \{ FullScreenSheet \} from "@\/components\/FullScreenSheet"/,
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
    assert.match(src, /import \{ FullScreenSheet \} from "@\/components\/FullScreenSheet"/);
  });
}

// An add-on editor sheet: the FullScreenSheet whose title mentions "New Add-on".
function editorSheets(src: string): string[] {
  const out: string[] = [];
  const re = /<FullScreenSheet\b[\s\S]*?\n\s*>\n/g;
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

console.log(`\n${passed} passed`);
