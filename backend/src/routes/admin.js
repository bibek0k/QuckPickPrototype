const express = require('express');
const router = express.Router();
const { auth, db, FieldValue } = require('../config/firebase');
const { authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');

// Middleware to check if user is admin
const requireAdmin = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'Admin access required'
      });
    }
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/drivers/pending
 * Get drivers with verificationStatus: 'pending'
 */
router.get('/drivers/pending', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const driversQuery = await db.collection('drivers')
      .where('verificationStatus', '==', 'pending')
      .orderBy('createdAt', 'desc')
      .get();

    const pendingDrivers = [];
    for (const doc of driversQuery.docs) {
      const driverData = doc.data();

      // Get user information
      const userDoc = await db.collection('users').doc(driverData.userId).get();
      const userData = userDoc.exists ? userDoc.data() : {};

      pendingDrivers.push({
        id: doc.id,
        userId: driverData.userId,
        name: userData.name || 'Unknown',
        phoneNumber: userData.phoneNumber || 'Unknown',
        email: userData.email || null,
        vehicleInfo: driverData.vehicleInfo,
        documents: driverData.documents,
        submittedAt: driverData.createdAt,
        verificationStatus: driverData.verificationStatus
      });
    }

    res.status(200).json({
      success: true,
      drivers: pendingDrivers,
      count: pendingDrivers.length
    });
  } catch (error) {
    logger.error('Error getting pending drivers:', error);
    next(error);
  }
});

/**
 * PUT /api/admin/drivers/:id/verify
 * Approve or reject driver verification
 */
router.put('/drivers/:id/verify', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status',
        message: 'Status must be either "approved" or "rejected"'
      });
    }

    if (status === 'rejected' && !rejectionReason) {
      return res.status(400).json({
        success: false,
        error: 'Rejection reason required',
        message: 'Please provide a reason for rejection'
      });
    }

    const driverRef = db.collection('drivers').doc(id);
    const driverDoc = await driverRef.get();

    if (!driverDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Driver not found'
      });
    }

    const driverData = driverDoc.data();

    if (driverData.verificationStatus !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Cannot verify driver',
        message: `Driver verification is ${driverData.verificationStatus} and cannot be updated`
      });
    }

    // Update driver verification status
    await driverRef.update({
      verificationStatus: status === 'approved' ? 'verified' : 'rejected',
      rejectionReason: rejectionReason || null,
      verifiedAt: status === 'approved' ? FieldValue.serverTimestamp() : null,
      updatedAt: FieldValue.serverTimestamp()
    });

    // Find and update verification record
    const verificationQuery = await db.collection('verifications')
      .where('driverId', '==', id)
      .where('status', '==', 'pending')
      .orderBy('submittedAt', 'desc')
      .limit(1)
      .get();

    if (!verificationQuery.empty) {
      const verificationDoc = verificationQuery.docs[0];
      await verificationDoc.ref.update({
        status: status,
        reviewedAt: FieldValue.serverTimestamp(),
        reviewedBy: req.user.uid,
        rejectionReason: rejectionReason || null
      });
    }

    // Log the verification action
    await db.collection('logs').add({
      action: 'driver_verification',
      driverId: id,
      status: status,
      rejectionReason: rejectionReason || null,
      adminId: req.user.uid,
      timestamp: FieldValue.serverTimestamp()
    });

    const action = status === 'approved' ? 'approved' : 'rejected';
    logger.info(`Driver ${id} verification ${action} by admin ${req.user.uid}`);

    res.status(200).json({
      success: true,
      message: `Driver verification ${action} successfully`
    });
  } catch (error) {
    logger.error('Error verifying driver:', error);
    next(error);
  }
});

/**
 * GET /api/admin/drivers
 * List all drivers with status
 */
