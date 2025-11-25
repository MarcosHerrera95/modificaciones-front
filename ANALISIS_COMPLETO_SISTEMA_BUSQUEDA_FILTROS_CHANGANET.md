# ANÁLISIS COMPLETO DEL SISTEMA DE BÚSQUEDA Y FILTROS - CHANGÁNET

**Fecha:** 25 de noviembre de 2025  
**Versión:** 1.0  
**Proyecto:** Changánet - Plataforma Digital de Servicios Profesionales  
**Alcance:** Sistema de Búsqueda y Filtros (REQ-11 a REQ-15)

---

## 📋 RESUMEN EJECUTIVO

Este documento presenta el análisis funcional profundo y la arquitectura técnica detallada para implementar correctamente el Sistema de Búsqueda y Filtros de Changánet, cumpliendo estrictamente con los requerimientos REQ-11 a REQ-15 del PRD.

### Estado Actual vs. Requerimientos
- ✅ **REQ-11:** Búsqueda por palabra clave - **IMPLEMENTADO**
- ⚠️ **REQ-12:** Filtros por especialidad, ciudad, barrio y radio - **IMPLEMENTACIÓN BÁSICA**
- ⚠️ **REQ-13:** Filtrar por rango de precio - **IMPLEMENTACIÓN BÁSICA**
- ⚠️ **REQ-14:** Ordenar por calificación, cercanía y disponibilidad - **IMPLEMENTACIÓN BÁSICA**
- ✅ **REQ-15:** Tarjeta resumen con foto, nombre, calificación, distancia - **IMPLEMENTADO**

---

## 🎯 1. ANÁLISIS FUNCIONAL PROFUNDO

### 1.1 Flujo Completo del Sistema de Búsqueda

```
1. INPUT DEL USUARIO
   ├── Barra de búsqueda (especialidad/keyword)
   ├── Filtros geográficos (ciudad/barrio/radio)
   ├── Filtros de precio (rango mínimo/máximo)
   └── Configuración de ordenamiento

2. PROCESAMIENTO EN BACKEND
   ├── Validación y sanitización de parámetros
   ├── Aplicación de filtros combinados
   ├── Cálculo de distancias geográficas
   ├── Ordenamiento según criterios
   └── Paginación optimizada

3. RESPUESTA Y RENDERIZADO
   ├── Tarjetas de profesionales
   ├── Información de distancia calculada
   ├── Metadatos de búsqueda
   └── Opciones de interacción
```

### 1.2 Análisis de Cumplimiento REQ-11 a REQ-15

#### REQ-11: Búsqueda por Palabra Clave ✅ **IMPLEMENTADO**
**Estado Actual:**
- Búsqueda por especialidad principal implementada
- Compatible con búsqueda en campo `especialidad`
- Búsqueda parcial (contains) funcional

**Mejoras Propuestas:**
```javascript
// Búsqueda semántica mejorada
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

#### REQ-12: Filtros por Especialidad, Ciudad, Barrio y Radio ⚠️ **MEJORAS REQUERIDAS**
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

  return where;
};
```

#### REQ-14: Ordenar por Calificación, Cercanía y Disponibilidad ⚠️ **OPTIMIZACIÓN REQUERIDA**
**Estado Actual:**
- Ordenamiento básico implementado
- Cálculo de distancia funcional
- Faltan índices para optimización

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

### 2.2 Backend - Arquitectura Optimizada

#### Controlador Mejorado:

```javascript
// src/controllers/advancedSearchController.js
class AdvancedSearchController {

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
      res.set('Cache-Control', 'public, max-age=300');

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
}
```

### 2.3 Frontend - Arquitectura Moderna

#### Componentes Optimizados:

```jsx
// src/components/search/AdvancedSearchBar.jsx
const AdvancedSearchBar = ({
  initialFilters = {},
  onSearch,
  className = '',
  showAdvancedFilters = true,
  placeholder = "¿Qué servicio necesitas?"
}) => {
  const navigate = useNavigate();

  const [keyword, setKeyword] = useState(initialFilters.keyword || '');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Búsqueda en tiempo real con debounce
  const handleSearch = useCallback((searchKeyword = keyword) => {
    if (!searchKeyword.trim()) return;

    setIsLoading(true);
    setShowSuggestions(false);

    const filters = {
      q: searchKeyword.trim(),
      ...initialFilters
    };

    // Actualizar URL con parámetros de búsqueda
    const searchParams = new URLSearchParams(filters);
    navigate(`/profesionales?${searchParams.toString()}`);

    if (onSearch) {
      onSearch(filters);
    }

    setIsLoading(false);
  }, [keyword, initialFilters, navigate, onSearch]);

  return (
    <div className={`advanced-search-bar ${className}`}>
      {/* Implementación completa del componente */}
    </div>
  );
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
          this.memoryCache.set(key, parsed);
          return parsed.data;
        }
      }
    } catch (error) {
      console.warn('localStorage cache error:', error);
    }

    return null;
  }
}
```

### 3.2 Optimización de Consultas con Índices

```sql
-- Optimización para búsquedas más frecuentes
CREATE INDEX CONCURRENTLY idx_specialty_location_combo
  ON professional_specialties(ps)
  INCLUDE (professional_id, specialty_id);

CREATE INDEX CONCURRENTLY idx_price_availability
  ON perfiles_profesionales(tarifa_hora, esta_disponible, calificacion_promedio DESC);

CREATE INDEX CONCURRENTLY idx_coverage_zones_lookup
  ON coverage_zones(city, state, latitude, longitude);
```

### 3.3 Estrategia de Rate Limiting

```javascript
// src/middleware/advancedRateLimiting.js
const rateLimit = require('express-rate-limit');

const createAdvancedRateLimiter = (options = {}) => {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: (req) => {
      if (req.user?.rol === 'admin') return 1000;
      if (req.user?.rol === 'cliente') return 100;
      return 50;
    },
    message: {
      success: false,
      error: 'Demasiadas solicitudes. Intenta nuevamente en unos minutos.',
      retryAfter: Math.ceil(options.windowMs / 1000)
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
  });
});
```

### 4.2 Tests de Integración

```javascript
// src/tests/integration/advancedSearch.integration.test.js
describe('Advanced Search Integration', () => {

  test('flujo completo de búsqueda con todos los filtros', async () => {
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

    const response = await request(app)
      .get(`/api/search?${searchParams.toString()}`)
      .set('Authorization', `Bearer ${validClientToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.professionals).toBeInstanceOf(Array);
    expect(response.body.meta.total).toBeGreaterThan(0);
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

  if (req.query.q) {
    sanitizedQuery.q = DOMPurify.sanitize(req.query.q, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: []
    }).trim().slice(0, 100);
  }

  if (req.query.city) {
    sanitizedQuery.city = DOMPurify.sanitize(req.query.city, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: []
    }).trim().slice(0, 50);
  }

  req.query = { ...req.query, ...sanitizedQuery };
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