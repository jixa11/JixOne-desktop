// Catalog pages (search, artist, album, playlist, explore, up next, lyrics)
// read from YouTube Music through youtubei.js and flattened into plain
// objects the renderer can show directly.
import { Innertube } from 'youtubei.js';
import { cached } from './yt-server';

export interface Track {
  id: string;
  title: string;
  artists: { name: string; id?: string }[];
  album?: { name: string; id?: string };
  duration?: number;
  thumb?: string;
  plays?: string;
}

export interface Card {
  kind: 'album' | 'playlist' | 'artist' | 'song' | 'video';
  id: string;
  title: string;
  subtitle?: string;
  thumb?: string;
}

export interface Shelf {
  title: string;
  tracks?: Track[];
  cards?: Card[];
}

let ytPromise: Promise<Innertube> | null = null;
function yt(): Promise<Innertube> {
  if (!ytPromise) ytPromise = Innertube.create({ retrieve_player: false }).catch((e) => { ytPromise = null; throw e; });
  return ytPromise;
}

const big = (thumbs: any): string | undefined => {
  const list = Array.isArray(thumbs) ? thumbs : thumbs?.contents;
  const url: string | undefined = list?.at?.(-1)?.url ?? list?.[list?.length - 1]?.url;
  const full = url?.startsWith('//') ? `https:${url}` : url;
  // Ask Google's image servers for a size fit for large tiles.
  return full?.replace(/=w\d+-h\d+/, '=w544-h544').replace(/=s\d+/, '=s544');
};

/** The plain, unlinked numeric column of an artist song row ("1.2M plays"). */
function playsOf(node: any): string | undefined {
  const cols: any[] = node.flex_columns ?? [];
  for (const col of cols.slice(2)) {
    const runs = col?.title?.runs ?? [];
    const run = runs[0];
    const text: string | undefined = run?.text ?? col?.title?.text;
    if (text && !run?.endpoint && /\d/.test(text) && !/^\d+:\d{2}/.test(text)) return text;
  }
  return node.views;
}

function toTrack(node: any, withPlays = false): Track | null {
  const id = node?.id ?? node?.video_id;
  if (!id || (node.item_type && !['song', 'video', 'non_music_track', undefined].includes(node.item_type))) return null;
  const title = typeof node.title === 'string' ? node.title : node.title?.text;
  if (!title) return null;
  const artists = (node.artists ?? node.authors ?? (node.author ? [node.author] : []))
    .map((a: any) => ({ name: a.name, id: a.channel_id }))
    .filter((a: any) => a.name);
  return {
    id,
    title,
    artists,
    album: node.album?.name ? { name: node.album.name, id: node.album.id } : undefined,
    duration: node.duration?.seconds,
    thumb: big(node.thumbnail ?? node.thumbnails),
    plays: withPlays ? playsOf(node) : undefined,
  };
}

function toCard(node: any): Card | null {
  const id = node?.id;
  if (!id) return null;
  const kind = (node.item_type === 'library_artist' ? 'artist' : node.item_type) as Card['kind'];
  if (!['album', 'playlist', 'artist', 'song', 'video'].includes(kind)) return null;
  const title = typeof node.title === 'string' ? node.title : node.title?.text ?? node.name;
  if (!title) return null;
  return {
    kind,
    id,
    title,
    subtitle: node.subtitle?.text ?? node.artists?.map((a: any) => a.name).join(', '),
    thumb: big(node.thumbnail ?? node.thumbnails),
  };
}

function shelvesOf(sections: any[] | undefined, withPlays = false): Shelf[] {
  const out: Shelf[] = [];
  for (const sec of sections ?? []) {
    const title = sec.header?.title?.text ?? sec.title?.text ?? '';
    const items: any[] = sec.contents ?? [];
    if (sec.type === 'MusicShelf' || items[0]?.type === 'MusicResponsiveListItem') {
      const tracks = items.map((n) => toTrack(n, withPlays)).filter(Boolean) as Track[];
      if (tracks.length) out.push({ title, tracks });
    } else if (items.length) {
      const cards = items.map(toCard).filter(Boolean) as Card[];
      if (cards.length) out.push({ title, cards });
    }
  }
  return out;
}

export async function search(query: string) {
  const music = (await yt()).music;
  const [songs, artists, albums, playlists] = await Promise.all(
    (['song', 'artist', 'album', 'playlist'] as const).map((type) =>
      music.search(query, { type }).catch(() => null),
    ),
  );
  const items = (r: any): any[] => r?.contents?.flatMap((c: any) => c.contents ?? []) ?? [];
  return {
    songs: items(songs).map((n) => toTrack(n)).filter(Boolean) as Track[],
    artists: items(artists).map(toCard).filter(Boolean) as Card[],
    albums: items(albums).map(toCard).filter(Boolean) as Card[],
    playlists: items(playlists).map(toCard).filter(Boolean) as Card[],
  };
}

