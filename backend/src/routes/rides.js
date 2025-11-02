const express = require('express');
const router = express.Router();
const { auth, db, FieldValue } = require('../config/firebase');
const { authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');

/**
 * POST /api/rides/create
 * Create a new ride request
 */
router.post('/create', authenticate, async (req, res, next) => {
  try {
    const { pickup, destination, vehicleType, fare, notes } = req.body;

    // Validate required fields
    if (!pickup || !destination || !vehicleType || !fare) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'pickup, destination, vehicleType, and fare are required'
      });
    }

    // Validate pickup and destination coordinates
    if (!pickup.latitude || !pickup.longitude || !destination.latitude || !destination.longitude) {
      return res.status(400).json({
        success: false,
        error: 'Invalid coordinates',
        message: 'Both pickup and destination must have valid latitude and longitude'
      });
    }

    // Validate vehicle type
    const validVehicleTypes = ['economy', 'comfort', 'xl'];
    if (!validVehicleTypes.includes(vehicleType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid vehicle type',
        message: 'Vehicle type must be one of: economy, comfort, xl'
      });
    }

    // Validate fare
    if (typeof fare !== 'number' || fare <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid fare',
        message: 'Fare must be a positive number'
      });
    }

    // Check if user has any active rides
    const activeRidesQuery = await db.collection('rides')
      .where('userId', '==', req.user.uid)
      .where('status', 'in', ['requested', 'confirmed', 'driver_assigned', 'arriving', 'in_progress'])
      .get();

    if (!activeRidesQuery.empty) {
      return res.status(400).json({
        success: false,
        error: 'Active ride exists',
        message: 'You already have an active ride. Please complete or cancel it before booking a new one.'
      });
    }

    // Create ride document
    const rideData = {
      userId: req.user.uid,
      pickup: {
        address: pickup.address || `${pickup.latitude}, ${pickup.longitude}`,
        latitude: pickup.latitude,
        longitude: pickup.longitude,
        placeId: pickup.placeId || null
      },
      destination: {
        address: destination.address || `${destination.latitude}, ${destination.longitude}`,
        latitude: destination.latitude,
        longitude: destination.longitude,
        placeId: destination.placeId || null
      },
      vehicleType,
      fare,
      notes: notes || '',
      status: 'requested',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    const rideRef = await db.collection('rides').add(rideData);
    const rideDoc = await rideRef.get();

    logger.info(`Ride created: ${rideRef.id} by user ${req.user.uid}`);

    res.status(201).json({
      success: true,
      message: 'Ride created successfully',
      ride: {
        id: rideRef.id,
        ...rideDoc.data()
      }
    });
  } catch (error) {
    logger.error('Error creating ride:', error);
    next(error);
  }
});

/**
 * GET /api/rides/nearby
 * Find available drivers near user location
 */
router.get('/nearby', authenticate, async (req, res, next) => {
  try {
    const { latitude, longitude, radius = 5 } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        error: 'Location required',
        message: 'Latitude and longitude are required'
      });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const searchRadius = parseFloat(radius);

    // Validate coordinates
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({
        success: false,
        error: 'Invalid coordinates'
      });
    }

    // Find nearby online drivers (simplified geospatial query)
    // In production, use geohash or proper geospatial indexing
    const nearbyDriversQuery = await db.collection('drivers')
      .where('isOnline', '==', true)
      .where('verificationStatus', '==', 'verified')
      .get();

    const nearbyDrivers = [];
    nearbyDriversQuery.forEach(doc => {
      const driverData = doc.data();
      if (driverData.currentLocation) {
        const distance = calculateDistance(
          lat, lng,
          driverData.currentLocation.latitude,
          driverData.currentLocation.longitude
        );

        if (distance <= searchRadius) {
          nearbyDrivers.push({
            id: doc.id,
            ...driverData,
            distance: Math.round(distance * 100) / 100 // Round to 2 decimal places
          });
        }
      }
    });

    // Sort by distance
    nearbyDrivers.sort((a, b) => a.distance - b.distance);

    res.status(200).json({
      success: true,
      drivers: nearbyDrivers
    });
  } catch (error) {
    logger.error('Error finding nearby drivers:', error);
    next(error);
  }
});

