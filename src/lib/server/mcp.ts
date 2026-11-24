import "server-only";
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/server";
import { COURSE_CARD_URI, courseCardHtml } from "./courseCard";
import { hasDatabase } from "./db";
import { siteUrl } from "./site";
import {
  AddLessonInput,
  addLesson,
  CreateCourseInput,
  createCourse,
  GetCourseInput,
  getCourseForTool,
  PublishInput,
  publishCourse,
  ToolError,
} from "./store";

/**
 * The AnyLearn MCP server: four tools the user's ChatGPT or Claude calls to
 * build a course. The AI writes the content; AnyLearn validates, stores and
 * hosts it.
 */

export const SERVER_INSTRUCTIONS = `AnyLearn turns anything the user wants to learn into an interactive course: short explanations with diagrams, questions with instant feedback, and spaced-repetition reviews, hosted at a shareable link.

How to build a course:
1. Before calling any tool, ask the user a few quick questions in ONE message (skip what they already said): their level, how many lessons (default 5–8), minutes per day, the course language (default: the language they are writing in), and any focus (e.g. exam prep). Wait for the answer. If they attached a book, notes or images, base the course on that material and set "source" on cards (e.g. "p. 12").
2. Call create_course with the title and the lesson outline. Keep courseId and editToken for the next calls. Never show the editToken to the user.
3. Call add_lesson once per lesson, in order, with 5–10 cards:
   - Open with an "explain" card, then alternate explanations and questions; at least half the cards should be questions.
   - Make it hands-on: mix question types, and use the interactive ones whenever they fit. Don't make every question an mcq.
     • "mcq": one right option, plausible wrong ones.
     • "true_false": a statement to judge; ideal for common misconceptions.
     • "multi": select all that apply (some, not all, options correct).
     • "fill": sentence with ___; add a "bank" of word tiles for short answers.
     • "order": 3–6 steps written in the correct order (the player shuffles them).
     • "match": 3–6 pairs (term → meaning, part → job, word → translation).
     • "hotspot": the learner taps the right spot on your svg. Draw the target shape unlabeled and give its centre as x/y in the same viewBox coordinates you drew it at.
     • "simulate": 1–3 sliders feeding live formulas, with an optional graph and a goal ("set the light so the rate is above 25"). Use one in every lesson where the topic has a quantity or cause → effect (physics, chemistry, biology rates, economics, finance, statistics, geometry). Formulas use the variable names, + - * / ^, comparisons, and sin cos sqrt exp ln log min max round pow clamp if; pi and e. The goal must not already be met at the default slider values.
   - Every question gets a short "explanation".
   - Diagrams: give almost every explain card an "svg" diagram, and add one to questions (mcq, true_false, multi, simulate) when a picture helps. Skip it only when a picture would add nothing. Make diagrams readable on phones: viewBox about 360 wide (e.g. "0 0 360 240"), label font-size 16–20, at most 6 labels, simple shapes, labels in the course language, no scripts or external images.
   - "note" is optional: use it only for a crisp one-line takeaway, not to repeat the body.
   - Keep text short; learners read on phones. Write everything in the course language.
4. Call publish_course, then give the user the link. Mention they can share it and that reviews are scheduled automatically.

If a tool returns an error, fix the problem it describes and call it again.`;

type Result = { content: { type: "text"; text: string }[]; structuredContent?: Record<string, unknown>; isError?: boolean };

const ok = (text: string, data: Record<string, unknown>): Result => ({
  content: [{ type: "text", text }],
  structuredContent: data,
});

async function run(fn: () => Promise<Result>): Promise<Result> {
  if (!hasDatabase()) {
    return { isError: true, content: [{ type: "text", text: "AnyLearn's database isn't configured on this server yet." }] };
  }
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ToolError) return { isError: true, content: [{ type: "text", text: err.message }] };
    console.error("AnyLearn tool error", err);
    return { isError: true, content: [{ type: "text", text: "AnyLearn hit an unexpected error. Try again in a moment." }] };
  }
}

