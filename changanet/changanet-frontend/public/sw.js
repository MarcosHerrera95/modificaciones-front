/**
 * Service Worker para Changánet PWA
 * Implementa estrategias de caché avanzadas y funcionalidad offline
 * Creado: 2025-11-24
 * Versión: 2.0.0
 */

const CACHE_NAME = 'changanet-v2.0.0';
const OFFLINE_URL = '/offline.html';

// Archivos críticos para caché inmediato
const CRITICAL_RESOURCES = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/static/js/bundle.js',
  '/static/css/main.css'
];

// Recursos que se cachearán bajo demanda
const DYNAMIC_CACHE_URLS = [
  '/api/professionals',
  '/api/profile',
  '/api/services',
  '/api/quotes'
];

// Estrategias de caché
const CACHE_STRATEGIES = {
  CACHE_FIRST: 'cache-first',
  NETWORK_FIRST: 'network-first',
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate',
  NETWORK_ONLY: 'network-only',
  CACHE_ONLY: 'cache-only'
};

/**
 * Instalación del Service Worker
 */
self.addEventListener('install', (event) => {
  console.log('🚀 Service Worker instalándose...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Abriendo caché, guardando recursos críticos...');
        return cache.addAll(CRITICAL_RESOURCES);
      })
      .then(() => {
        console.log('✅ Service Worker instalado correctamente');
        // Forzar activación inmediata
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('❌ Error durante la instalación:', error);
      })
  );
});

/**
 * Activación del Service Worker
 */
self.addEventListener('activate', (event) => {
  console.log('🔄 Service Worker activándose...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('🗑️ Eliminando caché antiguo:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ Service Worker activado correctamente');
        // Tomar control inmediato de todas las pestañas
        return self.clients.claim();
      })
  );
});

/**
 * Interceptar solicitudes de red
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Solo manejar solicitudes del mismo origen
  if (url.origin !== location.origin) {
    return;
  }

  // Determinar estrategia de caché según el tipo de recurso
  const strategy = getCacheStrategy(request);
  
  event.respondWith(handleRequest(request, strategy));
});

/**
 * Determina la estrategia de caché basada en el tipo de solicitud
 */
function getCacheStrategy(request) {
  const url = new URL(request.url);
  
  // API calls - Network first con fallback a caché
  if (url.pathname.startsWith('/api/')) {
    return CACHE_STRATEGIES.NETWORK_FIRST;
  }
  
  // Recursos estáticos - Cache first
  if (url.pathname.startsWith('/static/') || 
      url.pathname.endsWith('.js') || 
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.png') ||
      url.pathname.endsWith('.jpg') ||
      url.pathname.endsWith('.jpeg') ||
      url.pathname.endsWith('.svg')) {
    return CACHE_STRATEGIES.CACHE_FIRST;
  }
  
  // Páginas HTML - Network first con fallback offline
  if (request.destination === 'document') {
    return CACHE_STRATEGIES.NETWORK_FIRST;
  }
  
  // Por defecto, usar stale-while-revalidate
  return CACHE_STRATEGIES.STALE_WHILE_REVALIDATE;
}

/**
 * Maneja las solicitudes según la estrategia especificada
 */
async function handleRequest(request, strategy) {
  try {
    switch (strategy) {
      case CACHE_STRATEGIES.CACHE_FIRST:
        return await cacheFirst(request);
        
      case CACHE_STRATEGIES.NETWORK_FIRST:
        return await networkFirst(request);
        
      case CACHE_STRATEGIES.STALE_WHILE_REVALIDATE:
        return await staleWhileRevalidate(request);
        
      case CACHE_STRATEGIES.NETWORK_ONLY:
        return await networkOnly(request);
        
      case CACHE_STRATEGIES.CACHE_ONLY:
        return await cacheOnly(request);
        
      default:
        return await networkFirst(request);
    }
  } catch (error) {
    console.error('Error manejando solicitud:', error);
    return await handleOfflineRequest(request);
  }
}

/**
 * Estrategia Cache First - Busca en caché primero, luego en red
 */
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    throw error;
  }
}

/**
 * Estrategia Network First - Busca en red primero, luego en caché
 */
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Para solicitudes de documentos, devolver página offline
    if (request.destination === 'document') {
      return caches.match(OFFLINE_URL);
    }
    
    throw error;
  }
}

/**
 * Estrategia Stale While Revalidate - Sirve del caché y actualiza en segundo plano
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => {
    // Si la red falla, devolver caché sin actualizar
    return cachedResponse;
  });
  
  return cachedResponse || fetchPromise;
}

/**
 * Estrategia Network Only - Solo red
 */
async function networkOnly(request) {
  return await fetch(request);
}

/**
 * Estrategia Cache Only - Solo caché
 */
async function cacheOnly(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  throw new Error('Recurso no encontrado en caché');
}

/**
 * Maneja solicitudes offline
 */
async function handleOfflineRequest(request) {
  if (request.destination === 'document') {
    return caches.match(OFFLINE_URL);
  }
  
  return new Response('Sin conexión', {
    status: 503,
    statusText: 'Service Unavailable',
    headers: new Headers({
      'Content-Type': 'text/plain'
    })
  });
}

/**
 * Mensajes del cliente principal
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    const { urls } = event.data;
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(urls);
      })
    );
  }
});

/**
 * Notificaciones push
 */
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  const { title, body, icon, badge, data: notificationData } = data;
  
  const options = {
    body,
    icon: icon || '/icon-192x192.png',
    badge: badge || '/badge-72x72.png',
    data: notificationData,
    vibrate: [200, 100, 200],
    requireInteraction: true,
    actions: [
      {
        action: 'open',
        title: 'Abrir'
      },
      {
        action: 'close',
        title: 'Cerrar'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

/**
 * Manejo de clics en notificaciones
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const { action } = event;
  const { data } = event.notification;
  
  if (action === 'open' || !action) {
    const urlToOpen = data?.url || '/';
    
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        // Si ya hay una ventana abierta, enfocarla
        for (const client of clientList) {
          if (client.url.includes(urlToOpen) && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Si no hay ventana abierta, abrir una nueva
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
    );
  }
});

/**
 * Sincronización en segundo plano
 */
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

/**
 * Realiza sincronización en segundo plano
 */
async function doBackgroundSync() {
  try {
    // Obtener datos pendientes de sincronizar
    const cache = await caches.open('pending-sync');
    const pendingRequests = await cache.keys();
    
    for (const request of pendingRequests) {
      try {
        const response = await fetch(request);
        if (response.ok) {
          await cache.delete(request);
        }
      } catch (error) {
        console.error('Error en sincronización:', error);
      }
    }
  } catch (error) {
    console.error('Error en doBackgroundSync:', error);
  }
}