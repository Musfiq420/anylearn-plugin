import type { Lesson } from "./schema";

/**
 * Teaching-quality rules for a lesson, checked when the AI adds it.
 * They're stricter than the course format (which only checks structure),
 * so they apply to new lessons without breaking courses already saved.
 */

export const MAX_EXPLAIN_IN_A_ROW = 2;
export const MAX_BODY_CHARS = 700;

export function lessonIssues(lesson: Pick<Lesson, "cards">): string[] {
  const issues: string[] = [];
  const cards = lesson.cards;

  let run = 0;
  let runStart = 0;
  cards.forEach((card, i) => {
    if (card.type === "explain") {
      if (run === 0) runStart = i;
      run++;
      if (run === MAX_EXPLAIN_IN_A_ROW + 1) {
        issues.push(
          `cards ${runStart + 1}–${i + 1} are ${run}+ explain cards in a row. Put a question right after each explanation (explain → question → explain → question).`,
        );
      }
      const length = [...card.body].length;
      if (length > MAX_BODY_CHARS) {
        issues.push(
          `card ${i + 1} body is ${length} characters; keep explain cards under ${MAX_BODY_CHARS}. Split it into two explain cards with a question in between.`,
        );
      }
    } else {
      run = 0;
    }
  });

  const questions = cards.filter((c) => c.type !== "explain").length;
  if (cards.length >= 3 && questions * 2 < cards.length) {
    issues.push(`only ${questions} of ${cards.length} cards are questions; make at least half of them questions.`);
  }
  return issues;
}
