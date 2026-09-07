import { describe, expect, it } from "vitest";

import { countLines, measureText, wrapText } from "@/server/pdf/text";

describe("measureText", () => {
  it("measures full width Japanese characters as one em each", () => {
    // Noto Sans JP uses a 1000 unit em with full width CJK advances.
    expect(measureText("見積書", 10)).toBeCloseTo(30, 5);
    expect(measureText("", 10)).toBe(0);
  });

  it("measures Latin text proportionally, narrower than the same count of kanji", () => {
    expect(measureText("ABC", 10)).toBeLessThan(measureText("見積書", 10));
  });

  it("scales linearly with the font size", () => {
    expect(measureText("見積書", 20)).toBeCloseTo(measureText("見積書", 10) * 2, 5);
  });

  it("measures bold text at least as wide as regular text", () => {
    expect(measureText("御見積書", 12, "bold")).toBeGreaterThanOrEqual(
      measureText("御見積書", 12, "regular") - 0.001,
    );
  });
});

describe("wrapText", () => {
  const FONT_SIZE = 9;

  it("keeps short text on a single line", () => {
    expect(wrapText("キッチン交換", 200, FONT_SIZE)).toEqual(["キッチン交換"]);
  });

  it("breaks long Japanese text into lines that fit the given width", () => {
    const text = "システムキッチン交換工事（Ⅰ型・幅2550㎜・食洗機付、既存撤去処分費を含む）";
    const width = 120;
    const lines = wrapText(text, width, FONT_SIZE);

    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(measureText(line, FONT_SIZE)).toBeLessThanOrEqual(width + 0.01);
    }
  });

  it("never introduces a hyphen when breaking Japanese", () => {
    const text = "外壁シリコン塗装（下地補修・高圧洗浄・養生一式を含む）の単価です";
    const lines = wrapText(text, 100, FONT_SIZE);
    expect(lines.join("")).not.toContain("-");
    // No characters may be lost or duplicated by wrapping.
    expect(lines.join("")).toBe(text);
  });

  it("applies 行頭禁則: a line may not start with a closing bracket or punctuation", () => {
    const text = "解体工事（既存撤去）、廃材処分費、運搬費、諸経費を含みます。";
    for (const width of [40, 55, 70, 85, 100, 130]) {
      const lines = wrapText(text, width, FONT_SIZE);
      for (const line of lines.slice(1)) {
        expect("、。）」』】・？！".includes(line[0])).toBe(false);
      }
    }
  });

  it("applies 行末禁則: a line may not end with an opening bracket", () => {
    const text = "内装仕上工事（クロス張替・床材張替）および設備機器（給湯器）の交換";
    for (const width of [40, 60, 80, 110]) {
      const lines = wrapText(text, width, FONT_SIZE);
      for (const line of lines.slice(0, -1)) {
        expect("（「『【〈《".includes(line.at(-1) ?? "")).toBe(false);
      }
    }
  });

  it("does not split a Latin word across lines", () => {
    const lines = wrapText("ABCDEFGHIJKLMNOP QRSTUVWXYZ", 80, FONT_SIZE);
    expect(lines.some((line) => line.includes("ABCDEFGHIJKLMNOP"))).toBe(true);
  });

  it("honours explicit newlines", () => {
    expect(wrapText("一行目\n二行目", 500, FONT_SIZE)).toEqual(["一行目", "二行目"]);
  });

  it("returns a single empty line for empty input", () => {
    expect(wrapText("", 200, FONT_SIZE)).toEqual([""]);
  });

  it("stops at maxLines instead of growing without bound", () => {
    const text = "長い説明文です。".repeat(80);
    expect(wrapText(text, 60, FONT_SIZE, "regular", 4).length).toBeLessThanOrEqual(4);
  });

  it("degrades gracefully for a non positive width", () => {
    expect(wrapText("見積書", 0, FONT_SIZE)).toEqual(["見積書"]);
  });
});

describe("countLines", () => {
  it("reports how many lines the wrapped text occupies", () => {
    expect(countLines("短い", 300, 9)).toBe(1);
    expect(countLines("非常に長い工事項目名称をここに入力した場合の折返し確認用テキスト", 60, 9)).toBeGreaterThan(1);
  });
});
