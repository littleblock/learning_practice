import { expect, test, type Page } from "@playwright/test";

async function setInputValue(page: Page, selector: string, value: string) {
  const input = page.locator(selector).first();
  await input.click();
  await input.fill("");
  await input.pressSequentially(value);
  await expect(input).toHaveValue(value);
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
    await expect(
      page.getByRole("heading", { name: "题目列表", level: 2 }),
    ).toBeVisible();

    await page.getByRole("tab", { name: /导入记录/ }).click();
    await expect(
      page.getByRole("button", { name: "Excel 导入" }),
    ).toBeVisible();
    await expect(page.getByText("当前共有")).toBeVisible();

    await page.goto("/admin/banks");
    await expect(page).toHaveURL(/\/admin\/banks$/, { timeout: 20_000 });

    const statuteLink = page.getByRole("link", { name: "资料管理" }).first();
    await expect(statuteLink).toBeVisible();
    await statuteLink.click();

    await expect(page).toHaveURL(/\/admin\/banks\/.+\/statutes/, {
      timeout: 20_000,
    });
    await expect(page.getByText("资料总数")).toBeVisible();
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

    const reachedPractice = await Promise.race([
      page
        .waitForURL(/\/m\/practice\/.+/, { timeout: 20_000 })
        .then(() => true)
        .catch(() => false),
      page
        .getByText("当前题库还没有可练习的题目")
        .waitFor({ timeout: 20_000 })
        .then(() => false)
        .catch(() => false),
    ]);

    if (reachedPractice) {
      await expect(page.getByText(/第\s+\d+\s+\/\s+\d+\s+题/)).toBeVisible();
    } else {
      await expect(page.getByText("当前题库还没有可练习的题目")).toBeVisible();
    }

    await page.getByRole("button", { name: "错题本" }).first().click();
    await expect(page).toHaveURL(/\/m\/wrong-books/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "错题本" })).toBeVisible();
  });
});
