import { createRoot } from 'react-dom/client';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ICONS } from './icons';
import { dict, type Strings } from './i18n';
import * as S from './store';
import type { Card, Track } from './store';

// ---------- small helpers ----------
const ACCENTS: Record<string, [string, string]> = {
  sunset: ['#ff7a45', '#ff2d87'],
  aurora: ['#7c5cff', '#22d3ee'],
  lime: ['#a3e635', '#14b8a6'],
  ocean: ['#3b82f6', '#06b6d4'],
  rose: ['#f43f5e', '#f59e0b'],
  mono: ['#e5e5e5', '#8b8b96'],
};

function useT(): Strings {
  return dict[S.useStore((s) => s.lang)];
}

function Icon({ name, size = 22 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill="currentColor" aria-hidden>
      {(ICONS[name] ?? []).map(([d, duo], i) => <path key={i} d={d} opacity={duo ? 0.25 : 1} />)}
    </svg>
  );
}

const fmt = (sec?: number) => {
  if (!sec || !isFinite(sec)) return '0:00';
  const s = Math.floor(sec % 60);
  return `${Math.floor(sec / 60)}:${s < 10 ? '0' : ''}${s}`;
};
const names = (t: Track) => t.artists.map((a) => a.name).join(', ');

function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data?: T; error?: boolean; loading: boolean }>({ loading: true });
  useEffect(() => {
    let alive = true;
    setState({ loading: true });
    fn().then((data) => alive && setState({ data, loading: false })).catch(() => alive && setState({ error: true, loading: false }));
    return () => { alive = false; };
  }, deps);
  return state;
}

// ---------- routing ----------
type Route =
  | { name: 'home' } | { name: 'search'; q?: string } | { name: 'library' } | { name: 'settings' }
  | { name: 'artist'; id: string } | { name: 'album'; id: string } | { name: 'playlist'; id: string }
  | { name: 'local'; id: string };

let navigate: (r: Route) => void = () => {};
let goBack: () => void = () => {};

function openCard(c: Card) {
  if (c.kind === 'local') navigate({ name: 'local', id: c.id });
  else if (c.kind === 'artist') navigate({ name: 'artist', id: c.id });
  else if (c.kind === 'album') navigate({ name: 'album', id: c.id });
  else if (c.kind === 'playlist') navigate({ name: 'playlist', id: c.id });
  else S.playRadio({ id: c.id, title: c.title, artists: c.subtitle ? [{ name: c.subtitle }] : [], thumb: c.thumb });
}

// ---------- context menu ----------
let openMenu: (t: Track, x: number, y: number, playlistId?: string) => void = () => {};

