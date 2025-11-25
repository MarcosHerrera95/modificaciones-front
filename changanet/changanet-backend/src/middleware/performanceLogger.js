/**
 * Performance Logger Middleware
 * 
 * Logs request performance and response times for monitoring
 * and debugging purposes.
 */

const logger = require('../services/logger');

/**
 * Performance logging middleware
 * Logs request duration and performance metrics
 */
const performanceLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log request start
  const requestId = req.headers['x-request-id'] || Math.random().toString(36).substring(7);
  
  logger.info('Request started', {
    requestId,
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent'],
    ip: req.ip
  });
  
  // Override res.end to capture response time
  const originalEnd = res.end;
  res.end = function(...args) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Log request completion
    logger.info('Request completed', {
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('content-length') || 'unknown'
    });
    
    // Log slow requests (>1s)
    if (duration > 1000) {
      logger.warn('Slow request detected', {
        requestId,
        method: req.method,
        url: req.url,
        duration: `${duration}ms`,
        statusCode: res.statusCode
      });
    }
    
    // Call original end method
    originalEnd.apply(res, args);
  };
  
  next();
};

module.exports = performanceLogger;