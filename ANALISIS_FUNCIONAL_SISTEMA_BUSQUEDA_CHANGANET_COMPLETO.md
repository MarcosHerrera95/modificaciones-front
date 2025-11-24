# ANÁLISIS FUNCIONAL Y TÉCNICO COMPLETO - SISTEMA DE BÚSQUEDA Y FILTROS CHANGÁNET

**Fecha:** 24 de noviembre de 2025  
**Versión:** 1.0  
**Proyecto:** Changánet - Plataforma Digital de Servicios Profesionales  
**Alcance:** Sistema de Búsqueda y Filtros (REQ-11 a REQ-15)

---

## 📋 RESUMEN EJECUTIVO

Este documento presenta el análisis funcional profundo y la arquitectura técnica detallada para implementar correctamente el Sistema de Búsqueda y Filtros de Changánet, cumpliendo estrictamente con los requerimientos REQ-11 a REQ-15 del PRD.

### Estado Actual vs. Requerimientos
- ✅ **REQ-11:** Búsqueda por palabra clave - **PARCIALMENTE IMPLEMENTADO**
- ⚠️ **REQ-12:** Filtros por especialidad, ciudad, barrio y radio - **IMPLEMENTACIÓN BÁSICA**
- ⚠️ **REQ-13:** Filtrar por rango de precio - **IMPLEMENTACIÓN BÁSICA**
- ⚠️ **REQ-14:** Ordenar por calificación, cercanía y disponibilidad - **IMPLEMENTACIÓN BÁSICA**
- ✅ **REQ-15:** Tarjeta resumen con foto, nombre, calificación, distancia - **IMPLEMENTADO**

---

## 🎯 1. ANÁLISIS FUNCIONAL PROFUNDO

### 1.1 Flujo Completo del Sistema de Búsqueda

#### Flujo Principal del Usuario:
```
1. INPUT DEL USUARIO
   ├── Barra de búsqueda (especialidad/keyword)
   ├── Filtros geográficos (ciudad/barrio)
   ├── Filtros de precio (rango mínimo/máximo)
   └── Configuración de ordenamiento

2. PROCESAMIENTO EN BACKEND
   ├── Validación de parámetros
   ├── Aplicación de filtros combinados
   ├── Cálculo de distancias geográficas
   ├── Ordenamiento según criterios
   └── Paginación optimizada

3. RESPUESTA Y RENDERIZADO
   ├── Tarjetas de profesionales
   ├── Información de distancia
   ├── Metadatos de búsqueda
   └── Opciones de interacción
```

### 1.2 Análisis de Cumplimiento REQ-11 a REQ-15

#### REQ-11: Búsqueda por Palabra Clave ✅ **IMPLEMENTADO**
**Estado Actual:**
- Búsqueda por especialidad principal implementada
- Compatible con búsqueda en campo `especialidad`
- Búsqueda parcial (contains) funcional

**Requerimientos de Mejora:**
```javascript
// Mejora propuesta: Búsqueda semántica
const searchKeywords = (query) => {
  return {
    OR: [
      { especialidad: { contains: query, mode: 'insensitive' } },
      { descripcion: { contains: query, mode: 'insensitive' } },
      { 
        specialties: {
          some: {
            name: { contains: query, mode: 'insensitive' }
          }
        }
      }
    ]
  };
};
```

#### REQ-12: Filtrar por Especialidad, Ciudad, Barrio y Radio ⚠️ **MEJORAS REQUERIDAS**
**Estado Actual:**
- Filtros básicos implementados
- Radio geográfico con cálculo de distancia
- Falta integración con tabla `specialties` normalizada

**Mejoras Propuestas:**
```javascript
// Filtros mejorados con JOIN a specialties
const applyGeographicFilters = (filters) => {
  const where = {};
  
  if (filters.specialtyId) {
    where.specialties = {
      some: { specialty_id: filters.specialtyId }
    };
  }
  
  if (filters.city) {
    where.coverage_zone = {
      city: { contains: filters.city, mode: 'insensitive' }
    };
  }
  
  return where;
};
```

