// src/services/metricsService.js - Servicio de métricas para Prometheus
const promClient = require('prom-client');

/**
 * Inicializa el registro de métricas de Prometheus
 * Debe ser llamado al inicio de la aplicación
 */
function initializeMetrics() {
  // Métricas por defecto del sistema
  const collectDefaultMetrics = promClient.collectDefaultMetrics;
  collectDefaultMetrics({ prefix: 'changanet_' });

  console.log('✅ Métricas por defecto de Prometheus inicializadas');
}

/**
 * Métricas personalizadas para Changánet
 */

// Contador de servicios
const servicesTotal = new promClient.Counter({
  name: 'changanet_services_total',
  help: 'Total de servicios registrados en Changánet',
  labelNames: ['tipo', 'estado', 'impacto']
});

// Contador de usuarios
const usersTotal = new promClient.Counter({
  name: 'changanet_users_total',
  help: 'Total de usuarios registrados en Changánet',
  labelNames: ['rol', 'origen']
});

// Contador de SMS
const smsTotal = new promClient.Counter({
  name: 'changanet_sms_total',
  help: 'Total de SMS enviados por Changánet',
  labelNames: ['estado', 'tipo']
});

// Histograma de duración de solicitudes HTTP
const httpRequestDuration = new promClient.Histogram({
  name: 'changanet_http_request_duration_seconds',
  help: 'Duración de las solicitudes HTTP en segundos',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10] // buckets en segundos
});

// Contador de solicitudes HTTP
const httpRequestsTotal = new promClient.Counter({
  name: 'changanet_http_requests_total',
  help: 'Total de solicitudes HTTP por método y código de estado',
  labelNames: ['method', 'route', 'status_code']
});

// Gauge de usuarios activos
const activeUsers = new promClient.Gauge({
  name: 'changanet_active_users',
  help: 'Número de usuarios activos actualmente',
  labelNames: ['rol']
});

// Contador de errores de negocio
const businessErrorsTotal = new promClient.Counter({
  name: 'changanet_business_errors_total',
  help: 'Total de errores de negocio en Changánet',
  labelNames: ['tipo', 'componente']
});

// Métricas de triple impacto
const tripleImpactActivities = new promClient.Counter({
  name: 'changanet_triple_impact_activities_total',
  help: 'Total de actividades con triple impacto',
  labelNames: ['tipo_impacto', 'categoria']
});

// Métricas de negocio específicas
const quotesRequested = new promClient.Counter({
  name: 'changanet_quotes_requested_total',
  help: 'Total de cotizaciones solicitadas',
  labelNames: ['categoria_servicio', 'estado']
});

const servicesCompleted = new promClient.Counter({
  name: 'changanet_services_completed_total',
  help: 'Total de servicios completados exitosamente',
  labelNames: ['categoria', 'ubicacion', 'calificacion_promedio']
});

const userEngagement = new promClient.Histogram({
  name: 'changanet_user_engagement_duration_seconds',
  help: 'Duración de engagement de usuarios en segundos',
  labelNames: ['tipo_usuario', 'accion'],
  buckets: [30, 60, 300, 600, 1800, 3600] // 30s, 1min, 5min, 10min, 30min, 1hora
});

const conversionRate = new promClient.Gauge({
  name: 'changanet_conversion_rate',
  help: 'Tasa de conversión de visitantes a usuarios registrados',
  labelNames: ['fuente', 'tipo_conversion']
});

const revenueTotal = new promClient.Counter({
  name: 'changanet_revenue_total',
  help: 'Ingresos totales generados por la plataforma',
  labelNames: ['tipo_ingreso', 'metodo_pago']
});

/**
 * Funciones para incrementar métricas
 */

// Servicios
function incrementServiceScheduled(tipo = 'general', impacto = 'economic') {
  servicesTotal.inc({ tipo, estado: 'agendado', impacto });
}

function incrementServiceCompleted(tipo = 'general', impacto = 'economic') {
  servicesTotal.inc({ tipo, estado: 'completado', impacto });
}

