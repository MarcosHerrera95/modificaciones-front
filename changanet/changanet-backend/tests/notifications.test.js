const { NotificationService } = require('../src/services/notificationService');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

describe('NotificationService', () => {
  let notificationService;

  beforeEach(() => {
    notificationService = new NotificationService();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('createNotification', () => {
    it('should create a notification successfully', async () => {
      const userId = 'test-user-id';
      const type = 'system';
      const title = 'Test Notification';
      const message = 'This is a test notification';
      const data = { test: true };

      const notification = await notificationService.createNotification(
        userId,
        type,
        title,
        message,
        data
      );

      expect(notification).toBeDefined();
      expect(notification.usuario_id).toBe(userId);
      expect(notification.tipo).toBe(type);
      expect(notification.titulo).toBe(title);
      expect(notification.mensaje).toBe(message);
      expect(notification.estado).toBe('unread');
    });
  });

  describe('getUserNotifications', () => {
    it('should return paginated notifications', async () => {
      const userId = 'test-user-id';

      const result = await notificationService.getUserNotifications(userId, 1, 10);

      expect(result).toHaveProperty('notifications');
      expect(result).toHaveProperty('pagination');
      expect(Array.isArray(result.notifications)).toBe(true);
      expect(result.pagination).toHaveProperty('page');
      expect(result.pagination).toHaveProperty('limit');
      expect(result.pagination).toHaveProperty('total');
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      // First create a notification
      const notification = await notificationService.createNotification(
        'test-user-id',
        'system',
        'Test',
        'Test message'
      );

      const updated = await notificationService.markAsRead(notification.id, 'test-user-id');

      expect(updated.estado).toBe('read');
      expect(updated.leido_en).toBeDefined();
    });

    it('should throw error for non-existent notification', async () => {
      await expect(
        notificationService.markAsRead('non-existent-id', 'test-user-id')
      ).rejects.toThrow('Notification not found');
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      const userId = 'test-user-id';

      const count = await notificationService.getUnreadCount(userId);

      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getUserPreferences', () => {
    it('should return default preferences when none exist', async () => {
      const userId = 'test-user-id';

      const preferences = await notificationService.getUserPreferences(userId);

      expect(preferences).toHaveProperty('system');
      expect(preferences.system).toHaveProperty('inapp', true);
      expect(preferences.system).toHaveProperty('push', true);
      expect(preferences.system).toHaveProperty('email', true);
    });
  });

  describe('updateUserPreferences', () => {
    it('should update user preferences', async () => {
      const userId = 'test-user-id';
      const preferences = {
        system: { inapp: true, push: false, email: true },
        message: { inapp: true, push: true, email: false }
      };

      const result = await notificationService.updateUserPreferences(userId, preferences);

      expect(Array.isArray(result)).toBe(true);

      // Verify preferences were saved
      const saved = await notificationService.getUserPreferences(userId);
      expect(saved.system.push).toBe(false);
      expect(saved.message.email).toBe(false);
    });
  });
});