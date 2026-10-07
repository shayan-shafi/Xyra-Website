/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      // iOS password autofill / "save to Passwords" (see the route's header).
      { source: "/.well-known/apple-app-site-association", destination: "/api/apple-app-site-association" },
    ];
  },
};

export default nextConfig;
