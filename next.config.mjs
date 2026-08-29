/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3", "web-push", "@simplewebauthn/server"],
  },
};

export default nextConfig;
