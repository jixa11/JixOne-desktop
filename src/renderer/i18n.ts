export type Lang = 'fa' | 'en';

const fa = {
  home: 'خانه', search: 'جست‌وجو', library: 'کتابخانه', settings: 'تنظیمات',
  goodMorning: 'صبح بخیر', goodAfternoon: 'عصر بخیر', goodEvening: 'شب بخیر',
  yourArtists: 'آرتیست‌های تو', pickArtists: 'آرتیست‌هایت را انتخاب کن', pickArtistsHint: 'چند آرتیست را دنبال کن تا خانه برای تو ساخته شود.',
  yourMix: 'میکس تو', playMix: 'پخش میکس', moods: 'حال‌وهوا', searchHint: 'آهنگ، آرتیست، آلبوم…',
  songs: 'آهنگ‌ها', artists: 'آرتیست‌ها', albums: 'آلبوم‌ها', playlists: 'پلی‌لیست‌ها', topSongs: 'آهنگ‌های برتر',
  play: 'پخش', shuffle: 'شافل', follow: 'دنبال کردن', following: 'دنبال می‌کنی', liked: 'لایک‌شده‌ها', history: 'اخیراً پخش‌شده',
  newPlaylist: 'پلی‌لیست جدید', playlistName: 'اسم پلی‌لیست', create: 'ساختن', cancel: 'انصراف', remove: 'حذف',
  playNext: 'پخش بعدی', addToQueue: 'افزودن به صف', addToPlaylist: 'افزودن به پلی‌لیست', like: 'لایک', unlike: 'برداشتن لایک',
  goToArtist: 'رفتن به آرتیست', goToAlbum: 'رفتن به آلبوم', queue: 'صف پخش', lyrics: 'متن آهنگ', noLyrics: 'متنی برای این آهنگ پیدا نشد.',
  nothingPlaying: 'چیزی پخش نمی‌شود', empty: 'هنوز چیزی اینجا نیست.', loading: 'در حال بارگذاری…', error: 'بارگذاری نشد. اینترنت را چک کن.',
  account: 'حساب YouTube Music', signIn: 'ورود', signOut: 'خروج', signedInAs: 'وارد شده با', signInHint: 'بدون ورود هم کار می‌کند؛ اگر آهنگی پخش نشد، وارد شو.',
  theme: 'رنگ', language: 'زبان', about: 'درباره', aboutText: 'JixOne نسخه‌ی دسکتاپ. آهنگ‌ها مستقیم از YouTube Music پخش می‌شوند.',
  playFailed: 'این آهنگ پخش نشد؛ رفتم سراغ بعدی.', added: 'اضافه شد', back: 'برگشت', plays: 'پخش', tracks: 'آهنگ',
};
const en: typeof fa = {
  home: 'Home', search: 'Search', library: 'Library', settings: 'Settings',
  goodMorning: 'Good morning', goodAfternoon: 'Good afternoon', goodEvening: 'Good evening',
  yourArtists: 'Your artists', pickArtists: 'Pick your artists', pickArtistsHint: 'Follow a few artists and Home is built around them.',
  yourMix: 'Your mix', playMix: 'Play mix', moods: 'Moods', searchHint: 'Songs, artists, albums…',
  songs: 'Songs', artists: 'Artists', albums: 'Albums', playlists: 'Playlists', topSongs: 'Top songs',
  play: 'Play', shuffle: 'Shuffle', follow: 'Follow', following: 'Following', liked: 'Liked songs', history: 'Recently played',
  newPlaylist: 'New playlist', playlistName: 'Playlist name', create: 'Create', cancel: 'Cancel', remove: 'Remove',
  playNext: 'Play next', addToQueue: 'Add to queue', addToPlaylist: 'Add to playlist', like: 'Like', unlike: 'Unlike',
  goToArtist: 'Go to artist', goToAlbum: 'Go to album', queue: 'Queue', lyrics: 'Lyrics', noLyrics: 'No lyrics found for this song.',
  nothingPlaying: 'Nothing playing', empty: 'Nothing here yet.', loading: 'Loading…', error: 'Could not load. Check your connection.',
  account: 'YouTube Music account', signIn: 'Sign in', signOut: 'Sign out', signedInAs: 'Signed in as', signInHint: 'Works without an account; sign in if a song will not play.',
  theme: 'Color', language: 'Language', about: 'About', aboutText: 'JixOne for desktop. Music streams straight from YouTube Music.',
  playFailed: 'That song would not play; skipped to the next.', added: 'Added', back: 'Back', plays: 'plays', tracks: 'songs',
};

export const dict = { fa, en };
export type Strings = typeof fa;
