import { expect, type Page, type Route, test } from '@playwright/test';

const MOCK_USER = {
  user: {
    id: 'user-onboarding-audit',
    email: 'audit@example.com',
    name: 'Onboarding Audit User With Long Display Name',
    image: null,
    role: 'user',
    status: 'active',
    emailVerified: true,
    createdAt: '2026-05-19T00:00:00Z',
    updatedAt: '2026-05-19T00:00:00Z',
  },
  session: {
    id: 'session-onboarding-audit',
    userId: 'user-onboarding-audit',
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    token: 'mock-token',
    createdAt: '2026-05-19T00:00:00Z',
    updatedAt: '2026-05-19T00:00:00Z',
  },
};

async function screenshot(page: Page, name: string) {
  await page.waitForTimeout(600);
  await page.screenshot({
    path: `../../.codex/tmp/playwright-screenshots/${name}.png`,
    fullPage: true,
  });
}

async function assertNoOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
}

async function setupApiMocks(page: Page, trialAvailable = false) {
  await page.route('**/api/**', async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    const respond = (status: number, body: unknown) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (path.includes('/api/auth/')) return respond(200, MOCK_USER);
    if (path.startsWith('/api/notifications')) return respond(200, { notifications: [], unreadCount: 0 });
    if (path === '/api/dashboard/active-tasks') return respond(200, { tasks: [] });
    if (path === '/api/projects') return respond(200, { projects: [], nextCursor: null });
    if (path === '/api/credentials') return respond(200, []);
    if (path === '/api/credentials/agent') return respond(200, { credentials: [] });
    if (path === '/api/credentials/agent/validate' && method === 'POST') {
      return respond(200, { valid: true, agentType: 'claude-code', validationMode: 'provider', message: 'Claude Code credential validated.' });
    }
    if (path === '/api/credentials/validate' && method === 'POST') {
      return respond(200, { valid: true, provider: 'hetzner', message: 'hetzner credential validated.' });
    }
    if (path === '/api/trial/status' || path === '/api/trial-status') return respond(200, { available: trialAvailable });
    if (path === '/api/github/installations') return respond(200, trialAvailable ? [{ id: 'inst-1' }] : []);
    if (path === '/api/agents') {
      return respond(200, {
        agents: [
          { id: 'claude-code', name: 'Claude Code', configured: false, supportsAcp: true },
          { id: 'openai-codex', name: 'OpenAI Codex', configured: false, supportsAcp: true },
        ],
      });
    }

    return respond(200, {});
  });
}

test.describe('Onboarding wizard audit', () => {
  test('credential validation steps render without overflow', async ({ page }, testInfo) => {
    await setupApiMocks(page);
    await page.goto('/dashboard');
    await page.waitForTimeout(1000);

    const suffix = testInfo.project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    await expect(page.getByTestId('onboarding-wizard')).toBeVisible();
    await expect(page.getByText('Connect your AI agent')).toBeVisible();
    await page.getByText('Claude Code').click();
    await page.getByPlaceholder('Paste your anthropic API key').fill(`sk-ant-api03-${'x'.repeat(220)}`);
    await expect(page.getByRole('button', { name: 'Test key' })).toBeVisible();
    await screenshot(page, `onboarding-agent-validation-${suffix}`);
    await assertNoOverflow(page);

    await page.getByRole('tab', { name: /Cloud/ }).click();
    await page.getByText('Hetzner').click();
    await page.getByPlaceholder('Paste your Hetzner API token').fill(`hetzner-${'token-'.repeat(40)}`);
    await expect(page.getByRole('button', { name: 'Test connection' })).toBeVisible();
    await screenshot(page, `onboarding-cloud-validation-${suffix}`);
    await assertNoOverflow(page);
  });

  test('trial-aware final step exposes project and own-setup actions', async ({ page }, testInfo) => {
    await setupApiMocks(page, true);
    await page.goto('/dashboard');
    await page.waitForTimeout(1000);

    const suffix = testInfo.project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    await expect(page.getByText('Using trial compute right now')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create your first project' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add my own setup' })).toBeVisible();
    await screenshot(page, `onboarding-trial-final-${suffix}`);
    await assertNoOverflow(page);
  });
});
