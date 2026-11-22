import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Turns text into SVG paths with HarfBuzz, the shaping engine browsers use.
 * Rasterizers like resvg and satori get Bangla vowel signs and conjuncts
 * wrong; drawing pre-shaped glyph outlines sidesteps that for every script.
 */

type Hb = typeof import("harfbuzzjs");
type HbFont = InstanceType<Hb["Font"]>;

export type Weight = "bold" | "medium";
type Script = "latn" | "beng" | "deva" | "arab";

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
const FILES: Record<Script, Record<Weight, string>> = {
  latn: { bold: "PlusJakartaSans_800ExtraBold.ttf", medium: "PlusJakartaSans_600SemiBold.ttf" },
  beng: { bold: "NotoSansBengali_700Bold.ttf", medium: "NotoSansBengali_500Medium.ttf" },
  deva: { bold: "NotoSansDevanagari_700Bold.ttf", medium: "NotoSansDevanagari_500Medium.ttf" },
  arab: { bold: "NotoSansArabic_700Bold.ttf", medium: "NotoSansArabic_500Medium.ttf" },
};

let hbPromise: Promise<Hb> | null = null;
const fonts = new Map<string, { font: HbFont; upem: number; paths: Map<number, string> }>();

async function getFont(script: Script, weight: Weight) {
  const file = FILES[script][weight];
  const cached = fonts.get(file);
  if (cached) return cached;
  hbPromise ??= import("harfbuzzjs");
  const hb = await hbPromise;
  const face = new hb.Face(new hb.Blob(readFileSync(path.join(FONT_DIR, file))));
  const entry = { font: new hb.Font(face), upem: face.upem, paths: new Map<number, string>() };
  fonts.set(file, entry);
  return entry;
}

function scriptOf(ch: string): Script | null {
  const c = ch.codePointAt(0) ?? 0;
  if (c >= 0x0980 && c <= 0x09ff) return "beng";
  if (c >= 0x0900 && c <= 0x097f) return "deva";
  if ((c >= 0x0600 && c <= 0x06ff) || (c >= 0x0750 && c <= 0x077f) || (c >= 0xfb50 && c <= 0xfeff)) return "arab";
  if (/\p{L}/u.test(ch)) return "latn";
  return null; // spaces, digits, punctuation: join the neighbouring run
}

/** Splits text into runs of one script each. */
function runs(text: string): { text: string; script: Script }[] {
  const out: { text: string; script: Script }[] = [];
  for (const ch of text) {
    const s = scriptOf(ch);
    const last = out[out.length - 1];
    if (last && (s === null || s === last.script)) last.text += ch;
    else if (!last && s === null) out.push({ text: ch, script: "latn" });
    else out.push({ text: ch, script: s ?? "latn" });
  }
  // A leading neutral run takes the script of what follows it.
  if (out.length > 1 && !/\p{L}/u.test(out[0].text)) {
    out[1].text = out[0].text + out[1].text;
    out.shift();
  }
  return out;
}

type Glyph = { d: string; x: number; y: number; k: number };
export type ShapedLine = { width: number; glyphs: Glyph[] };

export async function shapeLine(text: string, size: number, weight: Weight, rtl = false): Promise<ShapedLine> {
  const hb = await (hbPromise ??= import("harfbuzzjs"));
  const pieces: ShapedLine[] = [];
  for (const run of runs(text)) {
    const { font, upem, paths } = await getFont(run.script, weight);
    const k = size / upem;
    const buffer = new hb.Buffer();
    buffer.addText(run.text);
    buffer.guessSegmentProperties();
    hb.shape(font, buffer);
    const infos = buffer.getGlyphInfos();
    const positions = buffer.getGlyphPositions();
    let x = 0;
    const glyphs: Glyph[] = [];
    infos.forEach((info, i) => {
      const p = positions[i];
      let d = paths.get(info.codepoint);
      if (d === undefined) {
        d = font.glyphToPath(info.codepoint);
        paths.set(info.codepoint, d);
      }
      if (d) glyphs.push({ d, x: x + p.xOffset * k, y: -p.yOffset * k, k });
      x += p.xAdvance * k;
    });
    pieces.push({ width: x, glyphs });
  }
  // Simple bidi: in a right-to-left line, runs read from right to left.
  if (rtl) pieces.reverse();
  let offset = 0;
  const glyphs: Glyph[] = [];
  for (const piece of pieces) {
    for (const g of piece.glyphs) glyphs.push({ ...g, x: g.x + offset });
    offset += piece.width;
  }
  return { width: offset, glyphs };
}

/** SVG for a shaped line with its left edge at x and baseline at y. */
export function lineSvg(line: ShapedLine, x: number, y: number, fill: string, opacity = 1): string {
  const r = (n: number) => Math.round(n * 100) / 100;
  const parts = line.glyphs.map(
    (g) => `<path transform="translate(${r(x + g.x)} ${r(y + g.y)}) scale(${r(g.k * 1000) / 1000} ${-r(g.k * 1000) / 1000})" d="${g.d}"/>`,
  );
  return `<g fill="${fill}"${opacity < 1 ? ` fill-opacity="${opacity}"` : ""}>${parts.join("")}</g>`;
}

/** Greedy word wrap using real glyph widths. */
export async function wrapText(text: string, size: number, weight: Weight, maxWidth: number, rtl = false): Promise<ShapedLine[]> {
  const noSpaces = /[　-鿿]/.test(text);
  const words = noSpaces ? [...text] : text.split(/\s+/).filter(Boolean);
  const joiner = noSpaces ? "" : " ";
  const lines: ShapedLine[] = [];
  let current = "";
  let shaped: ShapedLine | null = null;
  for (const word of words) {
    const candidate = current ? current + joiner + word : word;
    const s = await shapeLine(candidate, size, weight, rtl);
    if (current && s.width > maxWidth) {
      lines.push(shaped!);
      current = word;
      shaped = await shapeLine(word, size, weight, rtl);
    } else {
      current = candidate;
      shaped = s;
    }
  }
  if (shaped) lines.push(shaped);
  return lines;
}
