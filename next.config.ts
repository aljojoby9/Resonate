import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    experimental: {
        optimizeCss: true,
    },
    typedRoutes: true,
    turbopack: {},
    images: {
        remotePatterns: [
            { protocol: "https", hostname: "**.r2.cloudflarestorage.com" },
            { protocol: "https", hostname: "imagedelivery.net" },
        ],
        formats: ["image/avif", "image/webp"],
    },
    headers: async () => [
        {
            source: "/(.*)",
            headers: [
                { key: "X-Frame-Options", value: "DENY" },
                { key: "X-Content-Type-Options", value: "nosniff" },
                {
                    key: "Referrer-Policy",
                    value: "strict-origin-when-cross-origin",
                },
                {
                    key: "Permissions-Policy",
                    value: "camera=(), microphone=(self), geolocation=(self)",
                },
                {
                    key: "Content-Security-Policy",
                    value: [
                        "default-src 'self'",
                        "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com",
                        "style-src 'self' 'unsafe-inline'",
                        "img-src 'self' data: blob: https://imagedelivery.net",
                        "connect-src 'self' wss: https://api.openai.com https://api.pinecone.io",
                        "frame-src https://js.stripe.com",
                    ].join("; "),
                },
            ],
        },
    ],
    webpack: (config) => {
        config.externals.push({
            "utf-8-validate": "commonjs utf-8-validate",
            bufferutil: "commonjs bufferutil",
        });
        return config;
    },
};

export default nextConfig;
