// Electron main for the OpenGraph image renderer. Invoked by
// scripts/og-images.ts: renders the design page for each variant into a
// 2400x1260 PNG (2x of the final 1200x630) via offscreen rendering.
import { app, BrowserWindow } from 'electron';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [, , htmlPath, outDir] = process.argv;

app.disableHardwareAcceleration();
// Keep the throwaway Electron profile out of ~/Library/Application Support
// and clear of the app's single-instance lock.
app.setPath('userData', join(outDir, 'user-data'));
mkdirSync(outDir, { recursive: true });

const VARIANTS = [
  ['og-icon', 'icon'],
  ['og-shot', 'shot'],
];

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout: ${label}`)), ms)),
  ]);
}

async function render(win, name, variant) {
  const url = `${pathToFileURL(htmlPath).href}?variant=${variant}`;
  await withTimeout(win.loadURL(url), 20000, `load ${name}`);
  // The wordmark is a self-hosted webfont; wait until it is in use before
  // capturing, then give layout a beat to settle.
  await win.webContents.executeJavaScript('document.fonts.ready.then(() => true)');
  await new Promise((resolve) => setTimeout(resolve, 150));
  const image = await win.webContents.capturePage();
  writeFileSync(join(outDir, `${name}.png`), image.toPNG());
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 2400,
    height: 1260,
    useContentSize: true,
    show: false,
    frame: false,
    webPreferences: { offscreen: true },
  });
  try {
    for (const [name, variant] of VARIANTS) await render(win, name, variant);
    console.log(`og images rendered to ${outDir}`);
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
});
