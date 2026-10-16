/* H&J Health — service worker: funciona offline após o primeiro carregamento.
 * Só guarda os arquivos do app. Dados de saúde ficam no IndexedDB, nunca passam por aqui.
 * Ao publicar uma versão nova, altere VERSAO para que os aparelhos baixem os arquivos novos.
 */
const VERSAO = 'hj-health-1.0.0';
const ARQUIVOS = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/schema.js', 'js/db.js', 'js/logic.js', 'js/io.js', 'js/ui-core.js', 'js/ui-hoje.js', 'js/ui-nutricao.js', 'js/ui-treino.js',
  'js/ui-sono.js', 'js/ui-evolucao.js', 'js/ui-semana.js', 'js/ui-saude.js', 'js/ui-compras.js', 'js/ui-relatorios.js', 'js/ui-config.js', 'js/app.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS)));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('hj-health-') && k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('message', e => { if (e.data === 'atualizar') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('index.html').then(r => r || fetch(req)));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(r => r || fetch(req)));
});
