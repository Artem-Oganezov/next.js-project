import { expect, test } from "@playwright/test";

function uniqueUser(prefix: string): string {
  return `${prefix}_${Date.now()}`;
}

async function registerUser(page: import("@playwright/test").Page, username: string) {
  await page.goto("/");
  await page.getByTestId("auth-switch-mode").click();
  await page.getByTestId("auth-username").fill(username);
  await page.getByTestId("auth-email").fill(`${username}@example.com`);
  await page.getByTestId("auth-password").fill("password12");
  await page.getByTestId("auth-submit").click();
  await expect(page.getByTestId("home-screen")).toBeVisible();
}

test.describe("Auth E2E", () => {
  test("register shows home screen", async ({ page }) => {
    const username = uniqueUser("e2e_reg");
    await registerUser(page, username);
    await expect(page.getByText(username)).toBeVisible();
    await expect(page.getByTestId("start-game-btn")).toBeVisible();
  });

  test("login after logout", async ({ page }) => {
    const username = uniqueUser("e2e_login");
    await registerUser(page, username);

    await page.getByRole("button", { name: "Выход" }).click();
    await expect(page.getByTestId("auth-submit")).toBeVisible();

    await page.getByTestId("auth-username").fill(username);
    await page.getByTestId("auth-password").fill("password12");
    await page.getByTestId("auth-submit").click();

    await expect(page.getByTestId("home-screen")).toBeVisible();
  });
});
