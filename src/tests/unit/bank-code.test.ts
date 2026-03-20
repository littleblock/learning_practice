import { describe, expect, it } from "vitest";

import { bankCodeSchema, createBankSchema } from "@/shared/schemas/bank";
import {
  buildBankCode,
  extractBankCodeSequence,
  getBankCodePeriod,
} from "@/shared/utils/bank-code";

describe("bankCodeSchema", () => {
  it("允许大小写字母、数字、下划线和中划线", () => {
    expect(bankCodeSchema.parse("Tk_EXAM-2026")).toBe("Tk_EXAM-2026");
  });

  it("拒绝空格和特殊符号", () => {
    expect(() => bankCodeSchema.parse("TK 2026!")).toThrowError();
  });
});

describe("createBankSchema", () => {
  it("新增题库时不强制要求前端传入编码", () => {
    expect(
      createBankSchema.parse({
        name: "行政执法题库",
        description: "用于验证自动生成编码",
      }),
    ).toMatchObject({
      name: "行政执法题库",
      description: "用于验证自动生成编码",
    });
  });
});

describe("bank code utils", () => {
  it("按照上海时区生成题库编码年月", () => {
    expect(getBankCodePeriod(new Date("2026-02-28T16:30:00.000Z"))).toBe(
      "202603",
    );
  });

  it("按规则拼接题库编码和解析流水号", () => {
    const code = buildBankCode("202603", 1);

    expect(code).toBe("TK-202603-00000001");
    expect(extractBankCodeSequence(code, "202603")).toBe(1);
  });
});