#### REQ-13: Filtrar por Rango de Precio ⚠️ **FLEXIBILIZACIÓN REQUERIDA**
**Estado Actual:**
- Filtrado básico por `tarifa_hora`
- No considera otros tipos de tarifa (`servicio`, `convenio`)

**Mejoras Propuestas:**
```javascript
// Sistema de tarifas flexible
const applyPriceFilter = (filters) => {
  const where = {};
  
  if (filters.priceType === 'hora') {
    where.tarifa_hora = {
      gte: filters.minPrice || 0,
      lte: filters.maxPrice || Infinity
    };
  } else if (filters.priceType === 'servicio') {
    where.tarifa_servicio = {
      gte: filters.minPrice || 0,
      lte: filters.maxPrice || Infinity
    };
  }
  // Para "convenio", filtrar por disponibilidad
  
  return where;
};
```

#### REQ-14: Ordenar por Calificación, Cercanía y Disponibilidad ⚠️ **OPTIMIZACIÓN REQUERIDA**
**Estado Actual:**
- Ordenamiento básico implementado
- Cálculo de distancia funcional
- Faltan índices para optimización

**Mejoras Propuestas:**
```javascript
// Ordenamiento optimizado con índices
const getOptimizedOrdering = (sortBy, userLocation) => {
  switch (sortBy) {
    case 'distancia':
      return userLocation ? 
        { distance: 'asc' } : 
        { calificacion_promedio: 'desc' };
    case 'disponibilidad':
      return { esta_disponible: 'desc' };
    default:
      return { calificacion_promedio: 'desc' };
  }
};
```

#### REQ-15: Tarjeta Resumen Completa ✅ **IMPLEMENTADO**
**Estado Actual:**
- Foto, nombre, calificación implementados
- Distancia calculada dinámicamente
- Información adicional disponible

---

## 🏗️ 2. ARQUITECTURA TÉCNICA DETALLADA

### 2.1 Arquitectura de Base de Datos

#### Modelo de Datos Optimizado:

```sql
-- Índices optimizados para búsquedas frecuentes
CREATE INDEX CONCURRENTLY idx_professional_specialty_lookup 
  ON professional_specialties(specialty_id, professional_id);

CREATE INDEX CONCURRENTLY idx_professional_price_range 
  ON perfiles_profesionales(tarifa_hora, tarifa_servicio, tipo_tarifa);

CREATE INDEX CONCURRENTLY idx_professional_location 
  ON perfiles_profesionales(latitud, longitud, zona_cobertura);

CREATE INDEX CONCURRENTLY idx_professional_rating_availability 
  ON perfiles_profesionales(calificacion_promedio DESC, esta_disponible DESC);

-- Índice compuesto para búsquedas combinadas
CREATE INDEX CONCURRENTLY idx_professional_search_composite 
  ON perfiles_profesionales(
    especialidad, 
    zona_cobertura, 
    tipo_tarifa, 
    esta_disponible
  );
```

#### Estrategia de Geolocalización:
```sql
-- Si PostGIS está disponible
CREATE EXTENSION IF NOT EXISTS postgis;
ALTER TABLE perfiles_profesionales 
ADD COLUMN location_geography geography(Point, 4326);

-- Actualizar geometrías existentes
UPDATE perfiles_profesionales 
SET location_geography = ST_SetSRID(ST_MakePoint(longitud, latitud), 4326)
WHERE latitud IS NOT NULL AND longitud IS NOT NULL;

-- Índice espacial para búsquedas por radio
CREATE INDEX idx_professional_location_geography 
  ON perfiles_profesionales USING GIST (location_geography);
```

### 2.2 Backend - Controlador Optimizado

#### Estructura del SearchController Mejorado:

