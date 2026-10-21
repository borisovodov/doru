import { ipcMain } from 'electron';
import type { ChatMessage } from '@doru/ai';
import { cancelChat, resolvePermission, sendChat } from './chat';

export function registerChatIpc(): void {
  ipcMain.handle(
    'chat:send',
    (_event, options: { projectPath: string; messages: ChatMessage[] }) => sendChat(options),
  );

  ipcMain.on('chat:permission-response', (_event, options: { id: string; allow: boolean }) => {
    resolvePermission(options.id, options.allow);
  });

  ipcMain.on('chat:cancel', (_event, projectPath: string) => {
    cancelChat(projectPath);
  });
}
