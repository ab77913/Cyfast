import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const email = process.env.W1_E2E_EMAIL || 'admin@cyient.com';
const password = process.env.W1_E2E_PASSWORD || 'W1-Test-Admin!234';
const artifactDir = process.env.W1_UI_ARTIFACT_DIR || path.join(process.cwd(), '..', 'scripts', 'windows', '.w1-run', 'ui-e2e');

test.beforeAll(() => {
  fs.mkdirSync(artifactDir, { recursive: true });
});

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) return;
  const base = path.join(artifactDir, testInfo.title.replace(/\W+/g, '_'));
  await page.screenshot({ path: `${base}.png`, fullPage: true }).catch(() => {});
  await page.context().tracing.stop({ path: `${base}.zip` }).catch(() => {});
});

test('W1 Windows Nodes operator flow', async ({ page, context }) => {
  await context.tracing.start({ screenshots: true, snapshots: true }).catch(() => {});
  page.on('pageerror', (err) => fs.appendFileSync(path.join(artifactDir, 'page-errors.log'), `${err.message}\n`));
  page.on('requestfailed', (req) =>
    fs.appendFileSync(path.join(artifactDir, 'network-errors.log'), `${req.method()} ${req.url()} ${req.failure()?.errorText}\n`)
  );

  await page.goto('/login');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await Promise.all([
    page.waitForURL((url) => !String(url).includes('login'), { timeout: 45_000 }),
    page.getByRole('button', { name: /sign in/i }).click()
  ]);
  await expect(page).not.toHaveURL(/login/);

  // Top nav + project dashboard route must remain reachable after login.
  await page.getByRole('link', { name: /Dashboard/i }).first().click();
  await page.waitForURL(/\/projects(\/dashboard)?/, { timeout: 30_000 });
  await page.goto('/projects');
  await expect(page.getByRole('link', { name: /Projects/i }).first()).toBeVisible();

  await page.goto('/resources/windows-nodes');
  await page.waitForLoadState('networkidle');
  await expect(page).not.toHaveURL(/login/);
  // Navbar must remain visible on Windows Nodes (layout regression).
  await expect(page.getByRole('link', { name: /Windows Nodes/i }).first()).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole('heading', { name: 'Windows Nodes' })).toBeVisible({ timeout: 45_000 });

  const nodeLink = page.locator('a.project-link').first();
  await expect(nodeLink).toBeVisible({ timeout: 90_000 });
  await nodeLink.click();
  await expect(page.getByRole('heading', { name: /Windows Node:/i })).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText(/ONLINE|READY/i).first()).toBeVisible({ timeout: 45_000 });

  await page.getByPlaceholder('Project ID').fill('1');
  const profileSelect = page.locator('select').first();
  const optionCount = await profileSelect.locator('option').count();
  expect(optionCount).toBeGreaterThan(1);
  await profileSelect.selectOption({ index: 1 });
  await page.getByRole('button', { name: /Start session/i }).click();
  await page.getByRole('button', { name: /^Launch$/i }).click();
  await page.getByRole('button', { name: /Inspect UI tree/i }).click();

  const autoInput = page.locator('xpath=//label[contains(.,"AutomationId")]/following::input[1]');
  await autoInput.fill('CyFastFixture.TextInput');
  const valueInput = page.locator('xpath=//label[contains(.,"Value")]/following::input[1]');
  await valueInput.fill('W1-UI-E2E');
  await page.getByRole('button', { name: /^Set$/i }).click();

  await autoInput.fill('CyFastFixture.ActionButton');
  await page.getByRole('button', { name: /^Invoke$/i }).click();
  await page.getByRole('button', { name: /Screenshot/i }).click();
  await page.getByRole('button', { name: /End session/i }).click();
  await expect(page.getByText(/No active session|ENDED|CLOSED|REQUESTED/i).first()).toBeVisible({ timeout: 30_000 });
});
