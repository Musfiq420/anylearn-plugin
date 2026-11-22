import "server-only";
import { Course } from "../schema";
import photosynthesisEn from "@/content/photosynthesis-en.json";
import photosynthesisBn from "@/content/photosynthesis-bn.json";
import waterCycleAr from "@/content/water-cycle-ar.json";
import { hasDatabase } from "./db";
import { siteUrl } from "./site";
import { getPublished } from "./store";

/** Bundled sample courses: always available, even without a database. */
const samples: Course[] = [photosynthesisEn, photosynthesisBn, waterCycleAr].map((c) => Course.parse(c));

export type LoadedCourse = { course: Course; thumbnailUrl: string };

export async function getCourse(id: string): Promise<LoadedCourse | null> {
  const sample = samples.find((c) => c.id === id);
  if (sample) return { course: sample, thumbnailUrl: `${siteUrl()}/api/thumbnail/${sample.id}` };
  if (!hasDatabase() || !/^[A-Za-z0-9_-]{3,40}$/.test(id)) return null;
  const found = await getPublished(id);
  if (!found) return null;
  return { course: found.course, thumbnailUrl: found.thumbnailUrl ?? `${siteUrl()}/api/thumbnail/${id}` };
}

export async function listSampleCourses(): Promise<Course[]> {
  return samples;
}
