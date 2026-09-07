import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";

import fontkitModule, { type Fontkit, type FontkitFont } from "@react-pdf/fontkit";

/**
 * The directory is a literal subfolder of the project root and the file names
 * are literals, so the bundler's file tracing includes exactly these two files
 * rather than falling back to tracing the whole project.
 */
const FONT_DIR = path.join(process.cwd(), "src", "server", "pdf", "fonts");
const REGULAR_FILE = path.join(FONT_DIR, "NotoSansJP-Regular.ttf");
const BOLD_FILE = path.join(FONT_DIR, "NotoSansJP-Bold.ttf");

export const FONT_FILES = {
  regular: REGULAR_FILE,
  bold: BOLD_FILE,
} as const;

export type FontWeightName = keyof typeof FONT_FILES;

/**
 * `@react-pdf/fontkit` is a CommonJS package and is listed in
 * `serverExternalPackages`, so depending on how the bundler applies interop the
 * default import may be the module itself or a `{ default }` wrapper. Both
 * shapes are handled here rather than relying on one bundler's behaviour.
 */
const fontkit: Fontkit =
  (fontkitModule as Fontkit & { default?: Fontkit }).default ?? fontkitModule;

const fontCache = new Map<FontWeightName, FontkitFont>();

/**
 * Loads a font once per lambda instance. Reading a file that ships inside the
 * deployment bundle is a read-only operation and is fully supported on Vercel;
 * nothing is ever written to the filesystem.
 */
function loadFont(weight: FontWeightName): FontkitFont {
  const cached = fontCache.get(weight);
  if (cached) return cached;
  const font = fontkit.create(
    weight === "bold" ? readFileSync(BOLD_FILE) : readFileSync(REGULAR_FILE),
  );
  fontCache.set(weight, font);
  return font;
}

/** Width of `text` in PDF points at the given font size. */
export function measureText(text: string, fontSize: number, weight: FontWeightName = "regular"): number {
  if (!text) return 0;
  const font = loadFont(weight);
  const { advanceWidth } = font.layout(text);
  return (advanceWidth / font.unitsPerEm) * fontSize;
}

// 行頭禁則: characters that may not start a line.
const NO_LINE_START = "、。，．・：；？！ー〜゛゜ヽヾゝゞ々）〕］｝〉》」』】’”°′″℃％‰ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ";
// 行末禁則: characters that may not end a line.
const NO_LINE_END = "（〔［｛〈《「『【‘“￥＄＃";

const CJK_RANGE =
  /[　-〿぀-ゟ゠-ヿ㐀-䶿一-鿿＀-￯㈀-㏿]/u;

function isCjk(char: string): boolean {
  return CJK_RANGE.test(char);
}

/**
 * Splits text into the smallest units that may not themselves be broken:
 * one token per CJK character, one token per run of Latin/numeric characters.
 */
function tokenize(text: string): string[] {
  const tokens: string[] = [];
  let buffer = "";

  for (const char of text) {
    if (char === " " || char === "\t") {
      if (buffer) {
        tokens.push(buffer);
        buffer = "";
      }
      tokens.push(" ");
      continue;
    }
    if (isCjk(char)) {
      if (buffer) {
        tokens.push(buffer);
        buffer = "";
      }
      tokens.push(char);
      continue;
    }
    buffer += char;
  }
  if (buffer) tokens.push(buffer);
  return tokens;
}

/**
 * Wraps Japanese text to a pixel width and returns the finished lines.
 *
 * react-pdf's own line breaker inserts a hyphen wherever it splits a word,
 * which produces "既存 -" mid-sentence in a Japanese quotation. Measuring with
 * the very same font here and handing react-pdf pre-broken lines avoids that
 * entirely and lets us apply basic 禁則処理 (no line may start with a closing
 * bracket or a small kana, none may end with an opening bracket).
 */
export function wrapText(
  text: string,
  maxWidth: number,
  fontSize: number,
  weight: FontWeightName = "regular",
  maxLines = 40,
): string[] {
  if (!text) return [""];
  if (maxWidth <= 0) return [text];

  const lines: string[] = [];

  for (const paragraph of text.split(/\r?\n/u)) {
    if (paragraph === "") {
      lines.push("");
      continue;
    }

    const tokens = tokenize(paragraph);
    let current = "";

    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index];
      const candidate = current + token;

      if (current === "" || measureText(candidate, fontSize, weight) <= maxWidth) {
        current = candidate;
        continue;
      }

      // The token does not fit, so the line breaks here.
      let line = current;
      let carry = "";
      let next = index;

      // 行頭禁則: a line may not begin with a closing bracket, small kana or
      // punctuation.
      let forbiddenRun = "";
      let scan = index;
      while (scan < tokens.length && NO_LINE_START.includes(tokens[scan])) {
        forbiddenRun += tokens[scan];
        scan += 1;
      }

      if (forbiddenRun !== "") {
        if (measureText(line + forbiddenRun, fontSize, weight) <= maxWidth) {
          // 追い出し: the run still fits on this line, so pull it up.
          line += forbiddenRun;
          next = scan;
        } else if (line.length > 1) {
          // 追い込み: pulling it up would overflow the column, so push the
          // preceding character down instead. The next line then starts with a
          // normal character followed by the punctuation.
          carry = (line.at(-1) ?? "") + carry;
          line = line.slice(0, -1);
        }
      }

      // 行末禁則: a line may not end with an opening bracket, so push it down
      // to the following line instead.
      while (line.length > 1 && NO_LINE_END.includes(line.at(-1) ?? "")) {
        carry = (line.at(-1) ?? "") + carry;
        line = line.slice(0, -1);
      }

      lines.push(line.trimEnd());
      if (lines.length >= maxLines) return lines;

      current = carry;
      // Resume at the first token that was not absorbed above. When nothing was
      // absorbed this re-examines the current token against an empty line.
      index = next - 1;
    }

    if (current.trim() !== "" || lines.length === 0) lines.push(current.trimEnd());
    if (lines.length >= maxLines) return lines;
  }

  return lines.length > 0 ? lines : [""];
}

/** Number of wrapped lines a string will occupy — used for row height maths. */
export function countLines(
  text: string,
  maxWidth: number,
  fontSize: number,
  weight: FontWeightName = "regular",
): number {
  return wrapText(text, maxWidth, fontSize, weight).length;
}
