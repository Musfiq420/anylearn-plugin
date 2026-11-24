// Copies the MCP Apps browser client into public/ so the in-chat course card
// can load it from AnyLearn's own origin (runs before `dev` and `build`).
import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The package exports this exact file as "@modelcontextprotocol/ext-apps/app-with-deps".
const src = fileURLToPath(import.meta.resolve("@modelcontextprotocol/ext-apps/app-with-deps"));
const outDir = path.join(process.cwd(), "public", "mcp-app");
mkdirSync(outDir, { recursive: true });
copyFileSync(src, path.join(outDir, "sdk.js"));
console.log("Copied MCP Apps client to public/mcp-app/sdk.js");
