const express = require('express');
const router = express.Router();
const { auth, db, FieldValue, storage } = require('../config/firebase');
const { authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');
const multer = require('multer');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

/**
 * POST /api/drivers/register
 * Register as a driver with document upload
 */
router.post('/register', authenticate, upload.fields([
  { name: 'driverLicense', maxCount: 1 },
  { name: 'vehicleRegistration', maxCount: 1 },
  { name: 'vehicleInsurance', maxCount: 1 },
  { name: 'profilePhoto', maxCount: 1 }
]), async (req, res, next) => {
  try {
    const {
      vehicleType,
      vehicleMake,
      vehicleModel,
      vehicleYear,
      vehicleColor,
      licensePlate
    } = req.body;

    // Validate required fields
    const requiredFields = [
      'vehicleType', 'vehicleMake', 'vehicleModel',
      'vehicleYear', 'vehicleColor', 'licensePlate'
    ];

    for (const field of requiredFields) {
      if (!req.body[field]) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field',
          message: `${field} is required`
        });
      }
    }

    // Validate vehicle type
    const validVehicleTypes = ['bike', 'car', 'auto'];
    if (!validVehicleTypes.includes(vehicleType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid vehicle type',
        message: 'Vehicle type must be one of: bike, car, auto'
      });
    }

    // Validate vehicle year
    const currentYear = new Date().getFullYear();
    const vehicleYearNum = parseInt(vehicleYear);
    if (isNaN(vehicleYearNum) || vehicleYearNum < 1990 || vehicleYearNum > currentYear + 1) {
      return res.status(400).json({
        success: false,
        error: 'Invalid vehicle year',
        message: `Vehicle year must be between 1990 and ${currentYear + 1}`
      });
    }

    // Validate required documents
    const requiredDocuments = ['driverLicense', 'vehicleRegistration', 'vehicleInsurance'];
    const uploadedDocuments = {};

    for (const docName of requiredDocuments) {
      if (!req.files[docName] || req.files[docName].length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Missing document',
          message: `${docName} is required for registration`
        });
      }

      const file = req.files[docName][0];

      // Validate file type
      if (!file.mimetype.startsWith('image/') && !file.mimetype.includes('pdf')) {
        return res.status(400).json({
          success: false,
          error: 'Invalid file type',
          message: `${docName} must be an image or PDF file`
        });
      }

      // Upload document to Firebase Storage
      const fileName = `driver_documents/${req.user.uid}/${docName}_${Date.now()}_${file.originalname}`;
      const fileRef = storage.bucket().file(fileName);

      await fileRef.save(file.buffer, {
        metadata: {
          contentType: file.mimetype
        }
      });

      // Make file accessible to driver and admins
      await fileRef.makePublic();

      uploadedDocuments[docName] = `https://storage.googleapis.com/${storage.bucket().name}/${fileName}`;
    }

    // Upload profile photo if provided
    if (req.files.profilePhoto && req.files.profilePhoto.length > 0) {
      const profilePhoto = req.files.profilePhoto[0];

      if (!profilePhoto.mimetype.startsWith('image/')) {
        return res.status(400).json({
          success: false,
          error: 'Invalid profile photo',
          message: 'Profile photo must be an image file'
        });
      }

      const fileName = `profile_photos/${req.user.uid}/profile_${Date.now()}_${profilePhoto.originalname}`;
      const fileRef = storage.bucket().file(fileName);

      await fileRef.save(profilePhoto.buffer, {
        metadata: {
          contentType: profilePhoto.mimetype
        }
      });

      await fileRef.makePublic();

      uploadedDocuments.profilePhotoUrl = `https://storage.googleapis.com/${storage.bucket().name}/${fileName}`;
    }

    // Check if driver already exists
    const existingDriverDoc = await db.collection('drivers').doc(req.user.uid).get();
    if (existingDriverDoc.exists) {
      return res.status(400).json({
        success: false,
        error: 'Already registered',
        message: 'You are already registered as a driver'
      });
    }

    // Create driver document
    const driverData = {
      userId: req.user.uid,
      vehicleInfo: {
        type: vehicleType,
        make: vehicleMake,
        model: vehicleModel,
        year: vehicleYearNum,
        color: vehicleColor,
        licensePlate: licensePlate.toUpperCase()
      },
      documents: {
        driverLicense: uploadedDocuments.driverLicense,
        vehicleRegistration: uploadedDocuments.vehicleRegistration,
        vehicleInsurance: uploadedDocuments.vehicleInsurance,
        profilePhotoUrl: uploadedDocuments.profilePhotoUrl || null
      },
      verificationStatus: 'pending',
      isOnline: false,
      isAvailable: true,
      currentRideId: null,
      currentDeliveryId: null,
      rating: 0,
      totalRides: 0,
      totalDeliveries: 0,
      totalEarnings: 0,
      currentLocation: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    await db.collection('drivers').doc(req.user.uid).set(driverData);

    // Update user role to driver
    await db.collection('users').doc(req.user.uid).update({
      role: 'driver',
      updatedAt: FieldValue.serverTimestamp()
    });

    // Create verification record for admin review
    await db.collection('verifications').add({
      driverId: req.user.uid,
      status: 'pending',
      documents: uploadedDocuments,
      vehicleInfo: driverData.vehicleInfo,
      submittedAt: FieldValue.serverTimestamp(),
      reviewedAt: null,
      reviewedBy: null
    });

    logger.info(`Driver registration submitted: ${req.user.uid}`);

    res.status(201).json({
      success: true,
      message: 'Driver registration submitted successfully',
      verificationStatus: 'pending'
    });
  } catch (error) {
    logger.error('Error in driver registration:', error);
    next(error);
  }
});

