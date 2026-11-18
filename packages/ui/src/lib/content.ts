import type { ReactNode } from 'react';

/**
 * Whether an optional ReactNode slot should render its wrapper. Booleans and
 * empty strings render nothing, while numeric 0 is real content.
 */
export function hasContent(value: ReactNode): boolean {
  return value !== undefined && value !== null && typeof value !== 'boolean' && value !== '';
}
