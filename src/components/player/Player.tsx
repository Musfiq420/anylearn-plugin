"use client";

import { t } from "@/lib/i18n";
import { touchStreak, useCourseProgress, useProfile, visibleStreak, type CourseProgress } from "@/lib/progress";
import { cardKey, courseDir, isQuestion, type Course } from "@/lib/schema";
import { daysUntil, dueDate, grade, isDue, strength } from "@/lib/srs";
import { useMemo, useState } from "react";
import { CourseHome } from "./CourseHome";
import { DoneScreen } from "./DoneScreen";
import { Runner, XP_PER_QUESTION, type RunItem, type RunResult } from "./Runner";

const LESSON_BONUS_XP = 10;
const REVIEW_BATCH = 20;

type View =
  | { name: "home" }
  | { name: "lesson"; index: number; run: number }
  | { name: "review"; run: number; items: RunItem[] }
  | { name: "lesson-done"; index: number; xp: number; accuracy: number; questions: number; nextDays: number | null }
  | { name: "review-done"; xp: number; remembered: number; total: number; nextDays: number | null };

export type ContentProps = { dir: "ltr" | "rtl"; lang: string };

export function Player({ course }: { course: Course }) {
  const [progress, updateProgress] = useCourseProgress(course.id);
  const [profile, updateProfile] = useProfile();
  const [view, setView] = useState<View>({ name: "home" });
  const content: ContentProps = { dir: courseDir(course), lang: course.language };

  /** Every question card in the course, by key, with the lesson it belongs to. */
  const index = useMemo(() => {
    const map = new Map<string, { item: RunItem; lessonIndex: number }>();
    course.lessons.forEach((lesson, li) =>
      lesson.cards.forEach((card, ci) => {
        if (isQuestion(card)) map.set(cardKey(lesson, ci), { item: { key: cardKey(lesson, ci), card, from: lesson.title }, lessonIndex: li });
      }),
    );
    return map;
  }, [course]);

  const dueKeys = (p: CourseProgress | null, now = new Date()) =>
    Object.entries(p?.srs ?? {})
      .filter(([key, s]) => index.has(key) && isDue(s, now))
      .sort(([, a], [, b]) => dueDate(a).getTime() - dueDate(b).getTime())
      .map(([key]) => key);

  const nextDue = (p: CourseProgress, now = new Date()): number | null => {
    const dates = Object.entries(p.srs)
      .filter(([key]) => index.has(key))
      .map(([, s]) => dueDate(s).getTime());
    return dates.length ? daysUntil(new Date(Math.min(...dates)), now) : null;
  };

  const applyResults = (results: RunResult[], xp: number, extra?: (p: CourseProgress) => CourseProgress) => {
    const now = new Date();
    let saved: CourseProgress | null = null;
    updateProgress((prev) => {
      const srs = { ...prev.srs };
      for (const r of results) srs[r.key] = grade(srs[r.key], r.correct, now);
      let next: CourseProgress = { ...prev, srs, xp: prev.xp + xp };
      if (extra) next = extra(next);
      saved = next;
      return next;
    });
    updateProfile((p) => touchStreak(p, now));
    return saved as unknown as CourseProgress;
  };

  const startLesson = (i: number) => setView({ name: "lesson", index: i, run: Date.now() });

  const startReview = () => {
    const items = dueKeys(progress)
      .slice(0, REVIEW_BATCH)
      .map((key) => ({ ...index.get(key)!.item, strength: strength(progress?.srs[key]) }));
    if (items.length) setView({ name: "review", run: Date.now(), items });
  };

  if (view.name === "lesson") {
    const lesson = course.lessons[view.index];
    const items: RunItem[] = lesson.cards.map((card, ci) => ({ key: cardKey(lesson, ci), card }));
    return (
      <Runner
          key={view.run}
          items={items}
          content={content}
          mode="lesson"
          onExit={() => setView({ name: "home" })}
          onFinish={(results) => {
            const correct = results.filter((r) => r.correct).length;
            const accuracy = results.length ? correct / results.length : 1;
            const xp = correct * XP_PER_QUESTION.lesson + LESSON_BONUS_XP;
            const saved = applyResults(results, xp, (p) => {
              const best = Math.max(accuracy, p.completed[lesson.id]?.accuracy ?? 0);
              return { ...p, completed: { ...p.completed, [lesson.id]: { at: new Date().toISOString(), accuracy: best } } };
            });
            setView({ name: "lesson-done", index: view.index, xp, accuracy, questions: results.length, nextDays: nextDue(saved) });
          }}
        />
    );
  }

  if (view.name === "review") {
    return (
      <Runner
          key={view.run}
          items={view.items}
          content={content}
          mode="review"
          onExit={() => setView({ name: "home" })}
          onFinish={(results) => {
            const remembered = results.filter((r) => r.correct).length;
            const xp = remembered * XP_PER_QUESTION.review;
            const saved = applyResults(results, xp);
            setView({ name: "review-done", xp, remembered, total: results.length, nextDays: nextDue(saved) });
          }}
        />
    );
  }

  if (view.name === "lesson-done") {
    return (
      <DoneScreen
        kind="lesson"
        title={t.lessonComplete}
        body={t.lessonCompleteBody(view.questions)}
        stats={[
          { tone: "amber", label: t.xpEarned, value: `+${view.xp}` },
          { tone: "green", label: t.accuracy, value: `${Math.round(view.accuracy * 100)}%` },
          { tone: "blue", label: t.nextReview, value: view.nextDays === null ? "–" : view.nextDays === 0 ? "Today" : t.inDays(view.nextDays) },
        ]}
        onBack={() => setView({ name: "home" })}
        onAgain={() => startLesson(view.index)}
      />
    );
  }

  if (view.name === "review-done") {
    return (
      <DoneScreen
        kind="review"
        title={t.reviewComplete}
        body={t.reviewCompleteBody}
        stats={[
          { tone: "amber", label: t.xpEarned, value: `+${view.xp}` },
          { tone: "green", label: t.remembered, value: `${view.remembered}/${view.total}` },
          { tone: "blue", label: t.nextReview, value: view.nextDays === null ? "–" : view.nextDays === 0 ? "Today" : t.inDays(view.nextDays) },
        ]}
        onBack={() => setView({ name: "home" })}
      />
    );
  }

  return (
    <CourseHome
      course={course}
      content={content}
      progress={progress}
      streak={visibleStreak(profile)}
      dueCount={dueKeys(progress).length}
      nextDueDays={progress ? nextDue(progress) : null}
      onStartLesson={startLesson}
      onStartReview={startReview}
    />
  );
}
