"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { StoredCard } from "./srs";

/**
 * Learner progress, kept in the browser for now (Phase 1).
 * Phase 5 moves this to the server so it syncs across devices.
 */

export type CourseProgress = {
  v: 1;
  /** Finished lessons, with the first-try accuracy (0..1) of the best run. */
  completed: Record<string, { at: string; accuracy: number }>;
  xp: number;
  /** Spaced-repetition state per question card, keyed by cardKey(). */
  srs: Record<string, StoredCard>;
};

export type Profile = {
  v: 1;
  streak: { count: number; lastDay: string | null };
};

const PREFIX = "anylearn-plugin:v1:";
const cache = new Map<string, unknown>();
const listeners = new Set<() => void>();

function read<T>(key: string, empty: () => T): T {
  if (!cache.has(key)) {
    let value: T = empty();
    try {
      const raw = window.localStorage.getItem(PREFIX + key);
      if (raw) value = { ...value, ...JSON.parse(raw) };
    } catch {
      // Storage can be unavailable (private mode, blocked cookies). Progress then lasts for the visit.
    }
    cache.set(key, value);
  }
  return cache.get(key) as T;
}

function write<T>(key: string, value: T) {
  cache.set(key, value);
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // See read(): keep the in-memory value.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key?.startsWith(PREFIX)) {
      cache.delete(e.key.slice(PREFIX.length));
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const emptyCourse = (): CourseProgress => ({ v: 1, completed: {}, xp: 0, srs: {} });
const emptyProfile = (): Profile => ({ v: 1, streak: { count: 0, lastDay: null } });

function useStored<T>(key: string, empty: () => T) {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key, empty),
    () => null,
  );
  const update = useCallback((fn: (prev: T) => T) => write(key, fn(read(key, empty))), [key, empty]);
  return [value, update] as const;
}

export function useCourseProgress(courseId: string) {
  return useStored(`course:${courseId}`, emptyCourse);
}

export function useProfile() {
  return useStored("profile", emptyProfile);
}

export function localDay(date = new Date()): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

/** Extends the streak if the learner hadn't practiced yet today. */
export function touchStreak(profile: Profile, now = new Date()): Profile {
  const today = localDay(now);
  const { count, lastDay } = profile.streak;
  if (lastDay === today) return profile;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const next = lastDay === localDay(yesterday) ? count + 1 : 1;
  return { ...profile, streak: { count: next, lastDay: today } };
}

/** The streak to show: it resets to 0 once a whole day is missed. */
export function visibleStreak(profile: Profile | null, now = new Date()): number {
  if (!profile?.streak.lastDay) return 0;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const alive = profile.streak.lastDay === localDay(now) || profile.streak.lastDay === localDay(yesterday);
  return alive ? profile.streak.count : 0;
}