```javascript
// src/controllers/advancedSearchController.js
class AdvancedSearchController {
  
  /**
   * Búsqueda avanzada con filtros múltiples y ordenamiento optimizado
   * Cumple REQ-11, REQ-12, REQ-13, REQ-14, REQ-15
   */
  async advancedSearch(req, res) {
    try {
      // 1. Validación y normalización de parámetros
      const validatedFilters = await this.validateAndNormalizeFilters(req.query);
      
      // 2. Construcción de consulta optimizada
      const searchQuery = await this.buildSearchQuery(validatedFilters);
      
      // 3. Ejecutar búsqueda con caching
      const results = await this.executeOptimizedSearch(searchQuery);
      
      // 4. Enriquecimiento de resultados (REQ-15)
      const enrichedResults = await this.enrichResults(results, validatedFilters);
      
      // 5. Aplicar ordenamiento final
      const sortedResults = await this.applyAdvancedSorting(enrichedResults, validatedFilters);
      
      // 6. Paginación con metadata
      const paginatedResults = await this.paginateResults(sortedResults, validatedFilters);
      
      // 7. Respuesta con headers de caché
      res.set('Cache-Control', 'public, max-age=300'); // 5 minutos
      
      res.json({
        success: true,
        data: paginatedResults,
        meta: {
          total: paginatedResults.total,
          page: validatedFilters.page,
          limit: validatedFilters.limit,
          searchTime: results.searchTime,
          filters: validatedFilters
        }
      });
      
    } catch (error) {
      console.error('Advanced search error:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor en búsqueda avanzada'
      });
    }
  }
  
  /**
   * Validación exhaustiva de parámetros de entrada
   */
  async validateAndNormalizeFilters(filters) {
    const validated = {};
    
    // Validar búsqueda por keyword (REQ-11)
    if (filters.q && typeof filters.q === 'string') {
      validated.keyword = filters.q.trim().slice(0, 100);
    }
    
    // Validar filtros geográficos (REQ-12)
    if (filters.specialty) {
      validated.specialtyId = await this.resolveSpecialtyId(filters.specialty);
    }
    
    if (filters.city) {
      validated.city = filters.city.trim().slice(0, 50);
    }
    
    if (filters.district) {
      validated.district = filters.district.trim().slice(0, 50);
    }
    
    if (filters.radius && filters.user_lat && filters.user_lng) {
      validated.radius = Math.min(parseFloat(filters.radius), 50); // Máximo 50km
      validated.userLat = parseFloat(filters.user_lat);
      validated.userLng = parseFloat(filters.user_lng);
    }
    
    // Validar filtros de precio (REQ-13)
    if (filters.minPrice || filters.maxPrice) {
      validated.priceFilter = {
        min: filters.minPrice ? parseFloat(filters.minPrice) : 0,
        max: filters.maxPrice ? parseFloat(filters.maxPrice) : Infinity,
        type: filters.priceType || 'hora'
      };
    }
    
    // Validar ordenamiento (REQ-14)
    const validSortOptions = ['rating', 'distance', 'availability', 'price'];
    validated.sortBy = validSortOptions.includes(filters.sortBy) ? 
      filters.sortBy : 'rating';
    
    // Validar paginación
    validated.page = Math.max(1, parseInt(filters.page) || 1);
    validated.limit = Math.min(100, Math.max(1, parseInt(filters.limit) || 20));
    
    return validated;
  }
}
```

### 2.3 Frontend - Arquitectura Moderna

#### Componentes Optimizados:

```jsx
// src/components/search/AdvancedSearchBar.jsx
const AdvancedSearchBar = ({ onSearch, initialFilters }) => {
  const [filters, setFilters] = useState(initialFilters);
  const [isLoading, setIsLoading] = useState(false);
  const debounceTimer = useRef(null);
  
  // Búsqueda en tiempo real con debounce
  const handleSearch = useCallback((newFilters) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    
    debounceTimer.current = setTimeout(() => {
      setIsLoading(true);
      onSearch(newFilters);
    }, 300);
  }, [onSearch]);
  
  return (
    <div className="advanced-search-bar">
      <SearchInput 
        value={filters.keyword}
        onChange={(value) => handleSearch({...filters, keyword: value})}
        placeholder="¿Qué servicio necesitas?"
      />
      
      <SpecialtyFilter
        value={filters.specialty}
        onChange={(value) => handleSearch({...filters, specialty: value})}
      />
      
      <LocationFilter
        city={filters.city}
        district={filters.district}
        radius={filters.radius}
        onChange={(value) => handleSearch({...filters, ...value})}
      />
      
      <PriceRangeFilter
        min={filters.minPrice}
        max={filters.maxPrice}
        type={filters.priceType}
        onChange={(value) => handleSearch({...filters, ...value})}
      />
    </div>
  );
};
```

