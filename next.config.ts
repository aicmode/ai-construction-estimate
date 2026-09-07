import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  /**
   * `@react-pdf/renderer` and `@react-pdf/fontkit` are Node-only libraries that
   * read font binaries at runtime. Keeping them external prevents the bundler
   * from inlining them and keeps the PDF route working on Vercel's
   * Node.js serverless runtime.
   */
  serverExternalPackages: ["@react-pdf/renderer", "@react-pdf/fontkit"],

  /**
   * The Japanese PDF fonts live outside `public/` (they must never be served to
   * the browser) so they have to be traced into the serverless function bundle
   * explicitly.
   */
  outputFileTracingIncludes: {
    "/api/estimates/[id]/pdf": ["./src/server/pdf/fonts/**"],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
