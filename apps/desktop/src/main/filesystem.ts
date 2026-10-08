import { access, appendFile, copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import type { IFileSystem } from '@doru/core';

export class NodeFileSystem implements IFileSystem {
  async exists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }

  async mkdir(path: string): Promise<void> {
    await mkdir(path, { recursive: true });
  }

  readdir(path: string): Promise<string[]> {
    return readdir(path);
  }

  readFile(path: string): Promise<string> {
    return readFile(path, 'utf8');
  }

  writeFile(path: string, content: string): Promise<void> {
    return writeFile(path, content, 'utf8');
  }

  appendFile(path: string, content: string): Promise<void> {
    return appendFile(path, content, 'utf8');
  }

  copyFile(source: string, destination: string): Promise<void> {
    return copyFile(source, destination);
  }

  readBinary(path: string): Promise<Uint8Array> {
    return readFile(path);
  }

  writeBinary(path: string, content: Uint8Array): Promise<void> {
    return writeFile(path, content);
  }
}
