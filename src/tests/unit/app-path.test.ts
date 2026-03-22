import { afterEach, describe, expect, it, vi } from "vitest";

const originalBasePath = process.env.NEXT_PUBLIC_BASE_PATH;

async function loadModule(basePath?: string) {
  if (basePath === undefined) {
    delete process.env.NEXT_PUBLIC_BASE_PATH;
  } else {
    process.env.NEXT_PUBLIC_BASE_PATH = basePath;
  }

  vi.resetModules();
  return import("@/shared/utils/app-path");
}

afterEach(() => {
  if (originalBasePath === undefined) {
    delete process.env.NEXT_PUBLIC_BASE_PATH;
  } else {
    process.env.NEXT_PUBLIC_BASE_PATH = originalBasePath;
  }

  vi.resetModules();
});

describe("app path helpers", () => {
  it("在未配置前缀时保留原始路径", async () => {
    const { getAppBasePath, stripAppBasePath, withAppBasePath } =
      await loadModule();

    expect(getAppBasePath()).toBe("");
    expect(withAppBasePath("/api/auth/login")).toBe("/api/auth/login");
    expect(stripAppBasePath("/m/login")).toBe("/m/login");
  });

  it("在配置前缀时为应用路径追加前缀", async () => {
    const { getAppBasePath, withAppBasePath } = await loadModule(
      "/apps/learning-practice/",
    );

    expect(getAppBasePath()).toBe("/apps/learning-practice");
    expect(withAppBasePath("/api/auth/login")).toBe(
      "/apps/learning-practice/api/auth/login",
    );
    expect(withAppBasePath("/")).toBe("/apps/learning-practice");
  });

  it("在配置前缀时为 pathname 判断去掉前缀", async () => {
    const { stripAppBasePath } = await loadModule("/apps/learning-practice");

    expect(stripAppBasePath("/apps/learning-practice")).toBe("/");
    expect(stripAppBasePath("/apps/learning-practice/m/login")).toBe(
      "/m/login",
    );
    expect(stripAppBasePath("/m/login")).toBe("/m/login");
  });
});
