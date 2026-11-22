"use client";

import { canCheck, correctText, emptyAnswer, isCorrect, type Answer } from "@/lib/grading";
import { t } from "@/lib/i18n";
import { isQuestion, type Card } from "@/lib/schema";
import { useEffect, useRef, useState } from "react";
import { CheckIcon, CloseIcon } from "../Icons";
import { CardView } from "./Cards";
import type { ContentProps } from "./Player";
import { inline } from "./Rich";

export type RunItem = {
  key: string;
  card: Card;
  /** Review mode: which lesson the card came from, and its memory strength (1–5). */
  from?: string;
  strength?: number;
};

/** First-try result per question card. Explain cards are not included. */
export type RunResult = { key: string; correct: boolean };

export const XP_PER_QUESTION = { lesson: 10, review: 5 } as const;

type Props = {
  items: RunItem[];
  mode: "lesson" | "review";
  /** Language and direction of the course content. The interface itself stays English, left to right. */
  content: ContentProps;
  onExit: () => void;
  onFinish: (results: RunResult[]) => void;
};

export function Runner({ items, mode, content, onExit, onFinish }: Props) {
  const [queue, setQueue] = useState(() => items.map((_, i) => i));
  const [pos, setPos] = useState(0);
  const [answer, setAnswer] = useState<Answer>(() => emptyAnswer(items[0].card));
  const [checked, setChecked] = useState(false);
  const [wasRight, setWasRight] = useState(false);
  const [firstTry, setFirstTry] = useState<Record<string, boolean>>({});
  const top = useRef<HTMLDivElement>(null);

  const item = items[queue[pos]];
  const card = item.card;
  const question = isQuestion(card);
  const firstAttempt = !(item.key in firstTry);

  useEffect(() => {
    top.current?.scrollIntoView({ block: "start" });
  }, [pos]);

  const advance = (requeue: boolean) => {
    const nextQueue = requeue ? [...queue, queue[pos]] : queue;
    const nextPos = pos + 1;
    if (nextPos >= nextQueue.length) {
      onFinish(Object.entries(firstTry).map(([key, correct]) => ({ key, correct })));
      return;
    }
    setQueue(nextQueue);
    setPos(nextPos);
    setAnswer(emptyAnswer(items[nextQueue[nextPos]].card));
    setChecked(false);
    setWasRight(false);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (checked) return advance(!wasRight);
    if (!question) return advance(false);
    if (!canCheck(card, answer)) return;
    const right = isCorrect(card, answer);
    if (firstAttempt) setFirstTry({ ...firstTry, [item.key]: right });
    setWasRight(right);
    setChecked(true);
  };

  const progress = Math.round((pos / queue.length) * 100);
  const showXp = checked && wasRight && firstTry[item.key] === true;
  const explanation = question ? card.explanation : undefined;

  return (
    <form className="lesson" onSubmit={submit} noValidate>
      <div ref={top} />
      <header className="lesson-head">
        <button type="button" className="icon-btn" aria-label={mode === "lesson" ? t.closeLesson : t.closeReview} onClick={onExit}>
          <CloseIcon />
        </button>
        <div
          className="track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-label="Progress"
        >
          <span style={{ width: `${progress}%` }} />
        </div>
        <span className="counter">
          {Math.min(pos + 1, queue.length)}/{queue.length}
        </span>
      </header>

      <main className="lesson-body" key={`${pos}`} {...content}>
        {mode === "review" && (
          <div className="review-meta">
            {item.from && (
              <span className="from-chip">
                {t.fromLabel} <bdi {...content}>{item.from}</bdi>
              </span>
            )}
            <span className="strength">
              {t.memoryStrength}
              <span className="strength-bars" aria-label={`${item.strength ?? 1} of 5`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <span key={n} className={n <= (item.strength ?? 1) ? "on" : ""} />
                ))}
              </span>
            </span>
          </div>
        )}
        <CardView card={card} answer={answer} setAnswer={setAnswer} checked={checked} seed={item.key} />
      </main>

      {!checked && (
        <div className="footer">
          <button type="submit" className="btn" disabled={question && !canCheck(card, answer)}>
            {question ? t.check : t.gotIt}
          </button>
        </div>
      )}

      {checked && wasRight && (
        <div className="feedback right" role="status">
          <div className="feedback-title">
            <span className="feedback-icon">
              <CheckIcon size={20} />
            </span>
            {t.correctTitle}
            {showXp && <span className="xp-chip">+{XP_PER_QUESTION[mode]} XP</span>}
          </div>
          {explanation && <p {...content}>{inline(explanation)}</p>}
          <button type="submit" className="btn good" autoFocus>
            {t.continue}
          </button>
        </div>
      )}

      {checked && !wasRight && (
        <div className="feedback wrong" role="status">
          <div className="feedback-title">
            <span className="feedback-icon">
              <CloseIcon size={18} color="#fff" />
            </span>
            {t.wrongTitle}
          </div>
          <p>
            <strong>{t.correctAnswer}</strong> <bdi {...content}>{inline(correctText(card))}</bdi>
          </p>
          {explanation && <p {...content}>{inline(explanation)}</p>}
          <p style={{ fontSize: 13 }}>{mode === "lesson" ? t.comesBack : t.comesBackReview}</p>
          <button type="submit" className="btn bad" autoFocus>
            {t.ok}
          </button>
        </div>
      )}
    </form>
  );
}