#### Hook Optimizado para Búsqueda:

```jsx
// src/hooks/useAdvancedSearch.js
const useAdvancedSearch = () => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [meta, setMeta] = useState({});
  
  const search = useCallback(async (filters) => {
    setLoading(true);
    setError(null);
    
    try {
      // Usar parámetros de URL para SEO
      const searchParams = new URLSearchParams(filters);
      const url = `/api/search?${searchParams.toString()}`;
      
      // Navegación programática para actualizar URL
      window.history.pushState({}, '', `${window.location.pathname}?${searchParams.toString()}`);
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setResults(data.data.professionals);
        setMeta(data.meta);
      } else {
        throw new Error(data.error || 'Error en la búsqueda');
      }
      
    } catch (err) {
      setError(err.message);
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  }, []);
  
  return { results, loading, error, meta, search };
};
```

---

## ⚡ 3. OPTIMIZACIONES DE RENDIMIENTO Y ESCALABILIDAD

### 3.1 Sistema de Caché Multi-Nivel

```javascript
// src/services/advancedCacheService.js
class AdvancedCacheService {
  
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
    this.memoryCache = new Map();
    this.localStorageCache = 'advancedSearchCache';
  }
  
  /**
   * Cache multinivel: Redis -> Memory -> localStorage
   */
  async get(key) {
    // Nivel 1: Redis (más rápido, persistent)
    try {
      const redisData = await this.redis.get(`search:${key}`);
      if (redisData) {
        return JSON.parse(redisData);
      }
    } catch (error) {
      console.warn('Redis cache miss:', error);
    }
    
    // Nivel 2: Memory (ultra rápido, temporal)
    const memoryData = this.memoryCache.get(key);
    if (memoryData && memoryData.expires > Date.now()) {
      return memoryData.data;
    }
    
    // Nivel 3: localStorage (persistente, tamaño limitado)
    try {
      const localData = localStorage.getItem(`${this.localStorageCache}:${key}`);
      if (localData) {
        const parsed = JSON.parse(localData);
        if (parsed.expires > Date.now()) {
          // Migrar a memory cache
          this.memoryCache.set(key, parsed);
          return parsed.data;
        }
      }
    } catch (error) {
      console.warn('localStorage cache error:', error);
    }
    
    return null;
  }
  
  /**
   * Set con TTL diferenciado por tipo de búsqueda
   */
  async set(key, data, searchType = 'basic') {
    const ttlMap = {
      basic: 300,           // 5 minutos
      filtered: 600,        // 10 minutos
      geo: 180,             // 3 minutos
      trending: 120         // 2 minutos
    };
    
    const ttl = ttlMap[searchType] || 300;
    const expires = Date.now() + (ttl * 1000);
    
    const cacheData = { data, expires, timestamp: Date.now() };
    
    // Actualizar todos los niveles
    try {
      await this.redis.setex(`search:${key}`, ttl, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Redis set error:', error);
    }
    
    this.memoryCache.set(key, cacheData);
    
    try {
      localStorage.setItem(`${this.localStorageCache}:${key}`, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('localStorage set error:', error);
    }
  }
}
```

### 3.2 Optimización de Consultas con Índices

```sql
-- Optimización para búsquedas más frecuentes
-- 1. Búsqueda por especialidad + ubicación
CREATE INDEX CONCURRENTLY idx_specialty_location_combo 
  ON professional_specialties(ps) 
  INCLUDE (professional_id, specialty_id);

-- 2. Búsqueda por precio + disponibilidad
CREATE INDEX CONCURRENTLY idx_price_availability 
  ON perfiles_profesionales(tarifa_hora, esta_disponible, calificacion_promedio DESC);

-- 3. Búsqueda por zona geográfica
CREATE INDEX CONCURRENTLY idx_coverage_zones_lookup 
  ON coverage_zones(city, state, latitude, longitude);

-- Estadísticas para optimizar planner
ANALYZE perfiles_profesionales;
ANALYZE professional_specialties;
ANALYZE coverage_zones;
```

