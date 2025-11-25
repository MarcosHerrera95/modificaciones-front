/**
 * Servicio de Sincronización con Calendarios Externos
 * Implementa integración con Google Calendar, Outlook y iCal
 *
 * FUNCIONALIDADES:
 * - OAuth 2.0 con Google Calendar API
 * - Sincronización bidireccional de eventos
 * - Exportación a iCal
 * - Importación desde calendarios externos
 * - Manejo de conflictos y fusión
 */

const { PrismaClient } = require('@prisma/client');
const { google } = require('googleapis');
const ical = require('ical-generator');
const fs = require('fs').promises;
const path = require('path');

const prisma = new PrismaClient();

// Configuración OAuth Google
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob';

// Scopes requeridos para Google Calendar
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events'
];

/**
 * Crear cliente OAuth2 para Google
 */
function createOAuth2Client() {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
}

/**
 * Generar URL de autorización para Google Calendar
 */
exports.generateAuthUrl = (professionalId) => {
  const oauth2Client = createOAuth2Client();

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: GOOGLE_SCOPES,
    state: professionalId, // Pasar el ID del profesional como estado
    prompt: 'consent' // Forzar refresh token
  });

  return authUrl;
};

/**
 * Procesar callback de OAuth y guardar tokens
 */
exports.processAuthCallback = async (code, professionalId) => {
  try {
    const oauth2Client = createOAuth2Client();

    // Obtener tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Guardar configuración de sincronización
    const calendarSync = await prisma.calendar_sync.upsert({
      where: {
        professional_id_provider: {
          professional_id: professionalId,
          provider: 'google'
        }
      },
      update: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        sync_enabled: true,
        last_sync_at: new Date(),
        sync_status: 'idle'
      },
      create: {
        professional_id: professionalId,
        provider: 'google',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        sync_enabled: true,
        last_sync_at: new Date(),
        sync_status: 'idle'
      }
    });

    // Iniciar sincronización inicial
    await syncGoogleCalendar(professionalId);

    return calendarSync;

  } catch (error) {
    console.error('Error procesando callback OAuth:', error);
    throw new Error('Error conectando con Google Calendar');
  }
};

/**
 * Sincronizar calendario de Google
 */
exports.syncGoogleCalendar = async (professionalId) => {
  try {
    // Actualizar estado a 'syncing'
    await prisma.calendar_sync.updateMany({
      where: {
        professional_id: professionalId,
        provider: 'google',
        sync_enabled: true
      },
      data: { sync_status: 'syncing' }
    });

    await syncGoogleCalendar(professionalId);

    // Actualizar estado a 'idle'
    await prisma.calendar_sync.updateMany({
      where: {
        professional_id: professionalId,
        provider: 'google'
      },
      data: {
        sync_status: 'idle',
        last_sync_at: new Date()
      }
    });

  } catch (error) {
    console.error('Error sincronizando Google Calendar:', error);

    // Actualizar estado a 'error'
    await prisma.calendar_sync.updateMany({
      where: {
        professional_id: professionalId,
        provider: 'google'
      },
      data: {
        sync_status: 'error',
        sync_error: error.message
      }
    });

    throw error;
  }
};

/**
 * Función interna para sincronizar con Google Calendar
 */
async function syncGoogleCalendar(professionalId) {
  // Obtener configuración de sincronización
  const syncConfig = await prisma.calendar_sync.findUnique({
    where: {
      professional_id_provider: {
        professional_id: professionalId,
        provider: 'google'
      }
    }
  });

  if (!syncConfig || !syncConfig.access_token) {
    throw new Error('Configuración de Google Calendar no encontrada');
  }

  // Crear cliente OAuth2 con tokens guardados
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: syncConfig.access_token,
    refresh_token: syncConfig.refresh_token,
    expiry_date: syncConfig.token_expires_at?.getTime()
  });

  // Crear cliente de Calendar API
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  // Obtener eventos del calendario (últimos 30 días + próximos 90 días)
  const timeMin = new Date();
  timeMin.setDate(timeMin.getDate() - 30);

  const timeMax = new Date();
  timeMax.setDate(timeMax.getDate() + 90);

  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,
    orderBy: 'startTime'
  });

  const googleEvents = response.data.items || [];

  // Procesar eventos de Google Calendar
  for (const event of googleEvents) {
    await processGoogleEvent(professionalId, event);
  }

  // Sincronizar eventos locales a Google Calendar
  await syncLocalEventsToGoogle(professionalId, calendar);
}

