import { describe, expect, it } from "vitest";

/**
 * Course store against a real Postgres. Runs only when TEST_DATABASE_URL points
 * at a database where supabase/migrations/0001_anylearn.sql has been applied.
 */
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("course store (Postgres)", () => {
  it("creates, fills, publishes and loads a course", async () => {
    process.env.DATABASE_URL = url;
    const store = await import("../server/store");
    const { courseId, editToken } = await store.createCourse({
      title: "Test course",
      language: "en",
      lessons: [{ title: "One" }, { title: "Two" }],
    });

    await expect(store.publishCourse({ courseId, editToken })).rejects.toThrow(/no cards yet: l1, l2/);
    await expect(
      store.addLesson({ courseId, editToken: "alt_not-the-token", lessonId: "l1", cards: [{ type: "explain", body: "x" }] }),
    ).rejects.toThrow(/doesn't match/);

    const cards = [{ type: "mcq" as const, question: "2+2?", options: ["3", "4"], answer: 1 }];
    await store.addLesson({ courseId, editToken, lessonId: "l1", cards });
    const progress = await store.addLesson({ courseId, editToken, lessonId: "l2", cards });
    expect(progress.readyToPublish).toBe(true);

    const published = await store.publishCourse({ courseId, editToken });
    expect(published.url).toContain(`/c/${courseId}`);

    const loaded = await store.getPublished(courseId);
    expect(loaded?.course.lessons).toHaveLength(2);
  }, 30_000);
});
