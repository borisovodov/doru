import { useEffect, useRef, useState } from 'react';
import type { AgentStep } from '@doru/ai';
import { nls } from '../nls';

export interface ChatTranscriptMessage {
  role: 'user' | 'assistant';
  content: string;
  steps?: AgentStep[];
  error?: string;
}

export interface ChatPermissionRequest {
  id: string;
  tool: string;
  arguments: Record<string, unknown>;
}

export interface ChatPanelProps {
  messages: ChatTranscriptMessage[];
  busy: boolean;
  permission: ChatPermissionRequest | null;
  onSend: (text: string) => void;
  onPermission: (allow: boolean) => void;
}

export function ChatPanel({ messages, busy, permission, onSend, onPermission }: ChatPanelProps) {
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = scrollRef.current;
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  }, [messages, busy, permission]);

  const submit = () => {
    const text = draft.trim();
    if (!text || busy) {
      return;
    }
    setDraft('');
    onSend(text);
  };

  return (
    <div className="chat-panel">
      <div className="chat-messages" ref={scrollRef}>
        {messages.map((message, index) => (
          <div key={index} className={`chat-message ${message.role}`}>
            {message.role === 'user' ? (
              <div className="chat-bubble">{message.content}</div>
            ) : (
              <div className="chat-bubble">
                {message.steps?.map((step, stepIndex) => (
                  <ChatStep key={stepIndex} step={step} />
                ))}
                {message.error ? (
                  <div className="chat-error">{nls.t('chat.error', message.error)}</div>
                ) : null}
              </div>
            )}
          </div>
        ))}
        {permission && (
          <div className="chat-permission">
            <p>{nls.t('chat.permission.ask', permission.tool)}</p>
            <pre>{JSON.stringify(permission.arguments, null, 2)}</pre>
            <div className="chat-permission-actions">
              <button onClick={() => onPermission(true)}>{nls.t('chat.permission.allow')}</button>
              <button onClick={() => onPermission(false)}>{nls.t('chat.permission.deny')}</button>
            </div>
          </div>
        )}
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
        <button disabled={busy} onClick={submit}>
          {nls.t('chat.send')}
        </button>
      </div>
    </div>
  );
}

function ChatStep({ step }: { step: AgentStep }) {
  switch (step.type) {
    case 'text':
      return <div className="chat-text">{step.content}</div>;
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
