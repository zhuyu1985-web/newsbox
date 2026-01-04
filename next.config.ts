import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  async headers() {
    const isDev = process.env.NODE_ENV === "development";

    const csp = [
      "default-src 'self'",
      // Next/Turbopack & some deps may rely on eval/wasm in dev; keep it enabled to avoid runtime crash.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'",
      // Some browsers apply stricter checks for external scripts; keep consistent.
      "script-src-elem 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' blob: data: https: http:",
      "font-src 'self' data: https:",
      // Dev needs ws/wss/http for HMR and local APIs.
      isDev ? "connect-src 'self' https: http: ws: wss:" : "connect-src 'self' https:",
      isDev ? "frame-src 'self' https: http:" : "frame-src 'self' https:",
      "worker-src 'self' blob:",
      "child-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: csp,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