/**
 * GET /api/drivers/nearby
 * Find available drivers near location
 */
router.get('/nearby', authenticate, async (req, res, next) => {
  try {
    const { latitude, longitude, radius = 5, vehicleType } = req.query;

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

    // Build query for nearby drivers
    let driversQuery = db.collection('drivers')
      .where('isOnline', '==', true)
      .where('isAvailable', '==', true)
      .where('verificationStatus', '==', 'verified');

    // Filter by vehicle type if specified
    if (vehicleType) {
      driversQuery = driversQuery.where('vehicleInfo.type', '==', vehicleType);
    }

    const driversSnapshot = await driversQuery.get();

    const nearbyDrivers = [];
    driversSnapshot.forEach(doc => {
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
            name: doc.data().name || 'Driver',
            vehicleInfo: driverData.vehicleInfo,
            rating: driverData.rating || 0,
            totalRides: driverData.totalRides || 0,
            distance: Math.round(distance * 100) / 100,
            profilePhotoUrl: driverData.documents?.profilePhotoUrl || null
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
 * PUT /api/drivers/location
 * Update driver live location
 */
router.put('/location', authenticate, async (req, res, next) => {
  try {
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        error: 'Location required',
        message: 'Latitude and longitude are required'
      });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    // Validate coordinates
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({
        success: false,
        error: 'Invalid coordinates'
      });
    }

    // Check if user is a driver
    if (req.user.role !== 'driver') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'Only drivers can update their location'
      });
    }

    // Update driver location
    await db.collection('drivers').doc(req.user.uid).update({
      currentLocation: {
        latitude: lat,
        longitude: lng,
        timestamp: FieldValue.serverTimestamp()
      },
      locationUpdatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    res.status(200).json({
      success: true,
      message: 'Location updated successfully'
    });
  } catch (error) {
    logger.error('Error updating driver location:', error);
    next(error);
  }
});

/**
 * PUT /api/drivers/availability
 * Toggle online/offline status
 */
router.put('/availability', authenticate, async (req, res, next) => {
  try {
    const { isOnline } = req.body;

    if (typeof isOnline !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Invalid status',
        message: 'isOnline must be a boolean value'
      });
    }

    // Check if user is a driver
    if (req.user.role !== 'driver') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'Only drivers can update their availability'
      });
    }

    // Check driver verification status
    const driverDoc = await db.collection('drivers').doc(req.user.uid).get();
    if (!driverDoc.exists || driverDoc.data().verificationStatus !== 'verified') {
      return res.status(403).json({
        success: false,
        error: 'Driver not verified',
        message: 'Only verified drivers can go online'
      });
    }

    const driverData = driverDoc.data();

    // If driver has active ride/delivery, they cannot go offline
    if (!isOnline && (driverData.currentRideId || driverData.currentDeliveryId)) {
      return res.status(400).json({
        success: false,
        error: 'Cannot go offline',
        message: 'You have an active ride or delivery. Complete it before going offline.'
      });
    }

    // Update availability
    await db.collection('drivers').doc(req.user.uid).update({
      isOnline,
      updatedAt: FieldValue.serverTimestamp()
    });

    const status = isOnline ? 'online' : 'offline';
    logger.info(`Driver ${req.user.uid} is now ${status}`);

    res.status(200).json({
      success: true,
      message: `Driver is now ${status}`,
      isOnline
    });
  } catch (error) {
    logger.error('Error updating driver availability:', error);
    next(error);
  }
});

