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
};

export default nextConfig;
