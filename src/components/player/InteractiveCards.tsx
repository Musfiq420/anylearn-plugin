"use client";

import { calc } from "@/lib/expr";
import { hotspotHit, targetRadius, type AnswerOf } from "@/lib/grading";
import { t } from "@/lib/i18n";
import { svgViewBox, type HotspotCard, type MatchCard, type MultiCard, type SimulateCard, type TrueFalseCard } from "@/lib/schema";
import { shuffledIndices } from "@/lib/text";
import { useMemo } from "react";
import { CheckIcon, CloseIcon, SparkIcon } from "../Icons";
import type { CardProps } from "./Cards";
import { inline, SvgFigure, svgDataUrl } from "./Rich";

/* ---------- True / false ---------- */

export function TrueFalseView({ card, answer, setAnswer, checked }: CardProps<TrueFalseCard, AnswerOf<"true_false">>) {
  const choices = [true, false] as const;
  return (
    <>
      <div className="eyebrow">{t.trueOrFalse}</div>
      <div className="statement">
        {card.svg && <SvgFigure svg={card.svg} />}
        <p>{inline(card.statement)}</p>
      </div>
      <div className="tf-row" role="radiogroup" aria-label={t.trueOrFalse}>
        {choices.map((value) => {
          let state = "idle";
          if (!checked && answer.value === value) state = "selected";
          if (checked && value === card.answer) state = "correct";
          if (checked && answer.value === value && value !== card.answer) state = "wrong";
          return (
            <button
              key={String(value)}
              type="button"
              role="radio"
              aria-checked={answer.value === value}
              className="tf-btn"
              data-state={state}
              disabled={checked}
              onClick={() => setAnswer({ type: "true_false", value })}
            >
              {value ? <CheckIcon size={26} color="currentColor" /> : <CloseIcon size={24} color="currentColor" />}
              {value ? t.trueLabel : t.falseLabel}
            </button>
          );
        })}
      </div>
    </>
  );
}

/* ---------- Select all ---------- */