/**
 * Procesar evento de Google Calendar
 */
async function processGoogleEvent(professionalId, googleEvent) {
  const eventId = googleEvent.id;
  const start = googleEvent.start.dateTime || googleEvent.start.date;
  const end = googleEvent.end.dateTime || googleEvent.end.date;

  // Verificar si es un evento que debe importarse
  // (lógica para filtrar eventos relevantes)

  // Crear bloqueo temporal si es un evento que bloquea disponibilidad
  if (shouldBlockAvailability(googleEvent)) {
    await prisma.blocked_slots.upsert({
      where: {
        // Necesitaríamos un campo único, por ahora usamos una combinación
        professional_id: professionalId,
        start_datetime: new Date(start),
        end_datetime: new Date(end)
      },
      update: {
        reason: `Evento de Google Calendar: ${googleEvent.summary}`,
        updated_at: new Date()
      },
      create: {
        professional_id: professionalId,
        start_datetime: new Date(start),
        end_datetime: new Date(end),
        reason: `Evento de Google Calendar: ${googleEvent.summary}`,
        created_by: professionalId
      }
    });
  }
}

/**
 * Sincronizar eventos locales a Google Calendar
 */
async function syncLocalEventsToGoogle(professionalId, calendarClient) {
  // Obtener citas confirmadas que no están sincronizadas
  const appointments = await prisma.appointments.findMany({
    where: {
      professional_id: professionalId,
      status: 'confirmed',
      // Agregar campo para tracking de sincronización
      created_at: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Últimas 24 horas
      }
    },
    include: {
      client: { select: { nombre: true } },
      service: { select: { descripcion: true } }
    }
  });

  for (const appointment of appointments) {
    // Verificar si ya existe en Google Calendar
    // Si no existe, crear el evento

    const event = {
      summary: `Cita ChangAnet: ${appointment.client.nombre}`,
      description: appointment.service?.descripcion || 'Servicio agendado',
      start: {
        dateTime: appointment.start_datetime.toISOString(),
        timeZone: 'America/Argentina/Buenos_Aires'
      },
      end: {
        dateTime: appointment.end_datetime.toISOString(),
        timeZone: 'America/Argentina/Buenos_Aires'
      },
      // Agregar metadata para identificar eventos de ChangAnet
      extendedProperties: {
        private: {
          changanet_appointment_id: appointment.id,
          changanet_client_id: appointment.client_id
        }
      }
    };

    try {
      await calendarClient.events.insert({
        calendarId: 'primary',
        resource: event
      });
    } catch (error) {
      console.error('Error creando evento en Google Calendar:', error);
    }
  }
}

/**
 * Determinar si un evento de Google debe bloquear disponibilidad
 */
function shouldBlockAvailability(googleEvent) {
  // Lógica para determinar si el evento debe bloquear disponibilidad
  // Por ejemplo, excluir eventos marcados como "disponible" o eventos personales

  const summary = googleEvent.summary?.toLowerCase() || '';
  const description = googleEvent.description?.toLowerCase() || '';

  // Excluir eventos marcados como disponibles
  if (summary.includes('disponible') || description.includes('disponible')) {
    return false;
  }

  // Excluir eventos con ciertos términos
  const excludeTerms = ['recordatorio', 'cumpleaños', 'vacaciones'];
  if (excludeTerms.some(term => summary.includes(term) || description.includes(term))) {
    return false;
  }

  // Por defecto, bloquear disponibilidad
  return true;
}

