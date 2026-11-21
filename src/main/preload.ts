import { contextBridge, ipcRenderer } from 'electron';

const call = (name: string) => (...args: unknown[]) => ipcRenderer.invoke(name, ...args);

contextBridge.exposeInMainWorld('jix', {
  search: call('search'),
  suggestions: call('suggestions'),
  artist: call('artist'),
  album: call('album'),
  playlist: call('playlist'),
  explore: call('explore'),
  upNext: call('upNext'),
  lyrics: call('lyrics'),
  authStatus: call('authStatus'),
  login: call('login'),
  logout: call('logout'),
  openExternal: call('openExternal'),
  platform: process.platform,
});
