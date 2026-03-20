import { describe, expect, it } from "vitest";

import {
  isAllowedExcelFile,
  isAllowedExcelMimeType,
  isAllowedStatuteFile,
  isAllowedStatuteMimeType,
} from "@/shared/utils/file";

describe("file utils", () => {
  it("允许受支持的 Excel 扩展名和 MIME 类型", () => {
    expect(isAllowedExcelFile("questions.xlsx")).toBe(true);
    expect(isAllowedExcelFile("questions.csv")).toBe(true);
    expect(isAllowedExcelMimeType("application/vnd.ms-excel")).toBe(true);
    expect(isAllowedExcelMimeType("text/csv")).toBe(true);
  });

  it("拒绝不受支持的 Excel MIME 类型", () => {
    expect(isAllowedExcelMimeType("application/pdf")).toBe(false);
  });

  it("允许受支持的法条文件扩展名和 MIME 类型", () => {
    expect(isAllowedStatuteFile("statute.docx")).toBe(true);
    expect(isAllowedStatuteFile("statute.pdf")).toBe(true);
    expect(isAllowedStatuteMimeType("application/pdf")).toBe(true);
    expect(isAllowedStatuteMimeType("text/plain")).toBe(true);
  });

  it("对空 MIME 类型做兼容放行", () => {
    expect(isAllowedExcelMimeType("")).toBe(true);
    expect(isAllowedStatuteMimeType("")).toBe(true);
  });
});
