import { z } from "zod";
import { calc, checkFormula } from "./expr";

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
/** Strips what AIs often wrap around SVG: code fences, an XML declaration, a doctype, comments. */
export function cleanSvg(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  let s = raw.trim();
  s = s.replace(/^```[a-z]*\s*/i, "").replace(/\s*```$/, "");
  s = s.replace(/^<\?xml[^>]*\?>\s*/i, "").replace(/^<!DOCTYPE[^>]*>\s*/i, "");
  while (/^<!--[\s\S]*?-->\s*/.test(s)) s = s.replace(/^<!--[\s\S]*?-->\s*/, "");
  return s.trim();
}

export const SvgMarkup = z.preprocess(
  cleanSvg,
  z
    .string()
    .max(60_000, "SVG must be under 60 KB")
    .refine((s) => /^<svg[\s>]/i.test(s) && /<\/svg>\s*$/i.test(s), {
      message: "SVG must start with <svg and end with </svg>",
    }),
);

/** Reference to a picture the user supplied (uploaded with the add_image tool). */
export const ImageId = z
  .string()
  .trim()
  .regex(/^img_[A-Za-z0-9]{6,30}$/, 'image must be an id returned by add_image, like "img_ab12cd34"');
const imageField = ImageId.optional().describe(
  "Optional: id of a picture from the user's own material, returned by add_image (ChatGPT only). Shown above the text.",
);

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
  image: imageField,
  svg: SvgMarkup.optional().describe(
    "Diagram for this card: a complete <svg> with a viewBox about 360 wide, simple shapes, 16–20px labels in the course language, no scripts or external images. Expected on almost every explain card.",
  ),
  /** Short highlighted takeaway shown as a "Remember" box. */
  note: text(400).optional().describe("One-sentence key takeaway, shown in a highlighted \"Remember\" box."),
});

