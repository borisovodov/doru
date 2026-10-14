import { memo } from 'react';
import type { Node, NodeProps } from '@xyflow/react';

export type GenerationBandData = {
  generation: number;
};

/**
 * A horizontal band behind one card row (generation). Non-interactive; the
 * canvas renders it behind the cards.
 */
export const GenerationBand = memo(function GenerationBand({
  data,
}: NodeProps<Node<GenerationBandData>>) {
  return (
    <div className={data.generation % 2 === 0 ? 'generation-band even' : 'generation-band odd'} />
  );
});
