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

const appBasePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);

export function getAppBasePath() {
  return appBasePath;
}

export function withAppBasePath(path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (!appBasePath) {
    return normalizedPath;
  }

  return normalizedPath === "/" ? appBasePath : `${appBasePath}${normalizedPath}`;
}

export function stripAppBasePath(pathname?: string | null) {
  if (!pathname) {
    return pathname ?? "";
  }

  if (!appBasePath) {
    return pathname;
  }

  if (pathname === appBasePath) {
    return "/";
  }

  return pathname.startsWith(`${appBasePath}/`)
    ? pathname.slice(appBasePath.length)
    : pathname;
}
