// Safe markdown subset for chat messages. Parses to a plain tree that the renderer maps to React
// elements; nothing is ever injected as HTML, so markup in a message is shown as literal text.
// Supported: paragraphs with line breaks, ``` code blocks ```, > quotes, - / 1. lists,
// **bold**, *italic* / _italic_, `code`, [label](https://…) and bare http(s) links.

export type Inline =
  | { type: "text"; text: string }
  | { type: "strong"; children: Inline[] }
  | { type: "em"; children: Inline[] }
  | { type: "code"; text: string }
  | { type: "link"; href: string; children: Inline[] }
  | { type: "break" };

export type Block =
  | { type: "paragraph"; children: Inline[] }
  | { type: "code"; lang: string | null; text: string }
  | { type: "quote"; children: Block[] }
  | { type: "list"; ordered: boolean; items: Inline[][] };

const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

/** Returns a normalized URL when it is safe to link to, otherwise null (javascript:, data:, relative, …). */
export function safeHref(raw: string): string | null {
  const value = raw.trim();
  if (!value || /\s/.test(value)) return null;
  try {
    const url = new URL(value);
    return SAFE_PROTOCOLS.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

const FENCE = /^```\s*([\w+-]*)\s*$/;
const QUOTE = /^>\s?(.*)$/;
const BULLET = /^\s*[-*]\s+(.*)$/;
const ORDERED = /^\s*\d{1,3}[.)]\s+(.*)$/;

export function parseMessage(source: string, depth = 0): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", children: parseInline(paragraph.join("\n")) });
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const fence = FENCE.exec(line);
    if (fence) {
      const body: string[] = [];
      let j = i + 1;
      while (j < lines.length && !FENCE.test(lines[j])) body.push(lines[j++]);
      // An unclosed fence still renders as code to the end of the message.
      flushParagraph();
      blocks.push({ type: "code", lang: fence[1] || null, text: body.join("\n") });
      i = j;
      continue;
    }

    if (depth < 2 && QUOTE.test(line)) {
      flushParagraph();
      const body: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i])) body.push(QUOTE.exec(lines[i++])![1]);
      i--;
      blocks.push({ type: "quote", children: parseMessage(body.join("\n"), depth + 1) });
      continue;
    }

    const listMatch = BULLET.exec(line) ?? ORDERED.exec(line);
    if (listMatch) {
      flushParagraph();
      const ordered = !BULLET.test(line);
      const pattern = ordered ? ORDERED : BULLET;
      const items: Inline[][] = [];
      while (i < lines.length && pattern.test(lines[i])) items.push(parseInline(pattern.exec(lines[i++])![1]));
      i--;
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    if (line.trim() === "") flushParagraph();
    else paragraph.push(line);
  }
  flushParagraph();
  return blocks;
}

const URL_RE = /https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"\]]/y;

export function parseInline(source: string): Inline[] {
  const out: Inline[] = [];
  let text = "";
  const pushText = () => {
    if (text) out.push({ type: "text", text });
    text = "";
  };

  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    const rest = source.slice(i);

    if (ch === "\n") {
      pushText();
      out.push({ type: "break" });
      i++;
      continue;
    }

    if (ch === "`") {
      const end = source.indexOf("`", i + 1);
      if (end > i + 1) {
        pushText();
        out.push({ type: "code", text: source.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    if (rest.startsWith("**")) {
      const end = source.indexOf("**", i + 2);
      if (end > i + 2) {
        pushText();
        out.push({ type: "strong", children: parseInline(source.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }

    if ((ch === "*" || ch === "_") && isWordBoundary(source[i - 1])) {
      const end = findClosing(source, ch, i + 1);
      if (end > i + 1) {
        pushText();
        out.push({ type: "em", children: parseInline(source.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }

    if (ch === "[") {
      const link = /^\[([^\]\n]+)\]\(([^)\s]+)\)/.exec(rest);
      const href = link ? safeHref(link[2]) : null;
      if (link && href) {
        pushText();
        out.push({ type: "link", href, children: parseInline(link[1]) });
        i += link[0].length;
        continue;
      }
    }

    if ((ch === "h" || ch === "H") && isWordBoundary(source[i - 1])) {
      URL_RE.lastIndex = i;
      const match = URL_RE.exec(source);
      const href = match ? safeHref(match[0]) : null;
      if (match && href) {
        pushText();
        out.push({ type: "link", href, children: [{ type: "text", text: match[0] }] });
        i += match[0].length;
        continue;
      }
    }

    text += ch;
    i++;
  }
  pushText();
  return out;
}

function isWordBoundary(prev: string | undefined) {
  return prev === undefined || !/[\p{L}\p{N}_]/u.test(prev);
}

// Closing * or _ must not be followed by a word character (so snake_case stays literal).
function findClosing(source: string, marker: string, from: number) {
  for (let j = from; j < source.length; j++) {
    if (source[j] === "\n") return -1;
    if (source[j] === marker && source[j - 1] !== " " && isWordBoundary(source[j + 1])) return j;
  }
  return -1;
}

/** Plain-text preview for lists and notifications: markup stripped, whitespace collapsed. */
export function toPlainText(source: string): string {
  const flatten = (nodes: Inline[]): string =>
    nodes
      .map((n) => (n.type === "text" || n.type === "code" ? n.text : n.type === "break" ? " " : "children" in n ? flatten(n.children) : ""))
      .join("");
  return parseMessage(source)
    .map((b) => (b.type === "code" ? b.text : b.type === "paragraph" ? flatten(b.children) : b.type === "list" ? b.items.map(flatten).join(" ") : toPlainTextBlocks(b.children)))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  function toPlainTextBlocks(blocks: Block[]): string {
    return blocks.map((b) => (b.type === "paragraph" ? flatten(b.children) : b.type === "code" ? b.text : "")).join(" ");
  }
}
