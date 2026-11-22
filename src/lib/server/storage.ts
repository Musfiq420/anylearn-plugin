import "server-only";
import { AwsClient } from "aws4fetch";

/**
 * Uploads to the Supabase Storage bucket through its S3-compatible API.
 * Needs a Storage S3 access key (Dashboard → Storage → S3 Connection).
 */

function config() {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const accessKeyId = process.env.SUPABASE_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.SUPABASE_S3_SECRET_ACCESS_KEY;
  if (!base || !accessKeyId || !secretAccessKey) return null;
  return {
    base,
    bucket: process.env.SUPABASE_STORAGE_BUCKET ?? "anylearn-plugin",
    client: new AwsClient({
      accessKeyId,
      secretAccessKey,
      service: "s3",
      region: process.env.SUPABASE_S3_REGION ?? "ap-southeast-1",
    }),
  };
}

export function hasStorage(): boolean {
  return config() !== null;
}

/** Uploads a file and returns its public URL, or null if storage isn't configured. */
export async function uploadPublic(key: string, body: Uint8Array, contentType: string): Promise<string | null> {
  const c = config();
  if (!c) return null;
  const res = await c.client.fetch(`${c.base}/storage/v1/s3/${c.bucket}/${key}`, {
    method: "PUT",
    body: body as unknown as BodyInit,
    headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable" },
  });
  if (!res.ok) throw new Error(`Storage upload failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return `${c.base}/storage/v1/object/public/${c.bucket}/${key}`;
}