function TrackMenu() {
  const t = useT();
  const [menu, setMenu] = useState<{ track: Track; x: number; y: number; pid?: string } | null>(null);
  const playlists = S.useStore((s) => s.playlists);
  S.useStore((s) => s.liked);
  openMenu = (track, x, y, pid) => setMenu({ track, x, y, pid });
  useEffect(() => {
    const close = () => setMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('resize', close);
    return () => { window.removeEventListener('click', close); window.removeEventListener('resize', close); };
  }, []);
  if (!menu) return null;
  const tr = menu.track;
  const x = Math.min(menu.x, window.innerWidth - 240);
  const y = Math.min(menu.y, window.innerHeight - 380);
  const artist = tr.artists.find((a) => a.id);
  return (
    <div className="menu" style={{ left: x, top: y }} onClick={(e) => e.stopPropagation()}>
      <button onClick={() => { S.playNext(tr); S.toast(t.added); setMenu(null); }}><Icon name="next" size={18} />{t.playNext}</button>
      <button onClick={() => { S.addToQueue(tr); S.toast(t.added); setMenu(null); }}><Icon name="queue" size={18} />{t.addToQueue}</button>
      <button onClick={() => { S.toggleLike(tr); setMenu(null); }}><Icon name={S.isLiked(tr.id) ? 'heartFill' : 'heart'} size={18} />{S.isLiked(tr.id) ? t.unlike : t.like}</button>
      <button onClick={() => { S.playRadio(tr); setMenu(null); }}><Icon name="radio" size={18} />Radio</button>
      <div className="menu-sep">{t.addToPlaylist}</div>
      {playlists.map((p) => (
        <button key={p.id} onClick={() => { S.addToPlaylist(p.id, tr); S.toast(t.added); setMenu(null); }}><Icon name="list" size={18} />{p.name}</button>
      ))}
      <button onClick={() => { const n = prompt(t.playlistName); if (n) { S.createPlaylist(n, tr); S.toast(t.added); } setMenu(null); }}><Icon name="plus" size={18} />{t.newPlaylist}</button>
      {(artist || tr.album?.id || menu.pid) && <div className="menu-sep" />}
      {artist && <button onClick={() => { navigate({ name: 'artist', id: artist.id! }); setMenu(null); }}><Icon name="user" size={18} />{t.goToArtist}</button>}
      {tr.album?.id && <button onClick={() => { navigate({ name: 'album', id: tr.album!.id! }); setMenu(null); }}><Icon name="music" size={18} />{t.goToAlbum}</button>}
      {menu.pid && <button className="danger" onClick={() => { S.removeFromPlaylist(menu.pid!, tr.id); setMenu(null); }}><Icon name="trash" size={18} />{t.remove}</button>}
    </div>
  );
}

// ---------- building blocks ----------
function TrackRow({ track, list, index, showPlays, pid }: { track: Track; list: Track[]; index: number; showPlays?: boolean; pid?: string }) {
  const current = S.useStore((s) => s.queue[s.index]?.id);
  const playing = S.useStore((s) => s.playing);
  const liked = S.useStore((s) => s.liked.some((x) => x.id === track.id));
  const active = current === track.id;
  return (
    <div
      className={`row ${active ? 'active' : ''}`}
      onDoubleClick={() => S.playList(list, index)}
      onContextMenu={(e) => { e.preventDefault(); openMenu(track, e.clientX, e.clientY, pid); }}
    >
      <button className="row-art" onClick={() => (active ? S.toggle() : S.playList(list, index))}>
        {track.thumb ? <img src={track.thumb} alt="" loading="lazy" /> : <span className="ph"><Icon name="music" /></span>}
        <span className="row-play"><Icon name={active && playing ? 'pause' : 'play'} size={18} /></span>
      </button>
      <div className="row-text">
        <div className="row-title">{track.title}</div>
        <div className="row-sub">
          {track.artists.map((a, i) => (
            <span key={i}>{i > 0 && ', '}{a.id ? <a onClick={() => navigate({ name: 'artist', id: a.id! })}>{a.name}</a> : a.name}</span>
          ))}
        </div>
      </div>
      {showPlays && track.plays && <span className="row-plays">{track.plays}</span>}
      <span className="row-dur">{track.duration ? fmt(track.duration) : ''}</span>
      <button className={`icon-btn ${liked ? 'on' : ''}`} onClick={() => S.toggleLike(track)} aria-label="like"><Icon name={liked ? 'heartFill' : 'heart'} size={18} /></button>
      <button className="icon-btn" onClick={(e) => { e.stopPropagation(); openMenu(track, e.clientX, e.clientY, pid); }} aria-label="more"><Icon name="more" size={18} /></button>
    </div>
  );
}

function TrackList({ tracks, showPlays, pid }: { tracks: Track[]; showPlays?: boolean; pid?: string }) {
  return <div className="rows">{tracks.map((tr, i) => <TrackRow key={`${tr.id}${i}`} track={tr} list={tracks} index={i} showPlays={showPlays} pid={pid} />)}</div>;
}

