import { expect, test, type Page } from '@playwright/test';

/**
 * The account-side journey a developer can complete without a CLI: create an account, get a
 * workspace, register a repository, read the setup steps, filter runs through the URL,
 * confirm another account cannot see the repository, and sign out.
 *
 * Runs against a live `pnpm web dev` with its database. Local CLI execution is exercised
 * separately, with real PostgreSQL, and is not simulated here.
 */

const PASSWORD = 'correct-horse-battery-staple';

async function createAccount(page: Page, email: string): Promise<void> {
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Name').fill('Journey');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/repositories$/);
}

test('sign in, register a repository, read setup, filter runs, stay isolated, sign out', async ({
  page,
  browser,
}) => {
  const stamp = Date.now().toString(36);
  await createAccount(page, `journey-${stamp}@assurance.invalid`);
  await expect(page.getByRole('heading', { name: 'No repositories yet' })).toBeVisible();

  await page.getByRole('button', { name: 'Register repository' }).click();
  const dialog = page.getByRole('dialog', { name: 'Register a repository' });
  await dialog.getByLabel('Name').fill(`journey-${stamp}`);
  await dialog.getByRole('button', { name: 'Register repository' }).click();
  await expect(page).toHaveURL(/\/repositories\/[0-9a-f-]{36}$/);
  const repositoryUrl = page.url();
  const repositoryId = repositoryUrl.split('/').at(-1) ?? '';

  // The first unfinished step is open; later steps expand on request.
  await expect(page.getByText('0 of 3 done')).toBeVisible();
  await page.getByRole('button', { name: 'Link the checkout of this repository' }).click();
  await expect(page.getByText(`assure link ${repositoryId}`)).toBeVisible();
  await expect(page.getByText('Never sent')).toBeVisible();

  // Filters live in the URL and survive a reload.
  await page.goto(`/runs?repository=${repositoryId}&result=FAILED`);
  await expect(page.getByRole('radio', { name: 'Failed', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.getByRole('button', { name: `Repository: journey-${stamp}` })).toBeVisible();
  await page.getByRole('radio', { name: 'Complete', exact: true }).click();
  await expect(page).toHaveURL(/result=COMPLETE/);
  await page.reload();
  await expect(page.getByRole('radio', { name: 'Complete', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );

  // Another account cannot open this repository.
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await createAccount(otherPage, `other-${stamp}@assurance.invalid`);
  const response = await otherPage.goto(repositoryUrl);
  expect(response?.status()).toBe(404);
  await other.close();

  await page
    .getByRole('button', { name: /Journey's workspace/ })
    .first()
    .click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/sign-in/);
  const protectedResponse = await page.goto(repositoryUrl);
  expect(protectedResponse?.url()).toContain('/sign-in');
});
