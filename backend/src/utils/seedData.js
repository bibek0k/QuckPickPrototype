/**
 * Seed Data Generator
 * Creates mock users and drivers for testing
 */

const { db, auth, FieldValue } = require('../config/firebase');
const logger = require('./logger');

// GPS Coordinates for three towns in Tripura
const TOWN_COORDINATES = {
  kailashahar: { lat: 24.3300, lng: 92.0100 },
  dharmanagar: { lat: 24.3667, lng: 92.1667 },
  kumarghat: { lat: 24.0833, lng: 91.7833 }
};

// Helper function to generate random coordinate near a town
function generateNearbyCoordinate(townCoord, radiusKm = 2) {
  const kmInDegrees = 0.009; // Approximately 1km
  const randomLat = townCoord.lat + (Math.random() - 0.5) * radiusKm * kmInDegrees;
  const randomLng = townCoord.lng + (Math.random() - 0.5) * radiusKm * kmInDegrees;
  return { latitude: randomLat, longitude: randomLng };
}

/**
 * Create mock users
 */
async function createMockUsers() {
  logger.info('Creating mock users...');

  const mockUsers = [
    {
      phoneNumber: '+919876543210',
      name: 'Amit Kumar',
      town: 'kailashahar',
      language: 'en',
      emergencyContact: { name: 'Priya Kumar', phone: '+919876543211', relationship: 'Spouse' }
    },
    {
      phoneNumber: '+919876543212',
      name: 'Rajesh Das',
      town: 'dharmanagar',
      language: 'bn',
      emergencyContact: { name: 'Suman Das', phone: '+919876543213', relationship: 'Sibling' }
    },
    {
      phoneNumber: '+919876543214',
      name: 'Sneha Sharma',
      town: 'kumarghat',
      language: 'en',
      emergencyContact: { name: 'Vikram Sharma', phone: '+919876543215', relationship: 'Parent' }
    },
    {
      phoneNumber: '+919876543216',
      name: 'Pradeep Roy',
      town: 'kailashahar',
      language: 'bn',
      emergencyContact: { name: 'Anita Roy', phone: '+919876543217', relationship: 'Spouse' }
    },
    {
      phoneNumber: '+919876543218',
      name: 'Kavita Deb',
      town: 'dharmanagar',
      language: 'en',
      emergencyContact: { name: 'Rohit Deb', phone: '+919876543219', relationship: 'Sibling' }
    },
    {
      phoneNumber: '+919876543220',
      name: 'Suresh Tripura',
      town: 'kumarghat',
      language: 'bn',
      emergencyContact: { name: 'Meena Tripura', phone: '+919876543221', relationship: 'Spouse' }
    },
    {
      phoneNumber: '+919876543222',
      name: 'Anjali Chakraborty',
      town: 'kailashahar',
      language: 'en',
      emergencyContact: { name: 'Biplab Chakraborty', phone: '+919876543223', relationship: 'Parent' }
    },
    {
      phoneNumber: '+919876543224',
      name: 'Ravi Sarkar',
      town: 'dharmanagar',
      language: 'bn',
      emergencyContact: { name: 'Monika Sarkar', phone: '+919876543225', relationship: 'Spouse' }
    },
    {
      phoneNumber: '+919876543226',
      name: 'Deepa Nath',
      town: 'kumarghat',
      language: 'en',
      emergencyContact: { name: 'Arun Nath', phone: '+919876543227', relationship: 'Sibling' }
    },
    {
      phoneNumber: '+919876543228',
      name: 'Manish Debnath',
      town: 'kailashahar',
      language: 'bn',
      emergencyContact: { name: 'Rina Debnath', phone: '+919876543229', relationship: 'Spouse' }
    }
  ];

  for (const mockUser of mockUsers) {
    try {
      // Create Firebase Auth user
      let userRecord;
      try {
        userRecord = await auth.getUserByPhoneNumber(mockUser.phoneNumber);
      } catch (error) {
        if (error.code === 'auth/user-not-found') {
          userRecord = await auth.createUser({
            phoneNumber: mockUser.phoneNumber,
            displayName: mockUser.name
          });
        } else {
          throw error;
        }
      }

      // Create Firestore user document
      await db.collection('users').doc(userRecord.uid).set({
        uid: userRecord.uid,
        phoneNumber: mockUser.phoneNumber,
        name: mockUser.name,
        role: 'user',
        language: mockUser.language,
        emergencyContact: mockUser.emergencyContact,
        createdAt: FieldValue.serverTimestamp(),
        isActive: true,
        ageVerified: true,
        termsAccepted: {
          version: '1.0',
          timestamp: FieldValue.serverTimestamp()
        },
        privacyAccepted: {
          version: '1.0',
          timestamp: FieldValue.serverTimestamp()
        }
      });

      logger.info(`Created user: ${mockUser.name} (${mockUser.phoneNumber})`);
    } catch (error) {
      logger.error(`Error creating user ${mockUser.name}:`, error);
    }
  }
}

