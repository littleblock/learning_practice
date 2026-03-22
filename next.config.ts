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

function normalizeBuildCpus(value?: string | null) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return undefined;
  }

  return parsed;
}

const nextConfig: NextConfig = {
  basePath: normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH),
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  experimental: {
    cpus: normalizeBuildCpus(process.env.NEXT_BUILD_CPUS),
  },
  poweredByHeader: false,
  serverExternalPackages: ["mammoth", "pdf-parse"],
};

export default nextConfig;
