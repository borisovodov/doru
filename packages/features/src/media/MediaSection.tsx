import type { ComponentProps } from 'react';
import { MEDIA_VISIBLE } from '@doru/platform';
import { MediaSection as UiMediaSection } from '@doru/ui/domain';

/**
 * The product-level gate for the shared media section: the design-system
 * component stays in `@doru/ui` (and its gallery demo keeps working), while the
 * app hides every media editing surface behind `MEDIA_VISIBLE`.
 */
export function MediaSection(props: ComponentProps<typeof UiMediaSection>) {
  if (!MEDIA_VISIBLE) {
    return null;
  }
  return <UiMediaSection {...props} />;
}
