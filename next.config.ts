import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Native/WASM packages used to draw thumbnails: load them from node_modules at runtime.
  serverExternalPackages: ["@resvg/resvg-js", "harfbuzzjs"],
  // Fonts and the logo are read from disk when drawing thumbnails.
  outputFileTracingIncludes: {
    "/api/thumbnail/[id]": ["./assets/**/*", "./node_modules/harfbuzzjs/dist/*.wasm"],
    "/api/mcp": ["./assets/**/*", "./node_modules/harfbuzzjs/dist/*.wasm"],
  },
  async headers() {
    return [
      {
        // The in-chat course card runs in a sandboxed frame on another origin and
        // imports the MCP Apps client from here as an ES module, which needs CORS.
        source: "/mcp-app/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Cache-Control", value: "public, max-age=3600, s-maxage=86400" },
        ],
      },
    ];
  },
};

export default nextConfig;
