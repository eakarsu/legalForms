// Service Worker for LegalPracticeAI PWA
// Version: 1.0.0

const CACHE_NAME = 'legalpracticeai-v1';
const STATIC_CACHE = 'static-v1';
const DYNAMIC_CACHE = 'dynamic-v1';

// Assets to cache on install
const STATIC_ASSETS = [
    '/',
    '/css/custom.css',
    '/css/mobile.css',
    '/css/enhanced-features.css',
    '/css/practice-management.css',
    '/js/mobile.js',
    '/site.webmanifest',
    '/android-chrome-192x192.png',
    '/android-chrome-512x512.png',
    '/favicon.ico',
    // External CDN resources
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
    'https://code.jquery.com/jquery-3.6.0.min.js'
];

// Pages to cache for offline access
const OFFLINE_PAGES = [
    '/',
    '/about',
    '/faq',
    '/contact',
    '/pricing',
    '/privacy',
    '/terms'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[ServiceWorker] Install');
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('[ServiceWorker] Pre-caching static assets');
                return cache.addAll(STATIC_ASSETS.map(url => {
                    return new Request(url, { mode: 'cors' });
                })).catch(err => {
                    console.log('[ServiceWorker] Cache addAll failed:', err);
                    // Cache what we can, skip failures
                    return Promise.all(
                        STATIC_ASSETS.map(url => {
                            return cache.add(url).catch(() => {
                                console.log('[ServiceWorker] Failed to cache:', url);
                            });
                        })
                    );
                });
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[ServiceWorker] Activate');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
                    .map((name) => {
                        console.log('[ServiceWorker] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip API calls and socket.io
    if (url.pathname.startsWith('/api/') ||
        url.pathname.startsWith('/socket.io/') ||
        url.pathname.startsWith('/auth/')) {
        return;
    }

    // Handle static assets - Cache First
    if (isStaticAsset(url)) {
        event.respondWith(cacheFirst(request));
        return;
    }

    // Handle pages - Network First with cache fallback
    if (request.headers.get('accept')?.includes('text/html')) {
        event.respondWith(networkFirst(request));
        return;
    }

    // Handle other requests - Stale While Revalidate
    event.respondWith(staleWhileRevalidate(request));
});

// Check if URL is a static asset
function isStaticAsset(url) {
    const staticExtensions = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf'];
    return staticExtensions.some(ext => url.pathname.endsWith(ext));
}

// Cache First strategy
async function cacheFirst(request) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }

    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        console.log('[ServiceWorker] Cache first failed:', error);
        return new Response('Offline', { status: 503 });
    }
}

// Network First strategy
async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        // Return offline page
        return caches.match('/offline.html') || new Response(getOfflineHTML(), {
            headers: { 'Content-Type': 'text/html' }
        });
    }
}

// Stale While Revalidate strategy
async function staleWhileRevalidate(request) {
    const cache = await caches.open(DYNAMIC_CACHE);
    const cachedResponse = await cache.match(request);

    const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    }).catch(() => cachedResponse);

    return cachedResponse || fetchPromise;
}

// Generate offline HTML
function getOfflineHTML() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Offline - LegalPracticeAI</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-align: center;
            padding: 20px;
        }
        .container { max-width: 400px; }
        .icon {
            font-size: 4rem;
            margin-bottom: 1.5rem;
            opacity: 0.9;
        }
        h1 { font-size: 1.75rem; margin-bottom: 1rem; }
        p { opacity: 0.9; margin-bottom: 2rem; line-height: 1.6; }
        .btn {
            display: inline-block;
            padding: 14px 28px;
            background: white;
            color: #667eea;
            text-decoration: none;
            border-radius: 50px;
            font-weight: 600;
            transition: transform 0.2s;
        }
        .btn:active { transform: scale(0.98); }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">&#128268;</div>
        <h1>You're Offline</h1>
        <p>It looks like you've lost your internet connection. Please check your connection and try again.</p>
        <a href="/" class="btn" onclick="window.location.reload(); return false;">Try Again</a>
    </div>
</body>
</html>
    `;
}

// Background sync for form submissions
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-forms') {
        event.waitUntil(syncForms());
    }
});

// Sync pending form data
async function syncForms() {
    try {
        const db = await openDB();
        const pendingForms = await getAllPendingForms(db);

        for (const form of pendingForms) {
            try {
                const response = await fetch(form.url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(form.data)
                });

                if (response.ok) {
                    await deletePendingForm(db, form.id);
                }
            } catch (error) {
                console.log('[ServiceWorker] Sync failed for form:', form.id);
            }
        }
    } catch (error) {
        console.log('[ServiceWorker] Sync error:', error);
    }
}

// Push notifications
self.addEventListener('push', (event) => {
    if (!event.data) return;

    const data = event.data.json();
    const options = {
        body: data.body || 'You have a new notification',
        icon: '/android-chrome-192x192.png',
        badge: '/android-chrome-192x192.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/'
        },
        actions: [
            { action: 'open', title: 'Open' },
            { action: 'dismiss', title: 'Dismiss' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'LegalPracticeAI', options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'dismiss') return;

    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((windowClients) => {
                // Check if there's already a window open
                for (const client of windowClients) {
                    if (client.url === urlToOpen && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Open new window
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

// IndexedDB helpers for offline form storage
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('LegalFormsOffline', 1);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('pendingForms')) {
                db.createObjectStore('pendingForms', { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

function getAllPendingForms(db) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['pendingForms'], 'readonly');
        const store = transaction.objectStore('pendingForms');
        const request = store.getAll();

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

function deletePendingForm(db, id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['pendingForms'], 'readwrite');
        const store = transaction.objectStore('pendingForms');
        const request = store.delete(id);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
}

console.log('[ServiceWorker] Loaded');
