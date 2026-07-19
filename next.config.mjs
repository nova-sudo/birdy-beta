/** @type {import('next').NextConfig} */
const nextConfig = {
  // The marketing/landing page now lives on Askbirdy.ai — this app has no
  // homepage of its own, so "/" always sends straight to the login page.
  // Temporary (302) redirect, not permanent: keeps this easy to change later
  // without browsers/CDNs aggressively caching a 301.
  async redirects() {
    return [
      {
        source: "/",
        destination: "/login",
        permanent: false,
      },
    ];
  },
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
  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
