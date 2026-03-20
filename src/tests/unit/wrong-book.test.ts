import { describe, expect, it } from "vitest";

import { resolveWrongBookState } from "@/shared/utils/wrong-book";

describe("resolveWrongBookState", () => {
  it("首次答错会进入错题本", () => {
    expect(resolveWrongBookState(null, false)).toEqual({
      isInWrongBook: true,
      consecutiveCorrectInWrongBook: 0,
    });
  });

  it("错题连续答对两次后移出", () => {
    const first = resolveWrongBookState(
      {
        isInWrongBook: true,
        consecutiveCorrectInWrongBook: 0,
      },
      true,
    );
    const second = resolveWrongBookState(first, true);

    expect(first).toEqual({
      isInWrongBook: true,
      consecutiveCorrectInWrongBook: 1,
    });
    expect(second).toEqual({
      isInWrongBook: false,
      consecutiveCorrectInWrongBook: 2,
    });
  });
});
