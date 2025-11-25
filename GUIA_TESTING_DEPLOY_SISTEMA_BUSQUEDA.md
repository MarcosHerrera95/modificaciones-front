# GUÍA DE TESTING Y DEPLOY - SISTEMA DE BÚSQUEDA AVANZADA CHANGÁNET

**Fecha:** 25 de noviembre de 2025  
**Versión:** 1.0  
**Proyecto:** Sistema de Búsqueda y Filtros Avanzado

---

## 🧪 TESTING DEL SISTEMA

### 1. Tests de Backend

#### 1.1 Tests de Integración
```bash
# Ejecutar tests de búsqueda avanzada
cd changanet/changanet-backend
npm test -- --testPathPattern=advancedSearch
```

#### 1.2 Tests de Rendimiento
```javascript
// test/performance/searchPerformance.test.js
describe('Search Performance Tests', () => {
  
  test('búsqueda básica debe responder en menos de 500ms', async () => {
    const startTime = performance.now();
    
    const response = await request(app)
      .get('/api/advanced-search?q=plomero')
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
      .get(`/api/advanced-search?${searchParams.toString()}`)
      .set('Authorization', `Bearer ${validClientToken}`);
    
    const endTime = performance.now();
    const responseTime = endTime - startTime;
    
    expect(response.status).toBe(200);
    expect(responseTime).toBeLessThan(1000);
  });
});
```

#### 1.3 Tests de Funcionalidad
```bash
# Test de búsqueda básica
curl -X GET "http://localhost:3004/api/advanced-search?q=plomero" \
  -H "Accept: application/json"

# Test de búsqueda con filtros
curl -X GET "http://localhost:3004/api/advanced-search?q=electricista&city=Buenos Aires&minPrice=3000&maxPrice=6000" \
  -H "Accept: application/json"

# Test de sugerencias
curl -X GET "http://localhost:3004/api/search/suggestions?q=plom" \
  -H "Accept: application/json"

# Test de métricas (admin only)
curl -X GET "http://localhost:3004/api/metrics/search" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Accept: application/json"
```

### 2. Tests de Frontend

#### 2.1 Test de Componentes
```bash
cd changanet/changanet-frontend
npm test -- --testPathPattern=AdvancedSearch
```

#### 2.2 Test Manual de UI

**Página de Búsqueda Avanzada:**
1. Navegar a `/profesionales-advanced`
2. Verificar que se muestra el mensaje "Sistema de Búsqueda Avanzada Activo"
3. Probar búsqueda por palabra clave
4. Probar filtros de especialidad, ciudad, barrio
5. Probar filtros de precio (mínimo y máximo)
6. Probar ordenamiento por calificación
7. Verificar scroll infinito
8. Probar selección múltiple de profesionales

**Barra de Búsqueda Avanzada:**
1. Verificar que se muestran sugerencias
2. Probar autocompletado
3. Verificar navegación a página de resultados
4. Probar teclado (Enter para buscar)

**Filtros Avanzados:**
1. Verificar contador de filtros activos
2. Probar limpieza de filtros individuales
3. Probar botón "Limpiar todo"
4. Verificar resumen de filtros activos

---

## 🚀 DEPLOY Y CONFIGURACIÓN

### 1. Configuración de Base de Datos

#### Aplicar optimizaciones:
```bash
# Conectar a PostgreSQL
psql -d changanet -U your_user

# Aplicar script de optimización
\i sql/optimize_search_database.sql

# Verificar índices creados
SELECT * FROM get_index_usage_stats();
```

#### Verificar configuración:
```sql
-- Verificar índices creados
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('perfiles_profesionales', 'specialties', 'professional_specialties')
ORDER BY tablename, indexname;

-- Verificar vista materializada
SELECT 
    COUNT(*) as total_professionals,
    COUNT(CASE WHEN calificacion_calculada > 0 THEN 1 END) as with_ratings,
    AVG(tarifa_hora) as avg_hourly_rate
FROM mv_professional_stats;
```

### 2. Configuración de Variables de Entorno

#### Backend (.env):
```bash
# Base de datos
DATABASE_URL=postgresql://user:password@localhost:5432/changáet

# Redis para caché
REDIS_URL=redis://localhost:6379

# Configuración de aplicación
NODE_ENV=production
PORT=3004

# APIs externas
GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Servicios externos (opcional)
SENDGRID_API_KEY=your_sendgrid_key
TWILIO_ACCOUNT_SID=your_twilio_sid
SENTRY_DSN=your_sentry_dsn
```

#### Frontend (.env):
```bash
VITE_BACKEND_URL=https://api.tudominio.com
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

### 3. Build y Deploy

#### Backend:
```bash
cd changanet/changanet-backend