router.get('/drivers', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const offset = (pageNumber - 1) * limitNumber;

    let driversQuery = db.collection('drivers').orderBy('createdAt', 'desc');

    // Filter by status if provided
    if (status && ['pending', 'verified', 'rejected', 'suspended'].includes(status)) {
      driversQuery = driversQuery.where('verificationStatus', '==', status);
    }

    // Get total count for pagination
    const countSnapshot = await driversQuery.get();
    const totalCount = countSnapshot.size;

    // Apply pagination
    driversQuery = driversQuery.limit(limitNumber).offset(offset);
    const driversSnapshot = await driversQuery.get();

    const drivers = [];
    for (const doc of driversSnapshot.docs) {
      const driverData = doc.data();

      // Get user information
      const userDoc = await db.collection('users').doc(driverData.userId).get();
      const userData = userDoc.exists ? userDoc.data() : {};

      drivers.push({
        id: doc.id,
        userId: driverData.userId,
        name: userData.name || 'Unknown',
        phoneNumber: userData.phoneNumber || 'Unknown',
        email: userData.email || null,
        vehicleInfo: driverData.vehicleInfo,
        verificationStatus: driverData.verificationStatus,
        rejectionReason: driverData.rejectionReason || null,
        isOnline: driverData.isOnline || false,
        rating: driverData.rating || 0,
        totalRides: driverData.totalRides || 0,
        totalDeliveries: driverData.totalDeliveries || 0,
        totalEarnings: driverData.totalEarnings || 0,
        createdAt: driverData.createdAt,
        verifiedAt: driverData.verifiedAt || null
      });
    }

    res.status(200).json({
      success: true,
      drivers,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total: totalCount,
        pages: Math.ceil(totalCount / limitNumber)
      }
    });
  } catch (error) {
    logger.error('Error getting drivers:', error);
    next(error);
  }
});

/**
 * GET /api/admin/users
 * List all users
 */
router.get('/users', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { role, page = 1, limit = 20 } = req.query;
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const offset = (pageNumber - 1) * limitNumber;

    let usersQuery = db.collection('users').orderBy('createdAt', 'desc');

    // Filter by role if provided
    if (role && ['user', 'driver', 'admin'].includes(role)) {
      usersQuery = usersQuery.where('role', '==', role);
    }

    // Get total count for pagination
    const countSnapshot = await usersQuery.get();
    const totalCount = countSnapshot.size;

    // Apply pagination
    usersQuery = usersQuery.limit(limitNumber).offset(offset);
    const usersSnapshot = await usersQuery.get();

    const users = [];
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      users.push({
        id: doc.id,
        phoneNumber: userData.phoneNumber,
        name: userData.name || null,
        email: userData.email || null,
        role: userData.role,
        isActive: userData.isActive !== false,
        ageVerified: userData.ageVerified || false,
        language: userData.language || 'en',
        createdAt: userData.createdAt,
        updatedAt: userData.updatedAt
      });
    });

    res.status(200).json({
      success: true,
      users,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total: totalCount,
        pages: Math.ceil(totalCount / limitNumber)
      }
    });
  } catch (error) {
    logger.error('Error getting users:', error);
    next(error);
  }
});

/**
 * GET /api/admin/rides
 * View all ride history
 */
router.get('/rides', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const offset = (pageNumber - 1) * limitNumber;

    let ridesQuery = db.collection('rides').orderBy('createdAt', 'desc');

    // Filter by status if provided
    if (status && ['requested', 'confirmed', 'driver_assigned', 'arriving', 'in_progress', 'completed', 'cancelled'].includes(status)) {
      ridesQuery = ridesQuery.where('status', '==', status);
    }

    // Get total count for pagination
    const countSnapshot = await ridesQuery.get();
    const totalCount = countSnapshot.size;

    // Apply pagination
    ridesQuery = ridesQuery.limit(limitNumber).offset(offset);
    const ridesSnapshot = await ridesQuery.get();

    const rides = [];
    for (const doc of ridesSnapshot.docs) {
      const rideData = doc.data();

      // Get user and driver information
      const userDoc = await db.collection('users').doc(rideData.userId).get();
      const userData = userDoc.exists ? userDoc.data() : {};

      let driverData = null;
      if (rideData.driverId) {
        const driverDoc = await db.collection('drivers').doc(rideData.driverId).get();
        const driverUserDoc = driverDoc.exists ?
          await db.collection('users').doc(driverDoc.data().userId).get() : null;

        if (driverDoc.exists) {
          driverData = {
            ...driverDoc.data(),
            name: driverUserDoc?.exists ? driverUserDoc.data().name : 'Unknown'
          };
        }
      }

      rides.push({
        id: doc.id,
        user: {
          id: rideData.userId,
          name: userData.name || 'Unknown',
          phoneNumber: userData.phoneNumber || 'Unknown'
        },
        driver: driverData ? {
          id: rideData.driverId,
          name: driverData.name || 'Unknown'
        } : null,
        pickup: rideData.pickup,
        destination: rideData.destination,
        vehicleType: rideData.vehicleType,
        fare: rideData.fare,
        status: rideData.status,
        createdAt: rideData.createdAt,
        startedAt: rideData.startedAt || null,
        completedAt: rideData.completedAt || null,
        cancelledAt: rideData.cancelledAt || null,
        cancelledBy: rideData.cancelledBy || null
      });
    }

    res.status(200).json({
      success: true,
      rides,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total: totalCount,
        pages: Math.ceil(totalCount / limitNumber)
      }
    });
  } catch (error) {
    logger.error('Error getting rides:', error);
    next(error);
  }
});

