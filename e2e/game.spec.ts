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

    // Without jumps the dino hits the first cactus (~3–8 s).
    await expect(page.getByTestId("revive-offer-modal")).toBeVisible({
      timeout: 25_000,
    });

    await page.getByTestId("revive-save-score-btn").click();

    await expect(page.getByTestId("game-over-modal")).toBeVisible();

    await expect(page.getByText("Game over!")).toBeVisible();
    // Save error should not appear when the API is working.
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
});
