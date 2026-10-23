import { useEffect, useRef, useState } from 'react';
import { Send, Square } from 'lucide-react';
import type { AgentStep } from '@doru/ai';
import { nls } from '../nls';
import { ChatMarkdown } from './ChatMarkdown';
import './ChatPanel.css';

export interface ChatTranscriptMessage {
  role: 'user' | 'assistant';
  content: string;
  steps?: AgentStep[];
  error?: string | undefined;
}

export interface ChatPanelProps {
  messages: ChatTranscriptMessage[];
  busy: boolean;
  onSend: (text: string) => void;
  /** Stops the run and returns the sent message text ('' when none) so the input can restore it. */
  onStop: () => string;
  /** Opens a link from a markdown reply; without it, link clicks do nothing. */
  onOpenLink?: (url: string) => void;
}

export function ChatPanel({
  messages,
  busy,
  onSend,
  onStop,
  onOpenLink,
}: ChatPanelProps) {
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = scrollRef.current;
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  }, [messages, busy]);

  const submit = () => {
    const text = draft.trim();
    if (!text || busy) {
      return;
    }
    setDraft('');
    onSend(text);
  };

  const stop = () => {
    const restored = onStop();
    if (restored !== '') {
      setDraft(restored);
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-messages" ref={scrollRef}>
        {messages.map((message, index) => {
          const isLastUser = message.role === 'user' && busy && index === lastUserIndex(messages);
          const isEmptyAssistant =
            message.role === 'assistant' &&
            message.content === '' &&
            (message.steps?.length ?? 0) === 0 &&
            !message.error;
          return (
            <div key={index} className={`chat-message ${message.role}`}>
              {message.role === 'user' ? (
                <>
                  <div className="chat-bubble">{message.content}</div>
                  {isLastUser ? <ThinkingDots /> : null}
                </>
              ) : isEmptyAssistant && busy ? null : (
                <div className="chat-bubble">
                  <div className="chat-text">
                    <ChatMarkdown
                      text={message.content}
                      {...(onOpenLink ? { onOpenLink } : {})}
                    />
                  </div>
                  {message.steps?.map((step, stepIndex) => (
                    <ChatStep key={stepIndex} step={step} />
                  ))}
                  {message.error ? (
                    <div className="chat-error">{message.error}</div>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="chat-input">
        <input
          value={draft}
          placeholder={nls.t('chat.placeholder')}
          disabled={busy}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              submit();
            }
          }}
        />
        <button
          className="chat-action"
          disabled={busy}
          aria-label={nls.t('chat.send')}
          onClick={submit}
        >
          <Send size={16} aria-hidden="true" />
        </button>
        {busy ? (
          <button className="chat-action chat-stop" aria-label={nls.t('chat.stop')} onClick={stop}>
            <Square size={14} fill="currentColor" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Shimmering dots shown under the sent message while the agent works. */
function ThinkingDots() {
  return (
    <div className="chat-thinking" role="status" aria-label={nls.t('chat.thinking')}>
      <span />
      <span />
      <span />
    </div>
  );
}

/** Index of the last user message; -1 when there is none. */
function lastUserIndex(messages: ChatTranscriptMessage[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'user') {
      return index;
    }
  }
  return -1;
}

function ChatStep({ step }: { step: AgentStep }) {
  switch (step.type) {
    case 'toolCall':
      return <div className="chat-tool">{nls.t('chat.toolCall', step.name)}</div>;
    case 'toolResult':
      return (
        <div className="chat-tool-result">
          {truncate(typeof step.result === 'string' ? step.result : JSON.stringify(step.result))}
        </div>
      );
    case 'toolError':
      return <div className="chat-tool-error">{step.message}</div>;
    default:
      return null;
  }
}

function truncate(value: string, max = 400): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}
