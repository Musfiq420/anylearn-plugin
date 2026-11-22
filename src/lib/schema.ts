import { z } from "zod";

/**
 * AnyLearn course format, version 1.
 *
 * This is the single source of truth for what a course looks like. The MCP
 * server validates everything the AI sends against it, and the player renders
 * only what passes. The AI fills in data; it never writes UI code.
 */

export const BLANK = /_{3,}/g;

const text = (max: number) => z.string().trim().min(1).max(max);

/** Inline SVG markup. Rendered through <img>, so scripts inside never run. */
export const SvgMarkup = z
  .string()
  .trim()
  .max(60_000, "SVG must be under 60 KB")
  .refine((s) => /^<svg[\s>]/i.test(s) && /<\/svg>\s*$/i.test(s), {
    message: "SVG must start with <svg and end with </svg>",
  });

const base = {
  /** Stable id inside the lesson. Optional: the card's position is used if missing. */
  id: z.string().trim().min(1).max(40).optional().describe("Optional stable id for this card within the lesson, e.g. \"q-oxygen\"."),
  /** Where this came from in the learner's material, e.g. "p. 12". */
  source: text(120).optional().describe("Where this came from in the user's material, e.g. \"p. 12\". Omit if not from attached material."),
};

export const ExplainCard = z.object({
  type: z.literal("explain"),
  ...base,
  title: text(120).optional(),
  /** Light markdown: paragraphs, **bold**, *italic*, `code`, "- " lists. */
  body: text(4000).describe("Short explanation (2–4 short paragraphs max). Light markdown: blank line between paragraphs, **bold**, *italic*, `code`, \"- \" lists."),
  svg: SvgMarkup.optional().describe("Optional diagram as a complete <svg> with a viewBox. Simple shapes and labels, no scripts or external images."),
  /** Short highlighted takeaway shown as a "Remember" box. */
  note: text(400).optional().describe("One-sentence key takeaway, shown in a highlighted \"Remember\" box."),
});

export const McqCard = z.object({
  type: z.literal("mcq"),
  ...base,
  question: text(400),
  svg: SvgMarkup.optional(),
  options: z.array(text(200)).min(2).max(6).describe("2–6 options; wrong ones should be plausible."),
  /** Index of the correct option. */
  answer: z.number().int().min(0).describe("Zero-based index of the correct option."),
  explanation: text(600).optional().describe("Why the answer is right, shown after checking."),
});

export const FillCard = z.object({
  type: z.literal("fill"),
  ...base,
  /** Optional instruction above the sentence. */
  prompt: text(200).optional(),
  /** Sentence with one "___" per blank. */
  text: text(600).describe("Sentence with one \"___\" (three underscores) per blank."),
  /** One entry per blank, in order. Each lists every accepted answer. */
  blanks: z
    .array(z.object({ answers: z.array(text(80)).min(1).max(8).describe("Every accepted answer; the first is shown as the correct one.") }))
    .min(1)
    .max(4)
    .describe("One entry per ___, in order."),
  /** Optional word tiles. If present, learners tap tiles instead of typing. */
  bank: z.array(text(80)).min(2).max(10).optional().describe("Optional word tiles to tap instead of typing: the right answers plus a few distractors."),
  explanation: text(600).optional(),
});

export const OrderCard = z.object({
  type: z.literal("order"),
  ...base,
  prompt: text(400),
  /** Items in the CORRECT order. The player shuffles them. */
  items: z.array(text(160)).min(3).max(6).describe("3–6 steps written in the CORRECT order; the player shuffles them."),
  explanation: text(600).optional(),
});

export const Card = z
  .discriminatedUnion("type", [ExplainCard, McqCard, FillCard, OrderCard])
  .superRefine((card, ctx) => {
    if (card.type === "mcq" && card.answer >= card.options.length) {
      ctx.addIssue({ code: "custom", path: ["answer"], message: "answer must be an index into options" });
    }
    if (card.type === "fill") {
      const count = (card.text.match(BLANK) ?? []).length;
      if (count !== card.blanks.length) {
        ctx.addIssue({
          code: "custom",
          path: ["blanks"],
          message: `text has ${count} "___" but blanks has ${card.blanks.length} entries`,
        });
      }
      if (card.bank) {
        const bank = card.bank.map((b) => b.toLowerCase());
        card.blanks.forEach((b, i) => {
          if (!b.answers.some((a) => bank.includes(a.toLowerCase()))) {
            ctx.addIssue({ code: "custom", path: ["bank"], message: `bank has no accepted answer for blank ${i + 1}` });
          }
        });
      }
    }
  });

export const Lesson = z.object({
  id: z.string().trim().min(1).max(40),
  title: text(120),
  cards: z.array(Card).min(1).max(30),
});

export const Course = z.object({
  schemaVersion: z.literal(1),
  id: z.string().trim().regex(/^[A-Za-z0-9_-]{3,40}$/),
  title: text(140),
  description: text(400).optional(),
  /** BCP-47 language tag of the course content, e.g. "en", "bn", "ar". */
  language: z.string().trim().min(2).max(20),
  /** Text direction. Derived from language when missing. */
  dir: z.enum(["ltr", "rtl"]).optional(),
  subject: text(60).optional(),
  level: text(60).optional(),
  minutesPerDay: z.number().int().min(1).max(120).optional(),
  /** Accent color for the course header and thumbnail. */
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  source: z.object({ name: text(200) }).optional(),
  lessons: z.array(Lesson).min(1).max(60),
});

export type ExplainCard = z.infer<typeof ExplainCard>;
export type McqCard = z.infer<typeof McqCard>;
export type FillCard = z.infer<typeof FillCard>;
export type OrderCard = z.infer<typeof OrderCard>;
export type Card = z.infer<typeof Card>;
export type Lesson = z.infer<typeof Lesson>;
export type Course = z.infer<typeof Course>;
export type QuestionCard = McqCard | FillCard | OrderCard;

const RTL = new Set(["ar", "fa", "he", "ur", "ps", "sd", "yi", "dv", "ug", "ckb"]);

export function courseDir(course: Pick<Course, "language" | "dir">): "ltr" | "rtl" {
  if (course.dir) return course.dir;
  return RTL.has(course.language.toLowerCase().split("-")[0]) ? "rtl" : "ltr";
}

export function isQuestion(card: Card): card is QuestionCard {
  return card.type !== "explain";
}

/** Stable id of a card across sessions: "<lessonId>:<cardId or index>". */
export function cardKey(lesson: Lesson, index: number): string {
  return `${lesson.id}:${lesson.cards[index].id ?? index}`;
}
