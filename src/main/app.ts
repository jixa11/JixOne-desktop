import { app, BrowserWindow, ipcMain, protocol, shell, session } from 'electron';
import path from 'node:path';
import * as catalog from './catalog';
import { handleStream } from './stream';
import { setYtmCookie, clearYtmCookie, ytmBundle, probeAccountName } from './ytm-auth';

protocol.registerSchemesAsPrivileged([
  { scheme: 'jix', privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true } },
]);

let win: BrowserWindow | null = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 360,
    minHeight: 560,
    backgroundColor: '#0b0912',
    title: 'JixOne',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
    },
  });
  win.loadFile(path.join(__dirname, 'index.html'));
  // Links open in the browser, never inside the app window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

/** Account sign-in: a Google login window; its YouTube Music cookies become the session. */
async function login(): Promise<{ ok: boolean; name?: string; code?: string }> {
  const part = session.fromPartition('persist:yt-login');
  const loginWin = new BrowserWindow({
    width: 480,
    height: 720,
    parent: win ?? undefined,
    modal: true,
    title: 'Sign in',
    autoHideMenuBar: true,
    webPreferences: { partition: 'persist:yt-login', sandbox: true },
  });
  return new Promise((resolve) => {
    let done = false;
    const finish = (r: { ok: boolean; name?: string; code?: string }) => {
      if (done) return;
      done = true;
      resolve(r);
      if (!loginWin.isDestroyed()) loginWin.close();
    };
    loginWin.on('closed', () => finish({ ok: false, code: 'CANCELLED' }));
    loginWin.webContents.on('did-navigate', async (_e, url) => {
      if (!url.startsWith('https://music.youtube.com')) return;
      const cookies = await part.cookies.get({ url: 'https://music.youtube.com' });
      if (!cookies.some((c) => c.name === 'SAPISID')) return;
      const cookie = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
      const cfg = await loginWin.webContents
        .executeJavaScript('({v: window.ytcfg?.get?.("VISITOR_DATA"), d: window.ytcfg?.get?.("DATASYNC_ID")})')
        .catch(() => ({}));
      const result = await setYtmCookie(JSON.stringify({
        cookie,
        visitorData: cfg?.v || undefined,
        dataSyncId: (cfg?.d || '').split('||')[0] || undefined,
      }));
      finish(result);
    });
    loginWin.loadURL('https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Fmusic.youtube.com%2F');
  });
}

const handlers: Record<string, (...args: any[]) => Promise<unknown>> = {
  search: (q: string) => catalog.search(q),
  suggestions: (q: string) => catalog.suggestions(q),
  artist: (id: string) => catalog.artist(id),
  album: (id: string) => catalog.album(id),
  playlist: (id: string) => catalog.playlist(id),
  explore: () => catalog.explore(),
  upNext: (id: string) => catalog.upNext(id),
  lyrics: (title: string, artist: string, duration?: number) => catalog.lyrics(title, artist, duration),
  authStatus: async () => {
    const bundle = await ytmBundle();
    if (!bundle?.cookie) return { signedIn: false };
    return { signedIn: true, name: (await probeAccountName(bundle.cookie)) ?? undefined };
  },
  login: () => login(),
  logout: async () => {
    await clearYtmCookie();
    await session.fromPartition('persist:yt-login').clearStorageData();
    return { ok: true };
  },
  openExternal: async (url: string) => {
    if (/^https:\/\//.test(url)) await shell.openExternal(url);
  },
};

app.whenReady().then(() => {
  protocol.handle('jix', (request) => handleStream(request));
  for (const [name, fn] of Object.entries(handlers)) {
    ipcMain.handle(name, (_e, ...args) => fn(...args));
  }
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
