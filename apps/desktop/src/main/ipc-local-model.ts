// IPC for the Dóru AI offline model: install state, download (with resume),
// cancel and delete. The manager broadcasts progress on
// `settings:ai:doruModel:changed`; the replies carry the authoritative state.
import { ipcMain } from 'electron';
import { cancelDoruModelDownload, deleteDoruModel, doruModelState, downloadDoruModel } from './local-model';

export function registerLocalModelIpc(): void {
  ipcMain.handle('settings:ai:doruModel:get', () => doruModelState());
  ipcMain.handle('settings:ai:doruModel:download', () => downloadDoruModel());
  ipcMain.handle('settings:ai:doruModel:cancel', () => {
    cancelDoruModelDownload();
    return doruModelState();
  });
  ipcMain.handle('settings:ai:doruModel:delete', () => deleteDoruModel());
}
