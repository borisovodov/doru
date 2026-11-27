import { copyFile, mkdir, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Copies a project media tree. Content-addressed media lives in per-project
 * scope directories, while older projects may still have flat files; both
 * shapes are copied recursively.
 */
export async function copyMediaDirectory(source: string, destination: string): Promise<void> {
  await mkdir(destination, { recursive: true });
  for (const entry of await readdir(source)) {
    const sourceEntry = join(source, entry);
    const destinationEntry = join(destination, entry);
    const info = await stat(sourceEntry);
    if (info.isDirectory()) {
      await copyMediaDirectory(sourceEntry, destinationEntry);
    } else if (info.isFile()) {
      await copyFile(sourceEntry, destinationEntry);
    }
  }
}
