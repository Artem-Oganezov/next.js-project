import { expect, test } from "@playwright/test";

test.describe("Game E2E", () => {
  test("session starts and game ends with score save attempt", async ({ page }) => {
    const username = `e2e_game_${Date.now()}`;

    await page.goto("/");
    await page.getByTestId("auth-switch-mode").click();
    await page.getByTestId("auth-username").fill(username);
    await page.getByTestId("auth-email").fill(`${username}@example.com`);
    await page.getByTestId("auth-password").fill("password12");
    await page.getByTestId("auth-submit").click();

    await expect(page.getByTestId("home-screen")).toBeVisible();
    await page.getByTestId("start-game-btn").click();

    await expect(page.getByTestId("game-canvas")).toBeVisible();

    // Без прыжков дино врезается в первый кактус (~3–8 с).
    await expect(page.getByTestId("game-over-modal")).toBeVisible({
      timeout: 25_000,
    });

    await expect(page.getByText("Game over!")).toBeVisible();
    // Ошибка сохранения не должна появиться при рабочем API.
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
});