export function registerTools(server: McpServer) {
  server.registerTool(
    "create_course",
    {
      title: "Create an AnyLearn course",
      description:
        "Start a new course (as a draft) with a title and lesson outline. Returns courseId and editToken; then add each lesson with add_lesson and finish with publish_course. Ask the user about level, length and language first.",
      inputSchema: CreateCourseInput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    (input) =>
      run(async () => {
        const r = await createCourse(input);
        const outline = r.lessons.map((l) => `${l.id} (${l.title})`).join(", ");
        return ok(
          `Draft course created.\ncourseId: ${r.courseId}\neditToken: ${r.editToken} (keep private)\nNext: call add_lesson for each lesson: ${outline}. Then call publish_course.`,
          r,
        );
      }),
  );

  server.registerTool(
    "add_lesson",
    {
      title: "Add a lesson",
      description:
        "Add or replace one lesson's cards. Use a lessonId from the outline (or a new id plus a title to append a lesson). Cards: explain, mcq, true_false, multi, fill, order, match, hotspot (tap the right spot on an svg), simulate (sliders + live formulas + graph). Mix types and include interactive ones (match, hotspot, simulate) where they fit. Give almost every explain card an \"svg\" diagram; a lesson with explanations but no diagram is rejected. Returns which lessons are still empty.",
      inputSchema: AddLessonInput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    (input) =>
      run(async () => {
        const r = await addLesson(input);
        const next = r.readyToPublish
          ? r.status === "published"
            ? `All lessons have cards. The course is live and already shows this change: ${r.url}`
            : "All lessons have cards. Call publish_course."
          : `Still empty: ${r.emptyLessons.join(", ")}.`;
        return ok(`Saved lesson "${input.lessonId}" (${input.cards.length} cards). ${r.lessonsWithCards}/${r.lessonsTotal} lessons done. ${next}`, r);
      }),
  );

  // publish_course also shows the course card (an MCP App) in hosts that support it.
  registerAppTool(
    server,
    "publish_course",
    {
      title: "Publish the course",
      description:
        "Publish a course once every lesson has cards. Shows the user a course card with an Open button, and returns the shareable link and thumbnail URL. Can be called again after edits to refresh the thumbnail.",
      inputSchema: PublishInput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      _meta: { ui: { resourceUri: COURSE_CARD_URI } },
    },
    (input) =>
      run(async () => {
        const r = await publishCourse(input);
        return ok(
          `Published "${r.title}": ${r.lessons} lessons, ${r.cards} cards.\nLink: ${r.url}\nThumbnail: ${r.thumbnailUrl}\nA course card with an Open button is shown to the user where supported; still give them the link in your reply.`,
          r as unknown as Record<string, unknown>,
        );
      }),
  );

  registerAppResource(
    server,
    "AnyLearn course card",
    COURSE_CARD_URI,
    { description: "Shows a published course with its thumbnail and an Open course button." },
    async () => {
      const site = siteUrl();
      const domains = [site, process.env.SUPABASE_URL?.replace(/\/$/, "")].filter((d): d is string => Boolean(d));
      return {
        contents: [
          {
            uri: COURSE_CARD_URI,
            mimeType: RESOURCE_MIME_TYPE,
            text: courseCardHtml(site),
            _meta: { ui: { csp: { resourceDomains: domains }, prefersBorder: false } },
          },
        ],
      };
    },
  );

  server.registerTool(
    "get_course",
    {
      title: "Get a course",
      description: "Load a course's full content and build progress, e.g. to continue building it or to edit a lesson later.",
      inputSchema: GetCourseInput,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    (input) =>
      run(async () => {
        const r = await getCourseForTool(input);
        return ok(
          `Course "${r.course.title}" (${r.status}). ${r.progress.lessonsWithCards}/${r.progress.lessonsTotal} lessons have cards.${r.url ? ` Link: ${r.url}` : ""}\n${JSON.stringify(r.course)}`,
          r as unknown as Record<string, unknown>,
        );
      }),
  );
}
