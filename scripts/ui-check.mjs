// Dev helper: verifies the floating-panel geometry numerically.
// Usage: npm run dev (in another terminal), then: node scripts/ui-check.mjs
import { _electron as electron } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const electronPath = require('electron');
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const appDir = join(root, 'apps/desktop');

const userData = mkdtempSync(join(tmpdir(), 'doru-check-data-'));
const app = await electron.launch({
  args: ['.'],
  cwd: appDir,
  env: {
    ...process.env,
    DORU_USER_DATA: userData,
    ELECTRON_RENDERER_URL: process.env.ELECTRON_RENDERER_URL ?? 'http://localhost:5173',
  },
});
const window = await app.firstWindow();
await window.setViewportSize({ width: 1440, height: 900 });
await window.waitForSelector('.workbench', { timeout: 20_000 });
await window.waitForTimeout(400);

const report = await window.evaluate(() => {
  const win = { w: window.innerWidth, h: window.innerHeight };
  const rect = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      x: Math.round(r.x * 10) / 10,
      y: Math.round(r.y * 10) / 10,
      w: Math.round(r.width * 10) / 10,
      h: Math.round(r.height * 10) / 10,
      borderTop: cs.borderTopWidth,
      borderRight: cs.borderRightWidth,
      borderBottom: cs.borderBottomWidth,
      borderLeft: cs.borderLeftWidth,
      radius: cs.borderRadius,
      bg: cs.backgroundColor,
      overflow: cs.overflow,
    };
  };
  return {
    window: win,
    workbench: rect('.workbench'),
    titleBar: rect('.title-bar'),
    sideCluster: rect('.side-cluster'),
    activityBar: rect('.activity-bar'),
    sideBar: rect('.side-bar'),
    editor: rect('.editor-area'),
    secondary: rect('.secondary-side-bar'),
  };
});

console.log(JSON.stringify(report, null, 2));

// Open a project so the people view (with sidebar) is reachable
const project = join(mkdtempSync(join(tmpdir(), 'doru-check-project-')), 'family.doru');
await window.evaluate(async ({ project, fixture }) => {
  await window.doru.openProjectPath(project);
  await window.doru.importGedcomFile(project, fixture);
}, { project, fixture: join(root, 'e2e', 'fixtures', 'small.ged') });
await window.waitForSelector('.editor-pane.active');
await window.evaluate(() => {
  const items = [...document.querySelectorAll('.activity-bar .activity-bar-item:not(.activity-bar-bottom)')];
  items[1]?.click();
});
await window.waitForTimeout(400);

const withSidebar = await window.evaluate(() => {
  const r = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const b = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      x: Math.round(b.x * 10) / 10,
      w: Math.round(b.width * 10) / 10,
      h: Math.round(b.height * 10) / 10,
      borderLeft: cs.borderLeftWidth,
      radius: cs.borderRadius,
    };
  };
  return {
    sideCluster: r('.side-cluster'),
    sideBar: r('.side-bar'),
    editor: r('.editor-area'),
    secondary: r('.secondary-side-bar'),
  };
});
console.log('with sidebar:', JSON.stringify(withSidebar, null, 2));

// Tab geometry (open state has tabs rendered)
const tabs = await window.evaluate(() => {
  const bar = document.querySelector('.tab-bar');
  const tab = document.querySelector('.tab-bar .tab');
  const active = document.querySelector('.tab-bar .tab.active');
  const close = document.querySelector('.tab-bar .tab .tab-close');
  if (!bar || !tab) return null;
  const g = (el) => {
    const b = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      x: Math.round(b.x * 10) / 10,
      y: Math.round(b.y * 10) / 10,
      w: Math.round(b.width * 10) / 10,
      h: Math.round(b.height * 10) / 10,
      radius: cs.borderRadius,
      bg: cs.backgroundColor,
      opacity: cs.opacity,
    };
  };
  return {
    bar: g(bar),
    tab: g(tab),
    active: active ? g(active) : null,
    close: close ? g(close) : null,
  };
});
console.log('tabs:', JSON.stringify(tabs, null, 2));

await app.close();
