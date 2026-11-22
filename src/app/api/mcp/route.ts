import { registerTools, SERVER_INSTRUCTIONS } from "@/lib/server/mcp";
import { createMcpHandler } from "mcp-handler";

/**
 * MCP endpoint. Add this URL (https://<your-app>/api/mcp) as a connector in
 * ChatGPT or Claude.
 */
const handler = createMcpHandler(registerTools, {
  serverInfo: { name: "AnyLearn Plugin", version: "0.2.0" },
  instructions: SERVER_INSTRUCTIONS,
});

export const maxDuration = 60;

export { handler as GET, handler as POST, handler as DELETE };
