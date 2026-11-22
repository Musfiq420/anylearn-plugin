"use client";

import { t } from "@/lib/i18n";
import type { CourseProgress } from "@/lib/progress";
import type { Course } from "@/lib/schema";
import Link from "next/link";
import { BoltIcon, CheckIcon, CourseArt, FileIcon, FlameIcon, LockIcon, PlayIcon, RefreshIcon, TrophyIcon } from "../Icons";
import type { ContentProps } from "./Player";

type Props = {
  course: Course;
  content: ContentProps;
  progress: CourseProgress | null;
  streak: number;
  dueCount: number;
  nextDueDays: number | null;
  onStartLesson: (index: number) => void;
  onStartReview: () => void;
};

const ZIGZAG = [0, 48, 84, 48];

export function CourseHome({ course, content, progress, streak, dueCount, nextDueDays, onStartLesson, onStartReview }: Props) {
  const color = course.color ?? "#1F3A8A";
  const completed = progress?.completed ?? {};
  const doneCount = course.lessons.filter((l) => completed[l.id]).length;
  const currentIndex = course.lessons.findIndex((l) => !completed[l.id]);
  const hasReviews = Object.keys(progress?.srs ?? {}).length > 0;
  const meta = [t.lessonsCount(course.lessons.length), course.minutesPerDay && t.minutesPerDay(course.minutesPerDay), course.level]
    .filter(Boolean)
    .join(" · ");

  let reviewText = t.reviewEmpty;
  if (dueCount > 0) reviewText = t.reviewDue(dueCount);
  else if (hasReviews) reviewText = nextDueDays === null ? t.reviewNone : `${t.reviewNone}. ${t.reviewNext(nextDueDays)}.`;

  return (
    <div className="app">
      <header className="topbar">
        <Link href="/" className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element -- small static logo */}
          <img src="/logo.png" alt="" />
          {t.appName}
        </Link>
        <div className="pills">
          <span className="pill" aria-label={t.streak(streak)} title={t.streak(streak)}>
            <FlameIcon />
            {streak}
          </span>
          <span className="pill" aria-label={t.xp(progress?.xp ?? 0)} title={t.xp(progress?.xp ?? 0)}>
            <BoltIcon />
            {progress?.xp ?? 0}
          </span>
        </div>
      </header>

      <main className="home">
        <section className="course-card">
          <div className="course-band" style={{ background: `color-mix(in srgb, ${color} 14%, white)` }}>
            {course.subject && (
              <span className="tag" style={{ color }} {...content}>
                {course.subject}
              </span>
            )}
            <CourseArt color={color} />
          </div>
          <div className="course-info">
            <h1 className="course-title" {...content}>
              {course.title}
            </h1>
            {meta && (
              <div className="meta" {...content}>
                {meta}
              </div>
            )}
            {course.source && (
              <div className="meta-row">
                <FileIcon />
                <span>{t.source(course.source.name)}</span>
              </div>
            )}
            <div className="progress">
              <div
                className="track"
                role="progressbar"
                aria-label="Course progress"
                aria-valuemin={0}
                aria-valuemax={course.lessons.length}
                aria-valuenow={doneCount}
              >
                <span style={{ width: `${(doneCount / course.lessons.length) * 100}%`, background: color }} />
              </div>
              <span className="meta" style={{ fontWeight: 600 }}>
                {doneCount}/{course.lessons.length}
              </span>
            </div>
          </div>
        </section>

        <section className="review-card" aria-labelledby="review-title">
          <span className="icon-circle">
            <RefreshIcon />
          </span>
          <div style={{ flex: 1 }}>
            <h2 id="review-title">{t.todaysReview}</h2>
            <p>{reviewText}</p>
          </div>
          <button type="button" className="btn small" disabled={dueCount === 0} onClick={onStartReview}>
            {t.start}
          </button>
        </section>

        <h2 className="section-title">{t.lessons}</h2>
        <ol className="path">
          {course.lessons.map((lesson, i) => {
            const state = completed[lesson.id] ? "done" : i === currentIndex ? "current" : "locked";
            const isLast = i === course.lessons.length - 1;
            return (
              <li key={lesson.id} style={{ marginInlineStart: ZIGZAG[i % ZIGZAG.length] }}>
                <button
                  type="button"
                  className={`path-row is-${state}`}
                  disabled={state === "locked"}
                  onClick={() => onStartLesson(i)}
                  aria-label={`${i + 1}. ${lesson.title}. ${state === "done" ? t.done : state === "current" ? t.start : t.locked}`}
                >
                  <span className={`node is-${state}`}>
                    {state === "done" && <CheckIcon size={26} />}
                    {state === "current" && <PlayIcon />}
                    {state === "locked" && (isLast ? <TrophyIcon /> : <LockIcon />)}
                  </span>
                  <span className="path-label">
                    <strong {...content}>
                      {i + 1}. {lesson.title}
                    </strong>
                    <span>
                      {state === "done" && `${t.done} · ${t.replay}`}
                      {state === "current" && t.startSteps(lesson.cards.length)}
                      {state === "locked" && t.locked}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </main>
    </div>
  );
}
