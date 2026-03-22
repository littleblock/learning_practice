import { expect, test, type Page } from "@playwright/test";

async function setInputValue(page: Page, selector: string, value: string) {
  await page.locator(selector).evaluate((element, nextValue) => {
    const input = element as HTMLInputElement;
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;

    valueSetter?.call(input, nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

test.describe("admin and mobile smoke flows", () => {
  test("root route redirects learners to the mobile login page", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/m\/login$/, { timeout: 20_000 });
  });

  test("admin login and management pages are reachable", async ({ page }) => {
    await page.goto("/admin/login");

    await setInputValue(page, 'input[autocomplete="username"]', "admin");
    await setInputValue(
      page,
      'input[autocomplete="current-password"]',
      "123456",
    );
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/admin\/banks$/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "题库管理" })).toBeVisible();

    const questionManagerLink = page
      .getByRole("link", { name: "题目管理" })
      .first();
    await expect(questionManagerLink).toBeVisible();
    await questionManagerLink.click();

    await expect(page).toHaveURL(/\/admin\/banks\/.+\/questions/, {
      timeout: 20_000,
    });
    await expect(page.getByRole("heading", { name: /题目管理/ })).toBeVisible();

    await page.getByRole("tab", { name: /导入记录/ }).click();
    await expect(page.getByText("导入记录")).toBeVisible();

    const statuteLink = page
      .locator(".mobile-page-header")
      .getByRole("link", { name: "法条资料" });
    await expect(statuteLink).toBeVisible();
    await statuteLink.click();

    await expect(page).toHaveURL(/\/admin\/banks\/.+\/statutes/, {
      timeout: 20_000,
    });
    await expect(page.getByRole("heading", { name: /法条资料管理/ })).toBeVisible();
  });

  test("learner login and practice flow are reachable", async ({ page }) => {
    await page.goto("/m/login");

    await setInputValue(page, 'input[autocomplete="username"]', "syy");
    await setInputValue(
      page,
      'input[autocomplete="current-password"]',
      "study@123",
    );
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/m\/banks$/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "题库列表" })).toBeVisible();

    const bankEntry = page.getByRole("link", { name: "进入题库" }).first();
    await expect(bankEntry).toBeVisible();
    await bankEntry.click();

    await expect(page).toHaveURL(/\/m\/banks\/.+\/setup/, { timeout: 20_000 });
    const startButton = page.getByRole("button", { name: "开始练习" });
    await expect(startButton).toBeEnabled();
    await startButton.click();

    await expect(page).toHaveURL(/\/m\/practice\/.+/, { timeout: 20_000 });
    await expect(page.getByText(/第\s+\d+\s+\/\s+\d+\s+题/)).toBeVisible();

    await page.getByRole("link", { name: "错题本" }).first().click();
    await expect(page).toHaveURL(/\/m\/wrong-books/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "错题本" })).toBeVisible();
  });
});
