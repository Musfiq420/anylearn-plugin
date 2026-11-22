import type { Card, FillCard, McqCard, OrderCard } from "./schema";
import { normalizeAnswer } from "./text";

/** What the learner has entered so far, per card type. */
export type Answer =
  | { type: "explain" }
  | { type: "mcq"; selected: number | null }
  | { type: "fill"; values: string[] }
  | { type: "order"; picked: number[] };

export function emptyAnswer(card: Card): Answer {
  switch (card.type) {
    case "explain":
      return { type: "explain" };
    case "mcq":
      return { type: "mcq", selected: null };
    case "fill":
      return { type: "fill", values: card.blanks.map(() => "") };
    case "order":
      return { type: "order", picked: [] };
  }
}

export function canCheck(card: Card, answer: Answer): boolean {
  if (card.type === "explain") return true;
  if (card.type === "mcq" && answer.type === "mcq") return answer.selected !== null;
  if (card.type === "fill" && answer.type === "fill") return answer.values.every((v) => v.trim().length > 0);
  if (card.type === "order" && answer.type === "order") return answer.picked.length === card.items.length;
  return false;
}

export function fillBlankCorrect(card: FillCard, index: number, value: string): boolean {
  const v = normalizeAnswer(value);
  return card.blanks[index].answers.some((a) => normalizeAnswer(a) === v);
}

export function isCorrect(card: Card, answer: Answer): boolean {
  switch (card.type) {
    case "explain":
      return true;
    case "mcq":
      return answer.type === "mcq" && answer.selected === card.answer;
    case "fill":
      return answer.type === "fill" && card.blanks.every((_, i) => fillBlankCorrect(card, i, answer.values[i] ?? ""));
    case "order":
      return answer.type === "order" && answer.picked.length === card.items.length && answer.picked.every((v, i) => v === i);
  }
}

/** The correct answer as one line of text, for the "Correct answer:" feedback. */
export function correctText(card: Card): string {
  switch (card.type) {
    case "explain":
      return "";
    case "mcq":
      return (card as McqCard).options[card.answer];
    case "fill":
      return (card as FillCard).blanks.map((b) => b.answers[0]).join(" · ");
    case "order":
      return (card as OrderCard).items.join(" → ");
  }
}
