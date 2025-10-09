// src/routes/messageRoutes.js
const express = require('express');
const { getMessageHistory } = require('../controllers/messageController');

const router = express.Router();

router.get('/', getMessageHistory);

module.exports = router;