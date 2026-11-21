// Library and player state kept on this computer (localStorage), plus the
// audio engine. A tiny subscribe/notify store: components re-render through
// the useStore hook.
import { useSyncExternalStore } from 'react';
import type { Lang } from './i18n';

export interface Track {
  id: string;
  title: string;
  artists: { name: string; id?: string }[];
  album?: { name: string; id?: string };
  duration?: number;
  thumb?: string;
  plays?: string;
}
export interface Card { kind: string; id: string; title: string; subtitle?: string; thumb?: string }
export interface Playlist { id: string; name: string; tracks: Track[] }
export type Repeat = 'off' | 'all' | 'one';

interface State {
  lang: Lang;
  accent: string;
  liked: Track[];
  playlists: Playlist[];
  history: Track[];
  artists: Card[];
  queue: Track[];
  index: number;
  playing: boolean;
  shuffle: boolean;
  repeat: Repeat;
  position: number;
  duration: number;
  volume: number;
  toast: string | null;
}

const saved = (key: string, fallback: any) => {
  try {
    const v = localStorage.getItem(`jix.${key}`);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};

let state: State = {
  lang: saved('lang', 'fa'),
  accent: saved('accent', 'sunset'),
  liked: saved('liked', []),
  playlists: saved('playlists', []),
  history: saved('history', []),
  artists: saved('artists', []),
  queue: saved('queue', []),
  index: saved('index', 0),
  playing: false,
  shuffle: saved('shuffle', false),
  repeat: saved('repeat', 'off'),
  position: 0,
  duration: 0,
  volume: saved('volume', 0.9),
  toast: null,
};

const PERSIST: (keyof State)[] = ['lang', 'accent', 'liked', 'playlists', 'history', 'artists', 'queue', 'index', 'shuffle', 'repeat', 'volume'];
const listeners = new Set<() => void>();

export function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  for (const k of Object.keys(patch) as (keyof State)[]) {
    if (PERSIST.includes(k)) {
      try { localStorage.setItem(`jix.${k}`, JSON.stringify(state[k])); } catch { /* storage full or blocked */ }
    }
  }
  listeners.forEach((l) => l());
}

export const get = () => state;

export function useStore<T>(pick: (s: State) => T): T {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => pick(state));
}

let toastTimer: any;
export function toast(text: string) {
  set({ toast: text });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => set({ toast: null }), 2600);
}

// ---------- library ----------
export const isLiked = (id: string) => state.liked.some((t) => t.id === id);
export function toggleLike(t: Track) {
  set({ liked: isLiked(t.id) ? state.liked.filter((x) => x.id !== t.id) : [t, ...state.liked] });
}
export const isFollowing = (id: string) => state.artists.some((a) => a.id === id);
export function toggleFollow(a: Card) {
  set({ artists: isFollowing(a.id) ? state.artists.filter((x) => x.id !== a.id) : [...state.artists, a] });
}
export function createPlaylist(name: string, first?: Track): Playlist {
  const p: Playlist = { id: `pl${Date.now()}`, name, tracks: first ? [first] : [] };
  set({ playlists: [...state.playlists, p] });
  return p;
}
export function addToPlaylist(pid: string, t: Track) {
  set({ playlists: state.playlists.map((p) => (p.id === pid && !p.tracks.some((x) => x.id === t.id) ? { ...p, tracks: [...p.tracks, t] } : p)) });
}
export function removeFromPlaylist(pid: string, id: string) {
  set({ playlists: state.playlists.map((p) => (p.id === pid ? { ...p, tracks: p.tracks.filter((x) => x.id !== id) } : p)) });
}
export function deletePlaylist(pid: string) {
  set({ playlists: state.playlists.filter((p) => p.id !== pid) });
}

// ---------- player ----------
export const audio = new Audio();
audio.preload = 'auto';
audio.volume = state.volume;
let retried = '';

export const current = () => state.queue[state.index] as Track | undefined;

function load(play: boolean) {
  const t = current();
  if (!t) return;
  retried = '';
  audio.src = `jix://stream/${t.id}`;
  set({ position: 0, duration: t.duration ?? 0 });
  if (play) audio.play().catch(() => {});
  set({ history: [t, ...state.history.filter((x) => x.id !== t.id)].slice(0, 100) });
  mediaSession(t);
}

export function playList(tracks: Track[], start = 0, shuffled = false) {
  if (!tracks.length) return;
  let list = tracks.slice();
  if (shuffled) {
    list = list.sort(() => Math.random() - 0.5);
    start = 0;
  }
  set({ queue: list, index: start, shuffle: shuffled || state.shuffle });
  load(true);
}

