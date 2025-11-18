/**
 * Service Worker para Changánet PWA
 * Maneja cache, sincronización en segundo plano y notificaciones push
 */

const CACHE_NAME = 'changanet-v1.0.0';
const STATIC_CACHE = 'changanet-static-v1.0.0';
const DYNAMIC_CACHE = 'changanet-dynamic-v1.0.0';

// Recursos estáticos para cachear
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/vite.svg',
  '/src/main.jsx',
  '/src/App.jsx',
  '/src/index.css',
  '/src/App.css'
];

// Recursos dinámicos que se cachean en runtime
const DYNAMIC_PATTERNS = [
  /\/api\/(profile|services|professionals|notifications)/,
  /\/_assets\//,
  /\.(png|jpg|jpeg|svg|gif|webp)$/,
  /\.(css|js)$/
];

// Instalar Service Worker
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker instalándose...');

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('📦 Cacheando recursos estáticos...');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('✅ Service Worker instalado');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('❌ Error instalando Service Worker:', error);
      })
  );
});

// Activar Service Worker
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker activándose...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE)
            .map((cacheName) => {
              console.log('🗑️ Eliminando cache antiguo:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('✅ Service Worker activado');
        return self.clients.claim();
      })
  );
});

// Interceptar requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo interceptar requests del mismo origen
  if (url.origin !== location.origin) {
    return;
  }

  // Estrategia Cache First para recursos estáticos
  if (STATIC_ASSETS.some(asset => url.pathname.endsWith(asset))) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Estrategia Network First para API calls
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Estrategia Stale While Revalidate para otros recursos
  if (DYNAMIC_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Default: Network First
  event.respondWith(networkFirst(request));
});

// Estrategia Cache First
async function cacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.error('Error en cacheFirst:', error);
    return new Response('Offline - Recurso no disponible', { status: 503 });
  }
}

// Estrategia Network First
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('Red no disponible, intentando cache:', request.url);

    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Si es una API call y estamos offline, devolver respuesta especial
    if (request.url.includes('/api/')) {
      return new Response(
        JSON.stringify({
          error: 'offline',
          message: 'Estás offline. La acción se sincronizará cuando recuperes conexión.'
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response('Offline - Servicio no disponible', { status: 503 });
  }
}

// Estrategia Stale While Revalidate
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch((error) => {
    console.error('SW: fetch failed for:', request.url, error);
    // Si fetch falla y no hay cache, devolver error controlado
    if (!cachedResponse) {
      return new Response('Network error and no cache available', { status: 503 });
    }
    // Si hay cache, devolverlo aunque fetch falló
  });

  if (cachedResponse) {
    return cachedResponse;
  } else {
    try {
      return await fetchPromise;
    } catch (error) {
      console.error('SW: fetchPromise rejected:', error);
      return new Response('Fetch failed', { status: 503 });
    }
  }
}

// Manejar notificaciones push
self.addEventListener('push', (event) => {
  console.log('📱 Notificación push recibida:', event);

  if (!event.data) {
    console.log('No hay datos en la notificación push');
    return;
  }

  try {
    const data = event.data.json();
    console.log('Datos de notificación:', data);

    const options = {
      body: data.body || 'Tienes una nueva notificación',
      icon: '/vite.svg',
      badge: '/vite.svg',
      vibrate: [200, 100, 200],
      data: {
        url: data.url || '/',
        ...data
      },
      actions: [
        {
          action: 'view',
          title: 'Ver',
          icon: '/vite.svg'
        },
        {
          action: 'dismiss',
          title: 'Descartar'
        }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Changánet', options)
    );
  } catch (error) {
    console.error('Error procesando notificación push:', error);
  }
});

// Manejar clicks en notificaciones
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Click en notificación:', event);

  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Verificar si ya hay una ventana abierta con la URL
        for (let client of windowClients) {
          if (client.url === url && 'focus' in client) {
            return client.focus();
          }
        }

        // Si no hay ventana abierta, abrir una nueva
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

// Sincronización en segundo plano
self.addEventListener('sync', (event) => {
  console.log('🔄 Sincronización en segundo plano:', event.tag);

  if (event.tag === 'background-sync') {
    event.waitUntil(syncPendingActions());
  }
});

// Función para sincronizar acciones pendientes
async function syncPendingActions() {
  try {
    console.log('🔄 Sincronizando acciones pendientes...');

    // Aquí iría la lógica para sincronizar datos pendientes
    // Por ejemplo, enviar mensajes offline, actualizar perfiles, etc.

    console.log('✅ Sincronización completada');
  } catch (error) {
    console.error('❌ Error en sincronización:', error);
  }
}

// Manejar mensajes del cliente
self.addEventListener('message', (event) => {
  console.log('📨 Mensaje recibido del cliente:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});