"use client";

import { t } from "@/lib/i18n";
import { FlameBurst, StarBurst } from "../Icons";

type Stat = { tone: "amber" | "green" | "blue"; label: string; value: string };

type Props = {
  kind: "lesson" | "review";
  title: string;
  body: string;
  stats: Stat[];
  onBack: () => void;
  onAgain?: () => void;
};

export function DoneScreen({ kind, title, body, stats, onBack, onAgain }: Props) {
  return (
    <div className="lesson">
      <main className="done" role="status">
        {kind === "lesson" ? <StarBurst /> : <FlameBurst />}
        <h1>{title}</h1>
        <p>{body}</p>
        <div className="stats">
          {stats.map((s) => (
            <div key={s.label} className={`stat ${s.tone}`}>
              <span>{s.label}</span>
              <strong>{s.value}</strong>
            </div>
          ))}
        </div>
      </main>
      <div className="done-actions">
        <button type="button" className="btn" onClick={onBack} autoFocus>
          {t.backToCourse}
        </button>
        {onAgain && (
          <button type="button" className="btn ghost" onClick={onAgain}>
            {t.tryAgain}
          </button>
        )}
      </div>
    </div>
  );
}
