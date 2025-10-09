// src/routes/notificationRoutes.js
const express = require('express');
const { getNotifications, markAsRead, markAllAsRead } = require('../controllers/notificationController');

const router = express.Router();

router.get('/', getNotifications);
router.put('/:notificationId/read', markAsRead);
router.put('/read-all', markAllAsRead);

module.exports = router;