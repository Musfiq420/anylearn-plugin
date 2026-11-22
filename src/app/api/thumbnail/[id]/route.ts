import { getCourse } from "@/lib/server/courses";
import { renderThumbnail } from "@/lib/server/thumbnail";

/** Course thumbnail PNG, rendered on demand (cached by the CDN). */
export async function GET(_req: Request, ctx: RouteContext<"/api/thumbnail/[id]">) {
  const { id } = await ctx.params;
  const found = await getCourse(id);
  if (!found) return new Response("Not found", { status: 404 });
  const png = await renderThumbnail(found.course);
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
