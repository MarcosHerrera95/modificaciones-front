// src/routes/advancedAvailabilityRoutes.js
// Rutas para el sistema avanzado de disponibilidad y agenda
// Implementa sección 7.6 del PRD: Gestión de Disponibilidad y Agenda
//
// FUNCIONALIDADES IMPLEMENTADAS:
// - Gestión completa de disponibilidad con recurrencia
// - Sistema de citas/agendamientos
// - Bloqueos temporales
// - Sincronización con calendarios externos
// - Validaciones de conflictos y permisos
//
// AUTENTICACIÓN:
// - Todas las rutas requieren autenticación JWT
// - Validación de roles (cliente/profesional/admin)
//
// ENDPOINTS DISPONIBLES:
// POST /api/advanced-availability - Crear slot disponible (profesional)
// GET /api/advanced-availability/:professionalId - Ver disponibilidad agregada
// PUT /api/advanced-availability/:slotId - Actualizar slot (profesional)
// DELETE /api/advanced-availability/:slotId - Eliminar slot (profesional)
//
// POST /api/appointments - Crear cita (cliente)
// GET /api/appointments - Obtener citas del usuario
// PUT /api/appointments/:appointmentId/confirm - Confirmar cita (profesional)
// POST /api/appointments/:appointmentId/cancel - Cancelar cita
//
// POST /api/blocked-slots - Crear bloqueo temporal (profesional)
// POST /api/calendar/connect - Conectar calendario externo (profesional)

const express = require('express');
const {
  createAvailability,
  getAvailability,
  updateAvailability,
  deleteAvailability,
  createAppointment,
  getAppointments,
  confirmAppointment,
  cancelAppointment,
  createBlockedSlot,
  generateCalendarAuthUrl,
  processCalendarCallback,
  syncCalendar,
  getCalendarSyncStatus,
  disconnectCalendar,
  exportICal,
  importICal
} = require('../controllers/advancedAvailabilityController');
const { authenticateToken } = require('../middleware/authenticate');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// ==================================================
// ENDPOINTS DE DISPONIBILIDAD
// ==================================================

// Crear slot de disponibilidad (profesional)
router.post('/', createAvailability);

// Obtener disponibilidad agregada (cliente/profesional)
router.get('/:professionalId', getAvailability);

// Actualizar slot de disponibilidad (profesional)
router.put('/:slotId', updateAvailability);

// Eliminar slot de disponibilidad (profesional)
router.delete('/:slotId', deleteAvailability);

// ==================================================
// ENDPOINTS DE CITAS/AGENDAMIENTOS
// ==================================================

// Crear cita/agendamiento (cliente)
router.post('/appointments', createAppointment);

// Obtener citas del usuario (cliente/profesional/admin)
router.get('/appointments', getAppointments);

// Confirmar cita (profesional/admin)
router.put('/appointments/:appointmentId/confirm', confirmAppointment);

// Cancelar cita (cliente/profesional/admin)
router.post('/appointments/:appointmentId/cancel', cancelAppointment);

// ==================================================
// ENDPOINTS DE BLOQUEOS TEMPORALES
// ==================================================

// Crear bloqueo temporal (profesional)
router.post('/blocked-slots', createBlockedSlot);

// ==================================================
// ENDPOINTS DE SINCRONIZACIÓN DE CALENDARIOS
// ==================================================

// Generar URL de autorización para Google Calendar
router.get('/calendar/auth-url', generateCalendarAuthUrl);

// Procesar callback OAuth (público para Google)
router.get('/calendar/callback', processCalendarCallback);

// Sincronizar calendario manualmente
router.post('/calendar/sync/:provider?', syncCalendar);

// Obtener estado de sincronización
router.get('/calendar/status/:provider?', getCalendarSyncStatus);

// Desconectar calendario externo
router.delete('/calendar/disconnect/:provider?', disconnectCalendar);

// Exportar disponibilidad como iCal
router.get('/calendar/export-ical', exportICal);

// Importar desde archivo iCal
router.post('/calendar/import-ical', importICal);

module.exports = router;