### 3.3 Estrategia de Rate Limiting

```javascript
// src/middleware/advancedRateLimiting.js
const rateLimit = require('express-rate-limit');

const createAdvancedRateLimiter = (options = {}) => {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: (req) => {
      // Límite dinámico según tipo de usuario
      if (req.user?.rol === 'admin') return 1000;
      if (req.user?.rol === 'cliente') return 100;
      return 50; // Anónimo
    },
    message: {
      success: false,
      error: 'Demasiadas solicitudes. Intenta nuevamente en unos minutos.',
      retryAfter: Math.ceil(options.windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip cache para búsquedas críticas
    skip: (req) => {
      return req.path === '/api/search/critical' && req.user?.rol === 'admin';
    }
  });
};
```

---

## 🧪 4. SISTEMA DE PRUEBAS COMPLETO

### 4.1 Tests Unitarios del Backend

```javascript
// src/tests/unit/advancedSearch.test.js
describe('Advanced Search Controller', () => {
  
  describe('REQ-11: Búsqueda por palabra clave', () => {
    test('debe encontrar profesionales por especialidad', async () => {
      const mockFilters = { q: 'plomero' };
      const result = await searchController.advancedSearch({
        query: mockFilters
      }, mockResponse);
      
      expect(result.data.professionals).toHaveLength(2);
      expect(result.data.professionals[0].especialidad).toContain('plomero');
    });
    
    test('debe manejar búsqueda sin resultados', async () => {
      const mockFilters = { q: 'especialidad_inexistente' };
      const result = await searchController.advancedSearch({
        query: mockFilters
      }, mockResponse);
      
      expect(result.data.professionals).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });
  });
  
  describe('REQ-12: Filtros geográficos', () => {
    test('debe filtrar por ciudad', async () => {
      const mockFilters = { city: 'Buenos Aires' };
      const result = await searchController.advancedSearch({
        query: mockFilters
      }, mockResponse);
      
      result.data.professionals.forEach(prof => {
        expect(prof.zona_cobertura).toContain('Buenos Aires');
      });
    });
    
    test('debe calcular distancia correctamente', async () => {
      const mockFilters = { 
        user_lat: -34.6037, 
        user_lng: -58.3816, 
        radius: 10 
      };
      const result = await searchController.advancedSearch({
        query: mockFilters
      }, mockResponse);
      
      result.data.professionals.forEach(prof => {
        expect(prof.distancia_km).toBeLessThanOrEqual(10);
      });
    });
  });
  
  describe('REQ-13: Filtros de precio', () => {
    test('debe filtrar por rango de precios', async () => {
      const mockFilters = { 
        minPrice: 2000, 
        maxPrice: 5000 
      };
      const result = await searchController.advancedSearch({
        query: mockFilters
      }, mockResponse);
      
      result.data.professionals.forEach(prof => {
        expect(prof.tarifa_hora).toBeGreaterThanOrEqual(2000);
        expect(prof.tarifa_hora).toBeLessThanOrEqual(5000);
      });
    });
  });
});
```

### 4.2 Tests de Integración

```javascript
// src/tests/integration/advancedSearch.integration.test.js
describe('Advanced Search Integration', () => {
  
  test('flujo completo de búsqueda con todos los filtros', async () => {
    // Setup
    const searchParams = new URLSearchParams({
      q: 'electricista',
      city: 'Buenos Aires',
      minPrice: '3000',
      maxPrice: '6000',
      sortBy: 'rating',
      radius: '15',
      user_lat: '-34.6037',
      user_lng: '-58.3816'
    });
    
    // Execute
    const response = await request(app)
      .get(`/api/search?${searchParams.toString()}`)
      .set('Authorization', `Bearer ${validClientToken}`);
    
    // Assert
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.professionals).toBeInstanceOf(Array);
    expect(response.body.meta.total).toBeGreaterThan(0);
    
    // Validar ordenamiento (REQ-14)
    const professionals = response.body.data.professionals;
    for (let i = 0; i < professionals.length - 1; i++) {
      expect(professionals[i].calificacion_promedio)
        .toBeGreaterThanOrEqual(professionals[i + 1].calificacion_promedio);
    }
  });
  
  test('debe manejar errores gracefully', async () => {
    const response = await request(app)
      .get('/api/search?invalid_param=test')
      .set('Authorization', `Bearer ${validClientToken}`);
    
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('Parámetros inválidos');
  });
});
```

