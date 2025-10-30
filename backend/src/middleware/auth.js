const { auth, db } = require('../config/firebase');
const logger = require('../utils/logger');

/**
 * Middleware to verify Firebase authentication token
 * Adds user object to request if authenticated
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'No authentication token provided'
      });
    }

    const token = authHeader.split('Bearer ')[1];

    // Verify the token with Firebase Auth
    const decodedToken = await auth.verifyIdToken(token);

    // Get user document from Firestore
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();

    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        message: 'User profile does not exist'
      });
    }

    // Attach user data to request
    req.user = {
      uid: decodedToken.uid,
      ...userDoc.data()
    };

    next();
  } catch (error) {
    logger.error('Authentication error:', error);

    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({
        success: false,
        error: 'Token expired',
        message: 'Authentication token has expired'
      });
    }

    return res.status(401).json({
      success: false,
      error: 'Authentication failed',
      message: 'Invalid authentication token'
    });
  }
};

/**
 * Middleware to check if user has admin role
 * Must be used after authenticate middleware
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Admin access required'
    });
  }

  next();
};

/**
 * Middleware to check if user has driver role
 * Must be used after authenticate middleware
 */
const requireDriver = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }

  if (req.user.role !== 'driver') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Driver access required'
    });
  }

  next();
};

/**
 * Middleware to check if driver is verified
 * Must be used after authenticate and requireDriver middleware
 */
const requireVerifiedDriver = async (req, res, next) => {
  try {
    const driverDoc = await db.collection('drivers').doc(req.user.uid).get();

    if (!driverDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Driver profile not found'
      });
    }

    const driverData = driverDoc.data();

    if (!driverData.verified) {
      return res.status(403).json({
        success: false,
        error: 'Driver not verified',
        message: 'Your driver account is pending verification'
      });
    }

    if (driverData.verificationStatus !== 'approved') {
      return res.status(403).json({
        success: false,
        error: 'Driver account not approved',
        message: `Your account status: ${driverData.verificationStatus}`
      });
    }

    // Attach driver data to request
    req.driver = driverData;

    next();
  } catch (error) {
    logger.error('Driver verification check error:', error);
    return res.status(500).json({
      success: false,
      error: 'Verification check failed'
    });
  }
};

module.exports = {
  authenticate,
  requireAdmin,
  requireDriver,
  requireVerifiedDriver
};
