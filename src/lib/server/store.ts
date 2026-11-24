import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { Card, Course, courseDir, Lesson, normalizeLanguage, type Course as CourseT } from "../schema";
import type { CourseCardData } from "./courseCard";
import { db } from "./db";
import { courseUrl, siteUrl } from "./site";
import { uploadPublic } from "./storage";
import { renderThumbnail } from "./thumbnail";

/**
 * Course storage and the rules behind the MCP tools. Everything here returns
 * or throws messages written for the AI that is building the course, so it
 * can fix its own mistakes.
 */

export class ToolError extends Error {}

/** A course while it's being built: lessons may still be empty. */
export const DraftLesson = Lesson.extend({ cards: z.array(Card).max(30) });
export const DraftCourse = Course.extend({ lessons: z.array(DraftLesson).min(1).max(60) });
export type DraftCourse = z.infer<typeof DraftCourse>;

type Row = {
  id: string;
  edit_token_hash: string;
  status: "draft" | "published";
  data: unknown;
  thumbnail_url: string | null;
  version: number;
};

const MAX_COURSES_PER_HOUR = Number(process.env.MAX_COURSES_PER_HOUR ?? 300);
const ID_ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function newId(): string {
  const bytes = randomBytes(10);
  return Array.from(bytes.subarray(0, 8), (b) => ID_ALPHABET[b % ID_ALPHABET.length]).join("");
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

function tokenMatches(token: string, hash: string): boolean {
  const a = Buffer.from(hashToken(token), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function formatIssues(error: z.ZodError, prefix = ""): string {
  return error.issues
    .slice(0, 15)
    .map((i) => `- ${[prefix, ...i.path].filter((p) => p !== "").join(".") || "(root)"}: ${i.message}`)
    .join("\n");
}

/** Lesson progress, for telling the AI what's left to do. */
export function draftStatus(course: DraftCourse) {
  const empty = course.lessons.filter((l) => l.cards.length === 0).map((l) => l.id);
  return {
    lessonsTotal: course.lessons.length,
    lessonsWithCards: course.lessons.length - empty.length,
    emptyLessons: empty,
    readyToPublish: empty.length === 0,
  };
}

async function loadForEdit(sql: ReturnType<typeof db>, id: string, editToken: string): Promise<Row> {
  const rows = await sql<Row[]>`
    select id, edit_token_hash, status, data, thumbnail_url, version
    from anylearn_plugin.courses where id = ${id} for update`;
  const row = rows[0];
  if (!row) throw new ToolError(`No course with id "${id}". Check the course_id returned by create_course.`);
  if (!tokenMatches(editToken, row.edit_token_hash)) {
    throw new ToolError("edit_token doesn't match this course. Use the edit_token returned by create_course.");
  }
  return row;
}

export const CreateCourseInput = z.object({
  title: Course.shape.title,
  description: Course.shape.description,
  language: Course.shape.language,
  dir: Course.shape.dir,
  subject: Course.shape.subject,
  level: Course.shape.level,
  minutesPerDay: Course.shape.minutesPerDay,
  color: Course.shape.color,
  sourceName: z.string().trim().min(1).max(200).optional(),
  lessons: z
    .array(z.object({ id: Lesson.shape.id.optional(), title: Lesson.shape.title }))
    .min(1)
    .max(60),
});

export async function createCourse(input: z.infer<typeof CreateCourseInput>) {
  const sql = db();
  const [{ n }] = await sql<{ n: number }[]>`
    select count(*)::int as n from anylearn_plugin.courses where created_at > now() - interval '1 hour'`;
  if (n >= MAX_COURSES_PER_HOUR) throw new ToolError("AnyLearn is busy right now. Ask the user to try again in a little while.");

  const ids = new Set<string>();
  const lessons = input.lessons.map((l, i) => {
    let id = l.id ?? `l${i + 1}`;
    while (ids.has(id)) id = `${id}-${i + 1}`;
    ids.add(id);
    return { id, title: l.title, cards: [] };
  });
  const id = newId();
  const draft: DraftCourse = DraftCourse.parse({
    schemaVersion: 1,
    id,
    title: input.title,
    description: input.description,
    language: normalizeLanguage(input.language),
    dir: input.dir,
    subject: input.subject,
    level: input.level,
    minutesPerDay: input.minutesPerDay,
    color: input.color,
    source: input.sourceName ? { name: input.sourceName } : undefined,
    lessons,
  });
  const editToken = `alt_${randomBytes(24).toString("base64url")}`;
  await sql`
    insert into anylearn_plugin.courses (id, edit_token_hash, title, language, data)
    values (${id}, ${hashToken(editToken)}, ${draft.title}, ${draft.language}, ${sql.json(draft)})`;
  return { courseId: id, editToken, lessons: lessons.map(({ id, title }) => ({ id, title })) };
}

export const AddLessonInput = z.object({
  courseId: z.string().trim().min(3).max(40),
  editToken: z.string().trim().min(10).max(200),
  lessonId: Lesson.shape.id,
  title: Lesson.shape.title.optional(),
  cards: Lesson.shape.cards,
});

export async function addLesson(input: z.infer<typeof AddLessonInput>) {
  const sql = db();
  return sql.begin(async (tx) => {
    const row = await loadForEdit(tx as unknown as ReturnType<typeof db>, input.courseId, input.editToken);
    const draft = DraftCourse.parse(row.data);
    const index = draft.lessons.findIndex((l) => l.id === input.lessonId);
    if (index < 0 && !input.title) {
      throw new ToolError(
        `Lesson "${input.lessonId}" isn't in the outline (${draft.lessons.map((l) => l.id).join(", ")}). Pass a title to add it as a new lesson at the end.`,
      );
    }
    if (index < 0 && draft.lessons.length >= 60) throw new ToolError("A course can have at most 60 lessons.");
    const lesson = {
      id: input.lessonId,
      title: input.title ?? draft.lessons[index].title,
      cards: input.cards,
    };
    const check = Lesson.safeParse(lesson);
    if (!check.success) throw new ToolError(`The lesson isn't valid:\n${formatIssues(check.error)}`);
    const hasExplain = check.data.cards.some((c) => c.type === "explain");
    const hasDiagram = check.data.cards.some((c) => "svg" in c && Boolean(c.svg));
    if (hasExplain && !hasDiagram) {
      throw new ToolError(
        'The lesson wasn\'t saved: it has no diagram. Add an "svg" diagram to the explain cards (ideally almost every one): a complete <svg> with viewBox about "0 0 360 240", simple shapes and short labels in the course language. Then call add_lesson again.',
      );
    }
    if (index < 0) draft.lessons.push(check.data);
    else draft.lessons[index] = check.data;

    await tx`
      update anylearn_plugin.courses
      set data = ${tx.json(draft as never)}, title = ${draft.title}, version = version + 1, updated_at = now()
      where id = ${row.id}`;
    return { ...draftStatus(draft), status: row.status, url: row.status === "published" ? courseUrl(row.id) : undefined };
  });
}

export const PublishInput = z.object({
  courseId: z.string().trim().min(3).max(40),
  editToken: z.string().trim().min(10).max(200),
});

export async function publishCourse(input: z.infer<typeof PublishInput>) {
  const sql = db();
  const { course, version } = await sql.begin(async (tx) => {
    const row = await loadForEdit(tx as unknown as ReturnType<typeof db>, input.courseId, input.editToken);
    const draft = DraftCourse.parse(row.data);
    const status = draftStatus(draft);
    if (!status.readyToPublish) {
      throw new ToolError(`These lessons have no cards yet: ${status.emptyLessons.join(", ")}. Add them with add_lesson first.`);
    }
    const parsed = Course.safeParse(draft);
    if (!parsed.success) throw new ToolError(`The course isn't valid yet:\n${formatIssues(parsed.error)}`);
    const [{ version }] = await tx<{ version: number }[]>`
      update anylearn_plugin.courses
      set status = 'published', published_at = coalesce(published_at, now()), version = version + 1, updated_at = now()
      where id = ${row.id}
      returning version`;
    return { course: parsed.data, version };
  });

  const thumbnailUrl = await storeThumbnail(course, version);
  await sql`update anylearn_plugin.courses set thumbnail_url = ${thumbnailUrl} where id = ${course.id}`;
  const card: CourseCardData = {
    url: courseUrl(course.id),
    thumbnailUrl,
    title: course.title,
    description: course.description,
    language: course.language,
    dir: courseDir(course),
    color: course.color ?? "#1F3A8A",
    lessons: course.lessons.length,
    cards: course.lessons.reduce((n, l) => n + l.cards.length, 0),
    minutesPerDay: course.minutesPerDay,
    lessonTitles: course.lessons.map((l) => l.title),
  };
  return card;
}

/** Renders the thumbnail and puts it in the bucket. Falls back to the on-demand route. */
async function storeThumbnail(course: CourseT, version: number): Promise<string> {
  const fallback = `${siteUrl()}/api/thumbnail/${course.id}?v=${version}`;
  try {
    const png = await renderThumbnail(course);
    return (await uploadPublic(`thumbnails/${course.id}-v${version}.png`, png, "image/png")) ?? fallback;
  } catch (err) {
    console.error("thumbnail upload failed", err);
    return fallback;
  }
}

export const GetCourseInput = z.object({
  courseId: z.string().trim().min(3).max(40),
});

export async function getCourseForTool(input: z.infer<typeof GetCourseInput>) {
  const rows = await db()<Row[]>`
    select id, edit_token_hash, status, data, thumbnail_url, version from anylearn_plugin.courses where id = ${input.courseId}`;
  const row = rows[0];
  if (!row) throw new ToolError(`No course with id "${input.courseId}".`);
  const draft = DraftCourse.parse(row.data);
  return {
    status: row.status,
    url: row.status === "published" ? courseUrl(row.id) : undefined,
    progress: draftStatus(draft),
    course: draft,
  };
}

/** For the player: a published course, or null. */
export async function getPublished(id: string): Promise<{ course: CourseT; thumbnailUrl: string | null } | null> {
  const rows = await db()<Row[]>`
    select id, edit_token_hash, status, data, thumbnail_url, version
    from anylearn_plugin.courses where id = ${id} and status = 'published'`;
  const row = rows[0];
  if (!row) return null;
  const parsed = Course.safeParse(row.data);
  return parsed.success ? { course: parsed.data, thumbnailUrl: row.thumbnail_url } : null;
}