export async function suggestions(input: string): Promise<string[]> {
  const sections: any[] = await (await yt()).music.getSearchSuggestions(input).catch(() => []);
  return sections.flatMap((s: any) => s.contents ?? [])
    .map((c: any) => c.suggestion?.text ?? c.title?.text)
    .filter(Boolean)
    .slice(0, 8);
}

export function artist(id: string) {
  return cached(`artist:${id}`, 30 * 60_000, async () => {
    const page: any = await (await yt()).music.getArtist(id);
    return {
      id,
      name: page.header?.title?.text ?? '',
      thumb: big(page.header?.thumbnail) ?? big(page.header?.foreground_thumbnail),
      subscribers: page.header?.subscription_button?.subscriber_count?.text ?? page.header?.monthly_listener_count,
      shelves: shelvesOf(page.sections, true),
    };
  });
}

export function album(id: string) {
  return cached(`album:${id}`, 60 * 60_000, async () => {
    const page: any = await (await yt()).music.getAlbum(id);
    const header = page.header;
    const artists = header?.strapline_text_one?.runs?.filter((r: any) => r.endpoint).map((r: any) => ({ name: r.text, id: r.endpoint?.payload?.browseId }));
    const thumb = big(header?.thumbnail);
    const tracks = (page.contents ?? []).map((n: any) => toTrack(n)).filter(Boolean)
      .map((t: Track) => ({ ...t, thumb: t.thumb ?? thumb, artists: t.artists.length ? t.artists : artists ?? [] }));
    return {
      id,
      title: header?.title?.text ?? '',
      subtitle: header?.subtitle?.text,
      thumb,
      tracks,
    };
  });
}

export function playlist(id: string) {
  return cached(`playlist:${id}`, 30 * 60_000, async () => {
    const page: any = await (await yt()).music.getPlaylist(id);
    const header = page.header;
    return {
      id,
      title: header?.title?.text ?? '',
      subtitle: header?.subtitle?.text ?? header?.second_subtitle?.text,
      thumb: big(header?.thumbnail),
      tracks: (page.contents ?? page.items ?? []).map((n: any) => toTrack(n)).filter(Boolean),
    };
  });
}

/** Explore: trending and new music from YouTube Music, plus the home feed. */
export function explore() {
  return cached('explore', 20 * 60_000, async () => {
    const music = (await yt()).music;
    const [ex, home] = await Promise.all([
      music.getExplore().catch(() => null),
      music.getHomeFeed().catch(() => null),
    ]);
    const moods = ((ex as any)?.top_buttons ?? [])
      .map((b: any) => ({ title: b.button_text ?? b.title?.text, params: b.endpoint?.payload?.params, browseId: b.endpoint?.payload?.browseId }))
      .filter((m: any) => m.title);
    return {
      shelves: [...shelvesOf((ex as any)?.sections), ...shelvesOf((home as any)?.sections)],
      moods,
    };
  });
}

/** A radio-style queue continuing from a track. */
export async function upNext(videoId: string): Promise<Track[]> {
  const panel: any = await (await yt()).music.getUpNext(videoId, true).catch(() => null);
  return (panel?.contents ?? [])
    .map((n: any) => toTrack({ ...n, id: n.video_id, title: n.title?.text, artists: n.artists, duration: n.duration, thumbnail: n.thumbnail }))
    .filter(Boolean) as Track[];
}

export interface LyricLine { time: number; text: string }

/** Time-synced lyrics from lrclib, falling back to plain text. */
export async function lyrics(title: string, artistName: string, duration?: number): Promise<{ synced: LyricLine[]; plain?: string } | null> {
  const q = new URLSearchParams({ track_name: title, artist_name: artistName });
  if (duration) q.set('duration', String(Math.round(duration)));
  const r = await fetch(`https://lrclib.net/api/get?${q}`, {
    headers: { 'user-agent': 'JixOne Desktop (https://github.com/jixa11/jixone-desktop)' },
    signal: AbortSignal.timeout(10000),
  }).catch(() => null);
  if (!r?.ok) return null;
  const j: any = await r.json();
  const synced: LyricLine[] = String(j.syncedLyrics ?? '')
    .split('\n')
    .map((line) => {
      const m = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\]\s?(.*)$/);
      return m ? { time: Number(m[1]) * 60 + Number(m[2]), text: m[3] } : null;
    })
    .filter(Boolean) as LyricLine[];
  return { synced, plain: j.plainLyrics ?? undefined };
}