/**
 * GET /api/drivers/earnings
 * Get driver earnings summary
 */
router.get('/earnings', authenticate, async (req, res, next) => {
  try {
    // Check if user is a driver
    if (req.user.role !== 'driver') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'Only drivers can view their earnings'
      });
    }

    const { period = 'month' } = req.query;
    const driverId = req.user.uid;

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

    // Get completed rides
    const ridesQuery = await db.collection('rides')
      .where('driverId', '==', driverId)
      .where('status', '==', 'completed')
      .where('completedAt', '>=', startDate)
      .get();

    // Get completed deliveries
    const deliveriesQuery = await db.collection('deliveries')
      .where('driverId', '==', driverId)
      .where('status', '==', 'completed')
      .where('completedAt', '>=', startDate)
      .get();

    let totalEarnings = 0;
    let rideEarnings = 0;
    let deliveryEarnings = 0;
    const completedRides = ridesQuery.size;
    const completedDeliveries = deliveriesQuery.size;

    // Calculate ride earnings
    ridesQuery.forEach(doc => {
      const rideData = doc.data();
      totalEarnings += rideData.fare || 0;
      rideEarnings += rideData.fare || 0;
    });

    // Calculate delivery earnings
    deliveriesQuery.forEach(doc => {
      const deliveryData = doc.data();
      totalEarnings += deliveryData.fare || 0;
      deliveryEarnings += deliveryData.fare || 0;
    });

    // Get daily breakdown for the period
    const dailyEarnings = {};
    const days = Math.ceil((now - startDate) / (1000 * 60 * 60 * 24));

    for (let i = 0; i <= days; i++) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      dailyEarnings[dateStr] = 0;
    }

    // Add ride earnings to daily breakdown
    ridesQuery.forEach(doc => {
      const rideData = doc.data();
      const completedDate = rideData.completedAt.toDate().toISOString().split('T')[0];
      if (dailyEarnings[completedDate] !== undefined) {
        dailyEarnings[completedDate] += rideData.fare || 0;
      }
    });

    // Add delivery earnings to daily breakdown
    deliveriesQuery.forEach(doc => {
      const deliveryData = doc.data();
      const completedDate = deliveryData.completedAt.toDate().toISOString().split('T')[0];
      if (dailyEarnings[completedDate] !== undefined) {
        dailyEarnings[completedDate] += deliveryData.fare || 0;
      }
    });

    res.status(200).json({
      success: true,
      period,
      totalEarnings: Math.round(totalEarnings * 100) / 100,
      rideEarnings: Math.round(rideEarnings * 100) / 100,
      deliveryEarnings: Math.round(deliveryEarnings * 100) / 100,
      completedRides,
      completedDeliveries,
      totalTrips: completedRides + completedDeliveries,
      dailyEarnings
    });
  } catch (error) {
    logger.error('Error getting driver earnings:', error);
    next(error);
  }
});

/**
 * GET /api/drivers/pending-jobs
 * Get pending ride and delivery jobs for drivers
 */