export async function playRadio(t: Track) {
  playList([t]);
  const more: Track[] = await window.jix.upNext(t.id).catch(() => []);
  const rest = more.filter((x) => x.id !== t.id);
  if (current()?.id === t.id) set({ queue: [t, ...rest] });
}

export function playNext(t: Track) {
  const q = state.queue.slice();
  q.splice(state.index + 1, 0, t);
  set({ queue: q });
  if (q.length === 1) load(true);
}
export function addToQueue(t: Track) {
  set({ queue: [...state.queue, t] });
  if (state.queue.length === 1) load(true);
}
export function jump(i: number) {
  set({ index: i });
  load(true);
}
export function toggle() {
  if (!current()) return;
  if (!audio.src) load(true);
  else if (audio.paused) audio.play().catch(() => {});
  else audio.pause();
}
export function next(auto = false) {
  if (!state.queue.length) return;
  if (auto && state.repeat === 'one') {
    audio.currentTime = 0;
    audio.play().catch(() => {});
    return;
  }
  let i = state.shuffle ? Math.floor(Math.random() * state.queue.length) : state.index + 1;
  if (i >= state.queue.length) {
    if (state.repeat === 'all' || !auto) i = 0;
    else {
      set({ playing: false });
      return;
    }
  }
  set({ index: i });
  load(true);
}
export function prev() {
  if (audio.currentTime > 4) {
    audio.currentTime = 0;
    return;
  }
  set({ index: Math.max(0, state.index - 1) });
  load(true);
}
export const seek = (sec: number) => { audio.currentTime = sec; };
export function setVolume(v: number) {
  audio.volume = v;
  set({ volume: v });
}
export const toggleShuffle = () => set({ shuffle: !state.shuffle });
export const cycleRepeat = () => set({ repeat: state.repeat === 'off' ? 'all' : state.repeat === 'all' ? 'one' : 'off' });

audio.addEventListener('play', () => set({ playing: true }));
audio.addEventListener('pause', () => set({ playing: false }));
audio.addEventListener('timeupdate', () => set({ position: audio.currentTime }));
audio.addEventListener('durationchange', () => { if (isFinite(audio.duration)) set({ duration: audio.duration }); });
audio.addEventListener('ended', () => next(true));
audio.addEventListener('error', () => {
  const t = current();
  if (!t) return;
  // One retry with a freshly extracted URL, then move on.
  if (retried !== t.id) {
    retried = t.id;
    audio.src = `jix://stream/${t.id}?fresh=1`;
    audio.play().catch(() => {});
    return;
  }
  toast(dictToast());
  next(true);
});

let dictToast = () => 'Playback failed';
export const setFailToast = (fn: () => string) => { dictToast = fn; };

function mediaSession(t: Track) {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: t.title,
    artist: t.artists.map((a) => a.name).join(', '),
    album: t.album?.name ?? '',
    artwork: t.thumb ? [{ src: t.thumb, sizes: '512x512' }] : [],
  });
}
if ('mediaSession' in navigator) {
  navigator.mediaSession.setActionHandler('play', () => audio.play());
  navigator.mediaSession.setActionHandler('pause', () => audio.pause());
  navigator.mediaSession.setActionHandler('nexttrack', () => next());
  navigator.mediaSession.setActionHandler('previoustrack', () => prev());
}

// Restore the last queue, paused, so the player bar is not empty on launch.
if (current()) {
  audio.src = `jix://stream/${current()!.id}`;
  audio.preload = 'none';
  mediaSession(current()!);
}

declare global {
  interface Window {
    jix: {
      search(q: string): Promise<{ songs: Track[]; artists: Card[]; albums: Card[]; playlists: Card[] }>;
      suggestions(q: string): Promise<string[]>;
      artist(id: string): Promise<any>;
      album(id: string): Promise<any>;
      playlist(id: string): Promise<any>;
      explore(): Promise<any>;
      upNext(id: string): Promise<Track[]>;
      lyrics(title: string, artist: string, duration?: number): Promise<{ synced: { time: number; text: string }[]; plain?: string } | null>;
      authStatus(): Promise<{ signedIn: boolean; name?: string }>;
      login(): Promise<{ ok: boolean; name?: string; code?: string }>;
      logout(): Promise<unknown>;
      openExternal(url: string): Promise<void>;
      platform: string;
    };
  }
}
