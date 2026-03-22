import type { NextConfig } from "next";

function normalizeBasePath(value?: string | null) {
  if (!value) {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed === "/") {
    return "";
  }

  return `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
}

const nextConfig: NextConfig = {
  basePath: normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH),
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  poweredByHeader: false,
  serverExternalPackages: ["mammoth", "pdf-parse"],
};

export default nextConfig;
