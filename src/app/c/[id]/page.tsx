import { Player } from "@/components/player/Player";
import { getCourse } from "@/lib/server/courses";
import { t } from "@/lib/i18n";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

export async function generateMetadata(props: PageProps<"/c/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const found = await getCourse(id);
  if (!found) notFound();
  const { course, thumbnailUrl } = found;
  const description = course.description ?? t.lessonsCount(course.lessons.length);
  return {
    title: course.title,
    description,
    openGraph: {
      title: course.title,
      description,
      type: "website",
      siteName: t.appName,
      images: [{ url: thumbnailUrl, width: 1200, height: 630, alt: course.title }],
    },
    twitter: { card: "summary_large_image", title: course.title, description, images: [thumbnailUrl] },
  };
}

export default function CoursePage(props: PageProps<"/c/[id]">) {
  return (
    <Suspense fallback={<div className="app" aria-busy="true" />}>
      <CourseLoader params={props.params} />
    </Suspense>
  );
}

async function CourseLoader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = await getCourse(id);
  if (!found) notFound();
  return <Player course={found.course} />;
}
