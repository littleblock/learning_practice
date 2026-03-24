import { expect, test, type Page } from "@playwright/test";

const testBankName = "前端联调测试题库";
const questionOneStem = "测试题 1：组件样式调整后，哪种做法最容易保证按钮层级清晰？";
const questionTwoStem =
  "测试题 2：为了验证不同学习账号共用同一题库时进度互不影响，应重点观察哪些数据？";

async function setInputValue(page: Page, selector: string, value: string) {
  const input = page.locator(selector).first();
  await input.click();
  await input.fill("");
  await input.pressSequentially(value);
  await expect(input).toHaveValue(value);
}

async function loginAsLearner(page: Page, loginName: string) {
  await page.goto("/m/login");
  await setInputValue(page, 'input[autocomplete="username"]', loginName);
  await setInputValue(
    page,
    'input[autocomplete="current-password"]',
    "123456",
  );
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/m\/banks$/, { timeout: 20_000 });
}

function getBankCard(page: Page) {
  return page
    .locator("section.mobile-panel")
    .filter({ has: page.getByRole("heading", { name: testBankName }) })
    .first();
}

async function openTestBank(page: Page) {
  const bankCard = getBankCard(page);
  await expect(bankCard).toBeVisible();
  await bankCard.getByRole("link", { name: "进入题库" }).click();
  await expect(page).toHaveURL(/\/m\/banks\/.+\/setup$/, { timeout: 20_000 });
}

async function startPractice(page: Page) {
  await page.locator("button.mobile-button.is-primary").first().click();
  await expect(page).toHaveURL(/\/m\/practice\/.+/, { timeout: 20_000 });
}

async function submitAnswer(page: Page, optionLabel: "A" | "B" | "T" | "F") {
  await page.getByRole("button", { name: new RegExp(`^${optionLabel}\\.`) }).click();
  await page.locator(".mobile-practice-action-buttons .mobile-button.is-primary").click();
  await expect(page.locator(".mobile-practice-result-grid")).toBeVisible();
}

test.describe("practice isolation", () => {
  test("shared bank progress stays isolated across learners", async ({
    browser,
  }) => {
    const userOneContext = await browser.newContext();
    const userTwoContext = await browser.newContext();
    const userOnePage = await userOneContext.newPage();
    const userTwoPage = await userTwoContext.newPage();

    try {
      await loginAsLearner(userOnePage, "test01");
      await openTestBank(userOnePage);
      await startPractice(userOnePage);

      await expect(userOnePage.getByText(questionOneStem)).toBeVisible();
      await submitAnswer(userOnePage, "A");

      await userOnePage
        .locator(".mobile-practice-action-buttons .mobile-button.is-primary")
        .click();
      await expect(userOnePage.getByText(questionTwoStem)).toBeVisible();

      await userOnePage
        .locator(".mobile-practice-action-buttons .mobile-button")
        .first()
        .click();
      await expect(userOnePage.getByText(questionOneStem)).toBeVisible();
      await expect(
        userOnePage.getByRole("button", { name: /^A\./ }),
      ).toHaveClass(/is-active/);

      await userOnePage.goto("/m/wrong-books");
      await expect(userOnePage.getByText(testBankName)).toHaveCount(0);

      await userOnePage.goto("/m/banks");
      await expect(
        getBankCard(userOnePage).getByRole("link", { name: "继续上次练习" }),
      ).toBeVisible();

      await loginAsLearner(userTwoPage, "test02");
      await expect(
        getBankCard(userTwoPage).getByRole("link", { name: "继续上次练习" }),
      ).toHaveCount(0);

      await openTestBank(userTwoPage);
      await startPractice(userTwoPage);
      await expect(userTwoPage.getByText(questionOneStem)).toBeVisible();
      await submitAnswer(userTwoPage, "B");

      await userTwoPage.goto("/m/wrong-books");
      await expect(userTwoPage.getByText(testBankName)).toBeVisible();

      await userOnePage.goto("/m/wrong-books");
      await expect(userOnePage.getByText(testBankName)).toHaveCount(0);
    } finally {
      await userOneContext.close();
      await userTwoContext.close();
    }
  });
});