/**
 * Create mock drivers
 */
async function createMockDrivers() {
  logger.info('Creating mock drivers...');

  const vehicleTypes = ['bike', 'bike', 'bike', 'bike', 'bike', 'auto', 'auto', 'auto', 'auto', 'auto', 'car', 'car', 'car', 'car', 'car'];
  const towns = ['kailashahar', 'dharmanagar', 'kumarghat'];

  const mockDrivers = [
    { name: 'Bikash Das', phone: '+919876544001', vehicle: { make: 'Hero', model: 'Splendor', number: 'TR-07-A-1001', color: 'Black', year: 2020 } },
    { name: 'Dipak Roy', phone: '+919876544002', vehicle: { make: 'Bajaj', model: 'Pulsar', number: 'TR-07-B-1002', color: 'Blue', year: 2021 } },
    { name: 'Kamal Tripura', phone: '+919876544003', vehicle: { make: 'Honda', model: 'Shine', number: 'TR-07-C-1003', color: 'Red', year: 2019 } },
    { name: 'Sanjoy Deb', phone: '+919876544004', vehicle: { make: 'TVS', model: 'Apache', number: 'TR-07-D-1004', color: 'White', year: 2022 } },
    { name: 'Uttam Sarkar', phone: '+919876544005', vehicle: { make: 'Yamaha', model: 'FZ', number: 'TR-07-E-1005', color: 'Grey', year: 2020 } },

    { name: 'Ramesh Kumar', phone: '+919876544006', vehicle: { make: 'Bajaj', model: 'Auto', number: 'TR-07-F-2001', color: 'Yellow', year: 2018 } },
    { name: 'Gopal Nath', phone: '+919876544007', vehicle: { make: 'Piaggio', model: 'Ape', number: 'TR-07-G-2002', color: 'Green', year: 2019 } },
    { name: 'Mohan Chakma', phone: '+919876544008', vehicle: { make: 'Bajaj', model: 'Auto', number: 'TR-07-H-2003', color: 'Yellow', year: 2020 } },
    { name: 'Nitai Paul', phone: '+919876544009', vehicle: { make: 'Piaggio', model: 'Ape', number: 'TR-07-I-2004', color: 'Green', year: 2021 } },
    { name: 'Subhash Mog', phone: '+919876544010', vehicle: { make: 'Bajaj', model: 'Auto', number: 'TR-07-J-2005', color: 'Yellow', year: 2017 } },

    { name: 'Ajay Singh', phone: '+919876544011', vehicle: { make: 'Maruti', model: 'Swift', number: 'TR-07-K-3001', color: 'White', year: 2021 } },
    { name: 'Vijay Sharma', phone: '+919876544012', vehicle: { make: 'Hyundai', model: 'i10', number: 'TR-07-L-3002', color: 'Silver', year: 2020 } },
    { name: 'Prakash Roy', phone: '+919876544013', vehicle: { make: 'Tata', model: 'Tiago', number: 'TR-07-M-3003', color: 'Blue', year: 2022 } },
    { name: 'Anil Deb', phone: '+919876544014', vehicle: { make: 'Maruti', model: 'WagonR', number: 'TR-07-N-3004', color: 'Grey', year: 2019 } },
    { name: 'Sunil Das', phone: '+919876544015', vehicle: { make: 'Hyundai', model: 'Santro', number: 'TR-07-O-3005', color: 'Red', year: 2021 } }
  ];

  for (let i = 0; i < mockDrivers.length; i++) {
    const mockDriver = mockDrivers[i];
    const vehicleType = vehicleTypes[i];
    const town = towns[i % 3];
    const townCoord = TOWN_COORDINATES[town];
    const currentLocation = generateNearbyCoordinate(townCoord);

    try {
      // Create Firebase Auth user
      let userRecord;
      try {
        userRecord = await auth.getUserByPhoneNumber(mockDriver.phone);
      } catch (error) {
        if (error.code === 'auth/user-not-found') {
          userRecord = await auth.createUser({
            phoneNumber: mockDriver.phone,
            displayName: mockDriver.name
          });
        } else {
          throw error;
        }
      }

      // Create Firestore user document
      await db.collection('users').doc(userRecord.uid).set({
        uid: userRecord.uid,
        phoneNumber: mockDriver.phone,
        name: mockDriver.name,
        role: 'driver',
        language: 'en',
        createdAt: FieldValue.serverTimestamp(),
        isActive: true,
        ageVerified: true
      });

      // Create driver document
      await db.collection('drivers').doc(userRecord.uid).set({
        userId: userRecord.uid,
        verified: true, // Auto-verified for testing
        verificationStatus: 'approved',
        availabilityStatus: 'available',
        currentLocation: new db._firestore.GeoPoint(currentLocation.latitude, currentLocation.longitude),
        lastLocationUpdate: FieldValue.serverTimestamp(),
        vehicleType: vehicleType,
        vehicleDetails: mockDriver.vehicle,
        documents: {
          governmentId: { url: 'mock://driver_id.jpg', type: 'aadhaar', uploadedAt: FieldValue.serverTimestamp() },
          drivingLicense: { url: 'mock://license.jpg', number: `DL-07-${1000 + i}`, expiryDate: new Date(2026, 11, 31), uploadedAt: FieldValue.serverTimestamp() },
          vehicleRC: { url: 'mock://rc.jpg', uploadedAt: FieldValue.serverTimestamp() },
          insuranceDoc: { url: 'mock://insurance.jpg', uploadedAt: FieldValue.serverTimestamp() }
        },
        insurance: {
          policyNumber: `INS-${10000 + i}`,
          provider: 'National Insurance',
          expiryDate: new Date(2025, 11, 31),
          type: vehicleType === 'car' ? 'commercial' : 'personal'
        },
        commercialVehicleRegistration: vehicleType === 'auto',
        backgroundCheckStatus: 'cleared',
        rating: 4.5 + Math.random() * 0.5, // 4.5-5.0
        totalRides: Math.floor(Math.random() * 200) + 50,
        totalDeliveries: Math.floor(Math.random() * 100) + 20,
        earnings: Math.floor(Math.random() * 50000) + 10000,
        joiningDate: FieldValue.serverTimestamp()
      });

      logger.info(`Created driver: ${mockDriver.name} (${vehicleType}, ${town})`);
    } catch (error) {
      logger.error(`Error creating driver ${mockDriver.name}:`, error);
    }
  }
}

/**
 * Create admin user
 */
async function createAdminUser() {
  logger.info('Creating admin user...');

  const adminPhone = '+919876540001';
  const adminName = 'Admin User';

  try {
    let userRecord;
    try {
      userRecord = await auth.getUserByPhoneNumber(adminPhone);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        userRecord = await auth.createUser({
          phoneNumber: adminPhone,
          displayName: adminName,
          email: 'admin@quickpickup.com'
        });
      } else {
        throw error;
      }
    }

    await db.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      phoneNumber: adminPhone,
      email: 'admin@quickpickup.com',
      name: adminName,
      role: 'admin',
      language: 'en',
      createdAt: FieldValue.serverTimestamp(),
      isActive: true,
      ageVerified: true
    });

    logger.info(`Created admin user: ${adminName} (${adminPhone})`);
  } catch (error) {
    logger.error('Error creating admin user:', error);
  }
}

/**
 * Main function to seed all data
 */
async function seedAllData() {
  try {
    logger.info('Starting data seeding...');

    await createAdminUser();
    await createMockUsers();
    await createMockDrivers();

    logger.info('Data seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('Error seeding data:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  seedAllData();
}

module.exports = {
  createMockUsers,
  createMockDrivers,
  createAdminUser,
  seedAllData
};
