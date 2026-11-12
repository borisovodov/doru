export interface ThemePalette {
  [key: string]: string;
}

export interface ThemeDefinition {
  id: string;
  name: string;
  dark: ThemePalette;
  light: ThemePalette;
}

/** Converts a theme palette into the CSS custom properties the app uses. */
export function paletteToCss(palette: ThemePalette): string {
  const lines = Object.entries(palette).map(([key, value]) => `  --doru-${key}: ${value};`);
  return `:root {\n${lines.join('\n')}\n}\n`;
}
