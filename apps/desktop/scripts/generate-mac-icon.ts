#!/usr/bin/env node
// Generates the macOS icon assets from the Icon Composer project
// (build/Icon.icon) using the exact same actool pipeline that electron-builder
// runs when packaging:
//   - build/icon.icns      — legacy icns (also used as the DMG volume icon)
//   - build/icon-dev.png    — the 1024x1024 PNG embedded in that icns, used as
//                            the dock icon in development, because Electron's
//                            nativeImage cannot load .icns files directly.
//
// Run after editing the Icon Composer project:
//   npm run icon:mac --workspace @doru/desktop
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateAssetCatalogForIcon } from 'app-builder-lib/out/util/macosIconComposer.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const iconProject = join(root, 'build', 'Icon.icon');
const icnsPath = join(root, 'build', 'icon.icns');
const devPngPath = join(root, 'build', 'icon-dev.png');

if (process.platform !== 'darwin') {
  console.error('generate-mac-icon: macOS only (requires actool from Xcode 26+).');
  process.exit(1);
}

function extractIcnsPng(icns: Buffer, chunkType: string): Buffer | null {
  let offset = 8; // skip the 'icns' magic and the total size field
  while (offset + 8 <= icns.length) {
    const type = icns.toString('latin1', offset, offset + 4);
    const size = icns.readUInt32BE(offset + 4);
    if (size < 8 || offset + size > icns.length) {
      return null;
    }
    if (type === chunkType) {
      return icns.subarray(offset + 8, offset + size);
    }
    offset += size;
  }
  return null;
}

try {
  const { icnsFile } = await generateAssetCatalogForIcon(iconProject);
  writeFileSync(icnsPath, icnsFile);

  const devPng = extractIcnsPng(icnsFile, 'ic13'); // ic13 = 1024x1024 PNG
  if (!devPng) {
    throw new Error(`no ic13 (1024x1024) chunk in the generated icns`);
  }
  writeFileSync(devPngPath, devPng);

  console.log(`wrote ${icnsPath}`);
  console.log(`wrote ${devPngPath}`);
} catch (error) {
  console.error(`generate-mac-icon: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
