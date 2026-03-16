import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "@google-cloud/documentai"],
  env: {
    AUTH_SECRET: process.env.AUTH_SECRET ?? "",
    DATABASE_URL: process.env.DATABASE_URL ?? "",
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? "",
    APP_S3_KEY: process.env.APP_S3_KEY ?? "",
    APP_S3_SECRET: process.env.APP_S3_SECRET ?? "",
    S3_BUCKET_NAME: process.env.S3_BUCKET_NAME ?? "",
    S3_BUCKET_REGION: process.env.S3_BUCKET_REGION ?? "",
    GOOGLE_CLOUD_PROJECT_ID: process.env.GOOGLE_CLOUD_PROJECT_ID ?? "",
    GOOGLE_CLOUD_LOCATION: process.env.GOOGLE_CLOUD_LOCATION ?? "",
    DOCUMENT_AI_PROCESSOR_ID: process.env.DOCUMENT_AI_PROCESSOR_ID ?? "",
    GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? "",
    GOOGLE_CREDENTIALS_JSON: process.env.GOOGLE_CREDENTIALS_JSON ?? "",
  },
};

export default nextConfig;
