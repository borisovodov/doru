import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Plus, Send, Square, Trash2 } from 'lucide-react';
import type { AgentStep, ChatSessionMeta, ChatTranscriptMessage } from '@doru/ai';
import { nls } from '../nls';
import { ChatMarkdown } from './ChatMarkdown';
import './ChatPanel.css';

export interface ChatPanelProps {
  messages: ChatTranscriptMessage[];
  busy: boolean;
  sessions: ChatSessionMeta[];
  activeSessionId: string | null;
  onSend: (text: string) => void;
  /** Stops the run and returns the sent message text ('' when none) so the input can restore it. */
  onStop: () => string;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  /** Copies text to the system clipboard (the desktop layer owns the access). */
  onCopy?: (text: string) => void;
  /** Opens a link from a markdown reply; without it, link clicks do nothing. */
  onOpenLink?: (url: string) => void;
}

export function ChatPanel({
  messages,
  busy,
  sessions,
  activeSessionId,
  onSend,
  onStop,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onCopy,
  onOpenLink,
}: ChatPanelProps) {
  const [draft, setDraft] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const copyTimer = useRef<number | null>(null);
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

  /** Copies the reply's raw markdown to the system clipboard. */
  const copyReply = (index: number, message: ChatTranscriptMessage) => {
    const text = message.content !== '' ? message.content : (message.error ?? '');
    if (text === '' || !onCopy) {
      return;
    }
    onCopy(text);
    setCopiedIndex(index);
    if (copyTimer.current !== null) {
      window.clearTimeout(copyTimer.current);
    }
    copyTimer.current = window.setTimeout(() => setCopiedIndex(null), 1500);
  };

  return (
    <div className="chat-panel">
      <SessionsHeader
        sessions={sessions}
        activeSessionId={activeSessionId}
        busy={busy}
        onSelectSession={onSelectSession}
        onNewSession={onNewSession}
        onDeleteSession={onDeleteSession}
      />
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
                <div className="chat-assistant">
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
                  {message.content !== '' || message.error ? (
                    <div className="chat-message-actions">
                      <button
                        className="chat-copy"
                        aria-label={copiedIndex === index ? nls.t('chat.copied') : nls.t('chat.copy')}
                        onClick={() => copyReply(index, message)}
                      >
                        {copiedIndex === index ? (
                          <Check size={13} aria-hidden="true" />
                        ) : (
                          <Copy size={13} aria-hidden="true" />
                        )}
                      </button>
                    </div>
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

interface SessionsHeaderProps {
  sessions: ChatSessionMeta[];
  activeSessionId: string | null;
  busy: boolean;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
}

/** The session picker in the panel header: list, new, delete. */
function SessionsHeader({
  sessions,
  activeSessionId,
  busy,
  onSelectSession,
  onNewSession,
  onDeleteSession,
}: SessionsHeaderProps) {
  return (
    <div className="chat-sessions">
      <select
        className="chat-session-select"
        value={activeSessionId ?? ''}
        disabled={busy || sessions.length === 0}
        aria-label={nls.t('chat.sessions.title')}
        onChange={(event) => onSelectSession(event.target.value)}
      >
        {sessions.map((session) => (
          <option key={session.id} value={session.id}>
            {session.title !== '' ? session.title : nls.t('chat.sessions.untitled')}
          </option>
        ))}
      </select>
      <button
        className="chat-action chat-session-action"
        disabled={busy}
        aria-label={nls.t('chat.sessions.new')}
        onClick={onNewSession}
      >
        <Plus size={16} aria-hidden="true" />
      </button>
      <button
        className="chat-action chat-session-action"
        disabled={busy || !activeSessionId}
        aria-label={nls.t('chat.sessions.delete')}
        onClick={() => {
          if (activeSessionId) {
            onDeleteSession(activeSessionId);
          }
        }}
      >
        <Trash2 size={14} aria-hidden="true" />
      </button>
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