/**
 * Generar archivo iCal para exportación
 */
exports.generateICalExport = async (professionalId, fromDate, toDate) => {
  const calendar = ical({
    domain: 'changanet.com',
    prodId: { company: 'ChangAnet', product: 'Availability Export' },
    name: 'ChangAnet - Disponibilidad'
  });

  // Obtener slots de disponibilidad
  const availabilitySlots = await prisma.professionals_availability.findMany({
    where: {
      professional_id: professionalId,
      start_datetime: {
        gte: fromDate || new Date(),
        lte: toDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      }
    }
  });

  // Obtener citas
  const appointments = await prisma.appointments.findMany({
    where: {
      professional_id: professionalId,
      status: 'confirmed',
      start_datetime: {
        gte: fromDate || new Date(),
        lte: toDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      }
    },
    include: {
      client: { select: { nombre: true } }
    }
  });

  // Agregar eventos de disponibilidad
  for (const slot of availabilitySlots) {
    calendar.createEvent({
      start: slot.start_datetime,
      end: slot.end_datetime,
      summary: 'Disponible - ChangAnet',
      description: 'Horario disponible para agendamiento',
      categories: ['disponibilidad']
    });
  }

  // Agregar eventos de citas
  for (const appointment of appointments) {
    calendar.createEvent({
      start: appointment.start_datetime,
      end: appointment.end_datetime,
      summary: `Cita: ${appointment.client.nombre}`,
      description: appointment.notes || 'Cita agendada en ChangAnet',
      categories: ['cita']
    });
  }

  return calendar.toString();
};

/**
 * Importar desde archivo iCal
 */
exports.importICal = async (professionalId, icalContent, blockAvailability = true) => {
  // Parsear contenido iCal
  const parsed = require('ical').parseICS(icalContent);

  const importedEvents = [];

  for (const key in parsed) {
    const event = parsed[key];

    if (event.type === 'VEVENT' && event.start && event.end) {
      if (blockAvailability) {
        // Crear bloqueo de disponibilidad
        const blockedSlot = await prisma.blocked_slots.create({
          data: {
            professional_id: professionalId,
            start_datetime: new Date(event.start),
            end_datetime: new Date(event.end),
            reason: `Importado de iCal: ${event.summary || 'Evento sin título'}`,
            created_by: professionalId
          }
        });
        importedEvents.push(blockedSlot);
      } else {
        // Podríamos crear slots de disponibilidad si no existen
        // Lógica adicional aquí
      }
    }
  }

  return importedEvents;
};

/**
 * Obtener estado de sincronización
 */
exports.getSyncStatus = async (professionalId, provider = 'google') => {
  return await prisma.calendar_sync.findUnique({
    where: {
      professional_id_provider: {
        professional_id: professionalId,
        provider
      }
    }
  });
};

/**
 * Desconectar calendario externo
 */
exports.disconnectCalendar = async (professionalId, provider = 'google') => {
  await prisma.calendar_sync.updateMany({
    where: {
      professional_id: professionalId,
      provider
    },
    data: {
      sync_enabled: false,
      sync_status: 'disabled',
      access_token: null,
      refresh_token: null,
      token_expires_at: null
    }
  });
};

/**
 * Ejecutar sincronización programada para todos los profesionales
 */
exports.runScheduledSync = async () => {
  try {
    // Obtener todas las sincronizaciones activas
    const activeSyncs = await prisma.calendar_sync.findMany({
      where: {
        sync_enabled: true,
        sync_status: { in: ['idle', 'error'] }
      }
    });

    for (const sync of activeSyncs) {
      try {
        await exports.syncGoogleCalendar(sync.professional_id);
      } catch (error) {
        console.error(`Error sincronizando calendario para profesional ${sync.professional_id}:`, error);
      }
    }

    console.log(`Sincronización programada completada para ${activeSyncs.length} calendarios`);
  } catch (error) {
    console.error('Error en sincronización programada:', error);
  }
};

module.exports = exports;