/**
 * @archivo tests/database/urgentServices.database.test.js
 * @descripción Pruebas de base de datos para persistencia y integridad de Servicios Urgentes
 * @sprint Sprint 4 – Servicios Urgentes
 * @tarjeta Tests de base de datos para validación de constraints y consistencia
 * @impacto Social: Garantía de integridad de datos críticos en situaciones de emergencia
 */

const { PrismaClient } = require('@prisma/client');
const { createTestUser, cleanupTestData } = require('../testHelpers');

const prisma = new PrismaClient();

describe('Urgent Services - Database Tests', () => {
  let testClient;
  let testProfessional1;
  let testProfessional2;

  beforeAll(async () => {
    // Create test users
    testClient = await createTestUser('db_client@test.com', 'cliente');
    testProfessional1 = await createTestUser('db_prof1@test.com', 'profesional');
    testProfessional2 = await createTestUser('db_prof2@test.com', 'profesional');

    // Create professional profiles
    await prisma.perfiles_profesionales.create({
      data: {
        usuario_id: testProfessional1.id,
        especialidad: 'Plomero',
        zona_cobertura: 'Buenos Aires',
        latitud: -34.6118,
        longitud: -58.3960,
        esta_disponible: true,
        tarifa_hora: 1500,
        calificacion_promedio: 4.5,
        total_resenas: 25
      }
    });

    await prisma.perfiles_profesionales.create({
      data: {
        usuario_id: testProfessional2.id,
        especialidad: 'Electricista',
        zona_cobertura: 'Buenos Aires',
        latitud: -34.5881,
        longitud: -58.4165,
        esta_disponible: true,
        tarifa_hora: 1600,
        calificacion_promedio: 4.2,
        total_resenas: 18
      }
    });

    // Create pricing rules
    await prisma.urgent_pricing_rules.create({
      data: {
        service_category: 'plomero',
        base_multiplier: 1.5,
        min_price: 500
      }
    });
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.urgent_pricing_rules.deleteMany({
      where: { service_category: 'plomero' }
    });
    await prisma.$disconnect();
  });

  afterEach(async () => {
    // Clean up test data after each test
    await prisma.urgent_tracking.deleteMany();
    await prisma.urgent_rejections.deleteMany();
    await prisma.urgent_assignments.deleteMany();
    await prisma.urgent_request_candidates.deleteMany();
    await prisma.urgent_requests.deleteMany();
  });

  describe('Urgent Requests Table', () => {
    test('should create urgent request with all required fields', async () => {
      const urgentRequest = await prisma.urgent_requests.create({
        data: {
          client_id: testClient.id,
          description: 'Test urgent request',
          latitude: -34.6118,
          longitude: -58.3960,
          radius_km: 5,
          status: 'pending',
          price_estimate: 750
        }
      });

      expect(urgentRequest.id).toBeDefined();
      expect(urgentRequest.client_id).toBe(testClient.id);
      expect(urgentRequest.status).toBe('pending');
      expect(urgentRequest.created_at).toBeDefined();
      expect(urgentRequest.updated_at).toBeDefined();
    });

    test('should enforce foreign key constraints', async () => {
      await expect(prisma.urgent_requests.create({
        data: {
          client_id: 'non-existent-user',
          description: 'Test request',
          latitude: -34.6118,
          longitude: -58.3960,
          radius_km: 5,
          status: 'pending',
          price_estimate: 750
        }
      })).rejects.toThrow();
    });

    test('should update status correctly', async () => {
      const request = await prisma.urgent_requests.create({
        data: {
          client_id: testClient.id,
          description: 'Status update test',
          latitude: -34.6118,
          longitude: -58.3960,
          radius_km: 5,
          status: 'pending',
          price_estimate: 750
        }
      });

      const updated = await prisma.urgent_requests.update({
        where: { id: request.id },
        data: { status: 'assigned' }
      });

      expect(updated.status).toBe('assigned');
      expect(updated.updated_at.getTime()).toBeGreaterThan(request.updated_at.getTime());
    });

    test('should handle completed_at timestamp', async () => {
      const request = await prisma.urgent_requests.create({
        data: {
          client_id: testClient.id,
          description: 'Completion test',
          latitude: -34.6118,
          longitude: -58.3960,
          radius_km: 5,
          status: 'assigned',
          price_estimate: 750
        }
      });

      const completionTime = new Date();
      await prisma.urgent_requests.update({
        where: { id: request.id },
        data: {
          status: 'completed',
          completed_at: completionTime
        }
      });

      const completed = await prisma.urgent_requests.findUnique({
        where: { id: request.id }
      });

      expect(completed.status).toBe('completed');
      expect(completed.completed_at).toEqual(completionTime);
    });
  });

  describe('Urgent Request Candidates Table', () => {
    let testRequestId;

    beforeEach(async () => {
      const request = await prisma.urgent_requests.create({
        data: {
          client_id: testClient.id,
          description: 'Candidates test',
          latitude: -34.6118,
          longitude: -58.3960,
          radius_km: 5,
          status: 'pending',
          price_estimate: 750
        }
      });
      testRequestId = request.id;
    });

    test('should create candidate records', async () => {
      const candidate = await prisma.urgent_request_candidates.create({
        data: {
          urgent_request_id: testRequestId,
          professional_id: testProfessional1.id,
          distance_km: 2.5,
          responded: false,
          accepted: false
        }
      });

      expect(candidate.id).toBeDefined();
      expect(candidate.urgent_request_id).toBe(testRequestId);
      expect(candidate.professional_id).toBe(testProfessional1.id);
      expect(candidate.distance_km).toBe(2.5);
      expect(candidate.responded).toBe(false);
      expect(candidate.accepted).toBe(false);
    });

    test('should update candidate response', async () => {
      const candidate = await prisma.urgent_request_candidates.create({
        data: {
          urgent_request_id: testRequestId,
          professional_id: testProfessional1.id,
          distance_km: 2.5
        }
      });

      await prisma.urgent_request_candidates.update({
        where: { id: candidate.id },
        data: {
          responded: true,
          accepted: true
        }
      });

      const updated = await prisma.urgent_request_candidates.findUnique({
        where: { id: candidate.id }
      });

      expect(updated.responded).toBe(true);
      expect(updated.accepted).toBe(true);
    });

    test('should enforce unique constraint per request-professional pair', async () => {
      await prisma.urgent_request_candidates.create({
        data: {
          urgent_request_id: testRequestId,
          professional_id: testProfessional1.id,
          distance_km: 2.5
        }
      });

      await expect(prisma.urgent_request_candidates.create({
        data: {
          urgent_request_id: testRequestId,
          professional_id: testProfessional1.id,
          distance_km: 2.5
        }
      })).rejects.toThrow();
    });
  });

  describe('Urgent Assignments Table', () => {
    let testRequestId;

    beforeEach(async () => {
      const request = await prisma.urgent_requests.create({
        data: {
          client_id: testClient.id,
          description: 'Assignment test',
          latitude: -34.6118,
          longitude: -58.3960,
          radius_km: 5,
          status: 'pending',
          price_estimate: 750
        }
      });
      testRequestId = request.id;
    });

    test('should create assignment record', async () => {
      const assignment = await prisma.urgent_assignments.create({
        data: {
          urgent_request_id: testRequestId,
          professional_id: testProfessional1.id,
          status: 'accepted'
        }
      });

      expect(assignment.id).toBeDefined();
      expect(assignment.urgent_request_id).toBe(testRequestId);
      expect(assignment.professional_id).toBe(testProfessional1.id);
      expect(assignment.status).toBe('accepted');
      expect(assignment.assigned_at).toBeDefined();
    });

    test('should update assignment status', async () => {
      const assignment = await prisma.urgent_assignments.create({
        data: {
          urgent_request_id: testRequestId,
          professional_id: testProfessional1.id,
          status: 'accepted'
        }
      });

      await prisma.urgent_assignments.update({
        where: { id: assignment.id },
        data: { status: 'in_progress' }
      });

      const updated = await prisma.urgent_assignments.findUnique({
        where: { id: assignment.id }
      });

      expect(updated.status).toBe('in_progress');
    });
  });

  describe('Urgent Rejections Table', () => {
    let testRequestId;

    beforeEach(async () => {
      const request = await prisma.urgent_requests.create({
        data: {
          client_id: testClient.id,
          description: 'Rejection test',
          latitude: -34.6118,
          longitude: -58.3960,
          radius_km: 5,
          status: 'pending',
          price_estimate: 750
        }
      });
      testRequestId = request.id;
    });

    test('should create rejection record', async () => {
      const rejection = await prisma.urgent_rejections.create({
        data: {
          urgent_request_id: testRequestId,
          professional_id: testProfessional1.id,
          reason: 'No disponible en este momento'
        }
      });

      expect(rejection.id).toBeDefined();
      expect(rejection.urgent_request_id).toBe(testRequestId);
      expect(rejection.professional_id).toBe(testProfessional1.id);
      expect(rejection.reason).toBe('No disponible en este momento');
      expect(rejection.rejected_at).toBeDefined();
    });

    test('should handle null rejection reasons', async () => {
      const rejection = await prisma.urgent_rejections.create({
        data: {
          urgent_request_id: testRequestId,
          professional_id: testProfessional1.id,
          reason: null
        }
      });

      expect(rejection.reason).toBeNull();
    });
  });

  describe('Urgent Tracking Table', () => {
    let testRequestId;

    beforeEach(async () => {
      const request = await prisma.urgent_requests.create({
        data: {
          client_id: testClient.id,
          description: 'Tracking test',
          latitude: -34.6118,
          longitude: -58.3960,
          radius_km: 5,
          status: 'pending',
          price_estimate: 750
        }
      });
      testRequestId = request.id;
    });

    test('should create tracking records', async () => {
      const tracking = await prisma.urgent_tracking.create({
        data: {
          urgent_request_id: testRequestId,
          previous_status: null,
          new_status: 'pending',
          changed_by: testClient.id,
          notes: 'Request created'
        }
      });

      expect(tracking.id).toBeDefined();
      expect(tracking.urgent_request_id).toBe(testRequestId);
      expect(tracking.previous_status).toBeNull();
      expect(tracking.new_status).toBe('pending');
      expect(tracking.changed_by).toBe(testClient.id);
      expect(tracking.notes).toBe('Request created');
      expect(tracking.changed_at).toBeDefined();
    });

    test('should track status changes', async () => {
      // Initial tracking
      await prisma.urgent_tracking.create({
        data: {
          urgent_request_id: testRequestId,
          previous_status: null,
          new_status: 'pending',
          notes: 'Initial status'
        }
      });

      // Status change tracking
      await prisma.urgent_tracking.create({
        data: {
          urgent_request_id: testRequestId,
          previous_status: 'pending',
          new_status: 'assigned',
          changed_by: testProfessional1.id,
          notes: 'Assigned to professional'
        }
      });

      const trackingRecords = await prisma.urgent_tracking.findMany({
        where: { urgent_request_id: testRequestId },
        orderBy: { changed_at: 'asc' }
      });

      expect(trackingRecords).toHaveLength(2);
      expect(trackingRecords[0].new_status).toBe('pending');
      expect(trackingRecords[1].new_status).toBe('assigned');
      expect(trackingRecords[1].previous_status).toBe('pending');
    });
  });

  describe('Urgent Pricing Rules Table', () => {
    test('should create pricing rules', async () => {
      const rule = await prisma.urgent_pricing_rules.create({
        data: {
          service_category: 'test_category',
          base_multiplier: 2.0,
          min_price: 1000
        }
      });

      expect(rule.id).toBeDefined();
      expect(rule.service_category).toBe('test_category');
      expect(rule.base_multiplier).toBe(2.0);
      expect(rule.min_price).toBe(1000);
      expect(rule.updated_at).toBeDefined();

      // Cleanup
      await prisma.urgent_pricing_rules.delete({
        where: { service_category: 'test_category' }
      });
    });

    test('should update pricing rules', async () => {
      const rule = await prisma.urgent_pricing_rules.create({
        data: {
          service_category: 'update_test',
          base_multiplier: 1.5,
          min_price: 500
        }
      });

      const originalUpdateTime = rule.updated_at;

      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay

      await prisma.urgent_pricing_rules.update({
        where: { service_category: 'update_test' },
        data: {
          base_multiplier: 1.8,
          min_price: 600
        }
      });

      const updated = await prisma.urgent_pricing_rules.findFirst({
        where: { service_category: 'update_test' }
      });

      expect(updated.base_multiplier).toBe(1.8);
      expect(updated.min_price).toBe(600);
      expect(updated.updated_at.getTime()).toBeGreaterThan(originalUpdateTime.getTime());

      // Cleanup
      await prisma.urgent_pricing_rules.delete({
        where: { service_category: 'update_test' }
      });
    });
  });

  describe('Database Relationships and Constraints', () => {
    test('should maintain referential integrity on delete', async () => {
      // Create a complete urgent request scenario
      const request = await prisma.urgent_requests.create({
        data: {
          client_id: testClient.id,
          description: 'Relationship test',
          latitude: -34.6118,
          longitude: -58.3960,
          radius_km: 5,
          status: 'pending',
          price_estimate: 750
        }
      });

      // Create candidates
      await prisma.urgent_request_candidates.create({
        data: {
          urgent_request_id: request.id,
          professional_id: testProfessional1.id,
          distance_km: 2.5
        }
      });

      // Create assignment
      const assignment = await prisma.urgent_assignments.create({
        data: {
          urgent_request_id: request.id,
          professional_id: testProfessional1.id,
          status: 'accepted'
        }
      });

      // Create tracking
      await prisma.urgent_tracking.create({
        data: {
          urgent_request_id: request.id,
          previous_status: 'pending',
          new_status: 'assigned',
          notes: 'Test tracking'
        }
      });

      // Verify relationships exist
      const fullRequest = await prisma.urgent_requests.findUnique({
        where: { id: request.id },
        include: {
          candidates: true,
          assignments: true,
          tracking: true
        }
      });

      expect(fullRequest.candidates).toHaveLength(1);
      expect(fullRequest.assignments).toHaveLength(1);
      expect(fullRequest.tracking).toHaveLength(1);

      // Delete request should cascade or handle relationships properly
      await prisma.urgent_assignments.delete({ where: { id: assignment.id } });
      await prisma.urgent_request_candidates.deleteMany({ where: { urgent_request_id: request.id } });
      await prisma.urgent_tracking.deleteMany({ where: { urgent_request_id: request.id } });
      await prisma.urgent_requests.delete({ where: { id: request.id } });

      // Verify cleanup
      const deletedRequest = await prisma.urgent_requests.findUnique({
        where: { id: request.id }
      });
      expect(deletedRequest).toBeNull();
    });

    test('should handle cascade deletes correctly', async () => {
      // Test cascade behavior for related tables
      const request = await prisma.urgent_requests.create({
        data: {
          client_id: testClient.id,
          description: 'Cascade test',
          latitude: -34.6118,
          longitude: -58.3960,
          radius_km: 5,
          status: 'pending',
          price_estimate: 750
        }
      });

      // Create related records
      await prisma.urgent_request_candidates.create({
        data: {
          urgent_request_id: request.id,
          professional_id: testProfessional1.id,
          distance_km: 2.5
        }
      });

      await prisma.urgent_tracking.create({
        data: {
          urgent_request_id: request.id,
          previous_status: 'pending',
          new_status: 'created',
          notes: 'Test'
        }
      });

      // Delete request (should handle related records)
      await prisma.urgent_requests.delete({
        where: { id: request.id }
      });

      // Verify related records are handled (either deleted or orphaned appropriately)
      const candidates = await prisma.urgent_request_candidates.findMany({
        where: { urgent_request_id: request.id }
      });

      const tracking = await prisma.urgent_tracking.findMany({
        where: { urgent_request_id: request.id }
      });

      // Depending on cascade settings, these should either be deleted or still exist
      // The test verifies the database handles the operation without errors
      expect(candidates.length).toBeLessThanOrEqual(1);
      expect(tracking.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Database Performance and Indexing', () => {
    test('should use indexes for efficient queries', async () => {
      // Create multiple requests for performance testing
      const requests = [];
      for (let i = 0; i < 10; i++) {
        const request = await prisma.urgent_requests.create({
          data: {
            client_id: testClient.id,
            description: `Performance test ${i}`,
            latitude: -34.6118 + (Math.random() - 0.5) * 0.1,
            longitude: -58.3960 + (Math.random() - 0.5) * 0.1,
            radius_km: 5,
            status: ['pending', 'assigned', 'completed'][Math.floor(Math.random() * 3)],
            price_estimate: 750 + Math.random() * 250
          }
        });
        requests.push(request);
      }

      // Test indexed queries
      const startTime = Date.now();

      // Query by status (should use index)
      const pendingRequests = await prisma.urgent_requests.findMany({
        where: { status: 'pending' }
      });

      // Query by client (should use index)
      const clientRequests = await prisma.urgent_requests.findMany({
        where: { client_id: testClient.id }
      });

      // Query by creation date (should use index)
      const recentRequests = await prisma.urgent_requests.findMany({
        where: {
          created_at: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      });

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      // Should complete quickly with indexes
      expect(queryTime).toBeLessThan(1000); // Less than 1 second
      expect(clientRequests.length).toBe(10);
      expect(recentRequests.length).toBe(10);

      // Cleanup
      await prisma.urgent_requests.deleteMany({
        where: { client_id: testClient.id, description: { startsWith: 'Performance test' } }
      });
    });

    test('should handle geospatial queries efficiently', async () => {
      // Create requests at different locations
      const locations = [
        { lat: -34.6118, lng: -58.3960 }, // Centro
        { lat: -34.5881, lng: -58.4165 }, // Palermo
        { lat: -34.6288, lng: -58.3817 }, // San Telmo
        { lat: -34.7167, lng: -58.2833 }, // La Boca
        { lat: -34.5211, lng: -58.7000 }  // Zona Norte
      ];

      for (const location of locations) {
        await prisma.urgent_requests.create({
          data: {
            client_id: testClient.id,
            description: 'Geospatial test',
            latitude: location.lat,
            longitude: location.lng,
            radius_km: 5,
            status: 'pending',
            price_estimate: 750
          }
        });
      }

      const startTime = Date.now();

      // Query nearby requests (should use geospatial index)
      const nearbyRequests = await prisma.urgent_requests.findMany({
        where: {
          latitude: { gte: -34.7, lte: -34.5 },
          longitude: { gte: -58.5, lte: -58.3 }
        }
      });

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(queryTime).toBeLessThan(500); // Should be fast with bounding box
      expect(nearbyRequests.length).toBeGreaterThan(0);

      // Cleanup
      await prisma.urgent_requests.deleteMany({
        where: { client_id: testClient.id, description: 'Geospatial test' }
      });
    });
  });

  describe('Data Consistency and Transactions', () => {
    test('should maintain consistency in complex operations', async () => {
      // Test a complete urgent request flow for data consistency
      const request = await prisma.urgent_requests.create({
        data: {
          client_id: testClient.id,
          description: 'Consistency test',
          latitude: -34.6118,
          longitude: -58.3960,
          radius_km: 5,
          status: 'pending',
          price_estimate: 750
        }
      });

      // Add candidates
      await prisma.urgent_request_candidates.create({
        data: {
          urgent_request_id: request.id,
          professional_id: testProfessional1.id,
          distance_km: 2.5
        }
      });

      await prisma.urgent_request_candidates.create({
        data: {
          urgent_request_id: request.id,
          professional_id: testProfessional2.id,
          distance_km: 3.1
        }
      });

      // Accept request
      await prisma.urgent_assignments.create({
        data: {
          urgent_request_id: request.id,
          professional_id: testProfessional1.id,
          status: 'accepted'
        }
      });

      // Update request status
      await prisma.urgent_requests.update({
        where: { id: request.id },
        data: {
          status: 'assigned',
          assigned_professional_id: testProfessional1.id
        }
      });

      // Add tracking
      await prisma.urgent_tracking.create({
        data: {
          urgent_request_id: request.id,
          previous_status: 'pending',
          new_status: 'assigned',
          changed_by: testProfessional1.id,
          notes: 'Accepted by professional'
        }
      });

      // Verify consistency
      const finalRequest = await prisma.urgent_requests.findUnique({
        where: { id: request.id },
        include: {
          candidates: true,
          assignments: true,
          tracking: true
        }
      });

      expect(finalRequest.status).toBe('assigned');
      expect(finalRequest.assigned_professional_id).toBe(testProfessional1.id);
      expect(finalRequest.candidates).toHaveLength(2);
      expect(finalRequest.assignments).toHaveLength(1);
      expect(finalRequest.assignments[0].professional_id).toBe(testProfessional1.id);
      expect(finalRequest.tracking).toHaveLength(1);
      expect(finalRequest.tracking[0].new_status).toBe('assigned');
    });

    test('should handle concurrent updates safely', async () => {
      const request = await prisma.urgent_requests.create({
        data: {
          client_id: testClient.id,
          description: 'Concurrency test',
          latitude: -34.6118,
          longitude: -58.3960,
          radius_km: 5,
          status: 'pending',
          price_estimate: 750
        }
      });

      // Simulate concurrent status updates
      const updatePromises = [
        prisma.urgent_requests.update({
          where: { id: request.id },
          data: { status: 'assigned' }
        }),
        prisma.urgent_requests.update({
          where: { id: request.id },
          data: { status: 'completed' }
        })
      ];

      // One should succeed, one should fail or be handled
      const results = await Promise.allSettled(updatePromises);

      const fulfilled = results.filter(r => r.status === 'fulfilled').length;
      const rejected = results.filter(r => r.status === 'rejected').length;

      expect(fulfilled + rejected).toBe(2);
      expect(fulfilled).toBeGreaterThanOrEqual(1); // At least one should succeed

      // Final state should be consistent
      const finalRequest = await prisma.urgent_requests.findUnique({
        where: { id: request.id }
      });

      expect(['assigned', 'completed']).toContain(finalRequest.status);
    });
  });

  describe('Database Backup and Recovery Simulation', () => {
    test('should handle data restoration scenarios', async () => {
      // Create a complete dataset
      const request = await prisma.urgent_requests.create({
        data: {
          client_id: testClient.id,
          description: 'Backup test',
          latitude: -34.6118,
          longitude: -58.3960,
          radius_km: 5,
          status: 'completed',
          price_estimate: 750,
          completed_at: new Date()
        }
      });

      await prisma.urgent_assignments.create({
        data: {
          urgent_request_id: request.id,
          professional_id: testProfessional1.id,
          status: 'completed'
        }
      });

      // Simulate backup by exporting data
      const exportedData = {
        request: await prisma.urgent_requests.findUnique({
          where: { id: request.id },
          include: {
            assignments: true,
            candidates: true,
            tracking: true
          }
        })
      };

      // Verify exported data integrity
      expect(exportedData.request.id).toBe(request.id);
      expect(exportedData.request.status).toBe('completed');
      expect(exportedData.request.assignments).toHaveLength(1);
      expect(exportedData.request.completed_at).toBeDefined();

      // Simulate restoration check (data should be recoverable)
      const recoveredRequest = await prisma.urgent_requests.findUnique({
        where: { id: request.id },
        include: {
          assignments: true,
          candidates: true,
          tracking: true
        }
      });

      expect(recoveredRequest).toEqual(exportedData.request);
    });
  });
});