export function MultiView({ card, answer, setAnswer, checked }: CardProps<MultiCard, AnswerOf<"multi">>) {
  const toggle = (i: number) =>
    setAnswer({
      type: "multi",
      selected: answer.selected.includes(i) ? answer.selected.filter((x) => x !== i) : [...answer.selected, i],
    });
  return (
    <>
      <div className="eyebrow-row">
        <span className="eyebrow">{t.selectAll}</span>
        {answer.selected.length > 0 && !checked && <span className="count-chip">{t.selectedCount(answer.selected.length)}</span>}
      </div>
      <h1 className="card-title">{inline(card.question)}</h1>
      {card.svg && <SvgFigure svg={card.svg} />}
      <div className="options">
        {card.options.map((option, i) => {
          const picked = answer.selected.includes(i);
          const right = card.answers.includes(i);
          let state = picked ? "selected" : "idle";
          if (checked) state = picked && right ? "correct" : picked ? "wrong" : right ? "missed" : "idle";
          return (
            <button
              key={i}
              type="button"
              role="checkbox"
              aria-checked={picked}
              className="option"
              data-state={state}
              disabled={checked}
              onClick={() => toggle(i)}
            >
              <span className="check-box" aria-hidden="true">
                {(picked || state === "missed") && <CheckIcon size={16} color="currentColor" />}
              </span>
              <span>{inline(option)}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

/* ---------- Match pairs ---------- */

export function MatchView({ card, answer, setAnswer, checked, seed }: CardProps<MatchCard, AnswerOf<"match">>) {
  const rightOrder = useMemo(() => shuffledIndices(card.pairs.length, `${seed}:right`), [card.pairs.length, seed]);

  const tap = (side: "left" | "right", index: number) => {
    if (checked || answer.matched.includes(index)) return;
    const active = answer.active;
    if (!active || active.side === side) {
      setAnswer({ ...answer, active: { side, index }, wrong: null });
      return;
    }
    const left = side === "left" ? index : active.index;
    const right = side === "right" ? index : active.index;
    if (left === right) {
      setAnswer({ ...answer, matched: [...answer.matched, left], active: null, wrong: null });
    } else {
      setAnswer({ ...answer, mistakes: answer.mistakes + 1, active: null, wrong: { left, right } });
    }
  };

  const stateOf = (side: "left" | "right", index: number) => {
    if (answer.matched.includes(index)) return "matched";
    if (answer.wrong && answer.wrong[side] === index) return "wrong";
    if (answer.active?.side === side && answer.active.index === index) return "selected";
    return "idle";
  };

  return (
    <>
      <div className="eyebrow">{card.prompt ?? t.matchPairs}</div>
      <div className="match-grid">
        <div className="match-col">
          {card.pairs.map((p, i) => (
            <button key={i} type="button" className="match-item" data-state={stateOf("left", i)} disabled={checked || answer.matched.includes(i)} onClick={() => tap("left", i)}>
              {inline(p.left)}
            </button>
          ))}
        </div>
        <div className="match-col">
          {rightOrder.map((i) => (
            <button key={i} type="button" className="match-item" data-state={stateOf("right", i)} disabled={checked || answer.matched.includes(i)} onClick={() => tap("right", i)}>
              {inline(card.pairs[i].right)}
            </button>
          ))}
        </div>
      </div>
      <div className="hint">
        {answer.matched.length === 0 && !answer.active ? t.matchHint : t.pairsMatched(answer.matched.length, card.pairs.length)}
      </div>
    </>
  );
}

/* ---------- Tap the picture ---------- */

export function HotspotView({ card, answer, setAnswer, checked }: CardProps<HotspotCard, AnswerOf<"hotspot">>) {
  const vb = svgViewBox(card.svg) ?? { x: 0, y: 0, w: 360, h: 240 };
  const pct = (x: number, y: number) => ({ left: `${((x - vb.x) / vb.w) * 100}%`, top: `${((y - vb.y) / vb.h) * 100}%` });
  const hit = answer.point ? hotspotHit(card, answer.point) : false;

  const place = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setAnswer({
      type: "hotspot",
      point: {
        x: vb.x + ((e.clientX - rect.left) / rect.width) * vb.w,
        y: vb.y + ((e.clientY - rect.top) / rect.height) * vb.h,
      },
    });
  };

  return (
    <>
      <div className="eyebrow">{t.tapPicture}</div>
      <h1 className="card-title">{inline(card.question)}</h1>
      <div className="hotspot-frame">
        <button
          type="button"
          className="hotspot-area"
          style={{ aspectRatio: `${vb.w} / ${vb.h}` }}
          disabled={checked}
          onClick={place}
          aria-label={t.tapPicture}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- data: URL from course content */}
          <img src={svgDataUrl(card.svg)} alt="" draggable={false} />
          {checked &&
            card.targets.map((tg, i) => {
              const r = (targetRadius(card, tg) / 1.15 / vb.w) * 100;
              return <span key={i} className="hotspot-target" style={{ ...pct(tg.x, tg.y), width: `${r * 2}%` }} />;
            })}
          {answer.point && (
            <span
              className="hotspot-marker"
              data-state={checked ? (hit ? "correct" : "wrong") : "idle"}
              style={pct(answer.point.x, answer.point.y)}
            />
          )}
        </button>
      </div>
      {answer.point && !checked && <div className="hint">{t.yourMarker}</div>}
    </>
  );
}

/* ---------- Simulation ---------- */

function formatNumber(value: number, lang: string | undefined, decimals?: number) {
  if (!Number.isFinite(value)) return "–";
  const digits = decimals ?? (Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2);
  try {
    return new Intl.NumberFormat(lang || "en", { maximumFractionDigits: digits, minimumFractionDigits: decimals ?? 0 }).format(value);
  } catch {
    return value.toFixed(digits);
  }
}

export function SimulateView({ card, answer, setAnswer, checked, lang }: CardProps<SimulateCard, AnswerOf<"simulate">>) {
  const values = answer.values;
  const goalMet = card.goal ? Boolean(calc(card.goal.condition, values)) : false;
  const set = (name: string, v: number) => setAnswer({ type: "simulate", values: { ...values, [name]: v } });

  return (
    <>
      <div className="eyebrow">{t.tryItYourself}</div>
      {card.title && <h1 className="card-title">{card.title}</h1>}
      <p className="sim-prompt">{inline(card.prompt)}</p>
      {card.svg && <SvgFigure svg={card.svg} />}

      <div className="sim-outputs">
        {card.outputs.map((o, i) => (
          <div key={i} className="sim-output">
            <span>{o.label}</span>
            <strong>
              {formatNumber(calc(o.formula, values), lang, o.decimals)}
              {o.unit && <small> {o.unit}</small>}
            </strong>
          </div>
        ))}
      </div>

      {card.graph && <SimGraph card={card} values={values} lang={lang} />}

      <div className="sim-sliders">
        {card.variables.map((v) => {
          const id = `sim-${v.name}`;
          const step = v.step ?? (v.max - v.min) / 100;
          return (
            <div key={v.name} className="sim-slider">
              <div className="sim-slider-head">
                <label htmlFor={id}>{v.label}</label>
                <strong>
                  {formatNumber(values[v.name], lang)}
                  {v.unit && <small> {v.unit}</small>}
                </strong>
              </div>
              <input
                id={id}
                type="range"
                min={v.min}
                max={v.max}
                step={step}
                value={values[v.name]}
                disabled={checked}
                onChange={(e) => set(v.name, Number(e.target.value))}
              />
            </div>
          );
        })}
      </div>

      {card.goal && (
        <div className="note" data-state={goalMet ? "met" : "open"}>
          <SparkIcon />
          <div>
            <strong>{goalMet ? t.goalMet : t.goal}</strong>
            <span>{inline(card.goal.text)}</span>
          </div>
        </div>
      )}
    </>
  );
}

function SimGraph({ card, values, lang }: { card: SimulateCard; values: Record<string, number>; lang?: string }) {
  const g = card.graph!;
  const xv = card.variables.find((v) => v.name === g.x) ?? card.variables[0];
  const W = 340;
  const H = 210;
  const pad = { l: 48, r: 14, t: 14, b: 40 };

  const points: [number, number][] = [];
  for (let i = 0; i <= 80; i++) {
    const x = xv.min + ((xv.max - xv.min) * i) / 80;
    const y = calc(g.y, { ...values, [xv.name]: x });
    if (Number.isFinite(y)) points.push([x, y]);
  }
  let yMin = Math.min(...points.map((p) => p[1]), 0);
  let yMax = Math.max(...points.map((p) => p[1]));
  if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) return null;
  if (yMax - yMin < 1e-9) {
    yMax += 1;
    yMin -= 1;
  }
  const span = yMax - yMin;
  yMax += span * 0.08;

  const sx = (x: number) => pad.l + ((x - xv.min) / (xv.max - xv.min)) * (W - pad.l - pad.r);
  const sy = (y: number) => H - pad.b - ((y - yMin) / (yMax - yMin)) * (H - pad.t - pad.b);
  const cx = values[xv.name];
  const cy = calc(g.y, values);
  const line = points.map(([x, y]) => `${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join(" ");
  const xLabel = g.xLabel ?? `${xv.label}${xv.unit ? ` (${xv.unit})` : ""}`;
  const yLabel = g.yLabel ?? card.outputs[0]?.label ?? "";

  return (
    <figure className="figure sim-graph">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${yLabel} vs ${xLabel}`}>
        <line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} className="axis" />
        <line x1={pad.l} y1={pad.t} x2={pad.l} y2={H - pad.b} className="axis" />
        <text x={pad.l} y={H - pad.b + 16} className="tick" textAnchor="middle">{formatNumber(xv.min, lang)}</text>
        <text x={W - pad.r} y={H - pad.b + 16} className="tick" textAnchor="end">{formatNumber(xv.max, lang)}</text>
        <text x={pad.l - 6} y={sy(yMin) + 4} className="tick" textAnchor="end">{formatNumber(yMin, lang)}</text>
        <text x={pad.l - 6} y={pad.t + 10} className="tick" textAnchor="end">{formatNumber(yMax, lang)}</text>
        <text x={(pad.l + W - pad.r) / 2} y={H - 6} className="axis-label" textAnchor="middle">{xLabel}</text>
        <text x={12} y={(pad.t + H - pad.b) / 2} className="axis-label" textAnchor="middle" transform={`rotate(-90 12 ${(pad.t + H - pad.b) / 2})`}>
          {yLabel}
        </text>
        <polyline points={line} className="curve" />
        {Number.isFinite(cy) && (
          <>
            <line x1={sx(cx)} y1={H - pad.b} x2={sx(cx)} y2={sy(cy)} className="guide" />
            <circle cx={sx(cx)} cy={sy(cy)} r={7} className="dot" />
          </>
        )}
      </svg>
    </figure>
  );
}