function CardTile({ card }: { card: Card }) {
  return (
    <button className={`tile ${card.kind === 'artist' ? 'round' : ''}`} onClick={() => openCard(card)}>
      <div className="tile-art">{card.thumb ? <img src={card.thumb} alt="" loading="lazy" /> : <Icon name="music" size={40} />}</div>
      <div className="tile-title">{card.title}</div>
      {card.subtitle && <div className="tile-sub">{card.subtitle}</div>}
    </button>
  );
}

function Shelf({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="shelf">
      <h2>{title}</h2>
      <div className="shelf-row">{children}</div>
    </section>
  );
}

function Status({ loading, error }: { loading?: boolean; error?: boolean }) {
  const t = useT();
  if (loading) return <div className="status"><span className="spinner" />{t.loading}</div>;
  if (error) return <div className="status">{t.error}</div>;
  return null;
}

function Hero({ kicker, title, subtitle, thumb, round, actions }: { kicker?: string; title: string; subtitle?: string; thumb?: string; round?: boolean; actions?: ReactNode }) {
  return (
    <header className="hero">
      {thumb && <div className="hero-bg" style={{ backgroundImage: `url(${thumb})` }} />}
      <div className={`hero-art ${round ? 'round' : ''}`}>{thumb ? <img src={thumb} alt="" /> : <Icon name="music" size={64} />}</div>
      <div className="hero-text">
        {kicker && <div className="kicker">{kicker}</div>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
        <div className="hero-actions">{actions}</div>
      </div>
    </header>
  );
}

function PlayButtons({ tracks }: { tracks: Track[] }) {
  const t = useT();
  return (
    <>
      <button className="btn primary" disabled={!tracks.length} onClick={() => S.playList(tracks)}><Icon name="play" size={18} />{t.play}</button>
      <button className="btn" disabled={!tracks.length} onClick={() => S.playList(tracks, 0, true)}><Icon name="shuffle" size={18} />{t.shuffle}</button>
    </>
  );
}

// ---------- pages ----------
function Home() {
  const t = useT();
  const artists = S.useStore((s) => s.artists);
  const ex = useAsync(() => window.jix.explore(), []);
  const mix = useAsync(async () => {
    const pages = await Promise.all(artists.slice(-6).map((a) => window.jix.artist(a.id).catch(() => null)));
    return pages.filter(Boolean).map((p: any) => ({ artist: p.name as string, tracks: (p.shelves.find((s: any) => s.tracks)?.tracks ?? []) as Track[] }));
  }, [artists.map((a) => a.id).join()]);
  const hour = new Date().getHours();
  const greet = hour < 12 ? t.goodMorning : hour < 18 ? t.goodAfternoon : t.goodEvening;
  const mixTracks = useMemo(() => (mix.data ?? []).flatMap((m) => m.tracks.slice(0, 6)), [mix.data]);
  return (
    <div className="page">
      <div className="greet">{greet}</div>
      <div className="mix-card">
        <div className="mix-glow" />
        <div className="mix-text">
          <div className="kicker">{t.yourMix}</div>
          <h1>{artists.length ? artists.slice(-3).map((a) => a.title).join(' · ') : t.pickArtists}</h1>
          <p>{artists.length ? `${mixTracks.length} ${t.tracks}` : t.pickArtistsHint}</p>
        </div>
        {artists.length ? (
          <button className="btn big light" disabled={!mixTracks.length} onClick={() => S.playList(mixTracks, 0, true)}><Icon name="play" />{t.playMix}</button>
        ) : (
          <button className="btn big light" onClick={() => navigate({ name: 'search' })}><Icon name="search" />{t.search}</button>
        )}
      </div>
      {artists.length > 0 && (
        <Shelf title={t.yourArtists}>{artists.map((a) => <CardTile key={a.id} card={a} />)}</Shelf>
      )}
      {(mix.data ?? []).filter((m) => m.tracks.length).map((m) => (
        <section key={m.artist} className="shelf">
          <h2>{m.artist}</h2>
          <TrackList tracks={m.tracks.slice(0, 5)} showPlays />
        </section>
      ))}
      <Status loading={ex.loading} error={ex.error} />
      {(ex.data?.shelves ?? []).map((sh: any, i: number) =>
        sh.cards ? (
          <Shelf key={i} title={sh.title}>{sh.cards.map((c: Card) => <CardTile key={c.id} card={c} />)}</Shelf>
        ) : (
          <section key={i} className="shelf"><h2>{sh.title}</h2><TrackList tracks={sh.tracks.slice(0, 8)} /></section>
        ),
      )}
      {ex.data?.moods?.length > 0 && (
        <section className="shelf">
          <h2>{t.moods}</h2>
          <div className="chips">{ex.data.moods.map((m: any, i: number) => <button key={i} className="chip" style={{ ['--h' as any]: (i * 47) % 360 }} onClick={() => navigate({ name: 'search', q: m.title })}>{m.title}</button>)}</div>
        </section>
      )}
    </div>
  );
}

function Search({ initial }: { initial?: string }) {
  const t = useT();
  const [q, setQ] = useState(initial ?? '');
  const [query, setQuery] = useState(initial ?? '');
  const [sugg, setSugg] = useState<string[]>([]);
  // Suggestions that arrive after a search was submitted are dropped.
  const latest = useRef('');
  latest.current = q === query ? '' : q;
  const res = useAsync(async () => (query ? window.jix.search(query) : null), [query]);
  useEffect(() => {
    if (!q || q === query) { setSugg([]); return; }
    const h = setTimeout(() => window.jix.suggestions(q).then((list) => { if (latest.current === q) setSugg(list); }).catch(() => {}), 250);
    return () => clearTimeout(h);
  }, [q]);
  const submit = (v: string) => { latest.current = ''; setQ(v); setQuery(v); setSugg([]); };
  const r = res.data;
  return (
    <div className="page">
      <form className="searchbox" onSubmit={(e) => { e.preventDefault(); submit(q); }}>
        <Icon name="search" />
        <input autoFocus value={q} placeholder={t.searchHint} onChange={(e) => setQ(e.target.value)} />
        {q && <button type="button" className="icon-btn" onClick={() => { setQ(''); setQuery(''); }}><Icon name="x" size={18} /></button>}
        {sugg.length > 0 && <div className="suggest">{sugg.map((s) => <button type="button" key={s} onClick={() => submit(s)}><Icon name="search" size={16} />{s}</button>)}</div>}
      </form>
      {query && <Status loading={res.loading} error={res.error} />}
      {r && (
        <>
          {r.artists.length > 0 && <Shelf title={t.artists}>{r.artists.slice(0, 12).map((c) => <CardTile key={c.id} card={c} />)}</Shelf>}
          {r.songs.length > 0 && <section className="shelf"><h2>{t.songs}</h2><TrackList tracks={r.songs} /></section>}
          {r.albums.length > 0 && <Shelf title={t.albums}>{r.albums.map((c) => <CardTile key={c.id} card={c} />)}</Shelf>}
          {r.playlists.length > 0 && <Shelf title={t.playlists}>{r.playlists.map((c) => <CardTile key={c.id} card={c} />)}</Shelf>}
          {!r.songs.length && !r.artists.length && !r.albums.length && <div className="status">{t.empty}</div>}
        </>
      )}
    </div>
  );
}

function Artist({ id }: { id: string }) {
  const t = useT();
  const res = useAsync(() => window.jix.artist(id), [id]);
  const following = S.useStore((s) => s.artists.some((a) => a.id === id));
  const a = res.data;
  const top: Track[] = a?.shelves.find((s: any) => s.tracks)?.tracks ?? [];
  return (
    <div className="page">
      <Status loading={res.loading} error={res.error} />
      {a && (
        <>
          <Hero
            kicker={a.subscribers}
            title={a.name}
            thumb={a.thumb}
            round
            actions={<>
              <PlayButtons tracks={top} />
              <button className={`btn ${following ? 'on' : ''}`} onClick={() => S.toggleFollow({ kind: 'artist', id, title: a.name, thumb: a.thumb })}>
                <Icon name={following ? 'check' : 'plus'} size={18} />{following ? t.following : t.follow}
              </button>
            </>}
          />
          {a.shelves.map((sh: any, i: number) =>
            sh.tracks ? (
              <section key={i} className="shelf"><h2>{sh.title || t.topSongs}</h2><TrackList tracks={sh.tracks} showPlays /></section>
            ) : (
              <Shelf key={i} title={sh.title}>{sh.cards.map((c: Card) => <CardTile key={c.id} card={c} />)}</Shelf>
            ),
          )}
        </>
      )}
    </div>
  );
}

function Collection({ kind, id }: { kind: 'album' | 'playlist'; id: string }) {
  const res = useAsync(() => (kind === 'album' ? window.jix.album(id) : window.jix.playlist(id)), [kind, id]);
  const c = res.data;
  return (
    <div className="page">
      <Status loading={res.loading} error={res.error} />
      {c && (
        <>
          <Hero kicker={kind === 'album' ? 'Album' : 'Playlist'} title={c.title} subtitle={c.subtitle} thumb={c.thumb} actions={<PlayButtons tracks={c.tracks} />} />
          <TrackList tracks={c.tracks} />
        </>
      )}
    </div>
  );
}

function LocalPlaylist({ id }: { id: string }) {
  const t = useT();
  const liked = S.useStore((s) => s.liked);
  const history = S.useStore((s) => s.history);
  const pl = S.useStore((s) => s.playlists.find((p) => p.id === id));
  const tracks = id === 'liked' ? liked : id === 'history' ? history : pl?.tracks ?? [];
  const title = id === 'liked' ? t.liked : id === 'history' ? t.history : pl?.name ?? '';
  return (
    <div className="page">
      <Hero
        kicker={`${tracks.length} ${t.tracks}`}
        title={title}
        thumb={tracks[0]?.thumb}
        actions={<>
          <PlayButtons tracks={tracks} />
          {pl && <button className="btn" onClick={() => { if (confirm(`${t.remove} «${pl.name}»?`)) { S.deletePlaylist(pl.id); goBack(); } }}><Icon name="trash" size={18} />{t.remove}</button>}
        </>}
      />
      {tracks.length ? <TrackList tracks={tracks} pid={pl?.id} /> : <div className="status">{t.empty}</div>}
    </div>
  );
}

function Library() {
  const t = useT();
  const liked = S.useStore((s) => s.liked);
  const history = S.useStore((s) => s.history);
  const playlists = S.useStore((s) => s.playlists);
  const artists = S.useStore((s) => s.artists);
  return (
    <div className="page">
      <h1 className="page-title">{t.library}</h1>
      <div className="lib-tiles">
        <button className="lib-tile grad" onClick={() => navigate({ name: 'local', id: 'liked' })}><Icon name="heartFill" size={30} /><b>{t.liked}</b><span>{liked.length} {t.tracks}</span></button>
        <button className="lib-tile" onClick={() => navigate({ name: 'local', id: 'history' })}><Icon name="queue" size={30} /><b>{t.history}</b><span>{history.length} {t.tracks}</span></button>
        <button className="lib-tile dashed" onClick={() => { const n = prompt(t.playlistName); if (n) navigate({ name: 'local', id: S.createPlaylist(n).id }); }}><Icon name="plus" size={30} /><b>{t.newPlaylist}</b></button>
      </div>
      {playlists.length > 0 && (
        <Shelf title={t.playlists}>
          {playlists.map((p) => <CardTile key={p.id} card={{ kind: 'local', id: p.id, title: p.name, subtitle: `${p.tracks.length} ${t.tracks}`, thumb: p.tracks[0]?.thumb }} />)}
        </Shelf>
      )}
      {artists.length > 0 && <Shelf title={t.yourArtists}>{artists.map((a) => <CardTile key={a.id} card={a} />)}</Shelf>}
    </div>
  );
}

function Settings() {
  const t = useT();
  const lang = S.useStore((s) => s.lang);
  const accent = S.useStore((s) => s.accent);
  const [auth, setAuth] = useState<{ signedIn: boolean; name?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { window.jix.authStatus().then(setAuth).catch(() => setAuth({ signedIn: false })); }, []);
  return (
    <div className="page narrow">
      <h1 className="page-title">{t.settings}</h1>
      <section className="panel">
        <h3><Icon name="user" />{t.account}</h3>
        {auth?.signedIn ? (
          <div className="panel-row"><span>{t.signedInAs} <b>{auth.name || 'YouTube'}</b></span><button className="btn" onClick={async () => { await window.jix.logout(); setAuth({ signedIn: false }); }}>{t.signOut}</button></div>
        ) : (
          <div className="panel-row"><span className="muted">{t.signInHint}</span><button className="btn primary" disabled={busy} onClick={async () => { setBusy(true); const r = await window.jix.login().catch(() => null); setBusy(false); if (r?.ok) setAuth({ signedIn: true, name: r.name }); }}>{t.signIn}</button></div>
        )}
      </section>
      <section className="panel">
        <h3><Icon name="palette" />{t.theme}</h3>
        <div className="swatches">
          {Object.entries(ACCENTS).map(([k, [a, b]]) => (
            <button key={k} className={`swatch ${accent === k ? 'on' : ''}`} style={{ background: `linear-gradient(135deg, ${a}, ${b})` }} onClick={() => S.set({ accent: k })} aria-label={k}>{accent === k && <Icon name="check" size={18} />}</button>
          ))}
        </div>
      </section>
      <section className="panel">
        <h3><Icon name="globe" />{t.language}</h3>
        <div className="seg">
          <button className={lang === 'fa' ? 'on' : ''} onClick={() => S.set({ lang: 'fa' })}>فارسی</button>
          <button className={lang === 'en' ? 'on' : ''} onClick={() => S.set({ lang: 'en' })}>English</button>
        </div>
      </section>
      <section className="panel">
        <h3><Icon name="sparkle" />{t.about}</h3>
        <p className="muted">{t.aboutText}</p>
        <p className="muted">v1.0.0 · <a onClick={() => window.jix.openExternal('https://github.com/jixa11/JixOne')}>Android</a></p>
      </section>
    </div>
  );
}

// ---------- player ----------
function NowPlaying({ onClose }: { onClose: () => void }) {
  const t = useT();
  const track = S.useStore((s) => s.queue[s.index]);
  const queue = S.useStore((s) => s.queue);
  const index = S.useStore((s) => s.index);
  const position = S.useStore((s) => s.position);
  const [tab, setTab] = useState<'lyrics' | 'queue'>('lyrics');
  const ly = useAsync(async () => (track ? window.jix.lyrics(track.title, track.artists[0]?.name ?? '', track.duration) : null), [track?.id]);
  const activeLine = useMemo(() => {
    const lines = ly.data?.synced ?? [];
    let i = -1;
    for (let k = 0; k < lines.length; k++) if (lines[k].time <= position + 0.3) i = k;
    return i;
  }, [ly.data, position]);
  const lineRef = useRef<HTMLDivElement>(null);
  useEffect(() => { lineRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, [activeLine]);
  if (!track) return null;
  return (
    <div className="np">
      <div className="np-bg" style={{ backgroundImage: track.thumb ? `url(${track.thumb})` : undefined }} />
      <button className="icon-btn np-close" onClick={onClose}><Icon name="down" size={26} /></button>
      <div className="np-main">
        <div className="np-art">{track.thumb ? <img src={track.thumb} alt="" /> : <Icon name="music" size={96} />}</div>
        <div className="np-title">{track.title}</div>
        <div className="np-artist">{names(track)}</div>
        <Progress />
        <Controls big />
      </div>
      <div className="np-side">
        <div className="seg">
          <button className={tab === 'lyrics' ? 'on' : ''} onClick={() => setTab('lyrics')}>{t.lyrics}</button>
          <button className={tab === 'queue' ? 'on' : ''} onClick={() => setTab('queue')}>{t.queue}</button>
        </div>
        {tab === 'lyrics' ? (
          <div className="lyrics">
            <Status loading={ly.loading} />
            {!ly.loading && !ly.data?.synced.length && !ly.data?.plain && <div className="status">{t.noLyrics}</div>}
            {ly.data?.synced.length
              ? ly.data.synced.map((l, i) => (
                <div key={i} ref={i === activeLine ? lineRef : undefined} className={`ly ${i === activeLine ? 'on' : i < activeLine ? 'past' : ''}`} onClick={() => S.seek(l.time)}>{l.text || '♪'}</div>
              ))
              : ly.data?.plain && <div className="ly-plain">{ly.data.plain}</div>}
          </div>
        ) : (
          <div className="queue">
            {queue.map((q, i) => (
              <button key={`${q.id}${i}`} className={`q ${i === index ? 'on' : ''}`} onClick={() => S.jump(i)}>
                {q.thumb && <img src={q.thumb} alt="" />}
                <span><b>{q.title}</b><small>{names(q)}</small></span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Progress() {
  const position = S.useStore((s) => s.position);
  const duration = S.useStore((s) => s.duration);
  const pct = duration ? Math.min(100, (position / duration) * 100) : 0;
  return (
    <div className="progress">
      <span>{fmt(position)}</span>
      <input type="range" min={0} max={duration || 0} step={0.5} value={position} style={{ ['--p' as any]: `${pct}%` }} onChange={(e) => S.seek(Number(e.target.value))} />
      <span>{fmt(duration)}</span>
    </div>
  );
}

function Controls({ big }: { big?: boolean }) {
  const playing = S.useStore((s) => s.playing);
  const shuffle = S.useStore((s) => s.shuffle);
  const repeat = S.useStore((s) => s.repeat);
  return (
    <div className={`controls ${big ? 'big' : ''}`}>
      <button className={`icon-btn ${shuffle ? 'on' : ''}`} onClick={S.toggleShuffle} aria-label="shuffle"><Icon name="shuffle" size={big ? 24 : 20} /></button>
      <button className="icon-btn" onClick={S.prev} aria-label="previous"><Icon name="prev" size={big ? 30 : 22} /></button>
      <button className="play" onClick={S.toggle} aria-label="play"><Icon name={playing ? 'pause' : 'play'} size={big ? 34 : 24} /></button>
      <button className="icon-btn" onClick={() => S.next()} aria-label="next"><Icon name="next" size={big ? 30 : 22} /></button>
      <button className={`icon-btn ${repeat !== 'off' ? 'on' : ''}`} onClick={S.cycleRepeat} aria-label="repeat"><Icon name={repeat === 'one' ? 'repeatOne' : 'repeat'} size={big ? 24 : 20} /></button>
    </div>
  );
}

function PlayerBar({ onOpen }: { onOpen: () => void }) {
  const t = useT();
  const track = S.useStore((s) => s.queue[s.index]);
  const volume = S.useStore((s) => s.volume);
  const liked = S.useStore((s) => (track ? s.liked.some((x) => x.id === track.id) : false));
  const position = S.useStore((s) => s.position);
  const duration = S.useStore((s) => s.duration);
  return (
    <footer className="bar">
      <div className="bar-line" style={{ width: `${duration ? (position / duration) * 100 : 0}%` }} />
      <button className="bar-track" onClick={onOpen} disabled={!track}>
        <div className="bar-art">{track?.thumb ? <img src={track.thumb} alt="" /> : <Icon name="music" />}</div>
        <div className="bar-text"><b>{track?.title ?? t.nothingPlaying}</b><small>{track ? names(track) : ''}</small></div>
      </button>
      {track && <button className={`icon-btn like ${liked ? 'on' : ''}`} onClick={() => S.toggleLike(track)}><Icon name={liked ? 'heartFill' : 'heart'} size={20} /></button>}
      <div className="bar-center"><Controls /><div className="bar-progress"><Progress /></div></div>
      <div className="bar-right">
        <button className="icon-btn" onClick={onOpen} aria-label="lyrics"><Icon name="lyrics" size={20} /></button>
        <button className="icon-btn" onClick={() => S.setVolume(volume > 0 ? 0 : 0.9)} aria-label="volume"><Icon name={volume > 0 ? 'volume' : 'mute'} size={20} /></button>
        <input className="vol" type="range" min={0} max={1} step={0.01} value={volume} style={{ ['--p' as any]: `${volume * 100}%` }} onChange={(e) => S.setVolume(Number(e.target.value))} />
      </div>
    </footer>
  );
}

// ---------- shell ----------
function App() {
  const t = useT();
  const lang = S.useStore((s) => s.lang);
  const accent = S.useStore((s) => s.accent);
  const toast = S.useStore((s) => s.toast);
  const [stack, setStack] = useState<Route[]>([{ name: 'home' }]);
  const [np, setNp] = useState(false);
  const route = stack[stack.length - 1];
  const mainRef = useRef<HTMLElement>(null);
  navigate = (r) => { setNp(false); setStack((s) => (['home', 'search', 'library', 'settings'].includes(r.name) && !(r as any).q ? [r] : [...s, r])); };
  goBack = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  S.setFailToast(() => t.playFailed);
  useEffect(() => { mainRef.current?.scrollTo(0, 0); }, [route]);
  useEffect(() => {
    const [a, b] = ACCENTS[accent] ?? ACCENTS.sunset;
    document.documentElement.style.setProperty('--a1', a);
    document.documentElement.style.setProperty('--a2', b);
  }, [accent]);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
  }, [lang]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.code === 'Space') { e.preventDefault(); S.toggle(); }
      if (e.ctrlKey && e.key === 'ArrowRight') S.next();
      if (e.ctrlKey && e.key === 'ArrowLeft') S.prev();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  const tabs: [Route['name'], string, string][] = [['home', 'home', t.home], ['search', 'search', t.search], ['library', 'library', t.library], ['settings', 'settings', t.settings]];
  const root = stack[0].name;
  return (
    <div className="app">
      <nav className="side">
        <div className="brand"><span className="logo"><Icon name="music" size={20} /></span>JixOne</div>
        {tabs.map(([name, icon, label]) => (
          <button key={name} className={`nav ${root === name ? 'on' : ''}`} onClick={() => navigate({ name } as Route)}><Icon name={icon} />{label}</button>
        ))}
      </nav>
      <main ref={mainRef}>
        {stack.length > 1 && <button className="back" onClick={goBack}><Icon name="back" size={18} />{t.back}</button>}
        {route.name === 'home' && <Home />}
        {route.name === 'search' && <Search key={route.q ?? ''} initial={route.q} />}
        {route.name === 'library' && <Library />}
        {route.name === 'settings' && <Settings />}
        {route.name === 'artist' && <Artist id={route.id} />}
        {route.name === 'album' && <Collection kind="album" id={route.id} />}
        {route.name === 'playlist' && <Collection kind="playlist" id={route.id} />}
        {route.name === 'local' && <LocalPlaylist id={route.id} />}
      </main>
      <PlayerBar onOpen={() => setNp(true)} />
      <nav className="tabs">
        {tabs.map(([name, icon, label]) => (
          <button key={name} className={root === name ? 'on' : ''} onClick={() => navigate({ name } as Route)}><Icon name={icon} /><span>{label}</span></button>
        ))}
      </nav>
      {np && <NowPlaying onClose={() => setNp(false)} />}
      <TrackMenu />
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
