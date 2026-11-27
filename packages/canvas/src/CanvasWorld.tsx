import { useEffect, type ReactNode } from 'react';
import { useCanvasContext } from './useCanvas';
import styles from './canvas.module.css';

/**
 * The transformed layer. Its CSS transform is written imperatively by the
 * viewport controller so panning and zooming never re-render the children.
 */
export function CanvasWorld({ children }: { children: ReactNode }) {
  const { store, worldRef } = useCanvasContext();

  useEffect(() => {
    const element = worldRef.current;
    if (!element) {
      return;
    }
    const viewport = store.getSnapshot();
    element.style.transform = `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`;
  }, [store, worldRef]);

  return (
    <div ref={worldRef} className={styles['world']}>
      {children}
    </div>
  );
}
