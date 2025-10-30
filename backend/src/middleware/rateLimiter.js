const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

/**
 * General API rate limiter
 * Applies to all API routes
 */
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000, // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    success: false,
    error: 'Too many requests',
    message: 'Please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      error: 'Too many requests',
      message: 'You have exceeded the rate limit. Please try again later.'
    });
  }
});

/**
 * Strict rate limiter for authentication endpoints
 * Prevents brute force attacks on OTP verification
 */
const authLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 5, // 5 requests per minute per IP
  message: {
    success: false,
    error: 'Too many authentication attempts',
    message: 'Please wait before trying again'
  },
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    logger.warn(`Auth rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      error: 'Too many authentication attempts',
      message: 'Please wait 1 minute before trying again'
    });
  }
});

/**
 * Rate limiter for ride/delivery creation
 * Prevents spam bookings
 */
const rideLimiter = rateLimit({
  windowMs: 3600000, // 1 hour
  max: 10, // 10 ride requests per hour per IP
  message: {
    success: false,
    error: 'Too many booking requests',
    message: 'You have exceeded the hourly booking limit'
  },
  handler: (req, res) => {
    logger.warn(`Ride creation rate limit exceeded for IP: ${req.ip}, User: ${req.user?.uid}`);
    res.status(429).json({
      success: false,
      error: 'Too many booking requests',
      message: 'You have reached the maximum number of ride requests per hour. Please try again later.'
    });
  }
});

/**
 * Rate limiter for driver location updates
 * Allows more frequent updates for real-time tracking
 */
const locationUpdateLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 30, // 30 updates per minute (every 2 seconds)
  message: {
    success: false,
    error: 'Too many location updates',
    message: 'Please reduce update frequency'
  },
  skipSuccessfulRequests: true
});

/**
 * Rate limiter for admin operations
 * More permissive for admin users
 */
const adminLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 100, // 100 requests per minute
  message: {
    success: false,
    error: 'Rate limit exceeded',
    message: 'Too many admin requests'
  }
});

module.exports = {
  generalLimiter,
  authLimiter,
  rideLimiter,
  locationUpdateLimiter,
  adminLimiter
};
