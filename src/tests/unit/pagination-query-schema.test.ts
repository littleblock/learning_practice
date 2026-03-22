import { describe, expect, it } from "vitest";

import { DEFAULT_PAGE_SIZE } from "@/shared/constants/app";
import { bankListQuerySchema } from "@/shared/schemas/bank";
import { questionListQuerySchema } from "@/shared/schemas/question";
import { statuteListQuerySchema } from "@/shared/schemas/statute";

describe("pagination query schema", () => {
  it("后台分页默认每页 10 条", () => {
    expect(bankListQuerySchema.parse({}).pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(questionListQuerySchema.parse({}).pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(statuteListQuerySchema.parse({}).pageSize).toBe(DEFAULT_PAGE_SIZE);
  });

  it("后台分页最多允许 100 条", () => {
    expect(() => bankListQuerySchema.parse({ pageSize: 101 })).toThrowError();
    expect(() => questionListQuerySchema.parse({ pageSize: 101 })).toThrowError();
    expect(() => statuteListQuerySchema.parse({ pageSize: 101 })).toThrowError();
  });
});
