import type { ElementType, ReactNode } from 'react';

export type DemoDecorator = (Story: () => ReactNode) => ReactNode;

/**
 * The metadata a demo module exports by default. Demos live next to the
 * component they exercise and are discovered by the gallery at dev time.
 */
export interface DemoMeta<TComponent extends ElementType = ElementType> {
  title: string;
  component?: TComponent;
  args?: Record<string, unknown>;
  decorators?: DemoDecorator[];
  render?: (args: Record<string, unknown>) => ReactNode;
}

/** One named export of a demo module. */
export interface Demo {
  name?: string;
  args?: Record<string, unknown>;
  decorators?: DemoDecorator[];
  render?: (args: Record<string, unknown>) => ReactNode;
}
