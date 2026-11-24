import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { Course, Lesson, missingImages } from "../schema";
import { checkImageUrl, ImageError, processImage } from "../server/images";

describe("image download rules", () => {
  it("accepts ChatGPT file hosts only", () => {
    expect(checkImageUrl("https://files.oaiusercontent.com/file-abc?se=1").hostname).toBe("files.oaiusercontent.com");
    expect(() => checkImageUrl("https://example.com/cat.jpg")).toThrow(ImageError);
    expect(() => checkImageUrl("https://evil-oaiusercontent.com/x")).toThrow(ImageError);
    expect(() => checkImageUrl("http://files.oaiusercontent.com/x")).toThrow(/https/);
    expect(() => checkImageUrl("not a url")).toThrow(ImageError);
  });
});

describe("image processing", () => {
  it("shrinks, re-encodes as WebP and drops EXIF", async () => {
    const jpeg = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#3a7" } })
      .withExif({ IFD0: { Make: "PhoneCo", Model: "Secret Phone" } })
      .jpeg()
      .toBuffer();
    expect((await sharp(jpeg).metadata()).exif).toBeDefined();
    const out = await processImage(new Uint8Array(jpeg));
    expect(out.width).toBe(1280);
    expect(out.height).toBe(853);
    const meta = await sharp(out.data).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.exif).toBeUndefined();
  });

  it("rejects files that aren't pictures", async () => {
    await expect(processImage(new TextEncoder().encode("%PDF-1.7 hello"))).rejects.toThrow(ImageError);
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>');
    await expect(processImage(svg)).rejects.toThrow(/Unsupported/);
  });
});

describe("image references", () => {
  const lesson = Lesson.parse({
    id: "l1",
    title: "Leaves",
    cards: [
      { type: "explain", body: "A real leaf.", image: "img_abc12345" },
      { type: "mcq", question: "Which part?", options: ["a", "b"], answer: 0, image: "img_zzz99999" },
    ],
  });

  it("finds cards that point at missing images", () => {
    const images = [{ id: "img_abc12345", url: "https://x.supabase.co/a.webp", width: 10, height: 10 }];
    expect(missingImages({ images, lessons: [lesson] })).toEqual(["l1 card 2: img_zzz99999"]);
  });

  it("validates image ids and the course image list", () => {
    expect(Lesson.safeParse({ id: "l", title: "t", cards: [{ type: "explain", body: "x", image: "https://example.com/a.png" }] }).success).toBe(false);
    const course = { schemaVersion: 1, id: "abc", title: "T", language: "en", lessons: [lesson] };
    expect(Course.safeParse({ ...course, images: [{ id: "img_abc12345", url: "javascript:alert(1)", width: 1, height: 1 }] }).success).toBe(false);
    expect(Course.safeParse({ ...course, images: [{ id: "img_abc12345", url: "https://x.supabase.co/a.webp", width: 10, height: 10 }] }).success).toBe(true);
  });
});
