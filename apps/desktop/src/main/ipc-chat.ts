import { ipcMain } from 'electron';
import type { ChatMessage } from '@doru/ai';
import { cancelChat, sendChat } from './chat';

export function registerChatIpc(): void {
  ipcMain.handle(
    'chat:send',
    (_event, options: { projectPath: string; messages: ChatMessage[] }) => sendChat(options),
  );

  ipcMain.on('chat:cancel', (_event, projectPath: string) => {
    cancelChat(projectPath);
  });
}
