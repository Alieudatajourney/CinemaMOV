import type { NextConfig } from "next";

// Cache Components is intentionally not enabled: almost every page in this app renders
// live booking state (seat availability, holds, ticket status), so request-time rendering
// is the correct default. Pages opt in with `export const dynamic = "force-dynamic"`.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The downloadable ticket embeds the film poster. On serverless hosts `public/` is served by the
  // CDN and is not on the function's filesystem, so bundle the posters with that route.
  outputFileTracingIncludes: {
    "/api/bookings/*/ticket": ["./public/media/films/*-poster.jpg", "./public/brand/logo-256.png"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Cross-origin requests get the bare origin only (never paths or ticket keys). YouTube embeds
          // require a referrer origin, otherwise the player shows "Video player configuration error".
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