export const McqCard = z.object({
  type: z.literal("mcq"),
  ...base,
  question: text(400),
  image: imageField,
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

export const TrueFalseCard = z.object({
  type: z.literal("true_false"),
  ...base,
  statement: text(400).describe("A claim the learner judges true or false. Great for common misconceptions."),
  answer: z.boolean().describe("true if the statement is correct."),
  image: imageField,
  svg: SvgMarkup.optional(),
  explanation: text(600).optional(),
});

export const MultiCard = z.object({
  type: z.literal("multi"),
  ...base,
  question: text(400),
  image: imageField,
  svg: SvgMarkup.optional(),
  options: z.array(text(200)).min(3).max(8),
  /** Indices of every correct option. */
  answers: z.array(z.number().int().min(0)).min(1).describe("Zero-based indices of ALL correct options (at least one, not all)."),
  explanation: text(600).optional(),
});

export const MatchCard = z.object({
  type: z.literal("match"),
  ...base,
  prompt: text(200).optional(),
  pairs: z
    .array(z.object({ left: text(80), right: text(120) }))
    .min(3)
    .max(6)
    .describe("3–6 pairs, e.g. term → meaning. The player shuffles the right side."),
  explanation: text(600).optional(),
});

export const HotspotCard = z.object({
  type: z.literal("hotspot"),
  ...base,
  question: text(400).describe('What to tap, e.g. "Tap where CO₂ enters the leaf".'),
  svg: SvgMarkup.describe("The picture to tap on. Must have a viewBox; draw the target clearly but don't label it."),
  targets: z
    .array(
      z.object({
        x: z.number(),
        y: z.number(),
        r: z.number().positive().optional().describe("Tap radius in viewBox units; default 7% of the viewBox width."),
        label: text(80).optional(),
      }),
    )
    .min(1)
    .max(4)
    .describe("Correct spot(s) in the SVG's viewBox coordinates: use the same x/y as the shape you drew."),
  explanation: text(600).optional(),
});

const identifier = z
  .string()
  .regex(/^[A-Za-z_][A-Za-z0-9_]{0,23}$/, "variable names are letters, digits and _ (start with a letter)");

export const SimulateCard = z.object({
  type: z.literal("simulate"),
  ...base,
  title: text(120).optional(),
  prompt: text(400).describe("What to explore, e.g. \"Drag the light slider. When does the rate stop rising?\""),
  variables: z
    .array(
      z.object({
        name: identifier.describe("Short ASCII name used in formulas, e.g. light"),
        label: text(60).describe("Shown to the learner, in the course language"),
        min: z.number(),
        max: z.number(),
        step: z.number().positive().optional(),
        default: z.number(),
        unit: text(20).optional(),
      }),
    )
    .min(1)
    .max(3)
    .describe("1–3 sliders."),
  outputs: z
    .array(
      z.object({
        label: text(60),
        formula: text(500).describe("Math over the variable names: + - * / ^ %, ( ), and sin cos tan sqrt abs exp ln log min max round floor ceil pow clamp if; constants pi, e."),
        unit: text(20).optional(),
        decimals: z.number().int().min(0).max(4).optional(),
      }),
    )
    .min(1)
    .max(3)
    .describe("1–3 live results shown as numbers."),
  graph: z
    .object({
      x: z.string().describe("Name of the variable on the x-axis"),
      y: text(500).describe("Formula for the y-axis"),
      xLabel: text(40).optional(),
      yLabel: text(40).optional(),
    })
    .optional()
    .describe("Optional live graph: y as the x variable sweeps its range, with a dot at the current value."),
  goal: z
    .object({
      text: text(200).describe('The task, e.g. "Set the light so the rate is above 20".'),
      condition: text(300).describe('Formula that is true when the task is done, e.g. "light >= 60"'),
    })
    .optional()
    .describe("Optional task. With a goal the card is graded (and reviewed later); without one it's free exploration."),
  svg: SvgMarkup.optional(),
  explanation: text(600).optional(),
});

export const Card = z
  .discriminatedUnion("type", [ExplainCard, McqCard, FillCard, OrderCard, TrueFalseCard, MultiCard, MatchCard, HotspotCard, SimulateCard])
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
    if (card.type === "multi") {
      const bad = card.answers.filter((a) => a >= card.options.length);
      if (bad.length) ctx.addIssue({ code: "custom", path: ["answers"], message: "answers must be indices into options" });
      if (new Set(card.answers).size !== card.answers.length) ctx.addIssue({ code: "custom", path: ["answers"], message: "answers has duplicates" });
      if (card.answers.length >= card.options.length) ctx.addIssue({ code: "custom", path: ["answers"], message: "at least one option must be wrong" });
    }
    if (card.type === "match") {
      const lefts = card.pairs.map((p) => p.left.toLowerCase());
      const rights = card.pairs.map((p) => p.right.toLowerCase());
      if (new Set(lefts).size !== lefts.length || new Set(rights).size !== rights.length) {
        ctx.addIssue({ code: "custom", path: ["pairs"], message: "every left and every right item must be different" });
      }
    }
    if (card.type === "hotspot") {
      const vb = svgViewBox(card.svg);
      if (!vb) {
        ctx.addIssue({ code: "custom", path: ["svg"], message: 'hotspot svg needs a viewBox, e.g. viewBox="0 0 360 240"' });
      } else {
        card.targets.forEach((t, i) => {
          if (t.x < vb.x || t.x > vb.x + vb.w || t.y < vb.y || t.y > vb.y + vb.h) {
            ctx.addIssue({ code: "custom", path: ["targets", i], message: `target (${t.x}, ${t.y}) is outside the viewBox ${vb.x} ${vb.y} ${vb.w} ${vb.h}` });
          }
        });
      }
    }
    if (card.type === "simulate") checkSimulation(card, ctx);
  });

/** Parses an SVG's viewBox ("minX minY width height"). */
export function svgViewBox(svg: string): { x: number; y: number; w: number; h: number } | null {
  const m = /viewBox\s*=\s*["']\s*(-?[\d.]+)[\s,]+(-?[\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*["']/i.exec(svg);
  if (!m) return null;
  const [x, y, w, h] = m.slice(1).map(Number);
  return w > 0 && h > 0 ? { x, y, w, h } : null;
}

function checkSimulation(card: z.infer<typeof SimulateCard>, ctx: z.RefinementCtx) {
  const names = card.variables.map((v) => v.name);
  if (new Set(names).size !== names.length) ctx.addIssue({ code: "custom", path: ["variables"], message: "variable names must be different" });
  card.variables.forEach((v, i) => {
    if (!(v.min < v.max)) ctx.addIssue({ code: "custom", path: ["variables", i], message: "min must be less than max" });
    else if (v.default < v.min || v.default > v.max) ctx.addIssue({ code: "custom", path: ["variables", i, "default"], message: "default must be between min and max" });
  });
  const defaults = Object.fromEntries(card.variables.map((v) => [v.name, v.default]));
  const formula = (src: string, path: (string | number)[], kind: "number" | "condition") => {
    const err = checkFormula(src, names);
    if (err) return ctx.addIssue({ code: "custom", path, message: `formula "${src}" ${err}` });
    const value = calc(src, defaults);
    if (kind === "number" && !Number.isFinite(value)) {
      ctx.addIssue({ code: "custom", path, message: `formula "${src}" isn't a finite number at the default slider values` });
    }
  };
  card.outputs.forEach((o, i) => formula(o.formula, ["outputs", i, "formula"], "number"));
  if (card.graph) {
    if (!names.includes(card.graph.x)) ctx.addIssue({ code: "custom", path: ["graph", "x"], message: `graph.x must be one of: ${names.join(", ")}` });
    formula(card.graph.y, ["graph", "y"], "number");
  }
  if (card.goal) {
    formula(card.goal.condition, ["goal", "condition"], "condition");
    if (!checkFormula(card.goal.condition, names) && calc(card.goal.condition, defaults)) {
      ctx.addIssue({ code: "custom", path: ["goal", "condition"], message: "the goal is already met at the default values; pick defaults that don't meet it" });
    }
  }
}

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
  language: z.string().trim().min(2).max(20).describe('Language code of the content, e.g. "en", "bn", "ar", "hi".'),
  /** Text direction. Derived from language when missing. */
  dir: z.enum(["ltr", "rtl"]).optional(),
  subject: text(60).optional(),
  level: text(60).optional(),
  minutesPerDay: z.number().int().min(1).max(120).optional(),
  /** Accent color for the course header and thumbnail. */
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  source: z.object({ name: text(200) }).optional(),
  /** Pictures from the user's material, added by the server (add_image). Cards point at them by id. */
  images: z
    .array(
      z.object({
        id: ImageId,
        url: z.string().url().regex(/^https?:\/\//),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        alt: text(300).optional(),
      }),
    )
    .max(40)
    .optional(),
  lessons: z.array(Lesson).min(1).max(60),
});

