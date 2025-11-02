const express = require('express');
const router = express.Router();
const { auth, db, FieldValue, storage } = require('../config/firebase');
const { authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');

/**
 * POST /api/deliveries/create
 * Create a new delivery request
 */
router.post('/create', authenticate, async (req, res, next) => {
  try {
    const { pickup, destination, packageType, fare, recipientName, recipientPhone, notes } = req.body;

    // Validate required fields
    if (!pickup || !destination || !packageType || !fare || !recipientName || !recipientPhone) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'pickup, destination, packageType, fare, recipientName, and recipientPhone are required'
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

    // Validate package type
    const validPackageTypes = ['document', 'package', 'food', 'electronics', 'other'];
    if (!validPackageTypes.includes(packageType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid package type',
        message: 'Package type must be one of: document, package, food, electronics, other'
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

    // Validate phone number format (Indian numbers)
    const phoneRegex = /^\+91[6-9]\d{9}$/;
    if (!phoneRegex.test(recipientPhone)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid recipient phone number',
        message: 'Phone number must be in format: +91XXXXXXXXXX'
      });
    }

    // Check if user has any active deliveries
    const activeDeliveriesQuery = await db.collection('deliveries')
      .where('senderId', '==', req.user.uid)
      .where('status', 'in', ['requested', 'confirmed', 'driver_assigned', 'picked_up', 'in_transit'])
      .get();

    if (!activeDeliveriesQuery.empty) {
      return res.status(400).json({
        success: false,
        error: 'Active delivery exists',
        message: 'You already have an active delivery. Please complete or cancel it before booking a new one.'
      });
    }

    // Create delivery document
    const deliveryData = {
      senderId: req.user.uid,
      pickup: {
        address: pickup.address || `${pickup.latitude}, ${pickup.longitude}`,
        latitude: pickup.latitude,
        longitude: pickup.longitude,
        placeId: pickup.placeId || null,
        contactName: pickup.contactName || req.user.name || 'Sender',
        contactPhone: pickup.contactPhone || req.user.phoneNumber
      },
      destination: {
        address: destination.address || `${destination.latitude}, ${destination.longitude}`,
        latitude: destination.latitude,
        longitude: destination.longitude,
        placeId: destination.placeId || null,
        contactName: recipientName,
        contactPhone: recipientPhone
      },
      packageType,
      fare,
      notes: notes || '',
      status: 'requested',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    const deliveryRef = await db.collection('deliveries').add(deliveryData);
    const deliveryDoc = await deliveryRef.get();

    logger.info(`Delivery created: ${deliveryRef.id} by user ${req.user.uid}`);

    res.status(201).json({
      success: true,
      message: 'Delivery created successfully',
      delivery: {
        id: deliveryRef.id,
        ...deliveryDoc.data()
      }
    });
  } catch (error) {
    logger.error('Error creating delivery:', error);
    next(error);
  }
});

/**
 * GET /api/deliveries/nearby
 * Find delivery requests near driver location
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

    // Check if user is a driver
    if (req.user.role !== 'driver') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'Only drivers can view nearby delivery requests'
      });
    }

    // Find nearby delivery requests (simplified geospatial query)
    const deliveryRequestsQuery = await db.collection('deliveries')
      .where('status', '==', 'requested')
      .get();

    const nearbyDeliveries = [];
    deliveryRequestsQuery.forEach(doc => {
      const deliveryData = doc.data();
      const distance = calculateDistance(
        lat, lng,
        deliveryData.pickup.latitude,
        deliveryData.pickup.longitude
      );

      if (distance <= searchRadius) {
        nearbyDeliveries.push({
          id: doc.id,
          ...deliveryData,
          distance: Math.round(distance * 100) / 100 // Round to 2 decimal places
        });
      }
    });

    // Sort by distance
    nearbyDeliveries.sort((a, b) => a.distance - b.distance);

    res.status(200).json({
      success: true,
      deliveries: nearbyDeliveries
    });
  } catch (error) {
    logger.error('Error finding nearby deliveries:', error);
    next(error);
  }
});

/**
 * GET /api/deliveries/:id
 * Get delivery details by ID
 */
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const deliveryDoc = await db.collection('deliveries').doc(id).get();

    if (!deliveryDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Delivery not found'
      });
    }

    const deliveryData = deliveryDoc.data();

    // Check if user has access to this delivery
    const hasAccess = deliveryData.senderId === req.user.uid ||
                     deliveryData.driverId === req.user.uid ||
                     req.user.role === 'admin';

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You do not have permission to view this delivery'
      });
    }

    res.status(200).json({
      success: true,
      delivery: {
        id: deliveryDoc.id,
        ...deliveryData
      }
    });
  } catch (error) {
    logger.error('Error getting delivery details:', error);
    next(error);
  }
});

