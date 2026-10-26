/** Unit tests for the Event Host Agreement parser, ported from goutsyde.com tests/agreement-text.test.ts (the web HTML render checks stay on the web; the app renders Text nodes only). */
import { parseAgreement, parseInline } from "./agreementText";

let passed = 0, failed = 0;
function eq(actual: unknown, expected: unknown, name: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; console.log(`  ok  ${name}`); } else { failed++; console.error(`  FAIL ${name}`, JSON.stringify(actual), "expected", JSON.stringify(expected)); }
}

console.log("inline");
eq(parseInline("plain"), [{ t: "text", v: "plain" }], "plain text");
eq(parseInline("a **bold** b"), [{ t: "text", v: "a " }, { t: "bold", c: [{ t: "text", v: "bold" }] }, { t: "text", v: " b" }], "bold");
eq(parseInline("\\[VERSION\\]"), [{ t: "text", v: "[VERSION]" }], "backslash escapes");
eq(parseInline("a \\*\\*not bold\\*\\*"), [{ t: "text", v: "a **not bold**" }], "escaped stars stay text");
eq(parseInline("a \\d"), [{ t: "text", v: "a \\d" }], "backslash before a letter stays");
eq(parseInline("[Stripe](https://stripe.com/x)"), [{ t: "link", href: "https://stripe.com/x", c: [{ t: "text", v: "Stripe" }] }], "https link");
eq(parseInline("[bad](javascript:alert(1))"), [{ t: "text", v: "[bad](javascript:alert(1))" }], "javascript link stays text");
eq(parseInline("[plain](http://x.com)"), [{ t: "text", v: "[plain](http://x.com)" }], "http link stays text");
eq(parseInline("**unclosed"), [{ t: "text", v: "**unclosed" }], "unclosed bold stays text");

console.log("blocks");
const md = "## 1. About\n\nFirst line\nsame paragraph.\n\n- **Event**: a gathering\n- **Ticket**: a right\n\n3.1 **Age.** You must be 18.\n\n1. one;\n2. two.\n\nEnd.";
eq(parseAgreement(md).map((b) => b.t), ["h", "p", "ul", "p", "ol", "p"], "block kinds");
const blocks = parseAgreement(md);
eq(blocks[1], { t: "p", c: [{ t: "text", v: "First line same paragraph." }] }, "lines join into one paragraph");
eq(blocks[2].t === "ul" ? blocks[2].items.length : 0, 2, "two bullet items");
eq(blocks[3].t === "p" ? blocks[3].c[0] : null, { t: "text", v: "3.1 " }, "3.1 is a paragraph, not a list");
eq(blocks[4].t === "ol" ? [blocks[4].start, blocks[4].items.length] : null, [1, 2], "ordered list");

console.log("escapes");
eq(parseInline("Effective date: \\[EFFECTIVE DATE\\]."), [{ t: "text", v: "Effective date: [EFFECTIVE DATE]." }], "escaped brackets read plainly");
eq(parseInline("[x](https://a.com/\"onmouseover=alert(1))"), [{ t: "text", v: "[x](https://a.com/\"onmouseover=alert(1))" }], "a quote in a link URL is not a link");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
