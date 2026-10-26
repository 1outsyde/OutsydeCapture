/**
 * Parser for exactly the markdown the Event Host Agreement uses (backend hostAgreementText.ts): "## " headings,
 * paragraphs, **bold**, "- " lists, "1. " lists, [text](https://...) links and backslash escapes. Ported from
 * goutsyde.com app/events/_host/AgreementText.tsx (parse functions only); the app renders the blocks as Text.
 * Unit tests: utils/host/agreementText.test.ts.
 */

export type Inline =
  | { t: "text"; v: string }
  | { t: "bold"; c: Inline[] }
  | { t: "link"; href: string; c: Inline[] };

export type Block =
  | { t: "h"; c: Inline[] }
  | { t: "p"; c: Inline[] }
  | { t: "ul"; items: Inline[][] }
  | { t: "ol"; start: number; items: Inline[][] };

const ESCAPABLE = "\\`*_{}[]()#+-.!>|~\"'";

function pushText(out: Inline[], v: string) {
  if (!v) return;
  const last = out[out.length - 1];
  if (last && last.t === "text") last.v += v;
  else out.push({ t: "text", v });
}

/** Position of the next unescaped `needle` at or after `from`, or -1. */
function findUnescaped(s: string, needle: string, from: number): number {
  for (let i = from; i <= s.length - needle.length; i++) {
    if (s[i] === "\\") { i++; continue; }
    if (s.startsWith(needle, i)) return i;
  }
  return -1;
}

const LINK_RE = /^https:\/\/[^\s<>"'()]+$/i;

export function parseInline(s: string): Inline[] {
  const out: Inline[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === "\\" && i + 1 < s.length && ESCAPABLE.includes(s[i + 1])) {
      pushText(out, s[i + 1]);
      i += 2;
      continue;
    }
    if (s.startsWith("**", i)) {
      const end = findUnescaped(s, "**", i + 2);
      if (end > i + 2) {
        out.push({ t: "bold", c: parseInline(s.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }
    if (ch === "[") {
      const close = findUnescaped(s, "]", i + 1);
      if (close > i && s[close + 1] === "(") {
        const paren = s.indexOf(")", close + 2);
        const href = paren > 0 ? s.slice(close + 2, paren).trim() : "";
        if (paren > 0 && LINK_RE.test(href)) {
          out.push({ t: "link", href, c: parseInline(s.slice(i + 1, close)) });
          i = paren + 1;
          continue;
        }
      }
    }
    pushText(out, ch);
    i++;
  }
  return out;
}

export function parseAgreement(md: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ t: "p", c: parseInline(para.join(" ")) });
    para = [];
  };
  for (const raw of md.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    const h = /^#{1,6}\s+(.*)$/.exec(line);
    if (h) { flush(); blocks.push({ t: "h", c: parseInline(h[1]) }); continue; }
    const ul = /^[-*]\s+(.*)$/.exec(line);
    if (ul) {
      flush();
      const last = blocks[blocks.length - 1];
      if (last && last.t === "ul") last.items.push(parseInline(ul[1]));
      else blocks.push({ t: "ul", items: [parseInline(ul[1])] });
      continue;
    }
    const ol = /^(\d+)\.\s+(.*)$/.exec(line);
    if (ol) {
      flush();
      const last = blocks[blocks.length - 1];
      if (last && last.t === "ol") last.items.push(parseInline(ol[2]));
      else blocks.push({ t: "ol", start: Number(ol[1]), items: [parseInline(ol[2])] });
      continue;
    }
    para.push(line);
  }
  flush();
  return blocks;
}
