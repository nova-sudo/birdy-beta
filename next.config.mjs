/** @type {import('next').NextConfig} */
const nextConfig = {
  // dashkit ships ESM built for a bundler; compiling it with the app keeps it
  // on the app's single React instead of resolving its own.
  transpilePackages: ["dashkit"],

  // "/" is the landing page for visitors; signed-in users are sent on to the
  // app by proxy.js, so there is no redirect here.
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  // Dashboards moved under BirdyHub.
  async redirects() {
    return [
      { source: "/dashboards", destination: "/hub/dashboards", permanent: true },
      { source: "/dashboards/:id", destination: "/hub/dashboards/:id", permanent: true },
    ];
  },
  // The OAuth consent page must never be framed: a framed "Allow" could be
  // clickjacked into approving a connection (RFC 6819 §4.4.1.9).
  async headers() {
    return [
      {
        source: "/connect/authorize",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