// Usuarios
function incrementUserRegistered(rol = 'cliente', origen = 'email') {
  usersTotal.inc({ rol, origen });
}

// SMS
function incrementSmsSent(estado = 'exitoso', tipo = 'notificacion') {
  smsTotal.inc({ estado, tipo });
}

// Errores de negocio
function incrementBusinessError(tipo = 'general', componente = 'unknown') {
  businessErrorsTotal.inc({ tipo, componente });
}

// Triple impacto
function incrementTripleImpactActivity(tipoImpacto = 'social', categoria = 'servicio') {
  tripleImpactActivities.inc({ tipo_impacto: tipoImpacto, categoria });
}

// Cotizaciones
function incrementQuoteRequested(categoriaServicio = 'general', estado = 'pendiente') {
  quotesRequested.inc({ categoria_servicio: categoriaServicio, estado });
}

// Servicios completados (función específica)
function incrementServiceCompletedDetailed(categoria = 'general', ubicacion = 'desconocida', calificacion = '0') {
  servicesCompleted.inc({ categoria, ubicacion, calificacion_promedio: calificacion });
}

// Engagement de usuario
function recordUserEngagement(tipoUsuario = 'cliente', accion = 'navegacion', duracionSegundos) {
  userEngagement.observe({ tipo_usuario: tipoUsuario, accion }, duracionSegundos);
}

// Tasa de conversión
function setConversionRate(fuente = 'directo', tipoConversion = 'registro', tasa) {
  conversionRate.set({ fuente, tipo_conversion: tipoConversion }, tasa);
}

// Ingresos
function incrementRevenue(tipoIngreso = 'comision', metodoPago = 'efectivo', monto) {
  revenueTotal.inc({ tipo_ingreso: tipoIngreso, metodo_pago: metodoPago }, monto);
}

// Usuarios activos
function setActiveUsers(count, rol = 'total') {
  activeUsers.set({ rol }, count);
}

function incrementActiveUsers(rol = 'cliente') {
  activeUsers.inc({ rol });
}

function decrementActiveUsers(rol = 'cliente') {
  activeUsers.dec({ rol });
}

/**
 * Middleware para medir duración de solicitudes HTTP
 */
function createHttpMetricsMiddleware() {
  return (req, res, next) => {
    const start = Date.now();

    // Cuando la respuesta termine
    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000; // en segundos
      const method = req.method;
      const route = req.route ? req.route.path : req.path;
      const statusCode = res.statusCode.toString();

      // Registrar métricas
      httpRequestDuration.observe({ method, route, status_code: statusCode }, duration);
      httpRequestsTotal.inc({ method, route, status_code: statusCode });
    });

    next();
  };
}

/**
 * Obtener todas las métricas en formato Prometheus
 */
function getMetrics() {
  return promClient.register.metrics();
}

/**
 * Obtener registro de métricas para depuración
 */
function getRegistry() {
  return promClient.register;
}

/**
 * Limpiar todas las métricas (útil para pruebas)
 */
function clearMetrics() {
  promClient.register.clear();
}

module.exports = {
  initializeMetrics,
  createHttpMetricsMiddleware,
  getMetrics,
  getRegistry,
  clearMetrics,

  // Funciones de métricas
  incrementServiceScheduled,
  incrementServiceCompleted,
  incrementUserRegistered,
  incrementSmsSent,
  incrementBusinessError,
  incrementTripleImpactActivity,
  incrementQuoteRequested,
  incrementServiceCompletedDetailed,
  recordUserEngagement,
  setConversionRate,
  incrementRevenue,
  setActiveUsers,
  incrementActiveUsers,
  decrementActiveUsers,

  // Objetos de métricas (para acceso directo si es necesario)
  servicesTotal,
  usersTotal,
  smsTotal,
  httpRequestDuration,
  httpRequestsTotal,
  activeUsers,
  businessErrorsTotal,
  tripleImpactActivities,
  quotesRequested,
  servicesCompleted,
  userEngagement,
  conversionRate,
  revenueTotal
};