### 4.3 Tests de Rendimiento

```javascript
// src/tests/performance/searchPerformance.test.js
describe('Search Performance Tests', () => {
  
  test('búsqueda básica debe responder en menos de 500ms', async () => {
    const startTime = performance.now();
    
    const response = await request(app)
      .get('/api/search?q=plomero')
      .set('Authorization', `Bearer ${validClientToken}`);
    
    const endTime = performance.now();
    const responseTime = endTime - startTime;
    
    expect(response.status).toBe(200);
    expect(responseTime).toBeLessThan(500);
  });
  
  test('búsqueda compleja con filtros debe responder en menos de 1000ms', async () => {
    const searchParams = new URLSearchParams({
      q: 'electricista',
      city: 'Buenos Aires',
      minPrice: '2000',
      maxPrice: '8000',
      sortBy: 'distance',
      radius: '20',
      user_lat: '-34.6037',
      user_lng: '-58.3816'
    });
    
    const startTime = performance.now();
    
    const response = await request(app)
      .get(`/api/search?${searchParams.toString()}`)
      .set('Authorization', `Bearer ${validClientToken}`);
    
    const endTime = performance.now();
    const responseTime = endTime - startTime;
    
    expect(response.status).toBe(200);
    expect(responseTime).toBeLessThan(1000);
  });
  
  test('debe manejar 100 búsquedas concurrentes', async () => {
    const searchPromises = [];
    
    for (let i = 0; i < 100; i++) {
      searchPromises.push(
        request(app)
          .get('/api/search?q=test')
          .set('Authorization', `Bearer ${validClientToken}`)
      );
    }
    
    const startTime = performance.now();
    const responses = await Promise.all(searchPromises);
    const endTime = performance.now();
    
    const totalTime = endTime - startTime;
    const avgTime = totalTime / 100;
    
    // Todos deben ser exitosos
    responses.forEach(response => {
      expect(response.status).toBe(200);
    });
    
    // Tiempo promedio aceptable
    expect(avgTime).toBeLessThan(1000);
  });
});
```

---

## 🔐 5. SEGURIDAD Y VALIDACIÓN

### 5.1 Sanitización de Entrada

```javascript
// src/middleware/inputSanitization.js
const DOMPurify = require('isomorphic-dompurify');

const sanitizeSearchInput = (req, res, next) => {
  const sanitizedQuery = {};
  
  // Sanitizar palabra clave
  if (req.query.q) {
    sanitizedQuery.q = DOMPurify.sanitize(req.query.q, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: []
    }).trim().slice(0, 100);
  }
  
  // Sanitizar filtros geográficos
  if (req.query.city) {
    sanitizedQuery.city = DOMPurify.sanitize(req.query.city, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: []
    }).trim().slice(0, 50);
  }
  
  // Validar coordenadas GPS
  if (req.query.user_lat) {
    const lat = parseFloat(req.query.user_lat);
    if (lat >= -90 && lat <= 90) {
      sanitizedQuery.user_lat = lat;
    }
  }
  
  if (req.query.user_lng) {
    const lng = parseFloat(req.query.user_lng);
    if (lng >= -180 && lng <= 180) {
      sanitizedQuery.user_lng = lng;
    }
  }
  
  req.query = { ...req.query, ...sanitizedQuery };
  next();
};
```

### 5.2 Validación de API Keys para Servicios Externos

```javascript
// src/middleware/externalServiceValidation.js
const validateGoogleMapsKey = (req, res, next) => {
  if (req.query.use_google_maps === 'true') {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey || apiKey.length < 20) {
      return res.status(503).json({
        success: false,
        error: 'Servicio de mapas no disponible',
        fallback: 'Se utilizará cálculo de distancia básico'
      });
    }
  }
  next();
};
```

