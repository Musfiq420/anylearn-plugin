import { Fragment, type ReactNode } from "react";

/**
 * Tiny, safe markdown: paragraphs, "- " lists, **bold**, *italic*, `code`.
 * Builds React elements directly, so no HTML from a course is ever injected.
 */
export function Markdown({ text }: { text: string }) {
  const blocks = text.trim().split(/\n\s*\n/);
  return (
    <div className="prose">
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
          return (
            <ul key={i}>
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*[-*]\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {inline(l)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

export function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) out.push(<strong key={m.index}>{m[1]}</strong>);
    else if (m[2] !== undefined) out.push(<em key={m.index}>{m[2]}</em>);
    else out.push(<code key={m.index}>{m[3]}</code>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Shows course SVG through <img>, so any script inside it can never run. */
/** Course SVG as a data: URL for <img>. */
export function svgDataUrl(svg: string): string {
  const markup = /\sxmlns=/.test(svg) ? svg : svg.replace(/^<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}

export function SvgFigure({ svg, label }: { svg: string; label?: string }) {
  const src = svgDataUrl(svg);
  return (
    <figure className="figure">
      {/* eslint-disable-next-line @next/next/no-img-element -- data: URL from course content */}
      <img src={src} alt={label ?? ""} />
    </figure>
  );
}