# Instalar dependencias
npm install --production

# Ejecutar migraciones
npx prisma migrate deploy

# Build de producción
npm run build

# Iniciar servidor
npm start
```

#### Frontend:
```bash
cd changanet/changanet-frontend

# Instalar dependencias
npm install

# Build de producción
npm run build

# Deploy a CDN (ejemplo con Vercel)
vercel --prod
```

### 4. Health Checks

#### Verificar servicios:
```bash
# Health check general
curl https://api.tudominio.com/health

# Health check de búsqueda
curl https://api.tudominio.com/api/search/health

# Test de búsqueda en producción
curl "https://api.tudominio.com/api/advanced-search?q=plomero"
```

#### Monitoreo:
```bash
# Verificar métricas (admin)
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api.tudominio.com/api/metrics/search

# Verificar índices de rendimiento
curl https://api.tudominio.com/api/docs
```

---

## 🔧 TROUBLESHOOTING

### Problemas Comunes

#### 1. Error de Conexión a Base de Datos
```bash
# Verificar conexión
psql -h localhost -p 5432 -U your_user -d changanet

# Verificar índices
SELECT * FROM pg_indexes WHERE tablename = 'perfiles_profesionales';
```

#### 2. Error de Redis
```bash
# Verificar Redis
redis-cli ping

# Verificar logs
journalctl -u redis-server
```

#### 3. Frontend no encuentra Backend
- Verificar `VITE_BACKEND_URL` en variables de entorno
- Verificar CORS en servidor backend
- Verificar configuración de proxy en desarrollo

#### 4. Rendimiento Lento
- Verificar que los índices se crearon correctamente
- Ejecutar `ANALYZE` en tablas principales
- Verificar configuración de PostgreSQL

### Logs de Debugging

#### Backend:
```javascript
// En desarrollo, activar logs detallados
process.env.LOG_LEVEL = 'debug';

// Verificar logs de búsqueda
grep "advanced-search" logs/app.log
```

#### Frontend:
```javascript
// En browser console
localStorage.setItem('debug_search', 'true');

// Verificar estado de búsqueda
console.log(window.searchDebug);
```

---

## 📊 MÉTRICAS Y MONITOREO

### KPIs Técnicos a Monitorear

1. **Tiempo de Respuesta**: < 500ms promedio
2. **Tasa de Cache Hit**: > 70%
3. **Uptime**: > 99.5%
4. **Error Rate**: < 0.5%

### Queries de Monitoreo

```sql
-- Verificar rendimiento de índices
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as usage_count,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Verificar tamaño de tablas
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Verificar performance de consultas recientes
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
WHERE query LIKE '%search%' OR query LIKE '%professional%'
ORDER BY total_time DESC 
LIMIT 10;
```

### Alertas Recomendadas

1. **Tiempo de respuesta > 1000ms**
2. **Error rate > 1%**
3. **Cache hit rate < 50%**
4. **CPU usage > 80%**
5. **Memory usage > 85%**

---

## 📋 CHECKLIST DE DEPLOY

### Pre-Deploy:
- [ ] Ejecutar todos los tests
- [ ] Verificar que índices de BD se crearon
- [ ] Configurar variables de entorno
- [ ] Verificar conexión a Redis
- [ ] Probar en staging

### Durante Deploy:
- [ ] Aplicar migraciones de BD
- [ ] Configurar variables de producción
- [ ] Deploy backend
- [ ] Build y deploy frontend
- [ ] Verificar health checks

### Post-Deploy:
- [ ] Verificar búsqueda básica
- [ ] Verificar filtros avanzados
- [ ] Verificar métricas
- [ ] Monitorear performance
- [ ] Documentar cualquier issue

### Rollback:
```bash
# Rollback de base de datos (si es necesario)
psql -d changanet -c "DROP INDEX IF EXISTS idx_professional_search_composite;"
psql -d changanet -c "DROP MATERIALIZED VIEW IF EXISTS mv_professional_stats CASCADE;"

# Rollback de aplicación
git revert <commit_hash>
npm run build
pm2 restart all
```

---

## 📞 SOPORTE

### Contactos de Emergencia:
- **DevOps**: [email@company.com]
- **Backend**: [email@company.com]
- **Frontend**: [email@company.com]

### Documentación Adicional:
- [Documentación API](https://api.tudominio.com/api/docs)
- [Dashboard de Métricas](https://dashboard.tudominio.com/metrics)
- [Logs en Tiempo Real](https://logs.tudominio.com)

---

**✅ Sistema de Búsqueda Avanzada listo para producción**  
**Fecha de implementación:** 25 de noviembre de 2025  
**Estado:** Completado exitosamente