---

## 📊 6. MÉTRICAS Y MONITOREO

### 6.1 Métricas de Rendimiento

```javascript
// src/services/metricsService.js
class SearchMetricsService {
  
  static recordSearch(query, responseTime, resultCount) {
    const metric = {
      query_type: this.categorizeQuery(query),
      response_time: responseTime,
      result_count: resultCount,
      timestamp: Date.now(),
      user_agent: this.getUserAgent(query),
      cache_hit: query.from_cache || false
    };
    
    // Enviar a sistema de métricas
    this.sendToMetrics(metric);
  }
  
  static categorizeQuery(query) {
    if (query.q && query.city && query.radius) return 'comprehensive';
    if (query.q && query.city) return 'location_search';
    if (query.q) return 'keyword_only';
    return 'empty_search';
  }
}
```

### 6.2 Dashboard de Monitoreo

```javascript
// src/routes/monitoringRoutes.js
router.get('/search-metrics', authMiddleware, async (req, res) => {
  const { period = '24h' } = req.query;
  
  const metrics = await SearchMetricsService.getMetrics(period);
  
  res.json({
    success: true,
    data: {
      total_searches: metrics.total,
      avg_response_time: metrics.avgResponseTime,
      cache_hit_rate: metrics.cacheHitRate,
      top_searches: metrics.topQueries,
      error_rate: metrics.errorRate
    }
  });
});
```

---

## 🚀 7. PLAN DE IMPLEMENTACIÓN

### 7.1 Fase 1: Backend Core (Semana 1-2)
- [ ] Implementar AdvancedSearchController
- [ ] Optimizar base de datos con índices
- [ ] Sistema de caché multinivel
- [ ] Tests unitarios del backend

### 7.2 Fase 2: Frontend Components (Semana 3)
- [ ] AdvancedSearchBar component
- [ ] Hook useAdvancedSearch optimizado
- [ ] Filtros en tiempo real
- [ ] Tests de componentes

### 7.3 Fase 3: Optimización y Seguridad (Semana 4)
- [ ] Rate limiting avanzado
- [ ] Sanitización de entrada
- [ ] Métricas y monitoreo
- [ ] Tests de integración

### 7.4 Fase 4: Deploy y Monitoreo (Semana 5)
- [ ] Deploy gradual con feature flags
- [ ] Monitoreo en producción
- [ ] Optimización basada en métricas reales
- [ ] Documentación final

---

## 📈 8. MÉTRICAS DE ÉXITO

### 8.1 KPIs Técnicos
- Tiempo de respuesta promedio: < 500ms
- Tasa de caché hit: > 80%
- Uptime del servicio: > 99.5%
- Error rate: < 0.1%

### 8.2 KPIs de Usuario
- Búsquedas exitosas: > 95%
- Satisfacción con resultados: > 4.5/5
- Tiempo hasta primer resultado: < 2s
- Conversión a contacto: > 15%

---

## 💡 9. CONCLUSIONES Y RECOMENDACIONES

### 9.1 Fortalezas del Sistema Actual
- Base sólida con schema bien diseñado
- Funcionalidad básica implementada
- Arquitectura escalable en PostgreSQL
- Frontend React con hooks optimizados

### 9.2 Áreas de Mejora Críticas
- Optimización de consultas con índices compuestos
- Sistema de caché multinivel para mejor performance
- Validación y sanitización exhaustiva de entrada
- Monitoreo y métricas en tiempo real

### 9.3 Recomendaciones Estratégicas
1. **Priorizar el rendimiento:** Implementar caché y índices antes de nuevas features
2. **Adoptar monitoreo proactivo:** Métricas en tiempo real para detectar problemas
3. **Inversión en testing:** Suite completa de tests para garantizar calidad
4. **Documentación técnica:** APIs documentadas con OpenAPI/Swagger

---

**Documento preparado por:** Equipo de Ingeniería Changánet  
**Próxima revisión:** 1 de diciembre de 2025  
**Estado:** Pendiente de aprobación