/**
 * GET /api/rides/:id
 * Get ride details by ID
 */
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const rideDoc = await db.collection('rides').doc(id).get();

    if (!rideDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Ride not found'
      });
    }

    const rideData = rideDoc.data();

    // Check if user has access to this ride
    const hasAccess = rideData.userId === req.user.uid ||
                     rideData.driverId === req.user.uid ||
                     req.user.role === 'admin';

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You do not have permission to view this ride'
      });
    }

    res.status(200).json({
      success: true,
      ride: {
        id: rideDoc.id,
        ...rideData
      }
    });
  } catch (error) {
    logger.error('Error getting ride details:', error);
    next(error);
  }
});

/**
 * PUT /api/rides/:id/accept
 * Driver accepts a ride
 */
router.put('/:id/accept', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if user is a driver
    if (req.user.role !== 'driver') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'Only drivers can accept rides'
      });
    }

    // Check driver verification status
    const driverDoc = await db.collection('drivers').doc(req.user.uid).get();
    if (!driverDoc.exists || driverDoc.data().verificationStatus !== 'verified') {
      return res.status(403).json({
        success: false,
        error: 'Driver not verified',
        message: 'Only verified drivers can accept rides'
      });
    }

    const rideRef = db.collection('rides').doc(id);
    const rideDoc = await rideRef.get();

    if (!rideDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Ride not found'
      });
    }

    const rideData = rideDoc.data();

    // Check if ride is available for acceptance
    if (rideData.status !== 'requested') {
      return res.status(400).json({
        success: false,
        error: 'Ride not available',
        message: `Ride is ${rideData.status} and cannot be accepted`
      });
    }

    // Accept the ride
    await rideRef.update({
      driverId: req.user.uid,
      status: 'confirmed',
      acceptedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    // Update driver status
    await db.collection('drivers').doc(req.user.uid).update({
      currentRideId: id,
      isAvailable: false,
      updatedAt: FieldValue.serverTimestamp()
    });

    logger.info(`Ride ${id} accepted by driver ${req.user.uid}`);

    res.status(200).json({
      success: true,
      message: 'Ride accepted successfully'
    });
  } catch (error) {
    logger.error('Error accepting ride:', error);
    next(error);
  }
});

/**
 * PUT /api/rides/:id/start
 * Driver starts the ride
 */
router.put('/:id/start', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const rideRef = db.collection('rides').doc(id);
    const rideDoc = await rideRef.get();

    if (!rideDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Ride not found'
      });
    }

    const rideData = rideDoc.data();

    // Check if user is the assigned driver
    if (rideData.driverId !== req.user.uid) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'Only the assigned driver can start this ride'
      });
    }

    // Check if ride can be started
    if (rideData.status !== 'confirmed' && rideData.status !== 'arriving') {
      return res.status(400).json({
        success: false,
        error: 'Cannot start ride',
        message: `Ride is ${rideData.status} and cannot be started`
      });
    }

    // Start the ride
    await rideRef.update({
      status: 'in_progress',
      startedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    logger.info(`Ride ${id} started by driver ${req.user.uid}`);

    res.status(200).json({
      success: true,
      message: 'Ride started successfully'
    });
  } catch (error) {
    logger.error('Error starting ride:', error);
    next(error);
  }
});

/**
 * PUT /api/rides/:id/complete
 * Driver completes the ride
 */