/**
 * GET /api/admin/deliveries
 * View all delivery history
 */
router.get('/deliveries', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const offset = (pageNumber - 1) * limitNumber;

    let deliveriesQuery = db.collection('deliveries').orderBy('createdAt', 'desc');

    // Filter by status if provided
    if (status && ['requested', 'confirmed', 'driver_assigned', 'picked_up', 'in_transit', 'completed', 'cancelled'].includes(status)) {
      deliveriesQuery = deliveriesQuery.where('status', '==', status);
    }

    // Get total count for pagination
    const countSnapshot = await deliveriesQuery.get();
    const totalCount = countSnapshot.size;

    // Apply pagination
    deliveriesQuery = deliveriesQuery.limit(limitNumber).offset(offset);
    const deliveriesSnapshot = await deliveriesQuery.get();

    const deliveries = [];
    for (const doc of deliveriesSnapshot.docs) {
      const deliveryData = doc.data();

      // Get sender and driver information
      const senderDoc = await db.collection('users').doc(deliveryData.senderId).get();
      const senderData = senderDoc.exists ? senderDoc.data() : {};

      let driverData = null;
      if (deliveryData.driverId) {
        const driverDoc = await db.collection('drivers').doc(deliveryData.driverId).get();
        const driverUserDoc = driverDoc.exists ?
          await db.collection('users').doc(driverDoc.data().userId).get() : null;

        if (driverDoc.exists) {
          driverData = {
            ...driverDoc.data(),
            name: driverUserDoc?.exists ? driverUserDoc.data().name : 'Unknown'
          };
        }
      }

      deliveries.push({
        id: doc.id,
        sender: {
          id: deliveryData.senderId,
          name: senderData.name || 'Unknown',
          phoneNumber: senderData.phoneNumber || 'Unknown'
        },
        driver: driverData ? {
          id: deliveryData.driverId,
          name: driverData.name || 'Unknown'
        } : null,
        pickup: deliveryData.pickup,
        destination: deliveryData.destination,
        recipient: {
          name: deliveryData.destination.contactName,
          phone: deliveryData.destination.contactPhone
        },
        packageType: deliveryData.packageType,
        fare: deliveryData.fare,
        status: deliveryData.status,
        proofPhotoUrl: deliveryData.proofPhotoUrl || null,
        createdAt: deliveryData.createdAt,
        acceptedAt: deliveryData.acceptedAt || null,
        pickedUpAt: deliveryData.pickedUpAt || null,
        completedAt: deliveryData.completedAt || null,
        cancelledAt: deliveryData.cancelledAt || null,
        cancelledBy: deliveryData.cancelledBy || null
      });
    }

    res.status(200).json({
      success: true,
      deliveries,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total: totalCount,
        pages: Math.ceil(totalCount / limitNumber)
      }
    });
  } catch (error) {
    logger.error('Error getting deliveries:', error);
    next(error);
  }
});

/**
 * GET /api/admin/analytics
 * System analytics and metrics
 */
