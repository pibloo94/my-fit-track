import { expect, test } from '@playwright/test';

test('the health page renders a payload from the API', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'API health' })).toBeVisible();
  await expect(page.getByTestId('health-ok')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('health-ok')).toContainText(/ok|degraded/);
});
