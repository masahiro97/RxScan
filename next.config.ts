import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "@google-cloud/documentai"],
};

export default nextConfig;
