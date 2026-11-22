import { describe, expect, it } from "vitest";
import { lessonIssues } from "../lessonRules";
import type { Card } from "../schema";

const ex = (body = "short"): Card => ({ type: "explain", body });
const q: Card = { type: "mcq", question: "?", options: ["a", "b"], answer: 0 };

describe("lesson rules", () => {
  it("accepts explain/question rhythm", () => {
    expect(lessonIssues({ cards: [ex(), q, ex(), ex(), q, q] })).toEqual([]);
  });
  it("rejects three explanations in a row", () => {
    expect(lessonIssues({ cards: [ex(), ex(), ex(), q, q, q] }).join()).toMatch(/cards 1–3/);
  });
  it("rejects long explanations and too few questions", () => {
    const issues = lessonIssues({ cards: [ex("x".repeat(800)), q, ex(), ex()] });
    expect(issues.join()).toMatch(/800 characters/);
    expect(issues.join()).toMatch(/only 1 of 4/);
  });
  it("counts Bangla by characters, not bytes", () => {
    expect(lessonIssues({ cards: [ex("পানি ".repeat(100)), q] })).toEqual([]);
  });
});
