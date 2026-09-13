import { expect, test, type Page } from '@playwright/test';

/**
 * The account-side journey a developer can complete without a CLI: create an account, get a
 * workspace, register a repository, read the setup instructions, filter runs through the URL,
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

  await page.getByRole('link', { name: 'Register a repository' }).first().click();
  await page.getByLabel('Name').fill(`journey-${stamp}`);
  await page.getByRole('button', { name: 'Register repository' }).click();
  await expect(page).toHaveURL(/\/repositories\/[0-9a-f-]{36}$/);
  const repositoryUrl = page.url();
  const repositoryId = repositoryUrl.split('/').at(-1) ?? '';

  await expect(page.getByText('Not linked')).toBeVisible();
  await expect(page.getByText(`assure link ${repositoryId}`)).toBeVisible();
  await expect(page.getByText('It never sends database messages')).toBeVisible();

  // Filters live in the URL and survive a reload.
  await page.goto(`/runs?repository=${repositoryId}&result=FAILED`);
  await expect(page.getByLabel('Repository')).toHaveValue(repositoryId);
  await expect(page.getByLabel('Result')).toHaveValue('FAILED');
  await page.getByLabel('Result').selectOption('COMPLETE');
  await expect(page).toHaveURL(/result=COMPLETE/);
  await page.reload();
  await expect(page.getByLabel('Result')).toHaveValue('COMPLETE');

  // Another account cannot open this repository.
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await createAccount(otherPage, `other-${stamp}@assurance.invalid`);
  const response = await otherPage.goto(repositoryUrl);
  expect(response?.status()).toBe(404);
  await other.close();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/sign-in/);
  const protectedResponse = await page.goto(repositoryUrl);
  expect(protectedResponse?.url()).toContain('/sign-in');
});
