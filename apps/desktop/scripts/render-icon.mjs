import sharp from 'sharp';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const resources = join(root, 'resources');
mkdirSync(resources, { recursive: true });

const svg = readFileSync(join(resources, 'icon.svg'));
await sharp(svg, { density: 384 })
  .resize(1024, 1024)
  .png()
  .toFile(join(resources, 'icon.png'));

console.log('icon.png rendered from icon.svg');
