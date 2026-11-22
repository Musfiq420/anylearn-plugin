import { t } from "@/lib/i18n";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="app">
      <div className="done">
        {/* eslint-disable-next-line @next/next/no-img-element -- small static logo */}
        <img src="/logo.png" alt="" width={72} height={72} style={{ borderRadius: "50%" }} />
        <h1>{t.notFound}</h1>
        <p>{t.notFoundBody}</p>
        <Link href="/" className="btn" style={{ maxWidth: 280 }}>
          {t.goHome}
        </Link>
      </div>
    </main>
  );
}