router.get('/analytics', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { period = 'month' } = req.query;

    // Calculate date range based on period
    const now = new Date();
    let startDate;

    switch (period) {
      case 'day':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid period',
          message: 'Period must be one of: day, week, month, year'
        });
    }

    // Get user statistics
    const totalUsers = await db.collection('users').get();
    const activeDriversQuery = await db.collection('drivers')
      .where('verificationStatus', '==', 'verified')
      .get();
    const pendingDriversQuery = await db.collection('drivers')
      .where('verificationStatus', '==', 'pending')
      .get();

    // Get ride statistics for the period
    const ridesQuery = await db.collection('rides')
      .where('createdAt', '>=', startDate)
      .get();

    const completedRidesQuery = await db.collection('rides')
      .where('status', '==', 'completed')
      .where('completedAt', '>=', startDate)
      .get();

    // Get delivery statistics for the period
    const deliveriesQuery = await db.collection('deliveries')
      .where('createdAt', '>=', startDate)
      .get();

    const completedDeliveriesQuery = await db.collection('deliveries')
      .where('status', '==', 'completed')
      .where('completedAt', '>=', startDate)
      .get();

    // Calculate revenue
    let totalRevenue = 0;
    completedRidesQuery.forEach(doc => {
      totalRevenue += doc.data().fare || 0;
    });
    completedDeliveriesQuery.forEach(doc => {
      totalRevenue += doc.data().fare || 0;
    });

    // Get cancellation statistics
    const cancelledRidesQuery = await db.collection('rides')
      .where('status', '==', 'cancelled')
      .where('cancelledAt', '>=', startDate)
      .get();

    const cancelledDeliveriesQuery = await db.collection('deliveries')
      .where('status', '==', 'cancelled')
      .where('cancelledAt', '>=', startDate)
      .get();

    // Calculate daily breakdown
    const dailyStats = {};
    const days = Math.ceil((now - startDate) / (1000 * 60 * 60 * 24));

    for (let i = 0; i <= days; i++) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      dailyStats[dateStr] = {
        rides: 0,
        deliveries: 0,
        revenue: 0,
        cancellations: 0
      };
    }

    // Add daily ride data
    ridesQuery.forEach(doc => {
      const rideData = doc.data();
      const createdDate = rideData.createdAt.toDate().toISOString().split('T')[0];
      if (dailyStats[createdDate]) {
        dailyStats[createdDate].rides += 1;
        if (rideData.status === 'completed') {
          dailyStats[createdDate].revenue += rideData.fare || 0;
        } else if (rideData.status === 'cancelled') {
          dailyStats[createdDate].cancellations += 1;
        }
      }
    });

    // Add daily delivery data
    deliveriesQuery.forEach(doc => {
      const deliveryData = doc.data();
      const createdDate = deliveryData.createdAt.toDate().toISOString().split('T')[0];
      if (dailyStats[createdDate]) {
        dailyStats[createdDate].deliveries += 1;
        if (deliveryData.status === 'completed') {
          dailyStats[createdDate].revenue += deliveryData.fare || 0;
        } else if (deliveryData.status === 'cancelled') {
          dailyStats[createdDate].cancellations += 1;
        }
      }
    });

    const analytics = {
      period,
      users: {
        total: totalUsers.size,
        drivers: {
          active: activeDriversQuery.size,
          pending: pendingDriversQuery.size
        }
      },
      rides: {
        total: ridesQuery.size,
        completed: completedRidesQuery.size,
        cancelled: cancelledRidesQuery.size
      },
      deliveries: {
        total: deliveriesQuery.size,
        completed: completedDeliveriesQuery.size,
        cancelled: cancelledDeliveriesQuery.size
      },
      revenue: Math.round(totalRevenue * 100) / 100,
      dailyStats
    };

    res.status(200).json({
      success: true,
      analytics
    });
  } catch (error) {
    logger.error('Error getting analytics:', error);
    next(error);
  }
});

/**
 * PUT /api/admin/drivers/:id/suspend
 * Suspend or unsuspend a driver
 */
router.put('/drivers/:id/suspend', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { suspended, reason } = req.body;

    if (typeof suspended !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Invalid status',
        message: 'suspended must be a boolean value'
      });
    }

    const driverRef = db.collection('drivers').doc(id);
    const driverDoc = await driverRef.get();

    if (!driverDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Driver not found'
      });
    }

    const updateData = {
      isSuspended: suspended,
      updatedAt: FieldValue.serverTimestamp()
    };

    if (suspended) {
      updateData.suspensionReason = reason || 'Administrative action';
      updateData.suspendedAt = FieldValue.serverTimestamp();

      // Force driver offline if suspended
      updateData.isOnline = false;
    } else {
      updateData.suspensionReason = null;
      updateData.suspendedAt = null;
    }

    await driverRef.update(updateData);

    // Log the suspension action
    await db.collection('logs').add({
      action: 'driver_suspension',
      driverId: id,
      suspended,
      reason: reason || null,
      adminId: req.user.uid,
      timestamp: FieldValue.serverTimestamp()
    });

    const action = suspended ? 'suspended' : 'unsuspended';
    logger.info(`Driver ${id} ${action} by admin ${req.user.uid}`);

    res.status(200).json({
      success: true,
      message: `Driver ${action} successfully`
    });
  } catch (error) {
    logger.error('Error updating driver suspension:', error);
    next(error);
  }
});

module.exports = router;