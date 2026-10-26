/* Complexe Anziama — fonctionnement sans réseau.
   La page et les icônes sont gardées sur l'appareil. À chaque ouverture avec réseau,
   la dernière version est prise si elle arrive vite ; sinon la copie gardée s'ouvre tout de suite.
   Les échanges avec Google (données) ne passent pas par ici : l'appli les gère elle-même. */
var CACHE = 'anziama-v7';
var FICHIERS = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png?v=2', 'icon-512.png?v=2',
                'icon-maskable-512.png?v=2', 'apple-touch-icon.png?v=2',
                'lib/html2canvas-pro.min.js', 'lib/jspdf.umd.min.js'];
var ATTENTE_MAX = 3000;   // au-delà, on ouvre la copie gardée (connexion lente)

self.addEventListener('install', function (e) {
  // Un fichier manquant ne doit pas empêcher le reste de fonctionner sans réseau
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(FICHIERS.map(function (f) { return c.add(f).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (cles) {
    return Promise.all(cles.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function garder(req, rep) {
  if (rep && (rep.ok || rep.type === 'opaque')) { var copie = rep.clone(); caches.open(CACHE).then(function (c) { c.put(req, copie); }); }
  return rep;
}

self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;                       // envois vers Google : pas touchés

  // La page : la plus récente si elle arrive en moins de 3 s, sinon la copie gardée
  if (req.mode === 'navigate') {
    e.respondWith(new Promise(function (ok) {
      var fini = false, reseau = fetch(req).then(function (r) { garder('index.html', r.clone()); return r; });
      var copie = function () { return caches.match('index.html').then(function (c) { return c || reseau; }); };
      setTimeout(function () { if (!fini) { fini = true; ok(copie()); } }, ATTENTE_MAX);
      reseau.then(function (r) { if (!fini) { fini = true; ok(r); } }, function () { if (!fini) { fini = true; ok(copie()); } });
    }));
    return;
  }

  // Polices Google, icônes, manifeste : copie gardée d'abord, mise à jour en arrière-plan
  if (url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.match(req).then(function (c) {
      var reseau = fetch(req).then(function (r) { return garder(req, r); }).catch(function () { return c; });
      return c || reseau;
    }));
  }
});
