import { nls } from '../nls';
import { PlaceholderView } from '../placeholder/PlaceholderView';
import './ChatPanel.css';

export interface ChatSetupPlaceholderProps {
  onOpenSettings: () => void;
}

/** Shown in the agent chat panel while no AI provider is configured. */
export function ChatSetupPlaceholder({ onOpenSettings }: ChatSetupPlaceholderProps) {
  return (
    <div className="chat-setup">
      <PlaceholderView
        title={nls.t('chat.setup.title')}
        description={nls.t('chat.setup.description')}
      >
        <button onClick={onOpenSettings}>{nls.t('chat.setup.openSettings')}</button>
      </PlaceholderView>
    </div>
  );
}