/**
 * PUT /api/deliveries/:id/accept
 * Driver accepts a delivery
 */
router.put('/:id/accept', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if user is a driver
    if (req.user.role !== 'driver') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'Only drivers can accept deliveries'
      });
    }

    // Check driver verification status
    const driverDoc = await db.collection('drivers').doc(req.user.uid).get();
    if (!driverDoc.exists || driverDoc.data().verificationStatus !== 'verified') {
      return res.status(403).json({
        success: false,
        error: 'Driver not verified',
        message: 'Only verified drivers can accept deliveries'
      });
    }

    const deliveryRef = db.collection('deliveries').doc(id);
    const deliveryDoc = await deliveryRef.get();

    if (!deliveryDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Delivery not found'
      });
    }

    const deliveryData = deliveryDoc.data();

    // Check if delivery is available for acceptance
    if (deliveryData.status !== 'requested') {
      return res.status(400).json({
        success: false,
        error: 'Delivery not available',
        message: `Delivery is ${deliveryData.status} and cannot be accepted`
      });
    }

    // Accept the delivery
    await deliveryRef.update({
      driverId: req.user.uid,
      status: 'confirmed',
      acceptedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    // Update driver status
    await db.collection('drivers').doc(req.user.uid).update({
      currentDeliveryId: id,
      isAvailable: false,
      updatedAt: FieldValue.serverTimestamp()
    });

    logger.info(`Delivery ${id} accepted by driver ${req.user.uid}`);

    res.status(200).json({
      success: true,
      message: 'Delivery accepted successfully'
    });
  } catch (error) {
    logger.error('Error accepting delivery:', error);
    next(error);
  }
});

/**
 * PUT /api/deliveries/:id/pickup
 * Driver confirms package pickup
 */
router.put('/:id/pickup', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const deliveryRef = db.collection('deliveries').doc(id);
    const deliveryDoc = await deliveryRef.get();

    if (!deliveryDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Delivery not found'
      });
    }

    const deliveryData = deliveryDoc.data();

    // Check if user is the assigned driver
    if (deliveryData.driverId !== req.user.uid) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'Only the assigned driver can confirm pickup'
      });
    }

    // Check if delivery can be picked up
    if (deliveryData.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        error: 'Cannot confirm pickup',
        message: `Delivery is ${deliveryData.status} and pickup cannot be confirmed`
      });
    }

    // Confirm pickup
    await deliveryRef.update({
      status: 'picked_up',
      pickedUpAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    logger.info(`Delivery ${id} picked up by driver ${req.user.uid}`);

    res.status(200).json({
      success: true,
      message: 'Package pickup confirmed successfully'
    });
  } catch (error) {
    logger.error('Error confirming delivery pickup:', error);
    next(error);
  }
});

/**
 * PUT /api/deliveries/:id/complete
 * Driver completes the delivery
 */
router.put('/:id/complete', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { proofPhotoUrl } = req.body;

    const deliveryRef = db.collection('deliveries').doc(id);
    const deliveryDoc = await deliveryRef.get();

    if (!deliveryDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Delivery not found'
      });
    }

    const deliveryData = deliveryDoc.data();

    // Check if user is the assigned driver
    if (deliveryData.driverId !== req.user.uid) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'Only the assigned driver can complete this delivery'
      });
    }

    // Check if delivery can be completed
    if (deliveryData.status !== 'picked_up' && deliveryData.status !== 'in_transit') {
      return res.status(400).json({
        success: false,
        error: 'Cannot complete delivery',
        message: `Delivery is ${deliveryData.status} and cannot be completed`
      });
    }

    // Complete the delivery
    await deliveryRef.update({
      status: 'completed',
      completedAt: FieldValue.serverTimestamp(),
      proofPhotoUrl: proofPhotoUrl || null,
      updatedAt: FieldValue.serverTimestamp()
    });

    // Update driver status
    await db.collection('drivers').doc(req.user.uid).update({
      currentDeliveryId: null,
      isAvailable: true,
      updatedAt: FieldValue.serverTimestamp()
    });

    // Create payment record
    await db.collection('payments').add({
      deliveryId: id,
      senderId: deliveryData.senderId,
      driverId: deliveryData.driverId,
      amount: deliveryData.fare,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp()
    });

    logger.info(`Delivery ${id} completed by driver ${req.user.uid}`);

    res.status(200).json({
      success: true,
      message: 'Delivery completed successfully'
    });
  } catch (error) {
    logger.error('Error completing delivery:', error);
    next(error);
  }
});

