import { describe, expect, it } from "vitest";
import en from "@/content/photosynthesis-en.json";
import bn from "@/content/photosynthesis-bn.json";
import ar from "@/content/water-cycle-ar.json";
import { canCheck, isCorrect } from "../grading";
import { Card, Course, courseDir } from "../schema";
import { daysUntil, dueDate, grade } from "../srs";
import { normalizeAnswer, shuffledIndices } from "../text";

describe("schema", () => {
  it("accepts the sample courses", () => {
    for (const c of [en, bn, ar]) expect(Course.safeParse(c).success).toBe(true);
  });

  it("rejects a fill card whose blanks don't match the text", () => {
    const r = Card.safeParse({ type: "fill", text: "A ___ and ___", blanks: [{ answers: ["x"] }] });
    expect(r.success).toBe(false);
  });

  it("rejects an mcq answer outside the options", () => {
    expect(Card.safeParse({ type: "mcq", question: "Q?", options: ["a", "b"], answer: 2 }).success).toBe(false);
  });

  it("rejects SVG that isn't SVG", () => {
    expect(Card.safeParse({ type: "explain", body: "x", svg: "<script>alert(1)</script>" }).success).toBe(false);
  });

  it("derives text direction from the language", () => {
    expect(courseDir({ language: "ar" })).toBe("rtl");
    expect(courseDir({ language: "bn" })).toBe("ltr");
  });
});

describe("grading", () => {
  it("normalizes typed answers", () => {
    expect(normalizeAnswer(" CO₂. ")).toBe("co2");
    expect(normalizeAnswer("৬")).toBe("6");
    expect(normalizeAnswer("Chlorophyll")).toBe("chlorophyll");
  });

  it("grades each card type", () => {
    const mcq = Card.parse({ type: "mcq", question: "Q?", options: ["a", "b"], answer: 1 });
    expect(isCorrect(mcq, { type: "mcq", selected: 1 })).toBe(true);
    expect(isCorrect(mcq, { type: "mcq", selected: 0 })).toBe(false);

    const fill = Card.parse({ type: "fill", text: "In ___ out ___", blanks: [{ answers: ["CO₂"] }, { answers: ["O₂", "oxygen"] }] });
    expect(canCheck(fill, { type: "fill", values: ["co2", ""] })).toBe(false);
    expect(isCorrect(fill, { type: "fill", values: ["co2", "Oxygen"] })).toBe(true);
    expect(isCorrect(fill, { type: "fill", values: ["o2", "co2"] })).toBe(false);

    const order = Card.parse({ type: "order", prompt: "Order", items: ["a", "b", "c"] });
    expect(isCorrect(order, { type: "order", picked: [0, 1, 2] })).toBe(true);
    expect(isCorrect(order, { type: "order", picked: [1, 0, 2] })).toBe(false);
  });

  it("shuffles deterministically and never in the right order", () => {
    for (const seed of ["a", "b", "l1:steps", "x"]) {
      const s = shuffledIndices(4, seed);
      expect(s).toEqual(shuffledIndices(4, seed));
      expect(s).not.toEqual([0, 1, 2, 3]);
      expect([...s].sort()).toEqual([0, 1, 2, 3]);
    }
  });
});

describe("spaced repetition", () => {
  const now = new Date("2026-11-22T10:00:00");
  it("brings a missed card back tomorrow", () => {
    expect(daysUntil(dueDate(grade(undefined, false, now)), now)).toBe(1);
  });
  it("spaces a remembered card further out, and further again next time", () => {
    const first = grade(undefined, true, now);
    const d1 = daysUntil(dueDate(first), now);
    expect(d1).toBeGreaterThanOrEqual(2);
    const later = dueDate(first);
    const second = grade(first, true, later);
    expect(daysUntil(dueDate(second), later)).toBeGreaterThan(d1);
  });
});

describe("AI input cleanup", async () => {
  const { cleanSvg, normalizeLanguage } = await import("../schema");
  it("strips fences, XML declarations and comments around SVG", () => {
    const svg = "<svg viewBox='0 0 10 10'><rect/></svg>";
    expect(cleanSvg("```svg\n<?xml version=\"1.0\"?>\n<!-- diagram -->\n" + svg + "\n```")).toBe(svg);
    expect(Card.safeParse({ type: "explain", body: "x", svg: "<?xml version='1.0'?>" + svg }).success).toBe(true);
  });
  it("turns language names into codes", () => {
    expect(normalizeLanguage("বাংলা")).toBe("bn");
    expect(normalizeLanguage("English")).toBe("en");
    expect(normalizeLanguage("pt-BR")).toBe("pt-BR");
  });
});
