import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "sharp", "@azure/ai-form-recognizer", "@azure/core-auth", "@azure/core-rest-pipeline"],
  env: {
    AUTH_SECRET: process.env.AUTH_SECRET ?? "",
    DATABASE_URL: process.env.DATABASE_URL ?? "",
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? "",
    APP_S3_KEY: process.env.APP_S3_KEY ?? "",
    APP_S3_SECRET: process.env.APP_S3_SECRET ?? "",
    S3_BUCKET_NAME: process.env.S3_BUCKET_NAME ?? "",
    S3_BUCKET_REGION: process.env.S3_BUCKET_REGION ?? "",
    GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? "",
    AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT: process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT ?? "",
    AZURE_DOCUMENT_INTELLIGENCE_KEY: process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY ?? "",
  },
};

export default nextConfig;
