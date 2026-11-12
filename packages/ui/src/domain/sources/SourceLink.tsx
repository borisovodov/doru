import { BookOpenText } from 'lucide-react';
import { Button } from '../../atoms/button/Button';
import { nls } from '../../nls';
import styles from './SourceLink.module.css';

export interface SourceLinkProps {
  title: string;
  onClick: () => void;
}

/** The title link that opens a source tab from a citation row. */
export function SourceLink({ title, onClick }: SourceLinkProps) {
  return (
    <Button
      variant="link"
      className={styles['link']}
      icon={<BookOpenText size={13} aria-hidden="true" />}
      title={nls.t('features.tree.citation.openSource')}
      onClick={onClick}
    >
      {title}
    </Button>
  );
}