router.get('/pending-jobs', authenticate, async (req, res, next) => {
  try {
    // Check if user is a driver
    if (req.user.role !== 'driver') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'Only drivers can view pending jobs'
      });
    }

    // Check driver verification status
    const driverDoc = await db.collection('drivers').doc(req.user.uid).get();
    if (!driverDoc.exists || driverDoc.data().verificationStatus !== 'verified') {
      return res.status(403).json({
        success: false,
        error: 'Driver not verified',
        message: 'Only verified drivers can view pending jobs'
      });
    }

    const driverData = driverDoc.data();

    // Check if driver is online and available
    if (!driverData.isOnline || !driverData.isAvailable) {
      return res.status(400).json({
        success: false,
        error: 'Driver not available',
        message: 'You must be online and available to view pending jobs'
      });
    }

    // Get driver's current location
    if (!driverData.currentLocation) {
      return res.status(400).json({
        success: false,
        error: 'Location not available',
        message: 'Your current location is required to find nearby jobs'
      });
    }

    const driverLocation = driverData.currentLocation;
    const searchRadius = 10; // 10km radius

    // Get pending rides
    const pendingRidesQuery = await db.collection('rides')
      .where('status', '==', 'requested')
      .get();

    // Get pending deliveries
    const pendingDeliveriesQuery = await db.collection('deliveries')
      .where('status', '==', 'requested')
      .get();

    const allJobs = [];

    // Process rides
    pendingRidesQuery.forEach(doc => {
      const rideData = doc.data();
      const distance = calculateDistance(
        driverLocation.latitude,
        driverLocation.longitude,
        rideData.pickup.latitude,
        rideData.pickup.longitude
      );

      if (distance <= searchRadius) {
        allJobs.push({
          id: doc.id,
          type: 'ride',
          pickup: {
            address: rideData.pickup.address,
            latitude: rideData.pickup.latitude,
            longitude: rideData.pickup.longitude
          },
          destination: {
            address: rideData.destination.address,
            latitude: rideData.destination.latitude,
            longitude: rideData.destination.longitude
          },
          vehicleType: rideData.vehicleType,
          fare: rideData.fare,
          notes: rideData.notes || '',
          requestedAt: rideData.createdAt,
          distance: Math.round(distance * 100) / 100,
          estimatedDuration: Math.round(distance * 2) // Rough estimate: 2 minutes per km
        });
      }
    });

    // Process deliveries
    pendingDeliveriesQuery.forEach(doc => {
      const deliveryData = doc.data();
      const distance = calculateDistance(
        driverLocation.latitude,
        driverLocation.longitude,
        deliveryData.pickup.latitude,
        deliveryData.pickup.longitude
      );

      if (distance <= searchRadius) {
        allJobs.push({
          id: doc.id,
          type: 'delivery',
          pickup: {
            address: deliveryData.pickup.address,
            latitude: deliveryData.pickup.latitude,
            longitude: deliveryData.pickup.longitude
          },
          destination: {
            address: deliveryData.destination.address,
            latitude: deliveryData.destination.latitude,
            longitude: deliveryData.destination.longitude
          },
          packageType: deliveryData.packageType,
          packageDescription: deliveryData.packageDescription || '',
          recipientName: deliveryData.recipientName,
          recipientPhone: deliveryData.recipientPhone,
          fare: deliveryData.fare,
          notes: deliveryData.notes || '',
          requestedAt: deliveryData.createdAt,
          distance: Math.round(distance * 100) / 100,
          estimatedDuration: Math.round(distance * 2) // Rough estimate: 2 minutes per km
        });
      }
    });

    // Sort all jobs by distance (closest first)
    allJobs.sort((a, b) => a.distance - b.distance);

    res.status(200).json({
      success: true,
      jobs: allJobs,
      totalJobs: allJobs.length,
      driverLocation: driverLocation,
      searchRadius
    });
  } catch (error) {
    logger.error('Error getting pending jobs:', error);
    next(error);
  }
});

/**
 * GET /api/drivers/profile
 * Get driver profile details
 */
router.get('/profile', authenticate, async (req, res, next) => {
  try {
    // Check if user is a driver
    if (req.user.role !== 'driver') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'Only drivers can view their profile'
      });
    }

    const driverDoc = await db.collection('drivers').doc(req.user.uid).get();

    if (!driverDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Driver profile not found',
        message: 'Please register as a driver first'
      });
    }

    const driverData = driverDoc.data();

    res.status(200).json({
      success: true,
      driver: {
        id: driverDoc.id,
        userId: driverData.userId,
        vehicleInfo: driverData.vehicleInfo,
        verificationStatus: driverData.verificationStatus,
        isOnline: driverData.isOnline || false,
        isAvailable: driverData.isAvailable || true,
        rating: driverData.rating || 0,
        totalRides: driverData.totalRides || 0,
        totalDeliveries: driverData.totalDeliveries || 0,
        totalEarnings: driverData.totalEarnings || 0,
        documents: {
          profilePhotoUrl: driverData.documents?.profilePhotoUrl || null
          // Other documents are only visible to the driver and admins
        },
        createdAt: driverData.createdAt,
        updatedAt: driverData.updatedAt
      }
    });
  } catch (error) {
    logger.error('Error getting driver profile:', error);
    next(error);
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