router.put('/:id/complete', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const rideRef = db.collection('rides').doc(id);
    const rideDoc = await rideRef.get();

    if (!rideDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Ride not found'
      });
    }

    const rideData = rideDoc.data();

    // Check if user is the assigned driver
    if (rideData.driverId !== req.user.uid) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'Only the assigned driver can complete this ride'
      });
    }

    // Check if ride can be completed
    if (rideData.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        error: 'Cannot complete ride',
        message: `Ride is ${rideData.status} and cannot be completed`
      });
    }

    // Complete the ride
    await rideRef.update({
      status: 'completed',
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    // Update driver status
    await db.collection('drivers').doc(req.user.uid).update({
      currentRideId: null,
      isAvailable: true,
      updatedAt: FieldValue.serverTimestamp()
    });

    // Create payment record
    await db.collection('payments').add({
      rideId: id,
      userId: rideData.userId,
      driverId: rideData.driverId,
      amount: rideData.fare,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp()
    });

    logger.info(`Ride ${id} completed by driver ${req.user.uid}`);

    res.status(200).json({
      success: true,
      message: 'Ride completed successfully'
    });
  } catch (error) {
    logger.error('Error completing ride:', error);
    next(error);
  }
});

/**
 * PUT /api/rides/:id/cancel
 * Cancel a ride
 */
router.put('/:id/cancel', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const rideRef = db.collection('rides').doc(id);
    const rideDoc = await rideRef.get();

    if (!rideDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Ride not found'
      });
    }

    const rideData = rideDoc.data();

    // Check if user has permission to cancel this ride
    const isPassenger = rideData.userId === req.user.uid;
    const isDriver = rideData.driverId === req.user.uid;
    const isAdmin = req.user.role === 'admin';

    if (!isPassenger && !isDriver && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You do not have permission to cancel this ride'
      });
    }

    // Check if ride can be cancelled
    if (['completed', 'cancelled'].includes(rideData.status)) {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel ride',
        message: `Ride is ${rideData.status} and cannot be cancelled`
      });
    }

    // Determine cancellation fee
    let cancellationFee = 0;
    const cancelledBy = isPassenger ? 'passenger' : isDriver ? 'driver' : 'admin';

    // If driver was assigned and ride is cancelled after 2 minutes, apply fee
    if (rideData.driverId && rideData.acceptedAt) {
      const acceptanceTime = rideData.acceptedAt.toDate();
      const currentTime = new Date();
      const timeDiff = (currentTime - acceptanceTime) / (1000 * 60); // minutes

      if (timeDiff > 2 && cancelledBy === 'passenger') {
        cancellationFee = rideData.fare * 0.1; // 10% cancellation fee
      }
    }

    // Cancel the ride
    await rideRef.update({
      status: 'cancelled',
      cancelledBy,
      cancellationReason: reason || 'No reason provided',
      cancellationFee,
      cancelledAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    // Update driver status if driver was assigned
    if (rideData.driverId) {
      await db.collection('drivers').doc(rideData.driverId).update({
        currentRideId: null,
        isAvailable: true,
        updatedAt: FieldValue.serverTimestamp()
      });
    }

    // Create cancellation record
    await db.collection('cancellations').add({
      rideId: id,
      userId: rideData.userId,
      driverId: rideData.driverId || null,
      cancelledBy,
      reason: reason || 'No reason provided',
      cancellationFee,
      createdAt: FieldValue.serverTimestamp()
    });

    logger.info(`Ride ${id} cancelled by ${cancelledBy}`);

    res.status(200).json({
      success: true,
      message: 'Ride cancelled successfully',
      cancellationFee: cancellationFee > 0 ? Math.round(cancellationFee * 100) / 100 : 0
    });
  } catch (error) {
    logger.error('Error cancelling ride:', error);
    next(error);
  }
});

/**
 * GET /api/rides/my-history
 * Get user's completed ride history
 */
router.get('/my-history', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.uid;

    const ridesRef = db.collection('rides');
    const snapshot = await ridesRef
      .where('userId', '==', userId)
      .where('status', 'in', ['completed', 'cancelled'])
      .orderBy('createdAt', 'desc')
      .get();

    const rides = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate()
    }));

    res.status(200).json({
      success: true,
      rides
    });
  } catch (error) {
    logger.error('Error fetching ride history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch ride history'
    });
  }
});

/**
 * Helper function to calculate distance between two coordinates
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

module.exports = router;