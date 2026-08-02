/* Service worker — makes Mílù work with no signal at all.

   Everything is precached on install, so after the first visit the app runs
   entirely from the phone. Bump VERSION whenever you deploy to force a refresh. */

const VERSION = 'milu-v1';
const CACHE = VERSION;

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',

  './vendor/hanzi-writer.min.js',
  './js/config.js',
  './js/mascot.js',
  './js/store.js',
  './js/srs.js',
  './js/audio.js',
  './js/ui.js',
  './js/hanzi.js',
  './js/pitch.js',
  './js/speech.js',
  './js/pptx.js',
  './js/cloud.js',
  './js/app.js',
  './js/views/today.js',
  './js/views/session.js',
  './js/views/study.js',
  './js/views/practice.js',
  './js/views/quiz.js',
  './js/views/chars.js',
  './js/views/tones.js',
  './js/views/speak.js',
  './js/views/sentences.js',
  './js/views/import.js',
  './js/views/me.js',

  './data/vocab.json',
  './data/lessons.json',
  './data/dialogues.json',
  './data/patterns.json',
  './data/tones.json',
  './data/radicals.json',
  './data/strokes.json',

  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Add one at a time so a single 404 doesn't abort the whole install.
    await Promise.all(ASSETS.map(url =>
      cache.add(new Request(url, { cache: 'reload' }))
        .catch(err => console.warn('[sw] skipped', url, err))));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // leave Firebase alone

  // Navigations always resolve to the shell so deep links work offline.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        return await fetch(req);
      } catch (e) {
        return (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  // Everything else: serve from cache, refresh it in the background.
  event.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });
    const network = fetch(req).then(res => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() => null);

    if (cached) {
      network;                       // fire and forget
      return cached;
    }
    const res = await network;
    return res || new Response('Offline', { status: 503, statusText: 'Offline' });
  })());
});

self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
