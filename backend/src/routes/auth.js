const express = require('express');
const router = express.Router();
const { auth, db, FieldValue } = require('../config/firebase');
const { authLimiter } = require('../middleware/rateLimiter');
const { authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');

/**
 * POST /api/auth/send-otp
 * Send OTP to phone number for verification
 * This is a mock implementation for testing
 */
router.post('/send-otp', authLimiter, async (req, res, next) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Phone number required'
      });
    }

    // Validate phone number format (Indian numbers)
    const phoneRegex = /^\+91[6-9]\d{9}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone number',
        message: 'Phone number must be in format: +91XXXXXXXXXX'
      });
    }

    // In production, this would send actual OTP via SMS
    // For testing, we'll generate and log the OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP

    logger.info(`OTP sent to ${phoneNumber}: ${otp}`);

    // Store OTP in database with expiry (5 minutes)
    await db.collection('otp_verifications').add({
      phoneNumber,
      otp,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      verified: false,
      attempts: 0
    });

    res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      // FOR TESTING ONLY - Remove in production
      ...(process.env.NODE_ENV === 'development' && { otp })
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/verify-otp
 * Verify OTP and create/login user
 */
router.post('/verify-otp', authLimiter, async (req, res, next) => {
  try {
    const { phoneNumber, otp } = req.body;

    if (!phoneNumber || !otp) {
      return res.status(400).json({
        success: false,
        error: 'Phone number and OTP required'
      });
    }

    // Find OTP verification record
    const otpQuery = await db.collection('otp_verifications')
      .where('phoneNumber', '==', phoneNumber)
      .where('verified', '==', false)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (otpQuery.empty) {
      return res.status(400).json({
        success: false,
        error: 'No OTP found',
        message: 'Please request a new OTP'
      });
    }

    const otpDoc = otpQuery.docs[0];
    const otpData = otpDoc.data();

    // Check if OTP expired
    if (otpData.expiresAt.toDate() < new Date()) {
      return res.status(400).json({
        success: false,
        error: 'OTP expired',
        message: 'Please request a new OTP'
      });
    }

    // Check attempts limit
    if (otpData.attempts >= 3) {
      return res.status(400).json({
        success: false,
        error: 'Too many attempts',
        message: 'Please request a new OTP'
      });
    }

    // Verify OTP
    if (otpData.otp !== otp) {
      // Increment attempts
      await otpDoc.ref.update({
        attempts: FieldValue.increment(1)
      });

      return res.status(400).json({
        success: false,
        error: 'Invalid OTP',
        message: `Incorrect OTP. ${2 - otpData.attempts} attempts remaining`
      });
    }

    // Mark OTP as verified
    await otpDoc.ref.update({
      verified: true,
      verifiedAt: FieldValue.serverTimestamp()
    });

    // Check if user exists
    let userRecord;
    try {
      userRecord = await auth.getUserByPhoneNumber(phoneNumber);
    } catch (error) {
      // User doesn't exist, create new user
      if (error.code === 'auth/user-not-found') {
        userRecord = await auth.createUser({
          phoneNumber,
          disabled: false
        });

        // Create user document in Firestore
        await db.collection('users').doc(userRecord.uid).set({
          uid: userRecord.uid,
          phoneNumber,
          role: 'user', // Default role
          language: 'en',
          createdAt: FieldValue.serverTimestamp(),
          isActive: true,
          ageVerified: false
        });

        logger.info(`New user created: ${userRecord.uid}`);
      } else {
        throw error;
      }
    }

    // Generate custom token for client
    const customToken = await auth.createCustomToken(userRecord.uid);

    // Get user document
    const userDoc = await db.collection('users').doc(userRecord.uid).get();
    const userData = userDoc.data();

    res.status(200).json({
      success: true,
      message: 'Authentication successful',
      token: customToken,
      user: {
        uid: userRecord.uid,
        phoneNumber: userData.phoneNumber,
        name: userData.name || null,
        role: userData.role,
        language: userData.language
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get('/me', authenticate, async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      user: req.user
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/auth/profile
 * Update user profile
 */
router.put('/profile', authenticate, async (req, res, next) => {
  try {
    const { name, email, emergencyContact, language } = req.body;

    const updates = {};
    if (name) updates.name = name;
    if (email) updates.email = email;
    if (emergencyContact) updates.emergencyContact = emergencyContact;
    if (language) updates.language = language;
    updates.updatedAt = FieldValue.serverTimestamp();

    await db.collection('users').doc(req.user.uid).update(updates);

    // Get updated user data
    const updatedDoc = await db.collection('users').doc(req.user.uid).get();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedDoc.data()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/verify-age
 * Mark user as age-verified (18+)
 */
router.post('/verify-age', authenticate, async (req, res, next) => {
  try {
    const { confirmed } = req.body;

    if (!confirmed) {
      return res.status(400).json({
        success: false,
        error: 'Age confirmation required'
      });
    }

    await db.collection('users').doc(req.user.uid).update({
      ageVerified: true,
      ageVerifiedAt: FieldValue.serverTimestamp()
    });

    res.status(200).json({
      success: true,
      message: 'Age verified successfully'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
