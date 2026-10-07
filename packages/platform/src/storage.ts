import { createServiceId } from './di';

export const IStorageService = createServiceId<IStorageService>('storage');

export interface IStorageService {
  readText(path: string): Promise<string>;
  writeText(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}
