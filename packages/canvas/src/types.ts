export interface Point {
  x: number;
  y: number;
}

export interface Rect extends Point {
  width: number;
  height: number;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface ViewportTransitionOptions {
  /** Transition duration in milliseconds. Zero or undefined applies instantly. */
  duration?: number | undefined;
}

export interface FitOptions extends ViewportTransitionOptions {
  /** Padding as a fraction of the fitted size (0.12 = 12%). */
  padding?: number | undefined;
  minZoom?: number | undefined;
  maxZoom?: number | undefined;
}

export type PanelPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export type OverlayPosition = 'top' | 'bottom';
