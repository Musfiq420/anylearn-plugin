import "server-only";
import { Resvg } from "@resvg/resvg-js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { courseDir, type Course } from "../schema";
import { lineSvg, shapeLine, wrapText, type ShapedLine } from "./textpath";

/**
 * 1200×630 course thumbnail, used as the link preview image and in the chat card.
 * Text is shaped with HarfBuzz and drawn as paths (see textpath.ts), then
 * rasterized with resvg, so every script renders correctly.
 */

const W = 1200;
const H = 630;
const LEFT = 80;
const TITLE_MAX = 700;

let logoData: string | null = null;
function logo(): string {
  logoData ??= `data:image/png;base64,${readFileSync(path.join(process.cwd(), "assets", "logo-256.png")).toString("base64")}`;
  return logoData;
}

async function fitTitle(title: string, rtl: boolean): Promise<{ size: number; lines: ShapedLine[] }> {
  for (const size of [76, 66, 56, 48]) {
    const lines = await wrapText(title, size, "bold", TITLE_MAX, rtl);
    if (lines.length <= 3) return { size, lines };
  }
  const words = title.split(/\s+/);
  let cut = words.length;
  let lines = await wrapText(title, 48, "bold", TITLE_MAX, rtl);
  while (lines.length > 3 && cut > 1) {
    cut--;
    lines = await wrapText(words.slice(0, cut).join(" ") + "…", 48, "bold", TITLE_MAX, rtl);
  }
  return { size: 48, lines };
}

function isLight(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45;
}

export async function thumbnailSvg(course: Course): Promise<string> {
  const color = course.color ?? "#1F3A8A";
  const light = isLight(color);
  const ink = light ? "#14213D" : "#FFFFFF";
  const rtl = courseDir(course) === "rtl";

  const { size, lines } = await fitTitle(course.title, rtl);
  const lineHeight = Math.round(size * 1.2);
  const metaY = H - 80;
  const titleBottom = metaY - 60;
  const titleTop = titleBottom - lineHeight * (lines.length - 1);
  const title = lines
    .map((l, i) => lineSvg(l, rtl ? LEFT + TITLE_MAX - l.width : LEFT, titleTop + i * lineHeight, ink))
    .join("");

  const brand = await shapeLine("AnyLearn", 34, "bold");
  const lessons = `${course.lessons.length} ${course.lessons.length === 1 ? "lesson" : "lessons"}`;
  const metaText = [lessons, "Interactive course", course.minutesPerDay ? `${course.minutesPerDay} min a day` : null]
    .filter(Boolean)
    .join("  ·  ");
  const meta = await shapeLine(metaText, 26, "medium");

  let subject = "";
  if (course.subject) {
    const s = await shapeLine(course.subject, 22, "medium");
    const x = LEFT + 76 + brand.width + 28;
    subject = `<rect x="${x}" y="78" rx="20" width="${Math.round(s.width + 40)}" height="40" fill="${ink}" fill-opacity="0.14"/>${lineSvg(s, x + 20, 105, ink)}`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${color}"/>
  <g transform="translate(860 120)">
    <path d="M150 0c8 56 34 82 90 94-56 12-82 38-90 94-8-56-34-82-90-94 56-12 82-38 90-94z" fill="${ink}" fill-opacity="0.16"/>
    <path d="M70 230c4 28 17 41 45 47-28 6-41 19-45 47-4-28-17-41-45-47 28-6 41-19 45-47z" fill="#FFB020"/>
    <path d="M240 210c3 20 12 29 32 33-20 4-29 13-32 33-3-20-12-29-32-33 20-4 29-13 32-33z" fill="#FFB020" fill-opacity="0.85"/>
  </g>
  <image href="${logo()}" x="${LEFT}" y="68" width="60" height="60"/>
  ${lineSvg(brand, LEFT + 76, 110, ink)}
  ${subject}
  ${title}
  ${lineSvg(meta, LEFT, metaY, ink, light ? 0.72 : 0.82)}
</svg>`;
}

export async function renderThumbnail(course: Course): Promise<Buffer> {
  const resvg = new Resvg(await thumbnailSvg(course), {
    fitTo: { mode: "width", value: W },
    font: { loadSystemFonts: false },
  });
  return resvg.render().asPng();
}
