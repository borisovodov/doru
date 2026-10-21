import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgentStep, ChatMessage } from '@doru/ai';
import type { ChatPermissionRequest, ChatTranscriptMessage } from '@doru/features';

export function useChat(
  projectPath: string | null | undefined,
  refreshTree: () => Promise<void>,
) {
  const [chatMessages, setChatMessages] = useState<ChatTranscriptMessage[]>([]);
  const [chatBusy, setChatBusy] = useState(false);
  const [permission, setPermission] = useState<ChatPermissionRequest | null>(null);
  const chatConversation = useRef<ChatMessage[]>([]);

  useEffect(() => {
    setChatMessages([]);
    setPermission(null);
    chatConversation.current = [];
  }, [projectPath]);

  useEffect(() => {
    return window.doru.onChatPermission((request) => {
      setPermission(request);
    });
  }, []);

  useEffect(() => {
    return window.doru.onChatEvent((event) => {
      if (event.type === 'textDelta') {
        setChatMessages((previous) => {
          const next = [...previous];
          const last = next[next.length - 1];
          if (last && last.role === 'assistant') {
            next[next.length - 1] = { ...last, content: last.content + event.text };
          }
          return next;
        });
      } else {
        const step: AgentStep = event.step;
        setChatMessages((previous) => {
          const next = [...previous];
          const last = next[next.length - 1];
          if (last && last.role === 'assistant') {
            next[next.length - 1] = { ...last, steps: [...(last.steps ?? []), step] };
          }
          return next;
        });
      }
    });
  }, []);

  const sendChatMessage = useCallback(
    async (text: string) => {
      if (!projectPath || chatBusy) {
        return;
      }
      const userMessage: ChatMessage = { role: 'user', content: text };
      chatConversation.current = [...chatConversation.current.slice(-20), userMessage];
      setChatMessages((previous) => [
        ...previous,
        { role: 'user', content: text },
        { role: 'assistant', content: '', steps: [] },
      ]);
      setChatBusy(true);
      try {
        const result = await window.doru.sendChat(projectPath, chatConversation.current);
        setChatMessages((previous) => {
          const next = [...previous];
          const last = next[next.length - 1];
          if (last && last.role === 'assistant') {
            next[next.length - 1] = {
              role: 'assistant',
              content: result.finalText,
              steps: result.steps,
              error: result.error,
            };
          }
          return next;
        });
        chatConversation.current.push({ role: 'assistant', content: result.finalText || '' });
      } finally {
        setChatBusy(false);
      }
      void refreshTree();
    },
    [projectPath, chatBusy, refreshTree],
  );

  const respondPermission = useCallback(
    (allow: boolean) => {
      if (!permission) {
        return;
      }
      window.doru.respondChatPermission(permission.id, allow);
      setPermission(null);
    },
    [permission],
  );

  return { chatMessages, chatBusy, permission, sendChatMessage, respondPermission };
}
