import "server-only";

/**
 * The in-chat course card (an MCP App). ChatGPT and Claude render this HTML in
 * a sandboxed frame next to the publish_course result: thumbnail, title, the
 * first lessons and an "Open course" button.
 *
 * Bump the version in the URI whenever the HTML changes: hosts may cache it.
 */
export const COURSE_CARD_URI = "ui://anylearn-plugin/course-card.v1.html";

/** What publish_course returns as structuredContent, and what the card draws. */
export type CourseCardData = {
  url: string;
  thumbnailUrl: string;
  title: string;
  description?: string;
  language: string;
  dir: "ltr" | "rtl";
  color: string;
  lessons: number;
  cards: number;
  minutesPerDay?: number;
  lessonTitles: string[];
};

export function courseCardHtml(siteUrl: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="color-scheme" content="light dark">
<title>AnyLearn course</title>
<style>
  :root { --al-navy: #1F3A8A; --al-amber: #FFB020; }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: transparent; }
  body {
    font-family: var(--font-sans, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Noto Sans Bengali", "Nirmala UI", sans-serif);
    color: var(--color-text-primary, #14213D);
    -webkit-font-smoothing: antialiased;
  }
  .card {
    max-width: 560px;
    border: 1px solid var(--color-border-primary, #E9E2D3);
    border-radius: var(--border-radius-xl, 16px);
    overflow: hidden;
    background: var(--color-background-primary, #FFFFFF);
  }
  .thumb { display: block; width: 100%; aspect-ratio: 1200 / 630; object-fit: cover; background: var(--al-navy); border: 0; }
  .body { padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 10px; }
  .brand { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--color-text-secondary, #5E6472); }
  .brand i { width: 8px; height: 8px; border-radius: 50%; background: var(--al-amber); display: inline-block; }
  h1 { margin: 0; font-size: 18px; line-height: 1.35; font-weight: 700; }
  /* The thumbnail already shows the title; keep it for screen readers, show it if the image fails. */
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .desc { margin: 0; font-size: 14px; line-height: 1.5; color: var(--color-text-secondary, #5E6472); }
  .meta { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { font-size: 12px; font-weight: 600; padding: 3px 9px; border-radius: 999px; background: var(--color-background-secondary, #F3EFE6); color: var(--color-text-secondary, #3E465A); }
  ol { margin: 0; padding-inline-start: 22px; font-size: 14px; line-height: 1.7; color: var(--color-text-primary, #14213D); }
  ol li::marker { color: var(--color-text-tertiary, #5E6472); }
  .more { font-size: 13px; color: var(--color-text-tertiary, #5E6472); }
  .actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 2px; }
  button.open {
    appearance: none; border: 0; cursor: pointer; font: inherit;
    height: 40px; padding: 0 18px; border-radius: 999px;
    background: var(--al-navy); color: #FFFFFF; font-size: 14px; font-weight: 700;
  }
  button.open:hover { filter: brightness(1.12); }
  button.open:focus-visible { outline: 3px solid var(--al-amber); outline-offset: 2px; }
  .url { font-size: 12px; color: var(--color-text-tertiary, #5E6472); overflow-wrap: anywhere; user-select: all; }
  .skeleton .thumb { animation: pulse 1.4s ease-in-out infinite; }
  .bar { height: 14px; border-radius: 7px; background: var(--color-background-secondary, #EDE6D8); }
  .error { padding: 14px 16px; font-size: 14px; color: var(--color-text-danger, #B54708); }
  @keyframes pulse { 50% { opacity: 0.6; } }
  @media (prefers-reduced-motion: reduce) { .skeleton .thumb { animation: none; } }
</style>
</head>
<body>
<div id="root">
  <div class="card skeleton" aria-busy="true">
    <div class="thumb"></div>
    <div class="body">
      <div class="brand"><i></i>AnyLearn</div>
      <div class="bar" style="width: 70%"></div>
      <div class="bar" style="width: 45%"></div>
    </div>
  </div>
</div>
<script type="module">
  import { App, applyDocumentTheme, applyHostStyleVariables, applyHostFonts } from "${siteUrl}/mcp-app/sdk.js";

  const root = document.getElementById("root");
  const app = new App({ name: "AnyLearn course card", version: "1.0.0" });

  const el = (tag, props = {}, ...children) => {
    const node = Object.assign(document.createElement(tag), props);
    for (const c of children) if (c != null) node.append(c);
    return node;
  };

  function applyHost(ctx) {
    if (!ctx) return;
    if (ctx.theme) applyDocumentTheme(ctx.theme);
    if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
    if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts);
  }

  function render(result) {
    const data = result?.structuredContent;
    if (result?.isError || !data?.url) {
      const text = result?.content?.find((c) => c.type === "text")?.text ?? "The course couldn't be published.";
      root.replaceChildren(el("div", { className: "card" }, el("div", { className: "error", textContent: text })));
      return;
    }
    const lang = { lang: data.language || "", dir: data.dir || "ltr" };
    const meta = [
      data.lessons + (data.lessons === 1 ? " lesson" : " lessons"),
      data.cards + " cards",
      data.minutesPerDay ? data.minutesPerDay + " min a day" : null,
      "Spaced reviews",
    ].filter(Boolean);
    const titles = Array.isArray(data.lessonTitles) ? data.lessonTitles : [];
    const shown = titles.slice(0, 4);

    const title = Object.assign(el("h1", { className: "sr", textContent: data.title }), lang);
    const img = el("img", { className: "thumb", src: data.thumbnailUrl, alt: "" });
    img.onerror = () => { img.remove(); title.classList.remove("sr"); };

    const open = el("button", { className: "open", type: "button", textContent: "Open course" });
    open.onclick = async () => {
      try {
        const r = await app.openLink({ url: data.url });
        if (r?.isError) throw new Error("declined");
      } catch {
        window.open(data.url, "_blank", "noopener");
      }
    };

    root.replaceChildren(
      el("article", { className: "card" },
        img,
        el("div", { className: "body" },
          title,
          data.description ? Object.assign(el("p", { className: "desc", textContent: data.description }), lang) : null,
          el("div", { className: "meta" }, ...meta.map((m) => el("span", { className: "chip", textContent: m }))),
          shown.length ? Object.assign(el("ol", {}, ...shown.map((t) => el("li", { textContent: t }))), lang) : null,
          titles.length > shown.length ? el("div", { className: "more", textContent: "+ " + (titles.length - shown.length) + " more" }) : null,
          el("div", { className: "actions" }, open, el("span", { className: "url", textContent: data.url.replace(/^https?:\\/\\//, "") })),
        ),
      ),
    );
  }

  app.onhostcontextchanged = applyHost;
  app.ontoolresult = render;
  await app.connect();
  applyHost(app.getHostContext());
</script>
</body>
</html>`;
}
