import { listSampleCourses } from "@/lib/server/courses";
import { t } from "@/lib/i18n";
import { courseDir } from "@/lib/schema";
import Link from "next/link";

export default async function Home() {
  const courses = await listSampleCourses();
  return (
    <main className="landing">
      <section className="hero">
        {/* eslint-disable-next-line @next/next/no-img-element -- small static logo */}
        <img src="/logo.png" alt="AnyLearn logo" />
        <h1>{t.appName}</h1>
        <p>{t.tagline}</p>
      </section>
      <section aria-labelledby="samples-title" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <h2 id="samples-title" className="section-title">
          {t.sampleCourses}
        </h2>
        <div className="samples">
          {courses.map((c) => (
            <Link key={c.id} href={`/c/${c.id}`} className="sample">
              <span className="swatch" style={{ background: c.color ?? "#1F3A8A" }} />
              <strong dir={courseDir(c)} lang={c.language}>
                {c.title}
              </strong>
              <span>
                {t.lessonsCount(c.lessons.length)} · {new Intl.DisplayNames(["en"], { type: "language" }).of(c.language)}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
