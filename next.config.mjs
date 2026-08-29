/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3", "web-push", "@simplewebauthn/server"],
    // Build with a single CPU worker to keep peak memory low (small VPS friendly).
    cpus: 1,
  },
  // Skip ESLint during `next build` (warnings-only here; keeps build light on low-RAM hosts).
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
