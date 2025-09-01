// A principal alteração: mudámos a versão do cache.
// Isto força o navegador a apagar o cache antigo e a criar um novo e limpo.
const CACHE_NAME = 'projeto-5km-cache-v2';

// A lista de ficheiros essenciais continua a mesma.
const URLS_TO_CACHE = [
    '/',
    'index.html',
    'style.css',
    'script.js',
    'logo.png',
    'iniciar.opus',
    'correr.opus',
    'caminhar.opus',
    'finalizar.opus'
];

// Evento 'install': continua a guardar os ficheiros na primeira vez.
self.addEventListener('install', (event) => {
    console.log('Service Worker v2: A instalar...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker v2: A adicionar ficheiros essenciais ao cache.');
                // Usamos fetch para cada recurso individualmente para mais robustez.
                const promises = URLS_TO_CACHE.map((url) => {
                    return fetch(url).then((response) => {
                        if (!response.ok) {
                            throw new Error(`Falha ao obter: ${url}`);
                        }
                        return cache.put(url, response);
                    });
                });
                return Promise.all(promises);
            })
            .then(() => {
                console.log('Service Worker v2: Ficheiros guardados com sucesso.');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Service Worker v2: Falha ao guardar ficheiros no cache.', error);
            })
    );
});

// Evento 'fetch': A nossa nova estratégia mais robusta.
self.addEventListener('fetch', (event) => {
    event.respondWith(
        // 1. Tenta encontrar no cache primeiro (ideal para o modo offline).
        caches.match(event.request)
            .then((cachedResponse) => {
                // Se encontrar, retorna a versão do cache.
                if (cachedResponse) {
                    return cachedResponse;
                }
                // 2. Se não encontrar, vai à rede.
                return fetch(event.request).then((networkResponse) => {
                    // E guarda uma cópia no cache para a próxima vez.
                    return caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                });
            })
    );
});


// Evento 'activate': Limpa os caches antigos (como o v1).
self.addEventListener('activate', (event) => {
    console.log('Service Worker v2: A ativar...');
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log('Service Worker v2: A limpar cache antigo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});