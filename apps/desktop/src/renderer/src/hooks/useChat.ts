import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatSessionMeta, ChatTranscriptMessage } from '@doru/ai';

/**
 * The chat panel hook: owns the session list and the transcript of the
 * active session. The main process is the source of truth (sessions live in
 * the JSONL store); the renderer only mirrors what it is told and streams
 * deltas of the active session into the transcript.
 */
export function useChat(
  projectPath: string | null | undefined,
  refreshTree: () => Promise<void>,
) {
  const [sessions, setSessions] = useState<ChatSessionMeta[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatTranscriptMessage[]>([]);
  const [chatBusy, setChatBusy] = useState(false);
  const activeIdRef = useRef<string | null>(null);
  // Guards against the IPC ordering race: the invoke reply can beat the last
  // streamed `chat:event` deltas, which would otherwise append on top of the
  // already-finalized transcript ("Done.Done.").
  const runFinalized = useRef(true);

  const loadTranscript = useCallback(
    async (path: string, id: string) => {
      const transcript = await window.doru.getChatTranscript(path, id);
      runFinalized.current = true;
      setChatMessages(transcript);
    },
    [],
  );

  const refreshSessions = useCallback(async (path: string): Promise<ChatSessionMeta[]> => {
    const list = await window.doru.listChatSessions(path);
    setSessions(list);
    return list;
  }, []);

  useEffect(() => {
    setChatMessages([]);
    setChatBusy(false);
    if (projectPath) {
      void (async () => {
        const list = await refreshSessions(projectPath);
        const next = list[0]?.id ?? null;
        setActiveSessionId(next);
        activeIdRef.current = next;
        if (next) {
          await loadTranscript(projectPath, next);
        }
      })();
    } else {
      setSessions([]);
      setActiveSessionId(null);
      activeIdRef.current = null;
    }
  }, [projectPath, refreshSessions, loadTranscript]);

  useEffect(() => {
    return window.doru.onChatEvent((event) => {
      // Stale events from another session or after the reply finalized are
      // dropped; the invoke reply carries the authoritative transcript.
      if (runFinalized.current || event.sessionId !== activeIdRef.current) {
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
        const step = event.step;
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

  const switchSession = useCallback(
    async (id: string) => {
      if (!projectPath || chatBusy || id === activeSessionId) {
        return;
      }
      setActiveSessionId(id);
      activeIdRef.current = id;
      await loadTranscript(projectPath, id);
    },
    [projectPath, chatBusy, activeSessionId, loadTranscript],
  );

  const newSession = useCallback(async () => {
    if (!projectPath || chatBusy) {
      return;
    }
    const created = await window.doru.createChatSession(projectPath);
    await refreshSessions(projectPath);
    setActiveSessionId(created.id);
    activeIdRef.current = created.id;
    await loadTranscript(projectPath, created.id);
  }, [projectPath, chatBusy, refreshSessions, loadTranscript]);

  const deleteSession = useCallback(
    async (id: string) => {
      if (!projectPath || chatBusy) {
        return;
      }
      await window.doru.deleteChatSession(projectPath, id);
      const list = await refreshSessions(projectPath);
      if (activeSessionId === id) {
        const next = list[0]?.id ?? null;
        setActiveSessionId(next);
        activeIdRef.current = next;
        if (next) {
          await loadTranscript(projectPath, next);
        } else {
          runFinalized.current = true;
          setChatMessages([]);
        }
      }
    },
    [projectPath, chatBusy, activeSessionId, refreshSessions, loadTranscript],
  );

  const sendChatMessage = useCallback(
    async (text: string) => {
      if (!projectPath || chatBusy) {
        return;
      }
      let sessionId = activeSessionId;
      if (!sessionId) {
        const created = await window.doru.createChatSession(projectPath);
        sessionId = created.id;
        setActiveSessionId(sessionId);
        activeIdRef.current = sessionId;
        await refreshSessions(projectPath);
      }
      runFinalized.current = false;
      setChatMessages((previous) => [
        ...previous,
        { role: 'user', content: text },
        { role: 'assistant', content: '', steps: [] },
      ]);
      setChatBusy(true);
      try {
        const result = await window.doru.sendChat(projectPath, sessionId, text);
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
      // The title may have been generated by the first exchange.
      void refreshSessions(projectPath);
      void refreshTree();
    },
    [projectPath, chatBusy, activeSessionId, refreshSessions, refreshTree],
  );

  const cancelChat = useCallback((): string => {
    if (projectPath && activeSessionId) {
      window.doru.cancelChat(projectPath, activeSessionId);
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
    return lastUser?.content ?? '';
  }, [projectPath, activeSessionId, chatMessages]);

  return {
    sessions,
    activeSessionId,
    chatMessages,
    chatBusy,
    sendChatMessage,
    cancelChat,
    switchSession,
    newSession,
    deleteSession,
  };
}
