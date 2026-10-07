import { createServiceId } from './di';
import { Emitter } from './events';

export const IThemeService = createServiceId<IThemeService>('theme');

export interface Theme {
  name: string;
  type: 'dark' | 'light';
  colors: Record<string, string>;
}

export interface IThemeService {
  readonly theme: Theme;
  readonly onDidChange: Emitter<Theme>;
  setTheme(name: string): Promise<void>;
  list(): Promise<string[]>;
}