/** Image ids that cards use but the course doesn't have, as "lessonId/card n: img_x". */
export function missingImages(course: { images?: { id: string }[]; lessons: { id: string; cards: Card[] }[] }): string[] {
  const have = new Set((course.images ?? []).map((i) => i.id));
  const missing: string[] = [];
  for (const lesson of course.lessons) {
    lesson.cards.forEach((card, i) => {
      if ("image" in card && card.image && !have.has(card.image)) missing.push(`${lesson.id} card ${i + 1}: ${card.image}`);
    });
  }
  return missing;
}

export type ExplainCard = z.infer<typeof ExplainCard>;
export type McqCard = z.infer<typeof McqCard>;
export type FillCard = z.infer<typeof FillCard>;
export type OrderCard = z.infer<typeof OrderCard>;
export type Card = z.infer<typeof Card>;
export type Lesson = z.infer<typeof Lesson>;
export type Course = z.infer<typeof Course>;
export type TrueFalseCard = z.infer<typeof TrueFalseCard>;
export type MultiCard = z.infer<typeof MultiCard>;
export type MatchCard = z.infer<typeof MatchCard>;
export type HotspotCard = z.infer<typeof HotspotCard>;
export type SimulateCard = z.infer<typeof SimulateCard>;
export type QuestionCard = Exclude<Card, ExplainCard>;

const RTL = new Set(["ar", "fa", "he", "ur", "ps", "sd", "yi", "dv", "ug", "ckb"]);

export function courseDir(course: Pick<Course, "language" | "dir">): "ltr" | "rtl" {
  if (course.dir) return course.dir;
  return RTL.has(course.language.toLowerCase().split("-")[0]) ? "rtl" : "ltr";
}

/** Cards that are graded (and reviewed later). A simulation without a goal is free exploration. */
export function isQuestion(card: Card): card is QuestionCard {
  if (card.type === "explain") return false;
  if (card.type === "simulate") return Boolean(card.goal);
  return true;
}

/** Stable id of a card across sessions: "<lessonId>:<cardId or index>". */
export function cardKey(lesson: Lesson, index: number): string {
  return `${lesson.id}:${lesson.cards[index].id ?? index}`;
}

const LANGUAGE_NAMES: Record<string, string> = {
  bangla: "bn", bengali: "bn", "বাংলা": "bn", english: "en", "ইংরেজি": "en", arabic: "ar", "العربية": "ar",
  hindi: "hi", "हिन्दी": "hi", "हिंदी": "hi", urdu: "ur", "اردو": "ur", spanish: "es", "español": "es",
  french: "fr", "français": "fr", german: "de", deutsch: "de", chinese: "zh", "中文": "zh", japanese: "ja",
  "日本語": "ja", korean: "ko", "한국어": "ko", portuguese: "pt", "português": "pt", russian: "ru", "русский": "ru",
  indonesian: "id", malay: "ms", turkish: "tr", "türkçe": "tr", persian: "fa", farsi: "fa", "فارسی": "fa",
  tamil: "ta", nepali: "ne", "नेपाली": "ne",
};

/** Turns "Bangla" or "বাংলা" into "bn"; leaves real language codes alone. */
export function normalizeLanguage(value: string): string {
  const v = value.trim();
  return LANGUAGE_NAMES[v.toLowerCase()] ?? v;
}
