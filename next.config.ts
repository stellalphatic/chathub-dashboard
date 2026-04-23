import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Docker image (AWS EC2 / Fargate). Amplify/Netlify ignore it.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  serverExternalPackages: [
    "postgres",
    "bullmq",
    "ioredis",
    "pdf-parse",
    "mammoth",
    "@qdrant/js-client-rest",
  ],
  experimental: {
    // Allow worker scripts outside /src
    externalDir: true,
  },
};

export default nextConfig;
