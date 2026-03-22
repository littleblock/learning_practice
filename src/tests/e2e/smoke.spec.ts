import { expect, test } from "@playwright/test";

test.describe("admin and mobile smoke flows", () => {
  test("root route redirects learners to the mobile login page", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/m\/login$/, { timeout: 20_000 });
  });

  test("admin login and management pages are reachable", async ({ page }) => {
    await page.goto("/admin/login");

    await page.getByPlaceholder("管理员账号").fill("admin");
    await page.getByPlaceholder("请输入密码").fill("123456");
    await page.getByRole("button", { name: "登录后台" }).click();

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

    await page.getByPlaceholder("账号或手机号").fill("syy");
    await page.getByPlaceholder("请输入密码").fill("study@123");
    await page.getByRole("button", { name: "登录" }).click();

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
