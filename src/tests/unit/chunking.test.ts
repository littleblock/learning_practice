import { describe, expect, it } from "vitest";

import { chunkText } from "@/shared/utils/chunking";

describe("chunkText", () => {
  it("空文本返回空数组", () => {
    expect(chunkText("")).toEqual([]);
  });

  it("按固定长度与重叠拆分文本", () => {
    const text = "a".repeat(1200);
    const chunks = chunkText(text, 600, 100);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].content.length).toBeLessThanOrEqual(600);
    expect(chunks[1].content.length).toBeLessThanOrEqual(600);
  });
});
