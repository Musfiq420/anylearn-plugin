import "server-only";
import sharp from "sharp";

/**
 * Pictures from the user's own material. ChatGPT hands the add_image tool a
 * short-lived download URL for a file the user attached; we fetch it, shrink
 * it, re-encode it as WebP (which also drops EXIF data such as GPS location)
 * and store it in the bucket.
 */

export class ImageError extends Error {}

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_SIDE = 1280;
const FORMATS = new Set(["jpeg", "png", "webp", "gif", "avif", "tiff", "heif"]);

/** Hosts ChatGPT serves uploaded files from. Override with ANYLEARN_IMAGE_HOSTS (comma-separated). */
function allowedHosts(): string[] {
  const env = process.env.ANYLEARN_IMAGE_HOSTS?.trim();
  return (env ? env.split(",") : ["oaiusercontent.com", "openai.com", "chatgpt.com", "oaistatic.com"])
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

export function checkImageUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ImageError("download_url isn't a valid URL.");
  }
  const host = url.hostname.toLowerCase();
  // Plain http only for a local test server that was allowed explicitly.
  const local = host === "localhost" && allowedHosts().includes("localhost");
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new ImageError("download_url must be https.");
  }
  const ok = allowedHosts().some((h) => host === h || host.endsWith(`.${h}`));
  if (!ok) {
    throw new ImageError(
      "Only pictures the user attached in this chat can be added (not images from the web). If you can't pass the user's file, redraw the picture as an svg diagram instead.",
    );
  }
  return url;
}

async function readCapped(res: Response): Promise<Uint8Array> {
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) throw new ImageError("The picture is too large (over 15 MB).");
  if (!res.body) return new Uint8Array(await res.arrayBuffer());
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new ImageError("The picture is too large (over 15 MB).");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

export async function downloadImage(raw: string): Promise<Uint8Array> {
  const url = checkImageUrl(raw);
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(20_000), redirect: "follow" });
  } catch {
    throw new ImageError("Couldn't download the picture (the link may have expired). Call add_image again with the file.");
  }
  if (!res.ok) throw new ImageError(`Couldn't download the picture (HTTP ${res.status}). The link may have expired; call add_image again with the file.`);
  return readCapped(res);
}

export type ProcessedImage = { data: Uint8Array; width: number; height: number };

/** Shrinks to at most 1280px a side and re-encodes as WebP without metadata. */
export async function processImage(input: Uint8Array): Promise<ProcessedImage> {
  let format: string | undefined;
  try {
    format = (await sharp(input, { limitInputPixels: 50_000_000 }).metadata()).format;
  } catch {
    throw new ImageError("That file isn't a picture AnyLearn can read. Use a JPEG, PNG or WebP image.");
  }
  if (!format || !FORMATS.has(format)) {
    throw new ImageError(`Unsupported picture format${format ? ` (${format})` : ""}. Use a JPEG, PNG or WebP image.`);
  }
  try {
    const { data, info } = await sharp(input, { limitInputPixels: 50_000_000 })
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
    return { data: new Uint8Array(data), width: info.width, height: info.height };
  } catch {
    throw new ImageError(
      format === "heif"
        ? "This HEIC photo can't be read. Ask the user to attach it as a JPEG or PNG."
        : "The picture couldn't be processed. Try a JPEG or PNG.",
    );
  }
}
