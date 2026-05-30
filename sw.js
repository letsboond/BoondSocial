const CACHE_NAME = 'boond-v28';
const urlsToCache = [
    '/',
    '/index.html',
    '/logo.png',
    '/icon-192.png',
    '/icon-512.png',
    '/src/App.js?v=24',
    '/src/services/firebase.js',
    '/src/components/BottomNav.js',
    '/src/components/MapsView.js',
    '/src/components/BuyView.js?v=24',
    '/src/components/CommunityView.js',
    '/src/components/ProfileView.js?v=28',
    '/src/components/LoginView.js?v=17',
    '/src/components/Hero.js',
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/react@18/umd/react.development.js',
    'https://unpkg.com/react-dom@18/umd/react-dom.development.js',
    'https://unpkg.com/react-router-dom@5.3.4/umd/react-router-dom.min.js',
    'https://unpkg.com/@babel/standalone/babel.min.js',
    'https://unpkg.com/framer-motion@10.16.4/dist/framer-motion.js',
    'https://unpkg.com/lucide@latest',
    'https://fonts.googleapis.com/css2?family=Quicksand:wght@300;400;500;600;700&display=swap'
];

// Install SW
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

// Activate SW
self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});


// Fetch
self.addEventListener('fetch', (event) => {
    // Network First strategy (Dynamic App)
    // We try to get from network, if fail (offline), try cache.
    event.respondWith(
        fetch(event.request).catch(() => {
            return caches.match(event.request);
        })
    );
});
