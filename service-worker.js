// Aumentamos a versão para forçar a atualização do cache.
const CACHE_NAME = 'projeto-5km-cache-v3';

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

// Evento 'install': Guarda os ficheiros essenciais quando o service worker é instalado.
self.addEventListener('install', (event) => {
    console.log('Service Worker v3: A instalar...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker v3: A adicionar ficheiros essenciais ao cache.');
                return cache.addAll(URLS_TO_CACHE);
            })
            .then(() => self.skipWaiting())
    );
});

// Evento 'fetch': Interceta todos os pedidos de rede.
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                // Se o pedido estiver no cache, retorna a versão guardada.
                if (cachedResponse) {
                    return cachedResponse;
                }

                // Se não estiver no cache, vai à rede.
                return fetch(event.request).then((networkResponse) => {
                    // Clona a resposta para poder guardá-la no cache e enviá-la ao navegador.
                    const responseToCache = networkResponse.clone();

                    caches.open(CACHE_NAME).then((cache) => {
                        // --- A CORREÇÃO ESTÁ AQUI ---
                        // Só tenta guardar no cache se for um pedido web válido (http/https)
                        if (event.request.url.startsWith('http')) {
                            cache.put(event.request, responseToCache);
                        }
                    });

                    return networkResponse;
                });
            })
    );
});


// Evento 'activate': Limpa os caches antigos (como o v1 e v2).
self.addEventListener('activate', (event) => {
    console.log('Service Worker v3: A ativar...');
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log('Service Worker v3: A limpar cache antigo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});