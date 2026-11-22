"use client";

import { fillBlankCorrect, type Answer } from "@/lib/grading";
import { t } from "@/lib/i18n";
import { BLANK, type Card, type ExplainCard, type FillCard, type McqCard, type OrderCard } from "@/lib/schema";
import { shuffledIndices } from "@/lib/text";
import { Fragment } from "react";
import { CheckIcon, CloseIcon, SparkIcon } from "../Icons";
import { inline, Markdown, SvgFigure } from "./Rich";

export type CardProps<C extends Card, A extends Answer> = {
  card: C;
  answer: A;
  setAnswer: (a: A) => void;
  /** True once the learner pressed Check. Inputs lock and show right/wrong. */
  checked: boolean;
  /** Seed for stable shuffles, usually the card key. */
  seed: string;
};

export function CardView(props: CardProps<Card, Answer>) {
  const { card } = props;
  switch (card.type) {
    case "explain":
      return <ExplainView card={card} />;
    case "mcq":
      return <McqView {...(props as CardProps<McqCard, Extract<Answer, { type: "mcq" }>>)} />;
    case "fill":
      return <FillView {...(props as CardProps<FillCard, Extract<Answer, { type: "fill" }>>)} />;
    case "order":
      return <OrderView {...(props as CardProps<OrderCard, Extract<Answer, { type: "order" }>>)} />;
  }
}

function ExplainView({ card }: { card: ExplainCard }) {
  return (
    <>
      <div className="eyebrow">{t.newIdea}</div>
      {card.title && <h1 className="card-title">{card.title}</h1>}
      <Markdown text={card.body} />
      {card.svg && <SvgFigure svg={card.svg} label={card.title} />}
      {card.note && (
        <div className="note">
          <SparkIcon />
          <div>
            <strong>{t.remember}</strong>
            <span>{inline(card.note)}</span>
          </div>
        </div>
      )}
      {card.source && <div className="source">{card.source}</div>}
    </>
  );
}

const KEYS = ["A", "B", "C", "D", "E", "F"];

function McqView({ card, answer, setAnswer, checked }: CardProps<McqCard, Extract<Answer, { type: "mcq" }>>) {
  return (
    <>
      <div className="eyebrow" id="mcq-label">
        {t.chooseAnswer}
      </div>
      <h1 className="card-title">{inline(card.question)}</h1>
      {card.svg && <SvgFigure svg={card.svg} />}
      <div className="options" role="radiogroup" aria-labelledby="mcq-label">
        {card.options.map((option, i) => {
          let state = "idle";
          if (!checked && answer.selected === i) state = "selected";
          if (checked && i === card.answer) state = "correct";
          if (checked && answer.selected === i && i !== card.answer) state = "wrong";
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={answer.selected === i}
              className="option"
              data-state={state}
              disabled={checked}
              onClick={() => setAnswer({ type: "mcq", selected: i })}
            >
              <span className="option-key">
                {state === "correct" ? <CheckIcon size={18} /> : state === "wrong" ? <CloseIcon size={16} color="#fff" /> : KEYS[i]}
              </span>
              <span>{inline(option)}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function FillView({ card, answer, setAnswer, checked }: CardProps<FillCard, Extract<Answer, { type: "fill" }>>) {
  const parts = card.text.split(BLANK);
  const values = answer.values;
  const set = (i: number, v: string) => setAnswer({ type: "fill", values: values.map((old, j) => (j === i ? v : old)) });
  const slotClass = (i: number) => {
    if (checked) return fillBlankCorrect(card, i, values[i]) ? "correct" : "wrong";
    return values[i] ? "filled" : "";
  };

  // A tile is "used" when that word already fills as many blanks as there are copies of it up to here.
  const used = (index: number) => {
    const word = card.bank![index];
    const copiesSoFar = card.bank!.slice(0, index + 1).filter((w) => w === word).length;
    return values.filter((v) => v === word).length >= copiesSoFar;
  };
  const placeTile = (word: string) => {
    const empty = values.findIndex((v) => !v);
    if (empty >= 0) set(empty, word);
  };

  return (
    <>
      <div className="eyebrow">{card.prompt ?? t.fillBlank}</div>
      <div className="sentence">
        {parts.map((part, i) => (
          <Fragment key={i}>
            {inline(part)}
            {i < parts.length - 1 &&
              (card.bank ? (
                <button
                  type="button"
                  className={`slot ${slotClass(i)}`}
                  aria-label={values[i] ? `Blank ${i + 1}: ${values[i]}. Tap to clear` : `Blank ${i + 1}, empty`}
                  disabled={checked || !values[i]}
                  onClick={() => set(i, "")}
                >
                  {values[i]}
                </button>
              ) : (
                <input
                  className={`slot ${slotClass(i)}`}
                  aria-label={`Blank ${i + 1}`}
                  placeholder={card.blanks.length === 1 ? t.typeHere : `${i + 1}`}
                  value={values[i]}
                  disabled={checked}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  enterKeyHint="done"
                  onChange={(e) => set(i, e.target.value)}
                />
              ))}
          </Fragment>
        ))}
      </div>
      {card.bank && (
        <>
          <div className="hint">{t.tapWord}</div>
          <div className="tiles">
            {card.bank.map((word, i) => {
              const isUsed = used(i);
              return (
                <button
                  key={i}
                  type="button"
                  className={`tile ${isUsed ? "used" : ""}`}
                  disabled={checked || isUsed}
                  aria-hidden={isUsed}
                  onClick={() => placeTile(word)}
                >
                  {word}
                </button>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

function OrderView({ card, answer, setAnswer, checked, seed }: CardProps<OrderCard, Extract<Answer, { type: "order" }>>) {
  const pool = shuffledIndices(card.items.length, seed).filter((i) => !answer.picked.includes(i));
  const empties = card.items.length - answer.picked.length;
  return (
    <>
      <div className="eyebrow">{t.putInOrder}</div>
      <h1 className="card-title">{inline(card.prompt)}</h1>
      <ol className="order-zone" style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {answer.picked.map((idx, n) => (
          <li key={idx}>
            <button
              type="button"
              className={`order-item ${checked ? (idx === n ? "correct" : "wrong") : ""}`}
              style={{ width: "100%" }}
              disabled={checked}
              aria-label={`${n + 1}. ${card.items[idx]}. Tap to remove`}
              onClick={() => setAnswer({ type: "order", picked: answer.picked.filter((x) => x !== idx) })}
            >
              <span className="order-num">{n + 1}</span>
              <span>{inline(card.items[idx])}</span>
            </button>
          </li>
        ))}
        {Array.from({ length: empties }, (_, k) => (
          <li key={`empty-${k}`} className="order-slot" aria-hidden="true">
            <span className="order-num">{answer.picked.length + k + 1}</span>
          </li>
        ))}
      </ol>
      {pool.length > 0 && <div className="divider">{t.tapToPlace}</div>}
      <div className="pool">
        {pool.map((idx) => (
          <button
            key={idx}
            type="button"
            className="tile"
            disabled={checked}
            onClick={() => setAnswer({ type: "order", picked: [...answer.picked, idx] })}
          >
            {inline(card.items[idx])}
          </button>
        ))}
      </div>
    </>
  );
}
