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
  assert.match(src, /onRequestClose=\{onClose\}/);
  assert.match(src, /accessibilityLabel=/);
  assert.doesNotMatch(src, /\btransparent\b/);
});

for (const f of FILES_2A) {
  test(`${f}: no transparent sheets, uses FullScreenSheet`, () => {
    const src = read(f);
    const bad = modalTags(src).filter((t) => /\btransparent\b/.test(t));
    assert.deepEqual(bad, [], `${f} still has transparent Modal(s)`);
    assert.match(src, /import \{ FullScreenSheet \} from "@\/components\/FullScreenSheet"/);
  });
}

test("StaffDashboard opens the service editor full screen", () => {
  const src = read("screens/StaffDashboardScreen.tsx");
  const tag = /<ServiceEditorModal[\s\S]*?\/>/.exec(src)?.[0] ?? "";
  assert.match(tag, /\bfullScreen\b/);
});

test("ServiceEditorModal handles the keyboard", () => {
  assert.match(read("components/ServiceEditorModal.tsx"), /KeyboardAvoidingView/);
});

test("RefundModal stays a dialog but handles the keyboard", () => {
  const src = read("components/RefundModal.tsx");
  assert.match(src, /KeyboardAvoidingView/);
});

console.log(`\n${passed} passed`);
