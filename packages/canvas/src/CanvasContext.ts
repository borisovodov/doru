import { createContext, type RefObject } from 'react';
import type { FitOptions, Rect, Viewport, ViewportTransitionOptions } from './types';
import type { ViewportStore } from './viewportStore';

export interface CanvasConfig {
  minZoom: number;
  maxZoom: number;
  panOnScroll: boolean;
  zoomOnPinch: boolean;
  panOnDrag: boolean;
  panOnScrollSpeed: number;
}

export interface CanvasController {
  fit(bounds: Rect, options?: FitOptions): Promise<boolean>;
  setViewport(viewport: Viewport, options?: ViewportTransitionOptions): Promise<boolean>;
  zoomIn(options?: ViewportTransitionOptions): Promise<boolean>;
  zoomOut(options?: ViewportTransitionOptions): Promise<boolean>;
}

export interface CanvasContextValue {
  store: ViewportStore;
  config: CanvasConfig;
  controllerRef: RefObject<CanvasController | null>;
  rootRef: RefObject<HTMLDivElement | null>;
  worldRef: RefObject<HTMLDivElement | null>;
  setController(controller: CanvasController | null): void;
}

export const CanvasContext = createContext<CanvasContextValue | null>(null);
