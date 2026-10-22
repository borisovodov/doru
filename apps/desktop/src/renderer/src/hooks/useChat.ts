import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgentStep, ChatMessage } from '@doru/ai';
import type { ChatTranscriptMessage } from '@doru/features';

export function useChat(
  projectPath: string | null | undefined,
  refreshTree: () => Promise<void>,
) {
  const [chatMessages, setChatMessages] = useState<ChatTranscriptMessage[]>([]);
  const [chatBusy, setChatBusy] = useState(false);
  const chatConversation = useRef<ChatMessage[]>([]);
  // Guards against the IPC ordering race: the invoke reply can beat the last
  // streamed `chat:event` deltas, which would otherwise append on top of the
  // already-finalized transcript ("Done.Done.").
  const runFinalized = useRef(false);

  useEffect(() => {
    setChatMessages([]);
    chatConversation.current = [];
  }, [projectPath]);

  useEffect(() => {
    return window.doru.onChatEvent((event) => {
      if (runFinalized.current) {
        return;
      }
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
      runFinalized.current = false;
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
        // The run is over: the reply carries the authoritative text and
        // steps; any streamed deltas arriving after this point are stale.
        runFinalized.current = true;
        setChatMessages((previous) => {
          const next = [...previous];
          const last = next[next.length - 1];
          if (last && last.role === 'assistant' && !result.cancelled) {
            next[next.length - 1] = {
              role: 'assistant',
              content: result.finalText,
              steps: result.steps,
              error: result.error,
            };
          }
          return next;
        });
        if (!result.cancelled) {
          chatConversation.current.push({ role: 'assistant', content: result.finalText || '' });
        }
      } catch (error) {
        // The IPC itself rejected (main-process crash, serialization, …):
        // surface it in the transcript instead of leaving an empty bubble.
        const message = error instanceof Error ? error.message : String(error);
        console.error('chat: sendChat failed', error);
        setChatMessages((previous) => {
          const next = [...previous];
          const last = next[next.length - 1];
          if (last && last.role === 'assistant') {
            next[next.length - 1] = { ...last, error: message };
          }
          return next;
        });
      } finally {
        setChatBusy(false);
      }
      void refreshTree();
    },
    [projectPath, chatBusy, refreshTree],
  );

  const cancelChat = useCallback((): string => {
    if (projectPath) {
      window.doru.cancelChat(projectPath);
    }
    // Stop doubles as "oops, wrong wording": the sent message leaves the
    // transcript and its text goes back to the input for editing.
    const lastUser = [...chatMessages].reverse().find((message) => message.role === 'user');
    setChatMessages((previous) => {
      const next = [...previous];
      // Drop the in-flight assistant bubble (may hold partial text/steps).
      if (next[next.length - 1]?.role === 'assistant') {
        next.pop();
      }
      for (let index = next.length - 1; index >= 0; index -= 1) {
        if (next[index]?.role === 'user') {
          next.splice(index, 1);
          break;
        }
      }
      return next;
    });
    // The in-flight user message is the tail of the model conversation.
    if (chatConversation.current[chatConversation.current.length - 1]?.role === 'user') {
      chatConversation.current.pop();
    }
    return lastUser?.content ?? '';
  }, [projectPath, chatMessages]);

  return { chatMessages, chatBusy, sendChatMessage, cancelChat };
}
