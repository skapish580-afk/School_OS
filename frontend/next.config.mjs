/** @type {import('next').NextConfig} */

// Derive the backend hostname from the env var so image domains update automatically
// when NEXT_PUBLIC_API_BASE is changed (e.g. from localhost to a Railway/Render URL).
const apiBase = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000/api/v1';
const backendHostname = new URL(apiBase.startsWith('http') ? apiBase : `http://${apiBase}`).hostname;

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // Local development
      { protocol: 'http',  hostname: '127.0.0.1', port: '8000' },
      { protocol: 'http',  hostname: 'localhost',  port: '8000' },
      // Production backend — derived from NEXT_PUBLIC_API_BASE at build time
      { protocol: 'https', hostname: backendHostname },
      { protocol: 'http',  hostname: backendHostname },
    ],
  },
};

export default nextConfig;