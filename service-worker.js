// Define um nome e uma versão para o nosso cache
const CACHE_NAME = 'projeto-5km-cache-v1';

// Lista de todos os ficheiros que a nossa aplicação precisa para funcionar offline
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

// Evento 'install': é acionado quando o service worker é instalado pela primeira vez.
self.addEventListener('install', (event) => {
    console.log('Service Worker: A instalar...');
    // Espera até que o cache seja aberto e todos os nossos ficheiros sejam guardados
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Cache aberto, a adicionar ficheiros essenciais.');
                return cache.addAll(URLS_TO_CACHE);
            })
            .then(() => {
                console.log('Service Worker: Ficheiros guardados em cache com sucesso.');
                return self.skipWaiting();
            })
    );
});

// Evento 'fetch': é acionado sempre que a página pede um ficheiro (ex: uma imagem, um script).
// Funciona como um "porteiro" para todos os pedidos de rede.
self.addEventListener('fetch', (event) => {
    event.respondWith(
        // Estratégia "Cache First": Tenta primeiro encontrar a resposta no cache.
        caches.match(event.request)
            .then((response) => {
                // Se encontrar no cache, retorna a versão guardada.
                if (response) {
                    return response;
                }
                // Se não encontrar no cache, vai à rede para o obter.
                return fetch(event.request);
            })
    );
});

// Evento 'activate': é acionado quando o service worker é ativado.
// Útil para limpar caches antigos de versões anteriores.
self.addEventListener('activate', (event) => {
    console.log('Service Worker: A ativar...');
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log('Service Worker: A limpar cache antigo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});