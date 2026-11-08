/**
 * Krediflo Service Worker
 * Cache strategy:
 *   - Shell / navigation  → Network-first, fallback to cached /index.html (SPA)
 *   - Static assets       → Cache-first, network fallback + background update
 *   - /api/* requests     → Network-first, short-lived cache fallback (offline mode)
 */

const CACHE_VERSION   = 'v3';
const SHELL_CACHE     = `krediflo-shell-${CACHE_VERSION}`;
const STATIC_CACHE    = `krediflo-static-${CACHE_VERSION}`;
const API_CACHE       = `krediflo-api-${CACHE_VERSION}`;

const ALL_CACHES = [SHELL_CACHE, STATIC_CACHE, API_CACHE];

/**
 * Core shell assets pre-cached at install time.
 * Vite fingerprints JS/CSS bundles, so only stable paths go here.
 */
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/icon-maskable.svg',
  '/favicon.svg',
];

/* ─── INSTALL: pre-cache shell ────────────────────────────────────────────── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => {
        // Take control immediately — don't wait for existing tabs to close
        self.skipWaiting();
      })
      .catch((err) => console.error('[SW] Pre-cache failed:', err))
  );
});

/* ─── ACTIVATE: prune stale caches ───────────────────────────────────────── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keyList) =>
        Promise.all(
          keyList
            .filter((key) => !ALL_CACHES.includes(key))
            .map((key) => {
              console.log('[SW] Deleting stale cache:', key);
              return caches.delete(key);
            })
        )
      )
      .then(() => {
        // Claim all open clients so updated SW takes effect immediately
        self.clients.claim();
      })
  );
});

/* ─── FETCH: routing logic ────────────────────────────────────────────────── */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  if (request.method !== 'GET') return;
  if (!url.origin.startsWith('http')) return;
  if (url.origin !== self.location.origin) {
    // Allow CDN fonts/images through but don't cache them by default
    return;
  }

  // ── API calls: Network-first, offline cache fallback ──────────────────── //
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE, 8000));
    return;
  }

  // ── Static assets (JS, CSS, images, fonts, icons): Cache-first ────────── //
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // ── HTML navigation: serve shell for SPA client-side routing ──────────── //
  if (request.mode === 'navigate') {
    event.respondWith(navigateHandler(request));
    return;
  }

  // ── Fallback: cache-first for everything else ──────────────────────────── //
  event.respondWith(cacheFirst(request, STATIC_CACHE));
});

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function isStaticAsset(pathname) {
  return /\.(js|mjs|css|png|jpg|jpeg|svg|gif|webp|avif|woff|woff2|ttf|otf|eot|ico|json)$/.test(pathname)
    && !pathname.startsWith('/api/');
}

/**
 * Cache-first, Network fallback.
 * Puts fresh network response into cache for future use.
 */
async function cacheFirst(request, cacheName) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) return cachedResponse;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(cacheName);
      // Clone before consuming — streams can only be read once
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    return offlineFallback(request);
  }
}

/**
 * Network-first, Cache fallback.
 * Times out after `timeoutMs` and falls back to cache.
 */
async function networkFirst(request, cacheName, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const networkResponse = await fetch(request, { signal: controller.signal });
    clearTimeout(timer);

    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    clearTimeout(timer);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;
    return offlineFallback(request);
  }
}

/**
 * SPA navigation handler.
 * Tries the network, falls back to cached index.html for client-side routing.
 */
async function navigateHandler(request) {
  try {
    const networkResponse = await fetch(request);
    // If the server returns the page, update the shell cache
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
    return networkResponse;
  } catch {
    // Offline — serve the cached SPA shell so React Router handles routing
    const shellResponse =
      (await caches.match('/index.html')) ||
      (await caches.match('/'));
    if (shellResponse) return shellResponse;
    return offlineFallback(request);
  }
}

/**
 * Generic offline fallback.
 * Returns a branded offline page if nothing is cached.
 */
function offlineFallback(request) {
  const url = new URL(request.url);
  const isApiRequest = url.pathname.startsWith('/api/');

  if (isApiRequest) {
    return new Response(
      JSON.stringify({
        error: 'offline',
        message: 'You appear to be offline. Please check your connection and try again.',
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Krediflo offline HTML shell
  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Krediflo — Offline</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#0F172A;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
         display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;text-align:center}
    .card{max-width:380px}
    .logo{font-size:2rem;font-weight:900;margin-bottom:24px;letter-spacing:-0.02em}
    .logo .kredi{color:#e2e8f0}
    .logo .flo{background:linear-gradient(135deg,#00D2FF,#2563EB);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
    h1{font-size:1.5rem;font-weight:700;margin-bottom:12px}
    p{color:#94a3b8;line-height:1.6;margin-bottom:28px}
    button{background:linear-gradient(135deg,#00D2FF,#2563EB);color:#0F172A;border:none;padding:14px 32px;
           border-radius:10px;font-size:1rem;font-weight:700;cursor:pointer}
    button:hover{opacity:0.9}
    .pulse{display:inline-block;width:8px;height:8px;background:#ef4444;
           border-radius:50%;margin-right:8px;animation:pulse 1.5s infinite}
    @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(1.4)}}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo"><span class="kredi">Kredi</span><span class="flo">flo</span></div>
    <div style="margin-bottom:20px">
      <span class="pulse"></span>
      <span style="font-size:0.85rem;color:#64748b">No internet connection</span>
    </div>
    <h1>You're Offline</h1>
    <p>Krediflo requires a connection to sync your CIBIL, bank statements, and MCA data in real time. Please check your network and try again.</p>
    <button onclick="window.location.reload()">Retry Connection</button>
  </div>
</body>
</html>`,
    {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }
  );
}
