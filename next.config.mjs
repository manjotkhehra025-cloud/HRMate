/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3", "web-push", "@simplewebauthn/server"],
    // Better-sqlite3 is a native C++ addon that segfaults inside Next.js's
    // static-generation WORKER THREADS ("Collecting page data" -> SIGSEGV).
    // Disabling worker threads makes Next use child processes instead, which
    // is safe for native modules.
    workerThreads: false,
    // Single worker keeps peak memory low (small VPS friendly).
    cpus: 1,
  },
  // Skip ESLint during `next build` (warnings-only here; keeps build light on low-RAM hosts).
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
