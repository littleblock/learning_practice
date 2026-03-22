import { describe, expect, it } from "vitest";

import { bankListQuerySchema } from "@/shared/schemas/bank";
import { questionListQuerySchema } from "@/shared/schemas/question";
import { statuteListQuerySchema } from "@/shared/schemas/statute";

describe("pagination schema", () => {
  it("列表查询默认每页 10 条", () => {
    expect(bankListQuerySchema.parse({}).pageSize).toBe(10);
    expect(questionListQuerySchema.parse({}).pageSize).toBe(10);
    expect(statuteListQuerySchema.parse({}).pageSize).toBe(10);
  });

  it("允许最大每页 100 条，超过后会被拒绝", () => {
    expect(bankListQuerySchema.parse({ pageSize: 100 }).pageSize).toBe(100);
    expect(questionListQuerySchema.parse({ pageSize: 100 }).pageSize).toBe(100);
    expect(statuteListQuerySchema.parse({ pageSize: 100 }).pageSize).toBe(100);

    expect(() => bankListQuerySchema.parse({ pageSize: 101 })).toThrowError();
    expect(() => questionListQuerySchema.parse({ pageSize: 101 })).toThrowError();
    expect(() => statuteListQuerySchema.parse({ pageSize: 101 })).toThrowError();
  });
});
