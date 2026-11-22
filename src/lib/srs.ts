import { createEmptyCard, fsrs, generatorParameters, Rating, TypeConvert, type Card as FsrsCard } from "ts-fsrs";

/**
 * Spaced repetition with FSRS. Short-term learning steps are off, so the
 * shortest gap is one day: a wrong answer comes back tomorrow, a right one
 * after a few days, and the gaps grow as memory gets stronger.
 */
const scheduler = fsrs(generatorParameters({ enable_short_term: false, enable_fuzz: true }));

/** FSRS card as stored in localStorage (dates become ISO strings). */
export type StoredCard = Record<string, unknown>;

export function loadCard(stored: StoredCard | undefined, now: Date): FsrsCard {
  return stored ? TypeConvert.card(stored as unknown as FsrsCard) : createEmptyCard(now);
}

export function grade(stored: StoredCard | undefined, correct: boolean, now = new Date()): StoredCard {
  const card = loadCard(stored, now);
  const { card: next } = scheduler.next(card, now, correct ? Rating.Good : Rating.Again);
  return JSON.parse(JSON.stringify(next)) as StoredCard;
}

export function dueDate(stored: StoredCard): Date {
  return new Date(String(stored.due));
}

export function isDue(stored: StoredCard, now = new Date()): boolean {
  return dueDate(stored).getTime() <= now.getTime();
}

/** Memory strength from 1 to 5, from FSRS stability (in days). */
export function strength(stored: StoredCard | undefined): number {
  if (!stored) return 1;
  const s = Number(stored.stability) || 0;
  if (s >= 30) return 5;
  if (s >= 12) return 4;
  if (s >= 5) return 3;
  if (s >= 2) return 2;
  return 1;
}

/** Whole days from today (local) until the given date; 0 means today or overdue. */
export function daysUntil(date: Date, now = new Date()): number {
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const b = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}
