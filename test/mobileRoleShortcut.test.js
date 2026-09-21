import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = () => readFile(
  new URL('../src/components/layout/MobileHomePrimaryNav.jsx', import.meta.url),
  'utf8',
);

test('mobile home navigation exposes a direct role-aware admin or provider shortcut', async () => {
  const mobileNav = await source();

  assert.match(mobileNav, /profile\?\.role === 'admin' \|\| profile\?\.is_admin === true/);
  assert.match(mobileNav, /role === 'guide' \|\| role === 'agency'/);
  assert.match(mobileNav, /path: isAdmin \? '\/admin' : '\/dashboard'/);
  assert.match(mobileNav, /label: isAdmin \? t\('nav_admin_panel'\) : t\('nav_dashboard'\)/);
  assert.match(mobileNav, /data-testid=\{link\.roleShortcut \? 'mobile-role-shortcut' : undefined\}/);
});

test('mobile role shortcut waits for authentication and preserves the three-column public navigation', async () => {
  const mobileNav = await source();

  assert.match(mobileNav, /!isLoadingAuth && isAuthenticated && \(isAdmin \|\| isProvider\)/);
  assert.match(mobileNav, /roleShortcut \? 'grid-cols-2' : 'grid-cols-3'/);
  assert.match(mobileNav, /\{ path: '\/tours'/);
  assert.match(mobileNav, /\{ path: '\/guides'/);
  assert.match(mobileNav, /\{ path: '\/agencies'/);
});
