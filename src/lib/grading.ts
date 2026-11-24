import { calc } from "./expr";
import { t } from "./i18n";
import { svgViewBox, type Card, type FillCard, type HotspotCard } from "./schema";
import { normalizeAnswer } from "./text";

/** What the learner has entered so far, per card type. */
export type Answer =
  | { type: "explain" }
  | { type: "mcq"; selected: number | null }
  | { type: "fill"; values: string[] }
  | { type: "order"; picked: number[] }
  | { type: "true_false"; value: boolean | null }
  | { type: "multi"; selected: number[] }
  | { type: "match"; matched: number[]; mistakes: number; active: { side: "left" | "right"; index: number } | null; wrong: { left: number; right: number } | null }
  | { type: "hotspot"; point: { x: number; y: number } | null }
  | { type: "simulate"; values: Record<string, number> };

export type AnswerOf<T extends Answer["type"]> = Extract<Answer, { type: T }>;

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
    case "true_false":
      return { type: "true_false", value: null };
    case "multi":
      return { type: "multi", selected: [] };
    case "match":
      return { type: "match", matched: [], mistakes: 0, active: null, wrong: null };
    case "hotspot":
      return { type: "hotspot", point: null };
    case "simulate":
      return { type: "simulate", values: Object.fromEntries(card.variables.map((v) => [v.name, v.default])) };
  }
}

export function canCheck(card: Card, answer: Answer): boolean {
  switch (card.type) {
    case "explain":
      return true;
    case "mcq":
      return answer.type === "mcq" && answer.selected !== null;
    case "fill":
      return answer.type === "fill" && answer.values.every((v) => v.trim().length > 0);
    case "order":
      return answer.type === "order" && answer.picked.length === card.items.length;
    case "true_false":
      return answer.type === "true_false" && answer.value !== null;
    case "multi":
      return answer.type === "multi" && answer.selected.length > 0;
    case "match":
      return answer.type === "match" && answer.matched.length === card.pairs.length;
    case "hotspot":
      return answer.type === "hotspot" && answer.point !== null;
    case "simulate":
      return true;
  }
}

export function fillBlankCorrect(card: FillCard, index: number, value: string): boolean {
  const v = normalizeAnswer(value);
  return card.blanks[index].answers.some((a) => normalizeAnswer(a) === v);
}

/** Tap radius for a hotspot target, in viewBox units (a little generous for fingers). */
export function targetRadius(card: HotspotCard, target: HotspotCard["targets"][number]): number {
  const vb = svgViewBox(card.svg);
  return (target.r ?? (vb ? vb.w * 0.07 : 20)) * 1.15;
}

export function hotspotHit(card: HotspotCard, point: { x: number; y: number }): boolean {
  return card.targets.some((tg) => Math.hypot(point.x - tg.x, point.y - tg.y) <= targetRadius(card, tg));
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
    case "true_false":
      return answer.type === "true_false" && answer.value === card.answer;
    case "multi":
      return (
        answer.type === "multi" &&
        answer.selected.length === card.answers.length &&
        card.answers.every((a) => answer.selected.includes(a))
      );
    case "match":
      return answer.type === "match" && answer.matched.length === card.pairs.length && answer.mistakes === 0;
    case "hotspot":
      return answer.type === "hotspot" && answer.point !== null && hotspotHit(card, answer.point);
    case "simulate":
      return !card.goal || (answer.type === "simulate" && Boolean(calc(card.goal.condition, answer.values)));
  }
}

/** The correct answer as one line of text, for the "Correct answer:" feedback. */
export function correctText(card: Card): string {
  switch (card.type) {
    case "explain":
      return "";
    case "mcq":
      return card.options[card.answer];
    case "fill":
      return card.blanks.map((b) => b.answers[0]).join(" · ");
    case "order":
      return card.items.join(" → ");
    case "true_false":
      return card.answer ? t.trueLabel : t.falseLabel;
    case "multi":
      return card.answers.map((i) => card.options[i]).join(" · ");
    case "match":
      return card.pairs.map((p) => `${p.left} → ${p.right}`).join(" · ");
    case "hotspot":
      return card.targets.map((tg) => tg.label).filter(Boolean).join(" · ") || t.highlightedSpot;
    case "simulate":
      return card.goal?.text ?? "";
  }
}