/**
 * POST /api/deliveries/:id/proof
 * Upload delivery proof photo
 */
router.post('/:id/proof', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if file is provided (multipart/form-data)
    if (!req.files || !req.files.proofPhoto) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
        message: 'Please upload a proof photo'
      });
    }

    const deliveryDoc = await db.collection('deliveries').doc(id).get();

    if (!deliveryDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Delivery not found'
      });
    }

    const deliveryData = deliveryDoc.data();

    // Check if user is the assigned driver
    if (deliveryData.driverId !== req.user.uid) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'Only the assigned driver can upload proof photos'
      });
    }

    const file = req.files.proofPhoto;

    // Validate file type
    if (!file.mimetype.startsWith('image/')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file type',
        message: 'Only image files are allowed'
      });
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        error: 'File too large',
        message: 'Maximum file size is 5MB'
      });
    }

    // Upload to Firebase Storage
    const fileName = `delivery_proofs/${req.user.uid}/${Date.now()}_${file.name}`;
    const fileRef = storage.bucket().file(fileName);

    await fileRef.save(file.data, {
      metadata: {
        contentType: file.mimetype
      }
    });

    // Make file publicly readable
    await fileRef.makePublic();

    const photoUrl = `https://storage.googleapis.com/${storage.bucket().name}/${fileName}`;

    // Update delivery with proof photo URL
    await db.collection('deliveries').doc(id).update({
      proofPhotoUrl: photoUrl,
      updatedAt: FieldValue.serverTimestamp()
    });

    logger.info(`Proof photo uploaded for delivery ${id} by driver ${req.user.uid}`);

    res.status(200).json({
      success: true,
      message: 'Proof photo uploaded successfully',
      proofPhotoUrl: photoUrl
    });
  } catch (error) {
    logger.error('Error uploading delivery proof:', error);
    next(error);
  }
});

/**
 * PUT /api/deliveries/:id/cancel
 * Cancel a delivery
 */
router.put('/:id/cancel', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const deliveryRef = db.collection('deliveries').doc(id);
    const deliveryDoc = await deliveryRef.get();

    if (!deliveryDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Delivery not found'
      });
    }

    const deliveryData = deliveryDoc.data();

    // Check if user has permission to cancel this delivery
    const isSender = deliveryData.senderId === req.user.uid;
    const isDriver = deliveryData.driverId === req.user.uid;
    const isAdmin = req.user.role === 'admin';

    if (!isSender && !isDriver && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You do not have permission to cancel this delivery'
      });
    }

    // Check if delivery can be cancelled
    if (['completed', 'cancelled'].includes(deliveryData.status)) {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel delivery',
        message: `Delivery is ${deliveryData.status} and cannot be cancelled`
      });
    }

    // Determine cancellation fee
    let cancellationFee = 0;
    const cancelledBy = isSender ? 'sender' : isDriver ? 'driver' : 'admin';

    // If driver was assigned and delivery is cancelled after 2 minutes, apply fee
    if (deliveryData.driverId && deliveryData.acceptedAt) {
      const acceptanceTime = deliveryData.acceptedAt.toDate();
      const currentTime = new Date();
      const timeDiff = (currentTime - acceptanceTime) / (1000 * 60); // minutes

      if (timeDiff > 2 && cancelledBy === 'sender') {
        cancellationFee = deliveryData.fare * 0.1; // 10% cancellation fee
      }
    }

    // Cancel the delivery
    await deliveryRef.update({
      status: 'cancelled',
      cancelledBy,
      cancellationReason: reason || 'No reason provided',
      cancellationFee,
      cancelledAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    // Update driver status if driver was assigned
    if (deliveryData.driverId) {
      await db.collection('drivers').doc(deliveryData.driverId).update({
        currentDeliveryId: null,
        isAvailable: true,
        updatedAt: FieldValue.serverTimestamp()
      });
    }

    // Create cancellation record
    await db.collection('cancellations').add({
      deliveryId: id,
      senderId: deliveryData.senderId,
      driverId: deliveryData.driverId || null,
      cancelledBy,
      reason: reason || 'No reason provided',
      cancellationFee,
      createdAt: FieldValue.serverTimestamp()
    });

    logger.info(`Delivery ${id} cancelled by ${cancelledBy}`);

    res.status(200).json({
      success: true,
      message: 'Delivery cancelled successfully',
      cancellationFee: cancellationFee > 0 ? Math.round(cancellationFee * 100) / 100 : 0
    });
  } catch (error) {
    logger.error('Error cancelling delivery:', error);
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