import { ipcMain } from 'electron';
import { cancelChat, sendChat } from './chat';
import { chatSessions } from './chat-sessions';

export function registerChatIpc(): void {
  ipcMain.handle(
    'chat:send',
    (_event, options: { projectPath: string; sessionId: string; text: string }) => sendChat(options),
  );

  ipcMain.on('chat:cancel', (_event, options: { projectPath: string; sessionId: string }) => {
    cancelChat(options.projectPath, options.sessionId);
  });

  ipcMain.handle('chat:sessions:list', (_event, projectKey: string) => chatSessions().list(projectKey));

  ipcMain.handle('chat:sessions:create', (_event, projectKey: string) => chatSessions().create(projectKey));

  ipcMain.handle('chat:sessions:delete', (_event, options: { projectKey: string; id: string }) =>
    chatSessions().remove(options.projectKey, options.id),
  );

  ipcMain.handle('chat:sessions:transcript', (_event, options: { projectKey: string; id: string }) =>
    chatSessions().transcript(options.projectKey, options.id),
  );
}
